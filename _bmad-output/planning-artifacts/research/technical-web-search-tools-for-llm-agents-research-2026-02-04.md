---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 5
status: 'complete'
research_type: 'technical'
research_topic: 'Web Search Tools for LLM Agents'
research_goals: 'Evaluate self-hostable web search solutions (SearXNG and alternatives) for integration as an LLM agent tool in bmad-studio, comparing tradeoffs in architecture, API quality, result relevance, and ease of integration'
user_name: 'Flow'
date: '2026-02-04'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical

**Date:** 2026-02-04
**Author:** Flow
**Research Type:** Technical

---

## Research Overview

Evaluating web search solutions for LLM agent integration in bmad-studio. Comparing self-hosted (SearXNG) vs commercial API options (Tavily, Brave Search, Serper/SerpAPI) with focus on architecture, cost, result quality, privacy, and LLM-readiness.

---

## Technical Research Scope Confirmation

**Research Topic:** Web Search Tools for LLM Agents
**Research Goals:** Evaluate self-hostable web search solutions (SearXNG and alternatives) for integration as an LLM agent tool in bmad-studio

**Technical Research Scope:**

- Architecture Analysis - meta-search vs native index vs API proxy, deployment models
- Implementation Approaches - API design, JSON output quality, structured data for LLM consumption
- Technology Stack - runtime requirements, Docker support, dependencies
- Integration Patterns - REST API, result schema, MCP servers, LangChain support
- Performance Considerations - latency, result quality, reliability, upstream dependency risks

**Scope Confirmed:** 2026-02-04

---

## Technology Stack Analysis

### Candidates Evaluated

| Solution | Type | Index | Self-Hostable | Cost Model |
|----------|------|-------|---------------|------------|
| **SearXNG** | Open-source meta-search | Aggregated (210+ engines) | Yes | Free |
| **Tavily** | Commercial AI-native API | Proprietary | No | Pay-per-request |
| **Brave Search API** | Commercial API | Own index (35B+ pages) | No | Tiered plans |
| **Serper** | Commercial SERP API | Google (proxy) | No | Pay-per-request |
| **SerpAPI** | Commercial SERP API | 80+ engines (proxy) | No | Monthly plans |

### SearXNG (Self-Hosted Meta-Search)

**Architecture:** Python-based meta-search engine that queries 210+ upstream search engines and aggregates results. Runs as a Docker container. Returns JSON via REST API at `/search` endpoint (GET/POST). Results ranked by cross-engine agreement (more engines returning the same result = higher rank).

**Strengths:**
- Completely free, no API keys or usage limits from SearXNG itself
- Full privacy: all traffic stays on your infrastructure
- Configurable engine selection (Google, Bing, DuckDuckGo, Wikipedia, etc.)
- Lightweight Docker container, can run on the same host as your LLM
- Growing ecosystem: MCP servers, LiteLLM, Open WebUI, LangChain, n8n integrations
- You control caching, throttling, and rate limiting

**Weaknesses:**
- **Google actively blocks SearXNG instances** — after ~5 rapid queries, fresh instances get blocked. Only ~25 out of 91 public instances had working Google results at time of reporting
- Results are NOT AI-optimized — raw search results require additional processing for LLM consumption
- No built-in content extraction (you get links + snippets, not page content)
- `max_results` parameter not directly supported (fixed ~20 results per page)
- Upstream rate limiting is the real bottleneck — you're at the mercy of Google/Bing's bot detection
- Requires Redis/Valkey for rate limiter functionality

**API Output:** JSON with title, URL, snippet, engine source. No summary, no content extraction, no relevance scoring for LLM use.

