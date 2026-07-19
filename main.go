package main

import (
	"fmt"
	"log"
	"net/http"
	"path"
	"real/database"
	"real/handlers"
)

func main() {
	fmt.Println("Initializing forum database...")

	err := database.InitDB()
	if err != nil {
		log.Fatalf("Error initializing database: %v", err)
	}
	defer database.DB.Close()
	fmt.Println("Database successfully initialized!")

	fileServer := http.FileServer(http.Dir("./frontend"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" || path.Ext(r.URL.Path) != "" {
			fileServer.ServeHTTP(w, r)
			return
		}
		// Let the SPA render its dedicated not-found view while retaining a real 404 status.
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		http.ServeFile(w, r, "./frontend/index.html")
	})

	http.HandleFunc("/api/register", handlers.APIHandler(handlers.RegisterHandler))
	http.HandleFunc("/api/login", handlers.APIHandler(handlers.LoginHandler))
	http.HandleFunc("/api/logout", handlers.APIHandler(handlers.LogoutHandler))
	http.HandleFunc("/api/me", handlers.APIHandler(handlers.MeHandler))
	http.HandleFunc("/api/categories", handlers.APIHandler(handlers.AuthMiddleware(handlers.GetCategoriesHandler)))
	http.HandleFunc("/api/posts", handlers.APIHandler(handlers.AuthMiddleware(handlers.PostsHandler)))
	http.HandleFunc("/api/post", handlers.APIHandler(handlers.AuthMiddleware(handlers.GetPostHandler)))
	http.HandleFunc("/api/comments", handlers.APIHandler(handlers.AuthMiddleware(handlers.CommentsHandler)))
	http.HandleFunc("/api/users", handlers.APIHandler(handlers.AuthMiddleware(handlers.GetUsersHandler)))
	http.HandleFunc("/api/messages", handlers.APIHandler(handlers.AuthMiddleware(handlers.MessagesHandler)))
	http.HandleFunc("/api/reactions", handlers.APIHandler(handlers.AuthMiddleware(handlers.ToggleReactionHandler)))
	http.HandleFunc("/ws", handlers.WebSocketHandler)

	fmt.Println("Server is running smoothly on http://localhost:8000")
	err = http.ListenAndServe(":8000", nil)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
