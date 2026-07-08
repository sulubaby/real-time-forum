package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/mail"
	"real/database"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Nickname  string `json:"nickname"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Age       int    `json:"age"`
	Gender    string `json:"gender"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type LoginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

func generateSessionToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func writeJSON(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"message": "` + msg + `"}`))
}

func isValidEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return false
	}
	parts := strings.Split(addr.Address, "@")
	if len(parts) != 2 {
		return false
	}
	domain := parts[1]
	return strings.Contains(domain, ".") && !strings.HasSuffix(domain, ".")
}

var nicknameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
var nameRegex = regexp.MustCompile(`^[a-zA-Z]+$`)

func validateRegister(req RegisterRequest) string {
	if strings.TrimSpace(req.Nickname) == "" || utf8.RuneCountInString(req.Nickname) > 20 {
		return "Nickname is required and must be under 20 characters"
	}
	if !nicknameRegex.MatchString(req.Nickname) {
		return "Nickname can only contain English letters, numbers, and underscores"
	}
	if strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" {
		return "First and last name are required"
	}
	if !nameRegex.MatchString(req.FirstName) || !nameRegex.MatchString(req.LastName) {
		return "Names can only contain English letters"
	}
	if req.Age < 13 || req.Age > 80 {
		return "Age must be between 13 and 80"
	}
	if req.Gender != "Male" && req.Gender != "Female" && req.Gender != "Other" {
		return "Invalid gender"
	}
	if !isValidEmail(req.Email) {
		return "Invalid email address"
	}
	if utf8.RuneCountInString(req.Password) < 8 || utf8.RuneCountInString(req.Password) > 30 {
		return "Password must be between 8 and 30 characters"
	}
	return ""
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	if msg := validateRegister(req); msg != "" {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	query := `INSERT INTO users (nickname, first_name, last_name, age, email, gender, password) 
	          VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err = database.DB.Exec(query, req.Nickname, req.FirstName, req.LastName, req.Age, req.Email, req.Gender, string(hashedPassword))
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			http.Error(w, "Nickname or Email already taken", http.StatusConflict)
		} else {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	writeJSON(w, http.StatusCreated, "Registration successful")
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Identifier) == "" || strings.TrimSpace(req.Password) == "" {
		http.Error(w, "Identifier and password are required", http.StatusBadRequest)
		return
	}

	var dbID int
	var dbPassword string
	query := `SELECT id, password FROM users WHERE nickname = ? OR email = ?`

	err := database.DB.QueryRow(query, req.Identifier, req.Identifier).Scan(&dbID, &dbPassword)
	if err != nil {
		http.Error(w, "Invalid nickname/email or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(dbPassword), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid nickname/email or password", http.StatusUnauthorized)
		return
	}

	sessionToken, err := generateSessionToken()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	expiresAt := time.Now().Add(12 * time.Hour)

	database.DB.Exec(`DELETE FROM sessions WHERE user_id = ?`, dbID)

	sessionQuery := `INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)`
	if _, err = database.DB.Exec(sessionQuery, sessionToken, dbID, expiresAt); err != nil {
		http.Error(w, "Internal server error creating session", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "forum_session",
		Value:    sessionToken,
		Expires:  expiresAt,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, "Login successful")
}

func GetUserFromSession(r *http.Request) (int, bool) {
	cookie, err := r.Cookie("forum_session")
	if err != nil {
		return 0, false
	}

	var userID int
	var expiresAt time.Time

	query := `SELECT user_id, expires_at FROM sessions WHERE session_token = ?`
	err = database.DB.QueryRow(query, cookie.Value).Scan(&userID, &expiresAt)
	if err != nil {
		return 0, false
	}

	if time.Now().After(expiresAt) {
		go func() {
			database.DB.Exec(`DELETE FROM sessions WHERE session_token = ?`, cookie.Value)
		}()
		return 0, false
	}

	return userID, true
}
