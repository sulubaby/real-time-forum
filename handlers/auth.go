package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"real/database"
	"time"

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

func generateSessionToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
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
		http.Error(w, "Nickname or Email already taken", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(`{"message": "Registration successful"}`))
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	var dbID int
	var dbPassword string
	query := `SELECT id, password FROM users WHERE nickname = ? OR email = ?`
	
	err = database.DB.QueryRow(query, req.Identifier, req.Identifier).Scan(&dbID, &dbPassword)
	if err != nil {
		http.Error(w, "Invalid nickname/email or password", http.StatusUnauthorized)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(dbPassword), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid nickname/email or password", http.StatusUnauthorized)
		return
	}

	sessionToken := generateSessionToken()
	expiresAt := time.Now().Add(12 * time.Hour) 

	database.DB.Exec(`DELETE FROM sessions WHERE user_id = ?`, dbID)

	sessionQuery := `INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)`
	_, err = database.DB.Exec(sessionQuery, sessionToken, dbID, expiresAt)
	if err != nil {
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

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Login successful"}`))
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