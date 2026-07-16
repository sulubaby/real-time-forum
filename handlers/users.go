package handlers

import (
	"encoding/json"
	"net/http"
	"real/database"
)

type UserListItem struct {
	ID          int    `json:"id"`
	Nickname    string `json:"nickname"`
	Online      bool   `json:"online"`
	LastMessage string `json:"lastMessage,omitempty"`
}

func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUser := r.Context().Value(UserIDKey).(int)
	rows, err := database.DB.Query(`
		SELECT u.id, u.nickname,
			COALESCE((SELECT MAX(created_at) FROM messages
				WHERE (sender_id = ? AND receiver_id = u.id)
				   OR (sender_id = u.id AND receiver_id = ?)), '') as last_message
		FROM users u
		WHERE u.id != ?
		ORDER BY
			CASE WHEN last_message != '' THEN 0 ELSE 1 END,
			last_message DESC,
			u.nickname ASC
	`, currentUser, currentUser, currentUser)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []UserListItem{}
	for rows.Next() {
		var u UserListItem
		if err := rows.Scan(&u.ID, &u.Nickname, &u.LastMessage); err != nil {
			continue
		}

		clientsMu.RLock()
		_, u.Online = clients[u.ID]
		clientsMu.RUnlock()

		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
