package services

import (
	"context"
	"testing"

	"bmad-studio/backend/providers"
)

func TestNewProviderService(t *testing.T) {
	svc := NewProviderService()
	if svc == nil {
		t.Fatal("Expected non-nil ProviderService")
	}
}

func TestProviderService_GetProvider_Claude(t *testing.T) {
	svc := NewProviderService()
	p, err := svc.GetProvider("claude", "test-key")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if p == nil {
		t.Fatal("Expected non-nil provider")
	}
}

func TestProviderService_GetProvider_Unsupported(t *testing.T) {
	svc := NewProviderService()
	_, err := svc.GetProvider("unsupported", "test-key")
	if err == nil {
		t.Fatal("Expected error for unsupported provider")
	}

	pErr, ok := err.(*providers.ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "unsupported_provider" {
		t.Errorf("Expected code 'unsupported_provider', got %q", pErr.Code)
	}
}

func TestProviderService_ListProviderModels_Claude(t *testing.T) {
	svc := NewProviderService()
	models, err := svc.ListProviderModels("claude")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(models) != 3 {
		t.Errorf("Expected 3 Claude models, got %d", len(models))
	}
}

func TestProviderService_ListProviderModels_Unsupported(t *testing.T) {
	svc := NewProviderService()
	_, err := svc.ListProviderModels("unsupported")
	if err == nil {
		t.Fatal("Expected error for unsupported provider")
	}
}

func TestProviderService_ValidateProvider_UnsupportedType(t *testing.T) {
	svc := NewProviderService()
	err := svc.ValidateProvider(context.Background(), "unknown", "key")
	if err == nil {
		t.Fatal("Expected error for unsupported provider type")
	}

	pErr, ok := err.(*providers.ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "unsupported_provider" {
		t.Errorf("Expected code 'unsupported_provider', got %q", pErr.Code)
	}
}