_Sources: [SearXNG Documentation](https://searxng.org/), [SearXNG Search API](https://docs.searxng.org/dev/search_api.html), [Google blocking SearXNG](https://github.com/searxng/searxng/issues/2515), [SearXNG MCP Server Guide](https://skywork.ai/skypage/en/searxng-mcp-server-ai-guide-private-search/1979100863515971584)_

### Tavily (AI-Native Search API)

**Architecture:** Cloud-hosted search API purpose-built for LLM agents and RAG pipelines. Aggregates content from up to 20 sources per query, ranks with proprietary AI, delivers parsed content ready for LLM consumption. Includes Search, Extract, Map, and Crawl APIs.

**Strengths:**
- **Best-in-class LLM readiness** — returns structured JSON with summaries, citations, content highlights, pre-trimmed for context windows
- 93.3% accuracy on factual benchmarks (50-query test)
- Built-in content extraction, crawling, and summarization — no separate scraper needed
- SOC 2 certified (enterprise-ready)
- Native integrations: LangChain, LlamaIndex, MCP, Zapier, n8n
- 800,000+ developers using it

**Weaknesses:**
- Cloud-only, no self-hosting option
- Cost scales with usage: $0.008/request after 1,000 free monthly searches
- Advanced search costs 2 credits instead of 1
- Average response time ~1.9s (extraction adds latency)
- Vendor lock-in risk

**API Output:** Structured JSON with answer summary, source URLs, content highlights, relevance scores. Designed to drop directly into LLM prompts.

_Sources: [Tavily Alternatives Guide](https://websearchapi.ai/blog/tavily-alternatives), [Tavily Review 2026](https://aiagentslist.com/agents/tavily), [Firecrawl vs Tavily](https://blog.apify.com/firecrawl-vs-tavily/), [Tavily vs Exa vs Perplexity](https://www.humai.blog/ai-search-apis-compared-tavily-vs-exa-vs-perplexity/)_

### Brave Search API (Independent Index)

**Architecture:** Cloud API backed by Brave's own independent web index of 35+ billion pages. Not a proxy to Google/Bing — Brave crawls and indexes the web independently. Offers standard search and AI Grounding endpoints.

**Strengths:**
- **Independent index** — not dependent on Google or Bing availability
- AI Grounding API for reducing hallucinations with verified web sources
- Generous free tier: 2,000 queries/month
- Fast response times (own index, no upstream dependency)
- Official MCP server available (also as AWS Bedrock AgentCore container)
- Privacy-focused company philosophy
- Available on AWS Marketplace

**Weaknesses:**
- Not self-hostable
- AI Grounding plans are more expensive: $5.00 per 1,000 queries (Base AI)
- Multi-search mode median response time of 24.2s (single search is faster)
- Less AI-optimized output compared to Tavily — more traditional SERP-style results
- No built-in content extraction like Tavily

**API Output:** Structured JSON with web results, descriptions, URLs. AI Grounding endpoint adds factual anchoring. Closer to traditional SERP than Tavily's LLM-ready format.

_Sources: [Brave Search API](https://brave.com/search/api/), [Brave AI Grounding launch](https://www.etavrian.com/news/brave-ai-grounding-search-api-pricing), [Brave Search API Plans](https://api-dashboard.search.brave.com/app/plans), [Brave vs Tavily](https://data4ai.com/blog/vendors-comparison/brave-vs-tavily/)_

### Serper (Budget Google SERP)

**Architecture:** Lightweight API proxy that returns Google search results as structured JSON. Google-only, no multi-engine support.

**Strengths:**
- Extremely cheap: $0.30 per 1,000 requests
- 2,500 free searches/month
- Fast response: ~1.8s average
- Pay-as-you-go, no monthly commitment
- Simple REST API, clean JSON output

**Weaknesses:**
- Google-only (single point of failure)
- **SERP metadata only** — returns links and snippets, NOT page content
- You need a separate content extraction layer (Jina, Firecrawl) adding $2-5/1K to real cost
- Strict QPS limits on lower tiers
- No AI-optimized output
- No self-hosting

**API Output:** Google SERP as JSON — titles, URLs, snippets, featured snippets, knowledge graph data. No content extraction.

_Sources: [SERP API Pricing Index 2026](https://www.searchcans.com/blog/serp-api-pricing-index-2026/), [Serper Alternatives Comparison](https://www.searchcans.com/blog/google-serper-api-alternatives-comparison-2026/), [Complete Guide to Web Search APIs](https://www.firecrawl.dev/blog/top_web_search_api_2025)_

### SerpAPI (Multi-Engine SERP)

**Architecture:** API proxy supporting 80+ search engines (Google, Bing, YouTube, Amazon, etc.). Returns structured JSON results from any supported engine.

**Strengths:**
- Broadest engine coverage: 80+ search engines
- Multi-engine flexibility (Google, Bing, YouTube, Amazon, etc.)
- Detailed structured output
- Tutorials for AI agent integration (DeepSeek, Gemini, Groq)

**Weaknesses:**
- **Most expensive option**: $75/month for 5K searches ($15/1K), scaling to $10/1K at volume
- Monthly plans only, no true pay-as-you-go
- SERP metadata only — same content extraction gap as Serper
- Slower response: ~4s average
- No self-hosting

**API Output:** Detailed SERP JSON from selected engine — organic results, ads, knowledge graph, related searches. No content extraction.

_Sources: [SERP API Comparison 2025](https://dev.to/ritza/best-serp-api-comparison-2025-serpapi-vs-exa-vs-tavily-vs-scrapingdog-vs-scrapingbee-2jci), [SerpAPI for AI Apps](https://serpapi.com/blog/the-web-search-api-for-ai-applications/), [Best SERP APIs 2025](https://www.linkup.so/blog/best-serp-apis-web-search)_

---

## Comparison Matrix

| Dimension | SearXNG | Tavily | Brave Search | Serper | SerpAPI |
|-----------|---------|--------|--------------|--------|---------|
| **Cost/1K queries** | $0 (self-hosted) | $8 | $5 (AI tier) | $0.30 | $10-15 |
| **Free tier** | Unlimited | 1,000/mo | 2,000/mo | 2,500/mo | 250/mo |
| **Self-hostable** | Yes | No | No | No | No |
| **Own index** | No (meta) | Proprietary | Yes (35B pages) | No (Google) | No (80+ engines) |
| **LLM-ready output** | No | Yes (best) | Partial (AI Grounding) | No | No |
| **Content extraction** | No | Yes (built-in) | No | No | No |
| **Avg latency** | Variable | ~1.9s | Fast | ~1.8s | ~4s |
| **Privacy** | Full (self-hosted) | Cloud | Cloud (privacy-first) | Cloud | Cloud |
| **MCP server** | Community | Official | Official | Community | Unofficial |
| **Upstream risk** | High (Google blocks) | Low | None (own index) | Medium (Google) | Medium |
| **Content for RAG** | Snippets only | Full content | Snippets + grounding | Snippets only | Snippets only |

---

## Integration Patterns Analysis

### Integration Approach Options for bmad-studio

There are three main patterns for connecting a web search tool to an LLM agent. In practice, these are complementary and converging:

#### 1. MCP Server (Model Context Protocol)

The emerging standard (launched late 2024, 1,000+ community servers by Feb 2025). MCP provides a protocol-level, model-agnostic interface for tool discovery and execution. The LLM agent connects to an MCP server that wraps the search API.

**How it works:** Agent <-> MCP Client <-> MCP Server <-> Search API

**Pros:**
- Model-agnostic — works with Claude, GPT, open-source LLMs
- Dynamic tool discovery at runtime
- Loosely coupled, inter-process communication (more secure)
- Growing ecosystem: all major search tools have MCP servers
- Minimal overhead: 10-50ms protocol layer

**Cons:**
- Extra infrastructure (MCP server process)
- Newer standard, still evolving

**Available MCP servers per tool:**
| Tool | MCP Server | Status |
|------|-----------|--------|
| SearXNG | `ihor-sokoliuk/mcp-searxng`, `OvertliDS/mcp-searxng-enhanced` | Community, multiple options |
| Tavily | Official `tavily-ai/tavily-mcp` | Official, production-ready |
| Brave Search | Official Brave Search MCP (also AWS Bedrock container) | Official |
| Serper | Community implementations | Community |
| SerpAPI | Unofficial | Limited |

_Sources: [MCP vs LangChain/ReAct](https://glama.ai/blog/2025-09-02-comparing-mcp-vs-lang-chainre-act-for-chatbots), [MCP Introduction](https://stytch.com/blog/model-context-protocol-introduction/), [12 MCP Frameworks Compared](https://clickhouse.com/blog/how-to-build-ai-agents-mcp-12-frameworks)_

#### 2. Direct Function/Tool Calling (OpenAI-style)

The model natively outputs a structured JSON function call. Your application code executes the function and returns results to the model.

**How it works:** Agent -> function_call JSON -> your code -> HTTP request to search API -> results back to agent

**Pros:**
- Simplest integration — just define a tool schema and handler
- No extra infrastructure
- Lowest latency (direct HTTP call)
- Works with any REST API

**Cons:**
- Model-specific (OpenAI, Anthropic each have their own format)
- You write the glue code for each search provider
- No dynamic tool discovery

**For bmad-studio:** This is the most straightforward approach. Define a `web_search` tool with parameters like `query`, `max_results`, and have the handler call whichever search API you choose.

_Sources: [Tavily Function Calling](https://community.tavily.com/t/does-tavily-support-python-openai-function-calling-for-llm/759), [Tool Calling Guide](https://composio.dev/blog/tool-calling-in-llama-3-a-guide-to-build-agents)_

#### 3. LangChain/Framework Tool

Use a framework like LangChain that provides pre-built tool wrappers for each search API.

**How it works:** Agent -> LangChain Tool wrapper -> search API

**Pros:**
- Pre-built integrations for all major search tools
- Handles schema, retries, error handling
- Can also use MCP tools via `langchain-mcp-adapters`

**Cons:**
- Framework dependency (LangChain/LlamaIndex)
- Tightly coupled, in-process execution
- May be overkill if you only need one tool

**Available framework integrations:**
| Tool | LangChain | LlamaIndex |
|------|-----------|------------|
| SearXNG | `SearxSearchWrapper` | Community |
| Tavily | Official `langchain-tavily` | Official |
| Brave Search | `BraveSearchWrapper` | Available |
| Serper | `GoogleSerperAPIWrapper` | Available |

_Sources: [LangChain SearXNG](https://docs.langchain.com/oss/python/integrations/providers/searx), [LangChain Tavily](https://github.com/tavily-ai/langchain-tavily), [AI Agent Stack 2025](https://medium.com/@lssmj2014/the-ai-agent-stack-in-2025-understanding-mcp-langchain-and-llamaindex-408c82041168)_

### API Request/Response Patterns Per Tool

#### SearXNG API

```
GET /search?q=query&format=json&engines=google,bing,duckduckgo

Response: {
  "results": [
    {
      "title": "...",
      "url": "https://...",
      "content": "snippet text...",   // short snippet, NOT full page
      "engine": "google",
      "score": 1.0
    }, ...
  ],
  "number_of_results": 12345
}
```

**Note:** JSON format must be explicitly enabled in `settings.yml` (disabled by default to prevent bot abuse). No `max_results` parameter — always returns ~20 results per page.

_Source: [SearXNG Search API Docs](https://docs.searxng.org/dev/search_api.html)_

#### Tavily API

```
POST https://api.tavily.com/search
{
  "query": "...",
  "search_depth": "basic|advanced",
  "max_results": 5,
  "topic": "general|news"
}

Response: {
  "answer": "AI-generated summary...",
  "results": [
    {
      "title": "...",
      "url": "https://...",
      "content": "extracted full content...",   // full page content
      "score": 0.95,                            // relevance score
      "raw_content": "..."                      // optional raw HTML
    }, ...
  ]
}
```

**Key advantage:** Returns `answer` (summary), `content` (full extracted text), and `score` (relevance). This is the most LLM-ready response format.

_Sources: [Tavily Developer Guide](https://datalevo.com/tavily-api/), [Tavily + Agentuity](https://agentuity.com/spotlight/tavily-example)_

#### Brave Search API (Standard)

```
GET https://api.search.brave.com/res/v1/web/search?q=query
Header: X-Subscription-Token: <key>

Response: {
  "web": {
    "results": [
      {
        "title": "...",
        "url": "https://...",
        "description": "snippet...",
        "age": "2 days ago"
      }, ...
    ]
  }
}
```

#### Brave AI Grounding (Chat Completions)

```
POST https://api.search.brave.com/res/v1/chat/completions
{
  "messages": [{"role": "user", "content": "query"}],
  "stream": true
}

Response: streamed text with inline <citation> tags containing
  { start_index, end_index, url, favicon, snippet }
```

**Note:** AI Grounding uses an OpenAI-compatible chat completions format. F1-score of 94.1% on SimpleQA benchmark. Pricing: $4/1K web searches + $5/M tokens.

_Sources: [Brave AI Grounding Docs](https://api-dashboard.search.brave.com/app/documentation/ai-grounding/get-started), [Brave AI Grounding Responses](https://api-dashboard.search.brave.com/app/documentation/ai-grounding/responses)_

#### Serper API

```
POST https://google.serper.dev/search
{ "q": "query" }
Header: X-API-KEY: <key>

Response: {
  "organic": [
    {
      "title": "...",
      "link": "https://...",
      "snippet": "short snippet...",
      "position": 1
    }, ...
  ],
  "knowledgeGraph": { ... },
  "answerBox": { ... }
}
```

**Note:** Google-only. Returns SERP structure (organic, knowledge graph, answer box) but NO page content.

_Sources: [Serper Alternatives 2026](https://www.searchcans.com/blog/google-serper-api-alternatives-comparison-2026/)_

### Integration Security

| Tool | Auth Method | Key Storage |
|------|------------|-------------|
| SearXNG | None needed (self-hosted) | N/A |
| Tavily | API key in header | Environment variable |
| Brave Search | `X-Subscription-Token` header | Environment variable |
| Serper | `X-API-KEY` header | Environment variable |
| SerpAPI | API key as query param | Environment variable |

SearXNG has a security advantage here: since it's self-hosted, no API keys are exposed and no data leaves your infrastructure. All commercial APIs require storing and managing API keys securely.

---

## Architectural Patterns and Design Decisions

### The Two-Layer Problem: Search + Content Extraction

A critical architectural insight: **most search tools only solve half the problem**. For an LLM agent to reason over web content, it needs two things:

1. **Search** — find relevant URLs for a query
2. **Content Extraction** — retrieve and clean the actual page content for LLM consumption

Only **Tavily** bundles both layers. All other options (SearXNG, Brave, Serper, SerpAPI) return SERP data (titles, URLs, snippets) and require a separate content extraction step.

**If you choose a SERP-only provider, you need a content extraction layer:**

| Content Extraction Tool | Type | Cost | How it works |
|------------------------|------|------|--------------|
| **Crawl4AI** | Open-source | Free | Converts web pages to clean LLM-ready Markdown with citations |
| **Jina Reader** | API | ~$2-5/1K | URL-to-markdown extraction API |
| **Firecrawl** | Open-source + API | Free (self-host) or paid | Web crawling with LangChain integration |
| **Direct fetch + HTML-to-text** | DIY | Free | Simple HTTP fetch + readability parser |

So the real cost comparison for non-Tavily options is: **search cost + content extraction cost**.

_Sources: [Crawl4AI](https://github.com/unclecode/crawl4ai), [Apify RAG Web Browser](https://github.com/apify/rag-web-browser), [Web Scraping for RAG](https://scrapfly.io/blog/posts/how-to-use-web-scaping-for-rag-applications)_

### Provider Abstraction Pattern

Following Anthropic's guidance of "simple, composable patterns" over complex frameworks, the recommended architecture for bmad-studio is a **thin abstraction layer** over search providers:

```
LLM Agent
  └─> web_search tool (unified interface)
        └─> SearchProvider (interface)
              ├─> SearXNGProvider (self-hosted, free)
              ├─> TavilyProvider (AI-native, paid)
              ├─> BraveProvider (independent index, paid)
              └─> SerperProvider (budget, paid)
```

**Design principles:**
- **Unified response format** — normalize all provider responses to a common schema: `{ title, url, content, score }`
- **Provider-swappable** — configuration-driven provider selection, not code changes
- **Content extraction built-in** — for SERP-only providers, automatically fetch page content after search (using Crawl4AI or simple HTTP fetch + readability)
- **Fallback support** — if primary provider fails, fall back to next configured provider

This follows the same pattern as LLM abstraction layers (LiteLLM, ProxAI) but applied to the search tool layer.

_Sources: [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents), [ProxAI Abstraction Layer](https://www.proxai.co/blog/archive/llm-abstraction-layer), [Resilient LLM Agents](https://arxiv.org/pdf/2509.08646)_

### SearXNG Deployment Architecture (Self-Hosted Option)

If SearXNG is chosen as the primary or fallback provider, the Docker deployment consists of three services:

```
Docker Compose Stack:
  ├─ Caddy (reverse proxy, TLS termination)
  ├─ SearXNG (search engine, port 8080)
  └─ Valkey/Redis (caching, rate limiting)
```

**Production considerations:**
- Lightweight — can run on the same host as bmad-studio
- Valkey/Redis required for rate limiter (protects against upstream blocking)
- Configure `UWSGI_WORKERS` and `UWSGI_THREADS` for concurrent request handling
- **Disable Google engine** or use carefully — Google actively blocks SearXNG. Rely on Bing, DuckDuckGo, Brave, Wikipedia instead
- Enable image proxy for privacy
- JSON format must be explicitly enabled in `settings.yml`

_Sources: [SearXNG Docker Architecture](https://deepwiki.com/searxng/searxng-docker), [SearXNG Installation Docs](https://docs.searxng.org/admin/installation-docker.html), [SearXNG Docker GitHub](https://github.com/searxng/searxng-docker)_

### Recommended Architecture for bmad-studio

**Option A: SearXNG + Content Extraction (Free, Self-Hosted)**
```
bmad-studio agent
  └─> web_search tool
        └─> SearXNG (local Docker)
              └─> Bing + DuckDuckGo + Brave (engines)
        └─> Content Extractor (Crawl4AI or HTTP fetch)
              └─> Converts top URLs to clean text
```
- Cost: $0
- Privacy: Full
- Risk: Upstream engine availability, no Google
- Maintenance: You manage the Docker stack

**Option B: Tavily (Paid, Zero-Infra)**
```
bmad-studio agent
  └─> web_search tool
        └─> Tavily API
              └─> Returns search + extracted content + summary
```
- Cost: $8/1K queries (1,000 free/month)
- Privacy: Cloud
- Risk: Vendor dependency
- Maintenance: None (API key only)

**Option C: Hybrid (Recommended)**
```
bmad-studio agent
  └─> web_search tool
        ├─> Primary: SearXNG (free, self-hosted)
        │     └─> Content Extractor for full pages
        └─> Fallback: Tavily or Brave API (paid, reliable)
```
- Cost: Mostly free, paid API as fallback
- Privacy: Mostly self-hosted
- Risk: Low (fallback covers SearXNG failures)
- Maintenance: Docker stack + API key

The hybrid approach gives you the best of both worlds: free self-hosted search for normal operation, with a reliable commercial fallback when SearXNG's upstream engines are unavailable.

_Sources: [Anthropic Agent Patterns](https://www.anthropic.com/research/building-effective-agents), [Architecting Resilient LLM Agents](https://arxiv.org/pdf/2509.08646)_

---

## Implementation Research

### Content Extraction: Crawl4AI vs Firecrawl vs Simple HTTP Fetch

Your instinct about dynamic sites is correct. Here's the practical breakdown:

#### Simple HTTP Fetch + HTML-to-Markdown
- **Works for:** Static sites, documentation, blogs, Wikipedia, news articles
- **Fails for:** SPAs (React/Vue/Angular), sites with lazy-loaded content, Cloudflare-protected sites
- **Cost:** Free, zero dependencies
- **Speed:** Fastest (~100-500ms)
- **Verdict:** Good for ~40-60% of the web. Useless for the rest.

#### Crawl4AI (Recommended for Self-Hosted)
- **Architecture:** Python library using Playwright (headless Chromium). Renders JavaScript, handles pagination, outputs clean LLM-ready Markdown with citations
- **JavaScript rendering:** Full headless browser — handles SPAs, dynamic content, infinite scroll
- **Cloudflare:** Requires manual anti-bot strategies (proxy rotation, stealth plugins). Not automatic
- **Self-hostable:** Yes, runs as Docker container or directly. Can run completely offline with local models
- **Output:** Clean Markdown with numbered reference lists, heuristic filtering to remove noise
- **Cost:** Free, open-source
- **Best for:** Teams that want full control, privacy, and deep customization

#### Firecrawl
- **Architecture:** Managed API service. Automatically decides between HTTP fetch and full browser session per URL
- **JavaScript rendering:** Handled automatically by the platform
- **Cloudflare:** Built-in "Stealth Mode" for basic bypass, but struggles with heavily protected sites (LinkedIn, Walmart-level protection)
- **Self-hostable:** Self-hosted version exists but "still isn't production-ready" per multiple sources
- **Output:** Markdown, JSON, screenshots, simplified HTML, metadata
- **Cost:** Paid API (free tier available). Self-hosted version is free but limited
- **Best for:** Quick integration without infrastructure management

#### Recommendation for bmad-studio

**Crawl4AI** is the better fit because:
1. Fully self-hostable and free — matches your local-first architecture
2. Handles JavaScript-rendered content via Playwright
3. Outputs LLM-ready Markdown directly
4. Can run offline with local models (no external API dependency)
5. Firecrawl's self-hosted version isn't production-ready

_Sources: [Crawl4AI vs Firecrawl 2025](https://www.scrapeless.com/en/blog/crawl4ai-vs-firecrawl), [Crawl4AI vs Firecrawl (Apify)](https://blog.apify.com/crawl4ai-vs-firecrawl/), [Crawl4AI vs Firecrawl (Bright Data)](https://brightdata.com/blog/ai/crawl4ai-vs-firecrawl)_

### The Cloudflare Reality Check

Your concern about Cloudflare blocking is well-founded and getting worse:

**Current situation (2025-2026):**
- As of July 2025, **Cloudflare blocks all known AI crawlers by default** on every new domain. Cloudflare protects ~20% of the public web.
- Cloudflare deployed "AI Labyrinth" — invisible honeypot links that trap scrapers in infinite loops of fake pages
- Advanced detection includes TLS fingerprinting (90-99% accuracy), behavioral analysis (timing, mouse/keyboard), and per-customer ML models

**What this means for your tool:**
- Simple HTTP fetch will fail on ~20%+ of sites (Cloudflare-protected)
- Even Crawl4AI with headless Chromium will get blocked on some heavily-protected sites
- This is an **arms race** — no solution guarantees 100% access

**Practical mitigation:**
1. **Accept graceful failure** — not every URL will be extractable. Return what you can, skip what you can't
2. **Use Crawl4AI with headless browser** — handles most JavaScript sites and basic Cloudflare challenges
3. **Implement request delays** — random 2-5s delays between extractions to avoid behavioral detection
4. **Fall back to snippets** — if content extraction fails, the search result snippets are still usable by the LLM
5. **Don't try to bypass aggressively** — sophisticated bypass is an arms race you don't want to fight

**Honest assessment:** For an LLM agent doing research-style queries, you'll successfully extract content from ~70-80% of URLs. The remaining 20-30% will be Cloudflare-blocked or otherwise protected. This is acceptable — the LLM can work with partial information and snippets.

_Sources: [Cloudflare AI Bot Blocking](https://blog.cloudflare.com/declaring-your-aindependence-block-ai-bots-scrapers-and-crawlers-with-a-single-click/), [Cloudflare AI Labyrinth](https://blog.cloudflare.com/ai-labyrinth/), [Cloudflare blocks AI by default](https://www.technologyreview.com/2025/07/01/1119498/cloudflare-will-now-by-default-block-ai-bots-from-crawling-its-clients-websites/), [Bypassing Cloudflare 2026](https://www.zenrows.com/blog/bypass-cloudflare)_

### Local Model for Summarization

Your idea of using a local fast model for summarization is viable and well-supported:

**Recommended models (via Ollama):**

| Model | Size | Best For | RAM Required |
|-------|------|----------|--------------|
| **Qwen 2.5 7B** | 7B | Summarization, multilingual, general RAG | ~8GB VRAM |
| **Phi-4-Mini** | ~3.8B | Reasoning-heavy tasks, best ratio in sub-7B | ~4GB VRAM |
| **Llama 3.2 3B** | 3B | Quick summarization, reliable baseline | ~4GB VRAM |
| **Qwen 2.5 0.5B** | 0.5B | Ultra-lightweight, basic summarization | ~1GB |

**How this fits into the pipeline:**
```
SearXNG search results (titles, URLs, snippets)
  └─> Crawl4AI extracts top N page contents
        └─> Local model (Qwen 2.5 / Phi-4-Mini via Ollama)
              └─> Summarizes each page into concise LLM-ready text
                    └─> Agent receives: query + summarized sources
```

This effectively replicates what Tavily does ($8/1K), but entirely locally and for free. The trade-off is latency — local summarization adds 1-3s per page depending on model and hardware.

**Practical tips:**
- 4-bit quantized 7B model often outperforms 8-bit 3B model
- Prompt engineering is critical for smaller models — be explicit about output format
- For summarization, models don't need vast knowledge — instruction-following ability is what matters
- Ollama makes deployment trivial: `ollama run qwen2.5:7b`

_Sources: [Top Small Language Models 2026](https://www.datacamp.com/blog/top-small-language-models), [Best Open-Source LLMs Under 7B](https://mljourney.com/best-open-source-llms-under-7b-parameters-run-locally-in-2026/), [Small Local LLMs for 8GB RAM](https://apidog.com/blog/small-local-llm/)_

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Google blocks SearXNG | High (already happening) | Don't use Google engine. Use Bing + DuckDuckGo + Brave |
| Cloudflare blocks content extraction | Medium-High (~20% of web) | Graceful degradation to snippets. Headless browser helps |
| Upstream engines change APIs | Medium | SearXNG community maintains engine adapters |
| Local model quality insufficient | Low | Modern 7B models are strong at summarization |
| Crawl4AI maintenance burden | Low | Active open-source project, Playwright-based |
| Rate limiting by upstream engines | Medium | SearXNG rate limiter + delays between requests |
| Dynamic sites fail to render | Medium | Crawl4AI uses full Playwright — handles most SPAs |

---

## Final Recommendations

### Recommended Stack for bmad-studio

```
┌─────────────────────────────────────────────┐
│          bmad-studio LLM Agent              │
│                                             │
│  web_search tool (unified interface)        │
│    ├─ SearchProvider abstraction            │
│    │    ├─ SearXNG (primary, free)          │
│    │    └─ Brave/Tavily (optional fallback) │
│    │                                        │
│    ├─ ContentExtractor                      │
│    │    ├─ Crawl4AI (JS-rendered pages)     │
│    │    └─ Simple HTTP (static pages)       │
│    │                                        │
│    └─ Summarizer                            │
│         └─ Local model via Ollama           │
│            (Qwen 2.5 7B / Phi-4-Mini)      │
└─────────────────────────────────────────────┘

Docker Services:
  ├─ SearXNG + Valkey (search)
  ├─ Crawl4AI (content extraction)
  └─ Ollama (local summarization model)
```

### Implementation Priority

1. **Start with SearXNG + simple HTTP fetch** — get the basic search loop working
2. **Add Crawl4AI** for JavaScript-heavy pages when simple fetch fails
3. **Add local summarization** via Ollama to produce LLM-ready output
4. **(Optional)** Add Brave or Tavily API key as fallback for reliability

### Cost Summary

| Component | Cost | Notes |
|-----------|------|-------|
| SearXNG | $0 | Self-hosted Docker |
| Crawl4AI | $0 | Self-hosted, open-source |
| Ollama + Qwen 2.5 | $0 | Local model, needs GPU with 8GB VRAM |
| Brave API (optional fallback) | $0 for 2K/mo, then $5/1K | Only if you want fallback reliability |
| **Total** | **$0** (or ~$5/1K for fallback) | |

### What You'd Get vs Tavily

| Capability | Your Stack (Free) | Tavily ($8/1K) |
|------------|-------------------|----------------|
| Web search | SearXNG (210+ engines) | Tavily proprietary |
| Content extraction | Crawl4AI (headless browser) | Built-in |
| Summarization | Local model (Qwen/Phi) | Built-in AI |
| Privacy | Full (self-hosted) | Cloud |
| Reliability | ~80% URL extraction success | ~95%+ |
| Latency | Higher (search + extract + summarize) | ~1.9s single call |
| Cost at 10K queries/mo | $0 | $80 |
