package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWebSearch_SearXNGSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results": []map[string]interface{}{
				{"title": "Result 1", "url": "https://example.com/1", "content": "First result", "score": 1.0},
				{"title": "Result 2", "url": "https://example.com/2", "content": "Second result", "score": 0.9},
			},
		})
	}))
	defer server.Close()

	providers := []SearchProvider{NewSearXNGProvider(server.URL)}
	tool := NewWebSearchTool(providers)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":"test"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}
	if !strings.Contains(result.Output, "Result 1") {
		t.Error("expected Result 1 in output")
	}
	if !strings.Contains(result.Output, "https://example.com/1") {
		t.Error("expected URL in output")
	}
	if result.Metadata["provider"] != "searxng" {
		t.Errorf("expected provider searxng, got %v", result.Metadata["provider"])
	}
	if result.Metadata["resultCount"] != 2 {
		t.Errorf("expected resultCount 2, got %v", result.Metadata["resultCount"])
	}
}

func TestWebSearch_SearXNGDown_BraveFallback(t *testing.T) {
	braveServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"web": map[string]interface{}{
				"results": []map[string]interface{}{
					{"title": "Brave Result", "url": "https://brave.com/1", "description": "From Brave"},
				},
			},
		})
	}))
	defer braveServer.Close()

	searxServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer searxServer.Close()

	providers := []SearchProvider{
		NewSearXNGProvider(searxServer.URL),
		&testBraveProvider{server: braveServer},
	}
	tool := NewWebSearchTool(providers)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":"test"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}
	if !strings.Contains(result.Output, "Brave Result") {
		t.Error("expected Brave fallback result")
	}
}

func TestWebSearch_AllProvidersFail(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	providers := []SearchProvider{NewSearXNGProvider(server.URL)}
	tool := NewWebSearchTool(providers)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":"test"}`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError when all providers fail")
	}
}

func TestWebSearch_EmptyQuery(t *testing.T) {
	tool := NewWebSearchTool(nil)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":""}`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError for empty query")
	}
}

func TestWebSearch_EmptyResultsFallback(t *testing.T) {
	emptySearx := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"results": []interface{}{}})
	}))
	defer emptySearx.Close()

	braveServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"web": map[string]interface{}{
				"results": []map[string]interface{}{
					{"title": "Brave Fallback", "url": "https://brave.com", "description": "Fallback"},
				},
			},
		})
	}))
	defer braveServer.Close()

	providers := []SearchProvider{
		NewSearXNGProvider(emptySearx.URL),
		&testBraveProvider{server: braveServer},
	}
	tool := NewWebSearchTool(providers)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":"test"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Output, "Brave Fallback") {
		t.Error("expected Brave fallback when SearXNG returns empty")
	}
}

func TestWebSearch_MaxResultsRespected(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		results := make([]map[string]interface{}, 10)
		for i := range results {
			results[i] = map[string]interface{}{
				"title": "Result", "url": "https://example.com", "content": "content",
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"results": results})
	}))
	defer server.Close()

	providers := []SearchProvider{NewSearXNGProvider(server.URL)}
	tool := NewWebSearchTool(providers)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":"test","max_results":3}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Metadata["resultCount"] != 3 {
		t.Errorf("expected 3 results, got %v", result.Metadata["resultCount"])
	}
}

func TestWebSearch_FormattedOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results": []map[string]interface{}{
				{"title": "Go Lang", "url": "https://go.dev", "content": "Go programming language"},
			},
		})
	}))
	defer server.Close()

	providers := []SearchProvider{NewSearXNGProvider(server.URL)}
	tool := NewWebSearchTool(providers)

	result, err := tool.Execute(context.Background(), json.RawMessage(`{"query":"golang"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result.Output, "1. Go Lang") {
		t.Error("expected numbered list format")
	}
	if !strings.Contains(result.Output, "URL: https://go.dev") {
		t.Error("expected URL in output")
	}
}

// testBraveProvider wraps a test server as a Brave-like SearchProvider.
type testBraveProvider struct {
	server *httptest.Server
}

func (p *testBraveProvider) Name() string { return "brave" }

func (p *testBraveProvider) Search(ctx context.Context, query string, maxResults int) ([]SearchResult, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", p.server.URL+"?q="+query, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var braveResp struct {
		Web struct {
			Results []struct {
				Title       string `json:"title"`
				URL         string `json:"url"`
				Description string `json:"description"`
			} `json:"results"`
		} `json:"web"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&braveResp); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(braveResp.Web.Results))
	for _, r := range braveResp.Web.Results {
		results = append(results, SearchResult{Title: r.Title, URL: r.URL, Content: r.Description})
	}
	return results, nil
}
