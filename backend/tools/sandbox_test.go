package tools

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSandbox_ValidatePath_ReadWithinProject(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	testFile := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(testFile, []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	resolved, err := sandbox.ValidatePath(testFile, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != testFile {
		t.Errorf("expected %q, got %q", testFile, resolved)
	}
}

func TestSandbox_ValidatePath_WriteWithinProject(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	newFile := filepath.Join(dir, "new.txt")
	resolved, err := sandbox.ValidatePath(newFile, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != newFile {
		t.Errorf("expected %q, got %q", newFile, resolved)
	}
}

func TestSandbox_ValidatePath_ReadWithinCentral(t *testing.T) {
	projectDir := resolveDir(t, t.TempDir())
	centralDir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(projectDir, centralDir)

	testFile := filepath.Join(centralDir, "data.json")
	if err := os.WriteFile(testFile, []byte("{}"), 0644); err != nil {
		t.Fatal(err)
	}

	resolved, err := sandbox.ValidatePath(testFile, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != testFile {
		t.Errorf("expected %q, got %q", testFile, resolved)
	}
}

func TestSandbox_ValidatePath_WriteWithinCentral(t *testing.T) {
	projectDir := resolveDir(t, t.TempDir())
	centralDir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(projectDir, centralDir)

	newFile := filepath.Join(centralDir, "new.json")
	resolved, err := sandbox.ValidatePath(newFile, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != newFile {
		t.Errorf("expected %q, got %q", newFile, resolved)
	}
}

func TestSandbox_ValidatePath_PathTraversal(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	_, err := sandbox.ValidatePath("../../etc/passwd", false)
	if err == nil {
		t.Error("expected error for path traversal")
	}
}

func TestSandbox_ValidatePath_SymlinkOutsideSandbox(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	outsideDir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	outsideFile := filepath.Join(outsideDir, "secret.txt")
	if err := os.WriteFile(outsideFile, []byte("secret"), 0644); err != nil {
		t.Fatal(err)
	}

	symlink := filepath.Join(dir, "link")
	if err := os.Symlink(outsideFile, symlink); err != nil {
		t.Skipf("cannot create symlink: %v", err)
	}

	_, err := sandbox.ValidatePath(symlink, false)
	if err == nil {
		t.Error("expected error for symlink pointing outside sandbox")
	}
}

func TestSandbox_ValidatePath_WriteToDotEnv(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	_, err := sandbox.ValidatePath(filepath.Join(dir, ".env"), true)
	if err == nil {
		t.Error("expected error for write to .env")
	}
}

func TestSandbox_ValidatePath_WriteToGitConfig(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	gitDir := filepath.Join(dir, ".git")
	if err := os.MkdirAll(gitDir, 0755); err != nil {
		t.Fatal(err)
	}

	_, err := sandbox.ValidatePath(filepath.Join(gitDir, "config"), true)
	if err == nil {
		t.Error("expected error for write to .git/config")
	}
}

func TestSandbox_ValidatePath_ReadOutsideBothZones(t *testing.T) {
	projectDir := resolveDir(t, t.TempDir())
	centralDir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(projectDir, centralDir)

	_, err := sandbox.ValidatePath("/etc/passwd", false)
	if err == nil {
		t.Error("expected error for read outside both zones")
	}
}

func TestSandbox_ValidatePath_EmptyPath(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	_, err := sandbox.ValidatePath("", false)
	if err == nil {
		t.Error("expected error for empty path")
	}
}

func TestSandbox_ValidatePath_RelativePathResolution(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	testFile := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(testFile, []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	resolved, err := sandbox.ValidatePath("test.txt", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != testFile {
		t.Errorf("expected %q, got %q", testFile, resolved)
	}
}

func TestSandbox_ValidateBashEnv_StripsSensitive(t *testing.T) {
	env := []string{
		"PATH=/usr/bin",
		"HOME=/home/user",
		"MY_API_KEY=secret123",
		"GITHUB_TOKEN=ghp_xxx",
		"AWS_SECRET_ACCESS_KEY=xxx",
		"DB_PASSWORD=hunter2",
		"USER=developer",
	}

	sandbox := NewSandbox("", "")
	result := sandbox.ValidateBashEnv(env)

	allowed := map[string]bool{}
	for _, entry := range result {
		parts := splitEntry(entry)
		allowed[parts[0]] = true
	}

	if !allowed["PATH"] {
		t.Error("expected PATH to be preserved")
	}
	if !allowed["HOME"] {
		t.Error("expected HOME to be preserved")
	}
	if !allowed["USER"] {
		t.Error("expected USER to be preserved")
	}
	if allowed["MY_API_KEY"] {
		t.Error("expected MY_API_KEY to be stripped")
	}
	if allowed["GITHUB_TOKEN"] {
		t.Error("expected GITHUB_TOKEN to be stripped")
	}
	if allowed["AWS_SECRET_ACCESS_KEY"] {
		t.Error("expected AWS_SECRET_ACCESS_KEY to be stripped")
	}
	if allowed["DB_PASSWORD"] {
		t.Error("expected DB_PASSWORD to be stripped")
	}
}

func TestSandbox_ValidateBashEnv_PreservesNonSensitive(t *testing.T) {
	env := []string{
		"PATH=/usr/bin:/usr/local/bin",
		"GOPATH=/home/user/go",
		"EDITOR=vim",
	}

	sandbox := NewSandbox("", "")
	result := sandbox.ValidateBashEnv(env)

	if len(result) != 3 {
		t.Errorf("expected 3 preserved vars, got %d", len(result))
	}
}

func TestSandbox_ValidatePath_WriteToCredentialFile(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	_, err := sandbox.ValidatePath(filepath.Join(dir, "credentials.json"), true)
	if err == nil {
		t.Error("expected error for write to credentials file")
	}
}

func TestSandbox_ProjectRoot(t *testing.T) {
	sandbox := NewSandbox("/project", "/central")
	if sandbox.ProjectRoot() != "/project" {
		t.Errorf("expected /project, got %q", sandbox.ProjectRoot())
	}
}

// splitEntry splits a KEY=VALUE environment entry.
func splitEntry(entry string) [2]string {
	for i := 0; i < len(entry); i++ {
		if entry[i] == '=' {
			return [2]string{entry[:i], entry[i+1:]}
		}
	}
	return [2]string{entry, ""}
}
