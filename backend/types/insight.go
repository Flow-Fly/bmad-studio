package types

// Insight represents a structured knowledge extract from a conversation.
type Insight struct {
	ID                  string   `json:"id"`
	Title               string   `json:"title"`
	OriginContext       string   `json:"origin_context"`
	ExtractedIdea       string   `json:"extracted_idea"`
	Tags                []string `json:"tags"`
	HighlightColorsUsed []string `json:"highlight_colors_used"`
	CreatedAt           string   `json:"created_at"`
	SourceAgent         string   `json:"source_agent"`
	Status              string   `json:"status"`
	UsedInCount         int      `json:"used_in_count"`
}
