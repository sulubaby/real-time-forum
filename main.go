package main

import (
	"fmt"
	"log"
	"net/http"
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
	http.Handle("/", fileServer)

	http.HandleFunc("/api/register", handlers.RegisterHandler)
	http.HandleFunc("/api/login", handlers.LoginHandler)
	http.HandleFunc("/api/logout", handlers.LogoutHandler)
	http.HandleFunc("/api/me", handlers.MeHandler)
	http.HandleFunc("/api/categories", handlers.AuthMiddleware(handlers.GetCategoriesHandler))
	http.HandleFunc("/api/posts", handlers.AuthMiddleware(handlers.PostsHandler))
	http.HandleFunc("/api/post", handlers.AuthMiddleware(handlers.GetPostHandler))
	http.HandleFunc("/api/comments", handlers.AuthMiddleware(handlers.CommentsHandler))
	http.HandleFunc("/api/users", handlers.AuthMiddleware(handlers.GetUsersHandler))
	http.HandleFunc("/api/reactions", handlers.AuthMiddleware(handlers.ToggleReactionHandler))

	fmt.Println("Server is running smoothly on http://localhost:8080")
	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
