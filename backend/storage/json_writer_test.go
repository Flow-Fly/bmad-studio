package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	tmpDir := t.TempDir()

	type testData struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	tests := []struct {
		name    string
		data    testData
		wantErr bool
	}{
		{
			name: "write valid JSON",
			data: testData{Name: "test", Value: 42},
			wantErr: false,
		},
		{
			name: "write empty struct",
			data: testData{},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(tmpDir, tt.name+".json")
			err := WriteJSON(path, tt.data)

			if (err != nil) != tt.wantErr {
				t.Errorf("WriteJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr {
				return
			}

			// Verify file exists and contains expected content
			content, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("Failed to read written file: %v", err)
			}

			var got testData
			if err := json.Unmarshal(content, &got); err != nil {
				t.Fatalf("Failed to unmarshal written JSON: %v", err)
			}

			if got != tt.data {
				t.Errorf("WriteJSON() wrote %+v, want %+v", got, tt.data)
			}

			// Verify pretty-printed with 2-space indent
			expected, _ := json.MarshalIndent(tt.data, "", "  ")
			expected = append(expected, '\n')
			if string(content) != string(expected) {
				t.Errorf("WriteJSON() formatting:\ngot:\n%s\nwant:\n%s", content, expected)
			}

			// Verify .tmp file was cleaned up
			tmpFile := path + ".tmp"
			if _, err := os.Stat(tmpFile); !os.IsNotExist(err) {
				t.Errorf("WriteJSON() left .tmp file behind: %s", tmpFile)
			}
		})
	}
}

func TestWriteJSON_AtomicOverwrite(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.json")

	type testData struct {
		Value int `json:"value"`
	}

	// Write initial content
	initial := testData{Value: 1}
	if err := WriteJSON(path, initial); err != nil {
		t.Fatalf("Initial WriteJSON failed: %v", err)
	}

	// Verify initial content
	var got testData
	content, _ := os.ReadFile(path)
	json.Unmarshal(content, &got)
	if got.Value != 1 {
		t.Errorf("Initial write: got value %d, want 1", got.Value)
	}

	// Overwrite with new content
	updated := testData{Value: 2}
	if err := WriteJSON(path, updated); err != nil {
		t.Fatalf("Overwrite WriteJSON failed: %v", err)
	}

	// Verify new content replaced old
	content, _ = os.ReadFile(path)
	json.Unmarshal(content, &got)
	if got.Value != 2 {
		t.Errorf("After overwrite: got value %d, want 2", got.Value)
	}
}

func TestWriteJSON_InvalidPath(t *testing.T) {
	// Try to write to a directory that doesn't exist (no mkdirp)
	invalidPath := "/nonexistent/directory/file.json"
	err := WriteJSON(invalidPath, struct{}{})
	if err == nil {
		t.Error("WriteJSON() should fail for invalid path")
	}
}

func TestReadJSON(t *testing.T) {
	tmpDir := t.TempDir()

	type testData struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	tests := []struct {
		name     string
		setup    func(string) string // returns file path
		wantData testData
		wantErr  bool
	}{
		{
			name: "read valid JSON",
			setup: func(dir string) string {
				path := filepath.Join(dir, "valid.json")
				data := testData{Name: "test", Value: 42}
				content, _ := json.Marshal(data)
				os.WriteFile(path, content, 0644)
				return path
			},
			wantData: testData{Name: "test", Value: 42},
			wantErr:  false,
		},
		{
			name: "file not found",
			setup: func(dir string) string {
				return filepath.Join(dir, "nonexistent.json")
			},
			wantErr: true,
		},
		{
			name: "corrupt JSON",
			setup: func(dir string) string {
				path := filepath.Join(dir, "corrupt.json")
				os.WriteFile(path, []byte("{invalid json}"), 0644)
				return path
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := tt.setup(tmpDir)
			var got testData
			err := ReadJSON(path, &got)

			if (err != nil) != tt.wantErr {
				t.Errorf("ReadJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr {
				return
			}

			if got != tt.wantData {
				t.Errorf("ReadJSON() got %+v, want %+v", got, tt.wantData)
			}
		})
	}
}
