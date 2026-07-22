package handlers

import (
	"encoding/json"
	"net/http"
	"real/database"
	"sort"
	"strings"
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
		ORDER BY u.nickname COLLATE NOCASE ASC
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

	sort.SliceStable(users, func(i, j int) bool {
		left, right := users[i], users[j]
		if left.Online != right.Online {
			return left.Online
		}
		if left.LastMessage != "" && right.LastMessage != "" && left.LastMessage != right.LastMessage {
			return left.LastMessage > right.LastMessage
		}
		if left.LastMessage != "" && right.LastMessage == "" {
			return true
		}
		if left.LastMessage == "" && right.LastMessage != "" {
			return false
		}
		return strings.ToLower(left.Nickname) < strings.ToLower(right.Nickname)
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
