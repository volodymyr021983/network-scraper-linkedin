package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"google.golang.org/genai"
)

func reg_routes(app *pocketbase.PocketBase, client *genai.Client, ctx context.Context) {

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/CreateCandidate", func(e *core.RequestEvent) error {
			if e.Auth == nil || e.Auth.Id == "" {
				fmt.Println("not authed")
				return e.JSON(401, "Unauthorized")
			}
			body := e.Request.Body

			bodyBytes, err := io.ReadAll(body)
			if err != nil {
				fmt.Println("Error during reading")
				return err
			}
			result, err := client.Models.GenerateContent(ctx, "gemini-2.5-flash",
				genai.Text(fmt.Sprintf("You are given a JSON object containing a LinkedIn user profile: %s 1. Analyze the profile and write an objective overview of the candidate in **no more than 6 sentences**, with **no embellishment**, **no assumptions**, and **no fabricated information**. 2. Extract the user's **programming languages and frameworks only** from the **skills** and **about** sections (if they exists) of the provided JSON.Do not include soft skills, tools, certificates, or anything that is not a programming language, database or framework.4.Extract country and city from the location field.5.Extract the year when this person started their career (the year they got their first job). Return only the year as a four-digit number.Your response must be a **JSON object only**, with the following structure:{ overview: text key_skills: [skill1, skill2, ...] url: url career_start_year: career start year country: country city: city img_url: img_url. Output must be in **English**.", string(bodyBytes))),
				nil)
			if err != nil {
				fmt.Println("Error during generation of the promt")
				return err
			}

			var llm LLMResponse
			fmt.Println(result.Text())
			re := regexp.MustCompile(`\{[\s\S]*\}`)
			jsonStr := re.FindString(result.Text())
			if jsonStr == "" {
				e.Response.WriteHeader(500)
				return errors.New("error during regex")
			}

			bytellm := []byte(jsonStr)
			err = json.Unmarshal(bytellm, &llm)
			if err != nil {
				fmt.Println("error during unmarhsaling")
				e.Response.WriteHeader(500)
				return err
			}

			for i := range llm.KeySkills {
				llm.KeySkills[i] = strings.ToLower(llm.KeySkills[i])
			}

			err = AddCandidateTags(app, &llm, e.Auth.Id)
			if err != nil {
				e.Response.WriteHeader(500)
				return err
			}

			e.Response.Write(bytellm)
			e.Response.WriteHeader(200)
			return nil
		})

		return se.Next()
	})
}
func AddCandidateTags(app *pocketbase.PocketBase, llmressponse *LLMResponse, user_id string) error {

	tagColl, err := app.FindCollectionByNameOrId("Tags")
	CandColl, err := app.FindCollectionByNameOrId("Candidate")
	if err != nil {
		return err
	}
	tagsIds := make([]string, len(llmressponse.KeySkills))
	for i, sk := range llmressponse.KeySkills {
		record, err := app.FindFirstRecordByData("Tags", "label", sk)
		if err != nil {
			if err == sql.ErrNoRows {
				record = core.NewRecord(tagColl)
				record.Set("label", sk)
				err = app.Save(record)
				if err != nil {
					return err
				}
			} else {
				return err
			}
		}
		tagsIds[i] = record.Id
	}

	record, err := app.FindFirstRecordByData("Candidate", "linkedin", llmressponse.Url)
	if err != nil {
		if err == sql.ErrNoRows {
			record = core.NewRecord(CandColl)
		} else {
			return err
		}
	}

	addedby := record.GetStringSlice("added_by")
	addedby = append(addedby, user_id)

	record.Set("added_by", addedby)
	record.Set("career_start_year", llmressponse.Start_year)
	record.Set("linkedin", llmressponse.Url)
	record.Set("profile_overview", llmressponse.Overview)
	record.Set("tags", tagsIds)
	record.Set("country", llmressponse.Country)
	record.Set("city", llmressponse.City)
	err = app.Save(record)
	if err != nil {
		return err
	}
	return nil
}

type LLMResponse struct {
	Overview   string   `json:"overview"`
	Url        string   `json:"url"`
	KeySkills  []string `json:"key_skills"`
	Country    string   `json:"country"`
	City       string   `json:"city"`
	Img_url    string   `json:"img_url"`
	Start_year int      `json:"career_start_year"`
}
