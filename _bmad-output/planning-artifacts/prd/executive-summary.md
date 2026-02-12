# Executive Summary

**Vision:** Transform the BMAD methodology from CLI-only tooling into a visual developer cockpit that orchestrates AI-assisted development workflows. BMAD Studio sits above execution tools as the orchestration layer — managing streams, launching the right BMAD workflow via OpenCode at the right phase, and organizing all produced artifacts in a structured, stream-based lifecycle.

**Core Shift:** From "a better way to chat with an AI about code" to "a better way to manage AI-assisted development across everything you're working on."

## Problem Statement

AI-assisted development today suffers from a missing orchestration layer:

1. **No spatial awareness across work.** Developers juggle multiple features, explorations, and ideas across projects with no single view of what state everything is in. The "where am I?" tax costs 15-30 minutes of reconstruction every context switch.

2. **Methodology doesn't stick.** Structured approaches like BMAD exist, but manual overhead is too high. Research gets lost in expired chat sessions. PRDs get skipped. Architecture decisions evaporate. The methodology exists but doesn't get followed because there's no system enforcing the pipeline.

3. **AI tools are underutilized.** Developers use AI for the task immediately in front of them but never build the habit of structured, multi-phase development. 20-30% of productive time is spent on navigation and reconstruction instead of creation.

### Why Existing Solutions Fall Short

| Solution | Strength | Gap |
|----------|----------|-----|
| **OpenCode / Claude Code** | Excellent AI execution within a single session | No cross-session state, no multi-stream awareness, no methodology pipeline |
| **Cursor / Windsurf** | AI-assisted coding inside an editor | No structured methodology, no project-level orchestration, no phase awareness |
| **Linear / Jira** | Project management and issue tracking | No AI integration, no methodology pipeline, no artifact generation |
| **Generic AI orchestrators** | Task automation and chaining | Task-focused, not methodology-driven — no development discipline, no spatial awareness |

**Product Differentiator:** Five capabilities unavailable elsewhere:
1. **Methodology IS the Product** — BMAD's structured phases aren't bolted on — they're the architecture. Years of teaching developers how to build with AI, distilled into a product.
2. **Orchestrator, Not Executor** — BMAD Studio doesn't chat with LLMs — OpenCode does. Studio orchestrates: which session to launch, with what context, at what point in the pipeline. If the execution layer improves, the cockpit improves for free.
3. **Multi-Stream by Design** — Every other tool assumes one active task. BMAD Studio assumes multiple concurrent features, explorations, and ideas — because that's how development actually works. Streams are the core data model.
4. **Composable Execution Layer** — AI coding tools are now programmable (OpenCode's typed SDK, Claude Code's client-server architecture). BMAD Studio is built for this inflection point — programmatic orchestration of AI coding sessions.
5. **Developer-Native Workflow** — Streams map to git worktrees. Artifacts map to markdown files. The phase graph maps to BMAD methodology. Nothing invented, everything composed from tools developers already use.

**Target User:**
- **Alex — The AI-Native Developer** — Developer who uses AI coding tools daily, multiple features in flight across projects. Two entry points into the product:
  - **Entry Point A (Methodology Adopter):** Already knows BMAD. Uses it via CLI. Can't sustain it manually across multiple concurrent workstreams.
  - **Entry Point B (Methodology-Curious):** Productive with AI coding tools but has no structured approach. Ships features but skips architecture docs, loses context between sessions. Discovers BMAD methodology through the product.
