# Executive Summary

## Project Vision

BMAD Studio is a developer cockpit — an orchestration layer that manages AI-assisted development across multiple concurrent workstreams. It sits above execution tools (OpenCode) and provides spatial awareness: which streams exist, what phase each is in, what artifacts have been produced, and what's next. The product embodies the BMAD methodology (Analysis → Planning → Solutioning → Implementation) as its core architecture.

The core UX promise is "zero reconstruction" — opening a stream you haven't touched in two weeks and being productive in 60 seconds instead of 20 minutes.

Technical foundation: Electron desktop app (Go backend, React + Tailwind frontend), native chat UI powered by OpenCode SDK + SSE for AI sessions, central artifact store at `~/.bmad-studio/projects/`. Dark mode only. macOS primary, Linux supported.

## Target Users

**Single persona: Alex — The AI-Native Developer**

Developer who uses AI coding tools daily, with multiple features/explorations in flight across projects. Two entry points into the same product experience:

- **Entry Point A (Methodology Adopter):** Already uses BMAD via CLI. Knows the methodology works but can't sustain it manually across concurrent workstreams. Needs the orchestration layer. Expects power-user affordances — keyboard shortcuts, quick switching, minimal clicks.

- **Entry Point B (Methodology-Curious):** Productive with AI tools but no structured approach. Ships features but skips planning, loses context between sessions. Discovers BMAD methodology through the product. Needs the phase graph to feel like a helpful map, not a mandatory checklist. The methodology must feel like the shortest path, not overhead.

**User context:** Desktop-only (macOS/Linux). Tech-savvy. Typically 3-5 active streams across 2-3 projects. Sessions range from quick status checks (30 seconds) to deep conversation stretches (45+ minutes in an OpenCode session). The primary frustration is reconstruction overhead — the 15-20 minute tax of figuring out "where was I?" every context switch.

## Key Design Challenges

1. **Dual-Mode Layout.** The app serves two fundamentally different modes: active conversation (OpenCode session dominant, 45-minute stretches) and review/orient (browsing streams, checking status, reading artifacts). The layout must serve both with graceful transitions — a resizable conversation panel that collapses to a thin strip with last-message preview when in review mode, expanding to primary workspace during active sessions. One continuous workspace, not two apps.

2. **The 60-Second Resume Promise.** When Alex opens a dormant stream, phase graph + artifact list + last session context must reconstruct his mental state instantly. Information hierarchy on stream detail: phase status first, artifacts second, session history third. If any require an extra click to discover, the resume promise breaks.

3. **Methodology Without Bureaucracy.** The phase graph must communicate "here's where you are and what's available" — not "you must complete step 3 before step 4." Entry Point B users will abandon the product if it feels like a mandatory checklist. Users can skip phases manually; the graph should make progression inviting, not enforced.

## Design Opportunities

1. **Stream-as-Identity.** Streams are the atomic unit. Every view anchored to "which stream am I looking at" makes navigation trivial. The stream selector becomes the single most important navigation element — the persistent orientation point across all views.

2. **Phase Graph as Emotional Anchor.** The phase graph is the "zero reconstruction" artifact made visual. When well-designed, it produces an immediate emotional response: "I know exactly where I am." Worth disproportionate design investment as the product's core differentiator.

3. **Opinionated Cockpit Aesthetic.** Linear's information density (clean, compact, scannable) crossed with Zed's panel philosophy (primary workspace with contextual sidebars). Dark mode reinforces purposefulness. The app should feel like mission control — everything has a place and a reason. Not a configurable IDE, not a monitoring dashboard. A creation-focused cockpit.
