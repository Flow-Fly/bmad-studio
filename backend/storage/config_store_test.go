package storage

import (
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/types"
)

func tempConfigStore(t *testing.T) *ConfigStore {
	t.Helper()
	dir := t.TempDir()
	return &ConfigStore{filePath: filepath.Join(dir, "config.json")}
}

func TestDefaultSettings(t *testing.T) {
	s := DefaultSettings()
	if s.DefaultProvider != "claude" {
		t.Errorf("expected default provider 'claude', got %q", s.DefaultProvider)
	}
	if s.OllamaEndpoint != "http://localhost:11434" {
		t.Errorf("expected ollama endpoint, got %q", s.OllamaEndpoint)
	}
	if len(s.Providers) != 4 {
		t.Errorf("expected 4 providers, got %d", len(s.Providers))
	}
}

func TestLoad_NoFile_ReturnsDefaults(t *testing.T) {
	cs := tempConfigStore(t)
	s, err := cs.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.DefaultProvider != "claude" {
		t.Errorf("expected default provider 'claude', got %q", s.DefaultProvider)
	}
}

func TestSaveAndLoad_RoundTrip(t *testing.T) {
	cs := tempConfigStore(t)
	settings := types.Settings{
		DefaultProvider: "openai",
		DefaultModel:    "gpt-4o",
		OllamaEndpoint:  "http://custom:9999",
		Providers: map[string]types.ProviderSettings{
			"claude": {Enabled: false},
			"openai": {Enabled: true},
			"ollama": {Enabled: false, Endpoint: "http://custom:9999"},
		},
	}

	if err := cs.Save(settings); err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded, err := cs.Load()
	if err != nil {
		t.Fatalf("load error: %v", err)
	}

	if loaded.DefaultProvider != "openai" {
		t.Errorf("expected 'openai', got %q", loaded.DefaultProvider)
	}
	if loaded.DefaultModel != "gpt-4o" {
		t.Errorf("expected 'gpt-4o', got %q", loaded.DefaultModel)
	}
	if loaded.OllamaEndpoint != "http://custom:9999" {
		t.Errorf("expected custom endpoint, got %q", loaded.OllamaEndpoint)
	}
	if !loaded.Providers["openai"].Enabled {
		t.Error("expected openai to be enabled")
	}
}

func TestLoad_CorruptedFile_ReturnsDefaults(t *testing.T) {
	cs := tempConfigStore(t)
	if err := os.WriteFile(cs.filePath, []byte("not valid json{{{"), 0644); err != nil {
		t.Fatalf("write error: %v", err)
	}
	s, err := cs.Load()
	if err != nil {
		t.Fatalf("unexpected error on corrupt file: %v", err)
	}
	// Should fall back to defaults
	if s.DefaultProvider != "claude" {
		t.Errorf("expected default provider 'claude' on corrupt, got %q", s.DefaultProvider)
	}
}

func TestLoad_NilProviders_InitializedToDefaults(t *testing.T) {
	cs := tempConfigStore(t)
	// Save a valid file with no providers key
	if err := os.WriteFile(cs.filePath, []byte(`{"default_provider":"openai","default_model":"gpt-4o","ollama_endpoint":"x"}`), 0644); err != nil {
		t.Fatalf("write error: %v", err)
	}
	s, err := cs.Load()
	if err != nil {
		t.Fatalf("load error: %v", err)
	}
	if s.Providers == nil {
		t.Fatal("expected providers to be initialized")
	}
}

func TestUpdate_AtomicReadModifyWrite(t *testing.T) {
	cs := tempConfigStore(t)

	err := cs.Update(func(s *types.Settings) {
		s.DefaultProvider = "openai"
		s.DefaultModel = "gpt-4o"
	})
	if err != nil {
		t.Fatalf("update error: %v", err)
	}

	loaded, err := cs.Load()
	if err != nil {
		t.Fatalf("load error: %v", err)
	}
	if loaded.DefaultProvider != "openai" {
		t.Errorf("expected 'openai', got %q", loaded.DefaultProvider)
	}
	if loaded.DefaultModel != "gpt-4o" {
		t.Errorf("expected 'gpt-4o', got %q", loaded.DefaultModel)
	}
	// Unmodified fields retain defaults
	if loaded.OllamaEndpoint != "http://localhost:11434" {
		t.Errorf("expected default ollama endpoint, got %q", loaded.OllamaEndpoint)
	}
}

func TestSave_CreatesFile(t *testing.T) {
	cs := tempConfigStore(t)
	if err := cs.Save(DefaultSettings()); err != nil {
		t.Fatalf("save error: %v", err)
	}
	if _, err := os.Stat(cs.filePath); os.IsNotExist(err) {
		t.Error("config file should exist after save")
	}
}

func TestSave_AtomicWrite(t *testing.T) {
	cs := tempConfigStore(t)

	// Save initial settings
	initial := DefaultSettings()
	initial.DefaultProvider = "openai"
	if err := cs.Save(initial); err != nil {
		t.Fatalf("initial save error: %v", err)
	}

	// Save updated settings (atomic overwrite)
	updated := DefaultSettings()
	updated.DefaultProvider = "claude"
	updated.DefaultModel = "claude-opus-4"
	if err := cs.Save(updated); err != nil {
		t.Fatalf("updated save error: %v", err)
	}

	// Verify .tmp file was cleaned up
	tmpFile := cs.filePath + ".tmp"
	if _, err := os.Stat(tmpFile); !os.IsNotExist(err) {
		t.Error("Save() left .tmp file behind")
	}

	// Verify new content replaced old
	loaded, _ := cs.Load()
	if loaded.DefaultProvider != "claude" {
		t.Errorf("After atomic overwrite: got provider %s, expected claude", loaded.DefaultProvider)
	}
	if loaded.DefaultModel != "claude-opus-4" {
		t.Errorf("After atomic overwrite: got model %s, expected claude-opus-4", loaded.DefaultModel)
	}
}
