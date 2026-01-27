package main

import (
	"log"
	"net/http"

	"bmad-studio/backend/api"
)

func main() {
	router := api.NewRouter()

	log.Println("Starting BMAD Studio backend on http://localhost:3008")
	if err := http.ListenAndServe(":3008", router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
