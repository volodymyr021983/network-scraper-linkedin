package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/pocketbase/pocketbase"
	"google.golang.org/genai"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading env file")
	}
	APIKEY := os.Getenv("GEMINI_APIKEY")
	app := pocketbase.New()

	ctx := context.Background()
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  APIKEY,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		log.Fatal(err)
	}
	reg_routes(app, client, ctx)

	if err := app.Start(); err != nil {
		fmt.Println("PocketBase error:", err)
	}

}
