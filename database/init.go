package database

import (
	"database/sql"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() error {
	var err error

	DB, err = sql.Open("sqlite", "./database/forum.db?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return err
	}

	if err = DB.Ping(); err != nil {
		return err
	}

	DB.Exec("PRAGMA foreign_keys = ON")

	query, err := os.ReadFile("./queries/tables.sql")
	if err != nil {
		return err
	}

	_, err = DB.Exec(string(query))
	if err != nil {
		return err
	}

	seedCategories()
	return nil
}

func seedCategories() {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if err != nil {
		log.Printf("Warning: could not count categories: %v", err)
	}
	if count > 8 {
		return
	}
	categories := []string{"General", "Technology", "Sports", "Entertainment", "Science", "Art", "Music", "Gaming", "Others"}
	for _, name := range categories {
		_, err := DB.Exec("INSERT OR IGNORE INTO categories (name) VALUES ('" + name + "')")
		if err != nil {
			log.Printf("Warning: could not seed category '%s': %v", name, err)
		}
	}
}
