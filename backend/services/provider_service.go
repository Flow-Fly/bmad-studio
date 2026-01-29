package services

import (
	"context"
	"fmt"

	"bmad-studio/backend/providers"
)

// ProviderService manages provider creation and operations.
type ProviderService struct{}

// NewProviderService creates a new ProviderService instance.
func NewProviderService() *ProviderService {
	return &ProviderService{}
}

// GetProvider returns a provider instance for the given type and API key.
func (s *ProviderService) GetProvider(providerType string, apiKey string) (providers.Provider, error) {
	switch providerType {
	case "claude":
		return providers.NewClaudeProvider(apiKey), nil
	case "openai":
		return providers.NewOpenAIProvider(apiKey), nil
	case "ollama":
		return providers.NewOllamaProvider(apiKey), nil // endpoint URL passed via apiKey parameter
	default:
		return nil, &providers.ProviderError{
			Code:        "unsupported_provider",
			Message:     fmt.Sprintf("provider type not supported: %s", providerType),
			UserMessage: fmt.Sprintf("Provider type '%s' is not supported. Available providers: claude, openai, ollama.", providerType),
		}
	}
}

// ValidateProvider creates a provider and validates its credentials.
func (s *ProviderService) ValidateProvider(ctx context.Context, providerType string, apiKey string) error {
	provider, err := s.GetProvider(providerType, apiKey)
	if err != nil {
		return err
	}
	return provider.ValidateCredentials(ctx)
}

// ListProviderModels returns models for a specific provider type.
func (s *ProviderService) ListProviderModels(providerType string) ([]providers.Model, error) {
	// For model listing, we don't need a real API key since Claude/OpenAI models are hardcoded.
	// Ollama uses the default endpoint (http://localhost:11434) when empty string is passed.
	provider, err := s.GetProvider(providerType, "")
	if err != nil {
		return nil, err
	}
	return provider.ListModels()
}

// SendMessage orchestrates message sending through the appropriate provider.
func (s *ProviderService) SendMessage(ctx context.Context, providerType string, apiKey string, req providers.ChatRequest) (<-chan providers.StreamChunk, error) {
	provider, err := s.GetProvider(providerType, apiKey)
	if err != nil {
		return nil, err
	}
	return provider.SendMessage(ctx, req)
}
