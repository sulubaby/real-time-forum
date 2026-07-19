package handlers

import (
	"encoding/json"
	"net/http"
	"real/database"
	"strconv"
	"strings"
)

type CreateCommentRequest struct {
	PostID  int    `json:"postId"`
	Content string `json:"content"`
}

type CommentResponse struct {
	ID           int    `json:"id"`
	PostID       int    `json:"postId"`
	UserID       int    `json:"userId"`
	Author       string `json:"author"`
	Content      string `json:"content"`
	CreatedAt    string `json:"createdAt"`
	LikeCount    int    `json:"likeCount"`
	DislikeCount int    `json:"dislikeCount"`
	UserReaction string `json:"userReaction"`
}

func CreateCommentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Context().Value(UserIDKey).(int)

	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	result, err := database.DB.Exec(
		`INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
		req.PostID, userID, req.Content,
	)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	commentID, err := result.LastInsertId()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Comment created",
		"id":      commentID,
	})
}

func GetCommentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Context().Value(UserIDKey).(int)

	postIDStr := r.URL.Query().Get("post_id")
	if postIDStr == "" {
		http.Error(w, "Post ID required", http.StatusBadRequest)
		return
	}
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(`
		SELECT c.id, c.post_id, c.user_id, u.nickname, c.content, c.created_at,
			(SELECT COUNT(*) FROM reactions_comments WHERE comment_id = c.id AND reaction_type = 'like'),
			(SELECT COUNT(*) FROM reactions_comments WHERE comment_id = c.id AND reaction_type = 'dislike'),
			COALESCE((SELECT reaction_type FROM reactions_comments WHERE comment_id = c.id AND user_id = ?), '')
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC
	`, userID, postID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comments := []CommentResponse{}
	for rows.Next() {
		var cm CommentResponse
		if err := rows.Scan(&cm.ID, &cm.PostID, &cm.UserID, &cm.Author, &cm.Content, &cm.CreatedAt, &cm.LikeCount, &cm.DislikeCount, &cm.UserReaction); err != nil {
			continue
		}
		comments = append(comments, cm)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

func CommentsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetCommentsHandler(w, r)
	case http.MethodPost:
		CreateCommentHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
