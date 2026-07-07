package database

import (
	"database/sql"
	"os"

	_ "github.com/mattn/go-sqlite3" 
)

var DB *sql.DB

func InitDB() error {
	var err error
	
	DB, err = sql.Open("sqlite3", "./database/forum.db")
	if err != nil {
		return err
	}

	if err = DB.Ping(); err != nil {
		return err
	}

	query, err := os.ReadFile("./queries/tables.sql")
	if err != nil {
		return err
	}

	_, err = DB.Exec(string(query))
	if err != nil {
		return err
	}

	return nil
}