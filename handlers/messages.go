package handlers

import (
	"encoding/json"
	"net/http"
	"real/database"
	"strconv"
)

const messagePageSize = 10

type ChatMessage struct {
	ID         int    `json:"id"`
	SenderID   int    `json:"senderId"`
	ReceiverID int    `json:"receiverId"`
	Sender     string `json:"sender"`
	Content    string `json:"content"`
	CreatedAt  string `json:"createdAt"`
}

func MessagesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUser := r.Context().Value(UserIDKey).(int)
	otherUser, err := strconv.Atoi(r.URL.Query().Get("user_id"))
	if err != nil || otherUser <= 0 || otherUser == currentUser {
		http.Error(w, "Invalid user", http.StatusBadRequest)
		return
	}

	beforeID, _ := strconv.Atoi(r.URL.Query().Get("before_id"))
	query := `
		SELECT m.id, m.sender_id, m.receiver_id, u.nickname, m.content, m.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR
		       (m.sender_id = ? AND m.receiver_id = ?))`
	args := []interface{}{currentUser, otherUser, otherUser, currentUser}
	if beforeID > 0 {
		query += ` AND m.id < ?`
		args = append(args, beforeID)
	}
	query += ` ORDER BY m.id DESC LIMIT ?`
	args = append(args, messagePageSize)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, "Could not load messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	desc := []ChatMessage{}
	for rows.Next() {
		var message ChatMessage
		if err := rows.Scan(&message.ID, &message.SenderID, &message.ReceiverID, &message.Sender, &message.Content, &message.CreatedAt); err == nil {
			desc = append(desc, message)
		}
	}

	messages := make([]ChatMessage, len(desc))
	for i := range desc {
		messages[len(desc)-1-i] = desc[i]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": messages,
		"hasMore":  len(messages) == messagePageSize,
	})
}
