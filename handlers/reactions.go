package handlers

import (
	"encoding/json"
	"net/http"
	"real/database"
)

type ReactionRequest struct {
	TargetType   string `json:"targetType"`
	TargetID     int    `json:"targetId"`
	ReactionType string `json:"reactionType"`
}

func ToggleReactionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Context().Value(UserIDKey).(int)

	var req ReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TargetType != "post" && req.TargetType != "comment" {
		http.Error(w, "Invalid target type", http.StatusBadRequest)
		return
	}
	if req.ReactionType != "like" && req.ReactionType != "dislike" {
		http.Error(w, "Invalid reaction type", http.StatusBadRequest)
		return
	}

	var table, idCol string
	if req.TargetType == "post" {
		table = "reactions_posts"
		idCol = "post_id"
	} else {
		table = "reactions_comments"
		idCol = "comment_id"
	}

	var existingType string
	err := database.DB.QueryRow(
		"SELECT reaction_type FROM "+table+" WHERE "+idCol+" = ? AND user_id = ?",
		req.TargetID, userID,
	).Scan(&existingType)

	if err == nil {
		if existingType == req.ReactionType {
			database.DB.Exec("DELETE FROM "+table+" WHERE "+idCol+" = ? AND user_id = ?", req.TargetID, userID)
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"action": "removed"})
			return
		}
		database.DB.Exec("UPDATE "+table+" SET reaction_type = ? WHERE "+idCol+" = ? AND user_id = ?", req.ReactionType, req.TargetID, userID)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"action": "updated"})
		return
	}

	_, err = database.DB.Exec(
		"INSERT INTO "+table+" ("+idCol+", user_id, reaction_type) VALUES (?, ?, ?)",
		req.TargetID, userID, req.ReactionType,
	)
	if err != nil {
		http.Error(w, "Failed to add reaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"action": "created"})
}
