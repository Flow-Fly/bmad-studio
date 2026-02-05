package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// dangerousPatterns are file path patterns that should never be written to.
var dangerousPatterns = []string{
	".env",
	".git/config",
	"credential",
	"secret",
}

// sensitiveEnvPatterns are environment variable name patterns to strip.
var sensitiveEnvPatterns = []string{
	"API_KEY",
	"TOKEN",
	"SECRET",
	"PASSWORD",
	"CREDENTIAL",
}

// Sandbox enforces file system access boundaries for tool operations.
// It supports dual-path validation: project root and central storage.
type Sandbox struct {
	projectRoot string
	centralRoot string
}

// NewSandbox creates a Sandbox with the given allowed paths.
// Paths are resolved to their real paths (symlinks resolved) for reliable containment checks.
func NewSandbox(projectRoot, centralRoot string) *Sandbox {
	if projectRoot != "" {
		if resolved, err := filepath.EvalSymlinks(projectRoot); err == nil {
			projectRoot = resolved
		}
	}
	if centralRoot != "" {
		if resolved, err := filepath.EvalSymlinks(centralRoot); err == nil {
			centralRoot = resolved
		}
	}
	return &Sandbox{
		projectRoot: projectRoot,
		centralRoot: centralRoot,
	}
}

// ProjectRoot returns the sandbox project root path.
func (s *Sandbox) ProjectRoot() string {
	return s.projectRoot
}

// ValidatePath resolves symlinks, checks containment within allowed zones,
// and rejects dangerous paths. Returns the resolved absolute path or error.
func (s *Sandbox) ValidatePath(path string, write bool) (string, error) {
	if path == "" {
		return "", fmt.Errorf("empty path")
	}

	// Resolve relative paths against project root
	if !filepath.IsAbs(path) {
		path = filepath.Join(s.projectRoot, path)
	}

	// Resolve to absolute (handles . and ..)
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("failed to resolve path: %w", err)
	}

	// Try resolving symlinks. If file doesn't exist yet (write), use the parent dir.
	resolved := absPath
	if _, statErr := os.Lstat(absPath); statErr == nil {
		evalPath, evalErr := filepath.EvalSymlinks(absPath)
		if evalErr != nil {
			return "", fmt.Errorf("failed to resolve symlinks: %w", evalErr)
		}
		resolved = evalPath
	} else if write {
		// For new files, resolve the parent directory
		parentDir := filepath.Dir(absPath)
		if _, parentStatErr := os.Stat(parentDir); parentStatErr == nil {
			evalParent, evalErr := filepath.EvalSymlinks(parentDir)
			if evalErr != nil {
				return "", fmt.Errorf("failed to resolve parent symlinks: %w", evalErr)
			}
			resolved = filepath.Join(evalParent, filepath.Base(absPath))
		}
	}

	// Check containment: resolved path must be within projectRoot or centralRoot
	if !s.isContained(resolved) {
		return "", fmt.Errorf("path %q is outside sandbox boundaries", path)
	}

	// Check dangerous paths for write operations
	if write {
		if err := s.checkDangerous(resolved); err != nil {
			return "", err
		}
	}

	return resolved, nil
}

// isContained checks if the resolved path is within either allowed zone.
func (s *Sandbox) isContained(resolved string) bool {
	if s.projectRoot != "" && isUnder(resolved, s.projectRoot) {
		return true
	}
	if s.centralRoot != "" && isUnder(resolved, s.centralRoot) {
		return true
	}
	return false
}

// isUnder checks if child is under parent directory.
func isUnder(child, parent string) bool {
	rel, err := filepath.Rel(parent, child)
	if err != nil {
		return false
	}
	// Must not start with ".." to be truly under parent
	return !strings.HasPrefix(rel, "..")
}

// checkDangerous rejects writes to known dangerous file paths.
func (s *Sandbox) checkDangerous(resolved string) error {
	base := filepath.Base(resolved)
	lowerBase := strings.ToLower(base)
	lowerPath := strings.ToLower(resolved)

	for _, pattern := range dangerousPatterns {
		if lowerBase == pattern || strings.Contains(lowerPath, "/"+pattern) || strings.Contains(lowerBase, pattern) {
			return fmt.Errorf("write to dangerous path %q is not allowed", resolved)
		}
	}
	return nil
}

// ValidateBashEnv returns a sanitized copy of the environment,
// stripping variables matching sensitive patterns.
func (s *Sandbox) ValidateBashEnv(env []string) []string {
	result := make([]string, 0, len(env))
	for _, entry := range env {
		parts := strings.SplitN(entry, "=", 2)
		if len(parts) != 2 {
			continue
		}
		name := strings.ToUpper(parts[0])
		if isSensitiveEnv(name) {
			continue
		}
		result = append(result, entry)
	}
	return result
}

// isSensitiveEnv checks if an env variable name matches sensitive patterns.
func isSensitiveEnv(name string) bool {
	for _, pattern := range sensitiveEnvPatterns {
		if strings.Contains(name, pattern) {
			return true
		}
	}
	return false
}
