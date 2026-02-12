package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"bmad-studio/backend/types"
)

// SearchProvider is the interface for pluggable search backends.
type SearchProvider interface {
	Search(ctx context.Context, query string, maxResults int) ([]SearchResult, error)
	Name() string
}

// SearchResult represents a single search result.
type SearchResult struct {
	Title   string  `json:"title"`
	URL     string  `json:"url"`
	Content string  `json:"content"`
	Score   float64 `json:"score,omitempty"`
}

type webSearchInput struct {
	Query      string `json:"query"`
	MaxResults int    `json:"max_results,omitempty"`
}

// NewWebSearchTool creates the web_search tool with fallback providers.
func NewWebSearchTool(providers []SearchProvider) *Tool {
	return &Tool{
		Name:        "web_search",
		Description: "Search the web for information. Returns titles, URLs, and snippets from search results.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"max_results":{"type":"integer","description":"Maximum results to return (default 5)"}},"required":["query"]}`),
		Category:    types.ToolCategorySearch,
		DangerLevel: types.DangerLevelSafe,
		Execute: func(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
			var params webSearchInput
			if err := json.Unmarshal(input, &params); err != nil {
				return &ToolResult{Output: fmt.Sprintf("invalid input: %v", err), IsError: true}, nil
			}

			if params.Query == "" {
				return &ToolResult{Output: "query is required", IsError: true}, nil
			}

			maxResults := 5
			if params.MaxResults > 0 {
				maxResults = params.MaxResults
			}

			var lastErr error
			for _, provider := range providers {
				results, err := provider.Search(ctx, params.Query, maxResults)
				if err != nil {
					lastErr = err
					continue
				}
				if len(results) == 0 {
					lastErr = fmt.Errorf("%s returned no results", provider.Name())
					continue
				}

				return &ToolResult{
					Output: formatSearchResults(results),
					Metadata: map[string]interface{}{
						"provider":    provider.Name(),
						"resultCount": len(results),
					},
				}, nil
			}

			errMsg := "all search providers failed"
			if lastErr != nil {
				errMsg = fmt.Sprintf("all search providers failed: %v", lastErr)
			}
			return &ToolResult{Output: errMsg, IsError: true}, nil
		},
	}
}

func formatSearchResults(results []SearchResult) string {
	var sb strings.Builder
	for i, r := range results {
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, r.Title))
		sb.WriteString(fmt.Sprintf("   URL: %s\n", r.URL))
		if r.Content != "" {
			sb.WriteString(fmt.Sprintf("   %s\n", r.Content))
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

// SearXNGProvider calls a local SearXNG instance.
type SearXNGProvider struct {
	baseURL string
	client  *http.Client
}

// NewSearXNGProvider creates a SearXNG search provider.
func NewSearXNGProvider(baseURL string) *SearXNGProvider {
	return &SearXNGProvider{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *SearXNGProvider) Name() string { return "searxng" }

func (p *SearXNGProvider) Search(ctx context.Context, query string, maxResults int) ([]SearchResult, error) {
	u, err := url.Parse(p.baseURL + "/search")
	if err != nil {
		return nil, fmt.Errorf("invalid SearXNG URL: %w", err)
	}

	q := u.Query()
	q.Set("q", query)
	q.Set("format", "json")
	q.Set("engines", "bing,duckduckgo,brave")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("SearXNG returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var searxResp struct {
		Results []struct {
			Title   string  `json:"title"`
			URL     string  `json:"url"`
			Content string  `json:"content"`
			Score   float64 `json:"score"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &searxResp); err != nil {
		return nil, fmt.Errorf("failed to parse SearXNG response: %w", err)
	}

	results := make([]SearchResult, 0, maxResults)
	for i, r := range searxResp.Results {
		if i >= maxResults {
			break
		}
		results = append(results, SearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Content: r.Content,
			Score:   r.Score,
		})
	}

	return results, nil
}

// BraveSearchProvider calls the Brave Search API.
type BraveSearchProvider struct {
	apiKey string
	client *http.Client
}

// NewBraveSearchProvider creates a Brave Search provider.
func NewBraveSearchProvider(apiKey string) *BraveSearchProvider {
	return &BraveSearchProvider{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *BraveSearchProvider) Name() string { return "brave" }

func (p *BraveSearchProvider) Search(ctx context.Context, query string, maxResults int) ([]SearchResult, error) {
	u, _ := url.Parse("https://api.search.brave.com/res/v1/web/search")
	q := u.Query()
	q.Set("q", query)
	q.Set("count", strconv.Itoa(maxResults))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Subscription-Token", p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Brave Search returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var braveResp struct {
		Web struct {
			Results []struct {
				Title       string `json:"title"`
				URL         string `json:"url"`
				Description string `json:"description"`
			} `json:"results"`
		} `json:"web"`
	}

	if err := json.Unmarshal(body, &braveResp); err != nil {
		return nil, fmt.Errorf("failed to parse Brave response: %w", err)
	}

	results := make([]SearchResult, 0, len(braveResp.Web.Results))
	for _, r := range braveResp.Web.Results {
		results = append(results, SearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Content: r.Description,
		})
	}

	return results, nil
}
