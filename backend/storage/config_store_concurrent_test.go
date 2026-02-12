package storage

import (
	"sync"
	"testing"

	"bmad-studio/backend/types"
)

func TestConfigStore_ConcurrentUpdate(t *testing.T) {
	tmpDir := resolveDir(t, t.TempDir())
	store := NewCentralStoreWithPath(tmpDir)
	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init store: %v", err)
	}

	configStore := NewConfigStore(store)

	// Run 10 concurrent updates
	var wg sync.WaitGroup
	concurrency := 10
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func(id int) {
			defer wg.Done()
			err := configStore.Update(func(s *types.Settings) {
				s.DefaultProvider = "test-provider"
			})
			if err != nil {
				t.Errorf("Concurrent Update() failed: %v", err)
			}
		}(i)
	}

	wg.Wait()

	// Verify final state is consistent
	settings, err := configStore.Load()
	if err != nil {
		t.Fatalf("Load() after concurrent updates failed: %v", err)
	}

	if settings.DefaultProvider != "test-provider" {
		t.Errorf("After concurrent updates: got provider %s, want test-provider", settings.DefaultProvider)
	}
}
