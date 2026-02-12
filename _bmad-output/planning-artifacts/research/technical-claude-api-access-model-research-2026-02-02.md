---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 5
research_type: 'technical'
research_topic: 'Claude API access model for desktop apps'
research_goals: 'Determine whether bmad-studio should support subscription-based access (Claude Pro/Team), API-key-only access, or both. Clarify what authentication models Anthropic supports and their implications for a desktop app.'
user_name: 'Flow'
date: '2026-02-02'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical — Claude API Access Model for Desktop Apps

**Date:** 2026-02-02
**Author:** Flow
**Research Type:** Technical

---

## Research Overview

This research investigates how bmad-studio should authenticate with Claude to provide AI chat functionality. The core question: should it require users to bring their own API key, leverage a Claude subscription via Claude Code, or support both? This has significant cost, UX, and legal implications.

**Methodology:** Web research verified against official Anthropic documentation, community discussions, and reference app patterns. Multiple sources verified for all critical claims.

---

## Technical Research Scope Confirmation

**Research Topic:** Claude API access model for desktop apps
**Research Goals:** Determine whether bmad-studio should support subscription-based access (Claude Pro/Team), API-key-only access, or both. Clarify what authentication models Anthropic supports and their implications for a desktop app.

**Scope Confirmed:** 2026-02-02

---

## Anthropic's Access Models: The Landscape

### Three Distinct Claude Products

Anthropic offers three separate products with **separate billing and authentication**:

| Product | Auth Method | Billing | Who It's For |
|---|---|---|---|
| **Claude.ai** (Web/App) | Email login | Subscription ($0 / $20 / $100-200 / mo) | End users — chat interface |
| **Claude API** (Console) | API key (`x-api-key` header) | Pay-per-token (prepaid credits) | Developers — build apps |
| **Claude Code** (CLI) | OAuth token OR API key | Subscription (Pro/Max) or API credits | Developers — agentic coding |

**Critical fact:** A paid Claude subscription (Pro, Max, Team, Enterprise) does **not** include access to the Claude API or Console. They are separate products with separate billing.

