package types

// HighlightedSection represents a user-highlighted text span sent with compact requests.
type HighlightedSection struct {
	Color       string `json:"color"`
	Text        string `json:"text"`
	MessageRole string `json:"message_role"`
}

// CompactInsightRequest is the payload for POST /projects/{id}/insights/compact.
type CompactInsightRequest struct {
	Messages            []CompactMessage    `json:"messages"`
	Provider            string              `json:"provider"`
	Model               string              `json:"model"`
	APIKey              string              `json:"api_key"`
	SourceAgent         string              `json:"source_agent"`
	HighlightColorsUsed []string            `json:"highlight_colors_used"`
	HighlightedSections []HighlightedSection `json:"highlighted_sections,omitempty"`
}

// CompactMessage is a simplified message for the compact endpoint (no tool fields).
type CompactMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompactInsightLLMResponse is the structured JSON the LLM returns.
type CompactInsightLLMResponse struct {
	Title          string   `json:"title"`
	OriginContext  string   `json:"origin_context"`
	ExtractedIdea  string   `json:"extracted_idea"`
	Tags           []string `json:"tags"`
}

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
