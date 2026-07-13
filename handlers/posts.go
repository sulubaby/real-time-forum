package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"real/database"
	"strconv"
	"strings"
	"time"
)

type CreatePostRequest struct {
	Content     string `json:"content"`
	CategoryIDs []int  `json:"categoryIds"`
}

type PostResponse struct {
	ID           int               `json:"id"`
	UserID       int               `json:"userId"`
	Author       string            `json:"author"`
	Content      string            `json:"content"`
	CreatedAt    string            `json:"createdAt"`
	Categories   []Category        `json:"categories"`
	CommentCount int               `json:"commentCount"`
	LikeCount    int               `json:"likeCount"`
	DislikeCount int               `json:"dislikeCount"`
	UserReaction string            `json:"userReaction"`
	Comments     []CommentResponse `json:"comments,omitempty"`
}

func CreatePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Context().Value(UserIDKey).(int)

	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}
	if len(req.CategoryIDs) == 0 {
		http.Error(w, "At least one category is required", http.StatusBadRequest)
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec(`INSERT INTO posts (user_id, content) VALUES (?, ?)`, userID, req.Content)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	postID, err := result.LastInsertId()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	for _, catID := range req.CategoryIDs {
		_, err := tx.Exec(`INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)`, postID, catID)
		if err != nil {
			http.Error(w, "Invalid category ID", http.StatusBadRequest)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var nickname string
	database.DB.QueryRow(`SELECT nickname FROM users WHERE id = ?`, userID).Scan(&nickname)

	Broadcast("new_post", map[string]interface{}{
		"id":           postID,
		"userId":       userID,
		"author":       nickname,
		"content":      req.Content,
		"createdAt":    time.Now().Format("2006-01-02 15:04:05"),
		"categoryIds":  req.CategoryIDs,
		"commentCount": 0,
		"likeCount":    0,
		"dislikeCount": 0,
		"userReaction": "",
	})

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Post created",
		"id":      postID,
	})
}

func GetPostsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Context().Value(UserIDKey).(int)
	catParam := r.URL.Query().Get("categories")

	query := `
		SELECT p.id, p.user_id, u.nickname, p.content, p.created_at,
			(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id),
			(SELECT COUNT(*) FROM reactions_posts WHERE post_id = p.id AND reaction_type = 'like'),
			(SELECT COUNT(*) FROM reactions_posts WHERE post_id = p.id AND reaction_type = 'dislike'),
			COALESCE((SELECT reaction_type FROM reactions_posts WHERE post_id = p.id AND user_id = ?), '')
		FROM posts p
		JOIN users u ON p.user_id = u.id
	`

	args := []interface{}{userID}

	if catParam != "" {
		parts := strings.Split(catParam, ",")
		placeholders := make([]string, 0, len(parts))
		for _, s := range parts {
			id, err := strconv.Atoi(strings.TrimSpace(s))
			if err != nil {
				continue
			}
			placeholders = append(placeholders, "?")
			args = append(args, id)
		}
		if len(placeholders) > 0 {
			query += fmt.Sprintf(
				` WHERE p.id IN (SELECT pc.post_id FROM post_categories pc WHERE pc.category_id IN (%s))`,
				strings.Join(placeholders, ","),
			)
		}
	}

	query += ` ORDER BY p.created_at DESC`

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	posts := []PostResponse{}
	for rows.Next() {
		var p PostResponse
		if err := rows.Scan(&p.ID, &p.UserID, &p.Author, &p.Content, &p.CreatedAt, &p.CommentCount, &p.LikeCount, &p.DislikeCount, &p.UserReaction); err != nil {
			continue
		}

		catRows, err := database.DB.Query(`
			SELECT c.id, c.name FROM categories c
			JOIN post_categories pc ON c.id = pc.category_id
			WHERE pc.post_id = ?
		`, p.ID)
		if err == nil {
			for catRows.Next() {
				var cat Category
				if catRows.Scan(&cat.ID, &cat.Name) == nil {
					p.Categories = append(p.Categories, cat)
				}
			}
			catRows.Close()
		}

		posts = append(posts, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func GetPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.Context().Value(UserIDKey).(int)

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "Post ID required", http.StatusBadRequest)
		return
	}
	postID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var p PostResponse
	err = database.DB.QueryRow(`
		SELECT p.id, p.user_id, u.nickname, p.content, p.created_at,
			(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id),
			(SELECT COUNT(*) FROM reactions_posts WHERE post_id = p.id AND reaction_type = 'like'),
			(SELECT COUNT(*) FROM reactions_posts WHERE post_id = p.id AND reaction_type = 'dislike'),
			COALESCE((SELECT reaction_type FROM reactions_posts WHERE post_id = p.id AND user_id = ?), '')
		FROM posts p
		JOIN users u ON p.user_id = u.id
		WHERE p.id = ?
	`, userID, postID).Scan(&p.ID, &p.UserID, &p.Author, &p.Content, &p.CreatedAt, &p.CommentCount, &p.LikeCount, &p.DislikeCount, &p.UserReaction)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	catRows, err := database.DB.Query(`
		SELECT c.id, c.name FROM categories c
		JOIN post_categories pc ON c.id = pc.category_id
		WHERE pc.post_id = ?
	`, p.ID)
	if err == nil {
		for catRows.Next() {
			var cat Category
			if catRows.Scan(&cat.ID, &cat.Name) == nil {
				p.Categories = append(p.Categories, cat)
			}
		}
		catRows.Close()
	}

	commentRows, err := database.DB.Query(`
		SELECT c.id, c.post_id, c.user_id, u.nickname, c.content, c.created_at,
			(SELECT COUNT(*) FROM reactions_comments WHERE comment_id = c.id AND reaction_type = 'like'),
			(SELECT COUNT(*) FROM reactions_comments WHERE comment_id = c.id AND reaction_type = 'dislike'),
			COALESCE((SELECT reaction_type FROM reactions_comments WHERE comment_id = c.id AND user_id = ?), '')
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC
	`, userID, p.ID)
	if err == nil {
		for commentRows.Next() {
			var cm CommentResponse
			if commentRows.Scan(&cm.ID, &cm.PostID, &cm.UserID, &cm.Author, &cm.Content, &cm.CreatedAt, &cm.LikeCount, &cm.DislikeCount, &cm.UserReaction) == nil {
				p.Comments = append(p.Comments, cm)
			}
		}
		commentRows.Close()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func PostsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetPostsHandler(w, r)
	case http.MethodPost:
		CreatePostHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}