_Confidence: High — confirmed by official Anthropic support article_
_Sources: [Anthropic Support - Separate Billing](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-do-i-have-to-pay-separately-to-use-the-claude-api-and-console), [Claude vs Claude API vs Claude Code](https://eval.16x.engineer/blog/claude-vs-claude-api-vs-claude-code)_

### Claude API Key Authentication (Standard Path)

The Claude API authenticates via `x-api-key` header with keys generated at `console.anthropic.com`. Key characteristics:

- **Key format:** `sk-ant-api03-...`
- **Billing:** Prepaid credit system. New accounts get $5 free. Usage deducted from balance.
- **Rate limits:** 4-tier system based on cumulative spend ($5 → $40 → $200 → $400+ deposit thresholds)
- **Workspaces:** Organizations can create workspaces with separate API keys and rate limits
- **SDKs:** Official `anthropic-sdk-go` reads from `ANTHROPIC_API_KEY` env var

_Confidence: High — official documentation_
_Sources: [Claude API Overview](https://platform.claude.com/docs/en/api/overview), [API Rate Limits](https://platform.claude.com/docs/en/api/rate-limits), [Getting API Key Guide](https://gloobia.com/claude-api-key-guide-2026/)_

### Claude Code OAuth Token (Subscription Path)

Claude Code authenticates via OAuth when a user runs `claude login`. The OAuth token format is `sk-ant-oat01-...` (distinct from API keys). Key characteristics:

- **Works with:** Claude Pro ($20/mo), Max ($100-200/mo) subscriptions
- **Billing:** Included in subscription — no per-token charges
- **Rate limits:** Weekly limits (Pro: 40-80 hrs Sonnet/week; Max $100: 140-280 hrs Sonnet)
- **Context window:** Up to 200K tokens (vs 1M for API Tier 4)
- **Usage via SDK:** Claude Code SDK supports running as subprocess with `--output-format stream-json`

_Confidence: High — confirmed via multiple sources_
_Sources: [Claude Code Pricing (Northflank)](https://northflank.com/blog/claude-rate-limits-claude-code-pricing-cost), [Claude Code Limits (TrueFoundry)](https://www.truefoundry.com/blog/claude-code-limits-explained)_

---

## Claude Code SDK: The Subscription Access Question

### How It Works

The Claude Code SDK allows running Claude as a **subprocess** with structured JSON or streamed responses:

```bash
# Headless mode with streaming JSON output
claude -p "your prompt" --output-format stream-json

# Pipe integration
cat file.txt | claude -p "analyze this" --json
```

The SDK is available in TypeScript, Python, and CLI. It supports:
- In-process and subprocess-based MCP server integration
- SSE streaming for incremental responses
- Third-party provider routing (Bedrock: `CLAUDE_CODE_USE_BEDROCK=1`, Vertex: `CLAUDE_CODE_USE_VERTEX=1`)
- Tool use, file system access, and command execution

_Confidence: High — official SDK documentation_
_Sources: [Claude Code SDK docs](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview), [Claude Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python), [InfoQ - Claude Code SDK](https://www.infoq.com/news/2025/06/claude-code-sdk/)_

### The January 2026 Crackdown

In early January 2026, Anthropic tightened restrictions on third-party tools using Claude subscription OAuth tokens:

| Date | Event |
|---|---|
| **5 Jan 2026** | OpenCode users report bans after OAuth login with Max plan |
| **7 Jan 2026** | Crush maintainer removes Claude Code support at Anthropic's request |
| **9 Jan 2026** | Anthropic states: third-party harnesses using Claude subscriptions are prohibited; the supported path is the API |

**Key policy points:**
- Third-party developers cannot offer Claude.ai login or subscription rate limits in their products
- The Claude Code workspace in Console is dedicated to Claude Code usage and does not allow standard API keys
- OAuth tokens (`sk-ant-oat01-...`) are incompatible with standard API key format (`sk-ant-api03-...`)
- Bans were issued and later lifted, but the policy remains: **third-party tools must use the API**

_Confidence: High — multiple independent sources (VentureBeat, GitHub issues, community reports)_
_Sources: [Anthropic Crackdown (VentureBeat)](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses), [GitHub Issue #18340](https://github.com/anthropics/claude-code/issues/18340), [Claude Code OAuth Article (Medium)](https://jpcaparas.medium.com/claude-code-cripples-third-party-coding-agents-from-using-oauth-6548e9b49df3), [Hacker News Discussion](https://news.ycombinator.com/item?id=46549823)_

### Agent Client Protocol (ACP): The Approved Integration Path

ACP is an open standard (Apache licensed) designed as the "LSP for AI agents." It standardizes editor-agent communication via JSON-RPC over stdio.

**How Zed integrates with Claude Code via ACP:**

```
┌──────────┐    JSON-RPC/stdio    ┌──────────────────┐    OAuth    ┌──────────┐
│  Zed UI  │ ◄──────────────────► │ claude-code-acp  │ ◄────────► │ Claude   │
│ (Editor) │       ACP            │ (adapter process)│   (sub)    │ API      │
└──────────┘                      └──────────────────┘            └──────────┘
```

- Zed runs Claude Code as an independent subprocess
- The `claude-code-acp` adapter translates between ACP and Claude Code's SDK
- User authenticates once via `claude login` (subscription) or API key
- Zed's agent panel displays Claude Code's output

**ACP ecosystem (as of Jan 2026):**
- **Editors:** Zed, Neovim, Marimo; JetBrains coming soon
- **Agents:** Claude Code, Codex CLI, Gemini CLI, goose, StackPack
- **Key distinction:** ACP lets the user's own Claude Code installation handle auth — the editor never touches the OAuth token directly

_Confidence: High — official ACP docs and Zed blog_
_Sources: [Zed ACP Blog](https://zed.dev/blog/claude-code-via-acp), [ACP Standard](https://zed.dev/acp), [claude-code-acp (GitHub)](https://github.com/zed-industries/claude-code-acp), [ACP Vercel AI SDK Provider](https://ai-sdk.dev/providers/community-providers/acp), [JetBrains ACP Registry](https://blog.jetbrains.com/ai/2026/01/acp-agent-registry/)_

---

## API Pricing Deep Dive

### Current Token Rates (Early 2026)

| Model | Input (per MTok) | Output (per MTok) | Notes |
|---|---|---|---|
| **Opus 4.5** | $5.00 | $25.00 | Flagship |
| **Sonnet 4.5** | $3.00 | $15.00 | Best balance for most use cases |
| **Haiku 4.5** | $1.00 | $5.00 | Speed & cost efficiency |
| **Opus 4/4.1** | $15.00 | $75.00 | Legacy — 3x more expensive than 4.5 |

### Cost Optimization

| Feature | Savings | How |
|---|---|---|
| **Batch API** | 50% discount | Async processing; Sonnet drops to $1.50/$7.50 |
| **Prompt Caching** | 90% on cached reads | Cache write: 1.25x; cache read: 0.1x base price |
| **Long context (>200K)** | Premium pricing | 2x input cost; 1.5x output cost |

### Subscription vs. API Cost Comparison

| Usage Level | Subscription (Pro $20/mo) | API (Sonnet 4.5) |
|---|---|---|
| **Light** (10 conversations/day, ~2K tokens each) | $20 flat | ~$1.08/mo |
| **Moderate** (50 conversations/day) | $20 flat | ~$5.40/mo |
| **Heavy** (200+ conversations/day) | May hit rate limits | ~$21.60/mo |
| **Very Heavy** (coding agent, hours/day) | Max $200/mo recommended | $50-200+/mo |

**Key insight:** For a developer tool like bmad-studio where usage is moderate and variable, API pay-per-token is more cost-effective than a subscription for most users. Subscription wins only for very heavy daily usage.

_Confidence: High — official pricing verified_
_Sources: [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Claude Pricing Guide (IntuitionLabs)](https://intuitionlabs.ai/articles/claude-pricing-plans-api-costs), [Pro vs API Cost Comparison](https://prompt.16x.engineer/blog/claude-pro-vs-api-cost-for-developers)_

---

## How Reference Apps Handle Authentication

| App | Auth Model | Details |
|---|---|---|
| **T3Chat** | BYOK + managed | BYOK per workspace or per model. Also offers $8/mo Pro with managed keys. |
| **LibreChat** | BYOK (config) | `user_provided` in YAML config; key passed via `Authorization` header |
| **Automaker** | BYOK | User provides Claude API key; stored locally |
| **Cursor** | Managed proxy | Users pay Cursor; Cursor pays Anthropic. Also supports BYOK. |
| **Cline** | BYOK + Claude Code | Can use API key OR local Claude Code installation with subscription |
| **Zed** | BYOK + Claude Code via ACP | API key in settings OR Claude Code subprocess via ACP adapter |

**Industry pattern:** The dominant approach is **BYOK (Bring Your Own Key)** — user enters their API key in the app's settings. Some tools additionally support Claude Code subprocess integration for subscription users.

_Confidence: High — verified across multiple reference apps_
_Sources: [T3Chat BYOK (X/Twitter)](https://x.com/theo/status/1924951096684118118), [LibreChat user_provided](https://github.com/danny-avila/LibreChat/discussions/4028), [Cline Claude Code](https://docs.cline.bot/provider-config/claude-code), [Zed External Agents](https://zed.dev/docs/ai/external-agents)_

---

## Recommendations for bmad-studio

### Decision Matrix

| Access Model | Feasibility | Risk | User Experience | Recommendation |
|---|---|---|---|---|
| **API Key (BYOK)** | High — standard, well-documented | Low — fully supported by Anthropic | Moderate — user must create Console account + add billing | **Primary — implement in Epic 3** |
| **Claude Code subprocess via ACP** | Medium — requires Claude Code installed | Medium — Anthropic may change policy; ACP still evolving | Good — leverages existing subscription | **Future — investigate post-Epic 3** |
| **Direct OAuth token usage** | Low — explicitly blocked by Anthropic | High — ToS violation, risk of bans | N/A | **Do not implement** |
| **Managed proxy** (bmad-studio holds keys) | N/A — open-source desktop app | N/A | N/A | **Not applicable** |

### Primary Recommendation: API Key (BYOK)

For Epic 3, implement **BYOK (Bring Your Own Key)** as the sole authentication model:

1. **User enters API key** in a settings panel
2. **Key stored securely** on the Go backend (never exposed to frontend)
3. **Key sent** as `x-api-key` header in Claude API requests
4. **Multi-provider ready** — same pattern works for OpenAI key, Ollama (no key needed)

**Why BYOK first:**
- Fully supported by Anthropic — no ToS risk
- Industry standard — matches T3Chat, LibreChat, Automaker pattern
- Simplest to implement — just a settings UI + secure storage
- Works with all API tiers and rate limits
- User controls their own billing and spend limits

### Future Consideration: Claude Code Subprocess via ACP

Post-Epic 3, bmad-studio could support Claude Code as an alternative provider:

- Spawn `claude-code-acp` adapter as a subprocess
- Communicate via ACP (JSON-RPC over stdio)
- User authenticates via their own Claude Code installation
- bmad-studio never touches the OAuth token

**Risks:**
- Anthropic's January 2026 crackdown suggests they may further restrict this
- ACP is still evolving (Zed/JetBrains are early adopters)
- Claude Code must be installed separately — extra dependency
- Rate limits differ from API (weekly caps vs. per-minute)

**Recommendation:** Monitor ACP maturity and Anthropic policy through Epic 3. If both stabilize, add as an optional provider in a later epic.

### What NOT to Do

- Do not use Claude OAuth tokens directly (`sk-ant-oat01-...`) — explicitly prohibited
- Do not build a proxy that uses your own API keys on behalf of users — open-source desktop app makes this impractical
- Do not assume subscription access can be reused programmatically — the products are separate

---

## Implementation Guidance for Epic 3

### Settings UI for API Key Entry

```
Settings Panel
├── Providers Section
│   ├── Claude (Anthropic)
│   │   ├── API Key: [________________] (masked, stored securely)
│   │   ├── Default Model: [dropdown: Sonnet 4.5, Opus 4.5, Haiku 4.5]
│   │   └── Status: ✅ Valid / ❌ Invalid / ⏳ Not configured
│   ├── OpenAI (future)
│   │   └── ...
│   └── Ollama (local)
│       ├── Base URL: http://localhost:11434
│       └── Status: ✅ Running / ❌ Not detected
```

### Key Storage on Go Backend

| Approach | Security | Complexity |
|---|---|---|
| **Config file (encrypted)** | Medium — file-based encryption | Low |
| **OS keychain** (macOS Keychain, Windows Credential Manager) | High — OS-managed | Medium |
| **Environment variable** | Low — visible in process list | Lowest |
| **Tauri Stronghold plugin** | High — Rust-side encrypted vault | Medium |

**Recommendation:** Start with config file storage (already have BMadConfigService). Upgrade to OS keychain or Tauri Stronghold in a later pass if needed.

### API Key Validation

On key entry, make a lightweight API call (e.g., `ListModels` or a minimal `Messages` request with `max_tokens: 1`) to verify the key is valid and check the account's tier. Display the result in the settings UI.

---

## Summary

| Question | Answer |
|---|---|
| Can a Claude subscription be used programmatically? | Not directly — subscription ≠ API access. Claude Code SDK can, but Anthropic restricts third-party usage. |
| Should bmad-studio support subscription auth? | Not in Epic 3. Monitor ACP/Claude Code for future support. |
| What's the recommended auth model? | BYOK — user brings their own Claude API key. |
| How do other apps handle this? | BYOK is the industry standard (T3Chat, LibreChat, Automaker). Some also support Claude Code subprocess (Cline, Zed). |
| Is Claude Code subprocess integration viable? | Technically yes via ACP, but risky given Anthropic's January 2026 crackdown. Defer to post-Epic 3. |
| What about Ollama? | No auth needed — local HTTP API at `localhost:11434`. Free. (Research Spike 3 covers this.) |
