package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"bmad-studio/backend/providers"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"

	"github.com/google/uuid"
)

const compactSystemPrompt = `You are a conversation summarizer. Analyze the conversation below and extract a structured insight.

The user may have highlighted specific sections of the conversation. Highlight colors have semantic meaning:
- "interesting": Content the user found noteworthy or valuable
- "to-remember": Content the user wants to retain for future reference
- "disagree": Content the user disagrees with or wants to challenge
- "to-explore": Content the user wants to investigate further

Prioritize highlighted content in your summary — it reflects the user's focus and intent.

Return ONLY a JSON object with these fields:
- "title": A short, descriptive title (max 100 chars)
- "origin_context": The context/background that led to this conversation (1-3 sentences)
- "extracted_idea": The key insight, decision, or outcome from this conversation (1-5 sentences)
- "tags": An array of 2-5 relevant keyword tags (lowercase, no spaces)

Example response:
{"title":"Authentication flow redesign","origin_context":"Team discussed security concerns with the current session-based auth.","extracted_idea":"Decided to migrate to JWT tokens with refresh rotation. Key considerations: token expiry of 15min, refresh tokens stored httpOnly, blacklist for revoked tokens.","tags":["auth","jwt","security","backend"]}

Return ONLY the JSON object, no markdown fences or extra text.`

// InsightService provides business logic for Insight operations.
type InsightService struct {
	store           *storage.InsightStore
	providerService *ProviderService
}

// NewInsightService creates a new InsightService with the given store and optional provider service.
func NewInsightService(store *storage.InsightStore, providerService *ProviderService) *InsightService {
	return &InsightService{store: store, providerService: providerService}
}

// CompactConversation sends conversation messages to an LLM and creates a structured Insight.
func (s *InsightService) CompactConversation(ctx context.Context, projectName string, req types.CompactInsightRequest) (*types.Insight, error) {
	if s.providerService == nil {
		return nil, fmt.Errorf("provider service not configured")
	}

	// Format conversation as plain text for the LLM
	var conv strings.Builder
	for _, msg := range req.Messages {
		conv.WriteString(msg.Role)
		conv.WriteString(": ")
		conv.WriteString(msg.Content)
		conv.WriteString("\n\n")
	}

	// Append highlighted sections if present
	if len(req.HighlightedSections) > 0 {
		conv.WriteString("---\nHighlighted Sections:\n")
		for _, hs := range req.HighlightedSections {
			conv.WriteString(fmt.Sprintf("- [%s] (%s): \"%s\"\n", hs.Color, hs.MessageRole, hs.Text))
		}
		conv.WriteString("\n")
	}

	chatReq := providers.ChatRequest{
		Messages: []providers.Message{
			{Role: "user", Content: conv.String()},
		},
		Model:        req.Model,
		MaxTokens:    1024,
		SystemPrompt: compactSystemPrompt,
	}

	chunks, err := s.providerService.SendMessage(ctx, req.Provider, req.APIKey, chatReq)
	if err != nil {
		return nil, fmt.Errorf("LLM request failed: %w", err)
	}

	text, err := providers.CollectStreamText(ctx, chunks)
	if err != nil {
		return nil, fmt.Errorf("LLM stream failed: %w", err)
	}

	// Parse LLM response — strip code fences if present
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```") {
		// Remove opening fence (with optional language tag) and closing fence
		lines := strings.Split(text, "\n")
		if len(lines) >= 2 {
			lines = lines[1:] // drop opening ```json or ```
			for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "```" {
				lines = lines[:len(lines)-1]
			}
			text = strings.Join(lines, "\n")
		}
	}

	var llmResp types.CompactInsightLLMResponse
	if err := json.Unmarshal([]byte(text), &llmResp); err != nil {
		return nil, fmt.Errorf("failed to parse LLM response: %w (raw: %s)", err, text)
	}

	// Defaults
	title := llmResp.Title
	if title == "" {
		title = "Untitled conversation"
	}
	tags := llmResp.Tags
	if tags == nil {
		tags = []string{}
	}

	insight := &types.Insight{
		ID:                  uuid.New().String(),
		Title:               title,
		OriginContext:       llmResp.OriginContext,
		ExtractedIdea:       llmResp.ExtractedIdea,
		Tags:                tags,
		HighlightColorsUsed: req.HighlightColorsUsed,
		CreatedAt:           time.Now().UTC().Format(time.RFC3339),
		SourceAgent:         req.SourceAgent,
		Status:              "fresh",
		UsedInCount:         0,
	}

	if err := s.store.SaveInsight(projectName, *insight); err != nil {
		return nil, fmt.Errorf("failed to save insight: %w", err)
	}

	return insight, nil
}

// validateInsight checks required fields on an Insight.
func validateInsight(insight types.Insight) error {
	if insight.ID == "" {
		return fmt.Errorf("insight id is required")
	}
	if insight.Title == "" {
		return fmt.Errorf("insight title is required")
	}
	if insight.Status == "" {
		return fmt.Errorf("insight status is required")
	}
	return nil
}

// CreateInsight validates and persists an Insight for the given project.
func (s *InsightService) CreateInsight(projectName string, insight types.Insight) error {
	if err := validateInsight(insight); err != nil {
		return err
	}
	return s.store.SaveInsight(projectName, insight)
}

// ListInsights returns all Insights for a project, sorted by most recent first.
func (s *InsightService) ListInsights(projectName string) ([]types.Insight, error) {
	return s.store.ListInsights(projectName)
}

// GetInsight returns a single Insight by ID.
func (s *InsightService) GetInsight(projectName, insightID string) (types.Insight, error) {
	if insightID == "" {
		return types.Insight{}, fmt.Errorf("insight id is required")
	}
	return s.store.GetInsight(projectName, insightID)
}

// UpdateInsight validates and persists an updated Insight.
func (s *InsightService) UpdateInsight(projectName string, insight types.Insight) error {
	if err := validateInsight(insight); err != nil {
		return err
	}
	return s.store.SaveInsight(projectName, insight)
}

// DeleteInsight removes an Insight by ID.
func (s *InsightService) DeleteInsight(projectName, insightID string) error {
	if insightID == "" {
		return fmt.Errorf("insight id is required")
	}
	return s.store.DeleteInsight(projectName, insightID)
}
