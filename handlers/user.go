package handlers

import (
	"encoding/json"
	"net/http"
	"real/database"
)

type UserInfo struct {
	ID        int    `json:"id"`
	Nickname  string `json:"nickname"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Age       int    `json:"age"`
	Email     string `json:"email"`
	Gender    string `json:"gender"`
}

func MeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := GetUserFromSession(r)
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var user UserInfo
	err := database.DB.QueryRow(
		`SELECT id, nickname, first_name, last_name, age, email, gender FROM users WHERE id = ?`,
		userID,
	).Scan(&user.ID, &user.Nickname, &user.FirstName, &user.LastName, &user.Age, &user.Email, &user.Gender)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
