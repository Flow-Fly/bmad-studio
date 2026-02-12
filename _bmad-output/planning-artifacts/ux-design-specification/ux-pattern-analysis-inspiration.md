# UX Pattern Analysis & Inspiration

## Inspiring Products Analysis

### Linear — The Density Benchmark

**What it solves elegantly:** Project state across many issues, instantly scannable. You open Linear and in 2 seconds you know what's in progress, what's blocked, what's due. No clicking into cards to discover status.

**UX patterns worth studying:**
- **Information density without clutter.** Every row in a list view shows status, assignee, priority, project, cycle — all inline, no expansion needed. The visual weight is distributed through subtle color-coded badges and icons rather than text labels.
- **Keyboard-first navigation.** `Cmd+K` is the primary navigation mechanism. You rarely touch the mouse for switching views, projects, or creating items. The command palette is fast, fuzzy-matched, and remembers recent actions.
- **Create flows are modals, not pages.** Issue creation is a focused modal that appears over the current view — fast to open, fast to dismiss, doesn't lose your place. Fields have smart defaults so you can create with minimal input.
- **Sidebar as persistent context.** Left sidebar shows project/team hierarchy. It's always there but never demands attention. Collapsible but rarely collapsed because it's thin enough to coexist.
- **View transitions are instant.** No loading states between views. Data is pre-fetched. The app feels like it's already loaded everything.

**What to learn for BMAD Studio:** The dashboard and stream list should feel like Linear's list views — every stream showing project, phase, last activity, flow type inline. Stream creation should be a focused modal, not a page transition.

### Zed — The Panel Philosophy

**What it solves elegantly:** The tension between "I need to see my code" and "I need to interact with tools." Panels are first-class layout citizens that resize, collapse, and coexist without fighting for dominance.

**UX patterns worth studying:**
- **Panels as peers, not subordinates.** The terminal panel, the assistant panel, and the editor are all equal layout citizens. None is "the main thing with sidebars." The user controls the ratio, and the app remembers it.
- **Collapse-to-strip pattern.** Panels collapse to a thin strip showing their identity (icon + name) without disappearing. One click expands back. This is exactly the pattern needed for the phase graph ↔ conversation transition.
- **Context follows focus.** When you focus the terminal, the status bar updates to show terminal-relevant info. When you focus the editor, it shows file-relevant info. The chrome adapts to what's active without layout shifts.
- **Minimal chrome, maximum workspace.** Title bars are thin. Toolbars are minimal. The product trusts that users know what they're doing and doesn't waste pixels on hand-holding.

**What to learn for BMAD Studio:** The conversation panel (OpenCode session) should follow Zed's panel philosophy — a first-class layout citizen that expands to dominant during active sessions and collapses to a strip when not active. The breadcrumb strip pattern maps directly to Zed's collapsed-panel behavior.

### OpenCode / Claude Code — The Execution Layer

**What it solves elegantly:** AI-assisted coding with tool use, streaming output, and conversational context. The TUI is information-dense — showing thinking, tool calls, file edits, and conversation in a single scrollable stream.

**UX patterns worth studying:**
- **Streaming output as progress indicator.** You see tokens appearing in real-time. The stream itself is the loading state — no spinner needed because visible activity communicates "working."
- **Tool calls as inline events.** When the AI reads a file or edits code, it appears inline in the conversation stream as a collapsible block. You see what happened without it dominating the view.
- **Session-as-context model.** Everything in a session is contextual — previous messages, tool results, file contents. The user doesn't manage context manually; the session accumulates it.
- **Slash commands as affordances.** `/command` pattern for launching skills and workflows. Quick to type, discoverable via autocomplete, no GUI needed.

**What to learn for BMAD Studio:** The embedded terminal needs to faithfully represent OpenCode's streaming output and tool-call patterns. BMAD Studio doesn't re-render these — it frames them. The value add is what happens *around* the session: the phase graph, the context pre-loading, the artifact capture on completion.

### iTerm2 / Warp — Keyboard-First Navigation

**What it solves elegantly:** Power users navigating between multiple contexts (tabs, splits, sessions) without touching the mouse.

**UX patterns worth studying:**
- **Tab/split model for concurrent contexts.** Multiple terminals open, each with its own working directory and state. Quick switching via keyboard shortcut.
- **Warp's block model.** Each command and its output is a discrete "block" you can navigate, copy, or share. This conceptual model of "output as discrete units" maps to how artifacts work in BMAD Studio — each workflow session produces a discrete, navigable artifact.
- **Warp's command palette.** Similar to Linear's `Cmd+K` — fast fuzzy search across commands, recent directories, and workflows.

**What to learn for BMAD Studio:** The `Cmd+K` command palette should feel as fast and responsive as Warp's. Stream switching should feel as instant as iTerm tab switching. The mental model of "each stream is a workspace context" parallels how developers already think about terminal tabs.

## Transferable UX Patterns

**Navigation Patterns:**

| Pattern | Source | Application in BMAD Studio |
|---------|--------|---------------------------|
| Command palette (`Cmd+K`) | Linear, Warp, Zed | Primary navigation for stream switching, project switching, artifact search, workflow launching. Fuzzy-matched, recent-aware |
| Persistent sidebar | Linear | Left sidebar with project → stream hierarchy. Always visible, thin, collapsible. The persistent orientation anchor |
| Breadcrumb strip | Zed (collapsed panels) | Phase progress strip during active sessions: `Analysis ✓ → Planning ✓ → [Solutioning 🔵] → Implementation`. Click to expand back to full phase graph |
| Modal for creation | Linear | Stream creation as a focused overlay. Name → flow template → confirm. No page transition |

**Interaction Patterns:**

| Pattern | Source | Application in BMAD Studio |
|---------|--------|---------------------------|
| Inline status badges | Linear | Stream list shows phase badge, flow type, last activity, agent — all inline, no expansion needed |
| Panel resize/collapse | Zed | Conversation panel as a first-class layout citizen. Drag to resize, collapse to strip, expand to dominant |
| Streaming as progress | OpenCode | During active sessions, the streaming output IS the progress indicator. No separate loading state |
| Discrete output blocks | Warp | Each workflow session produces a discrete artifact. The artifact list is the session history, navigable and viewable |

**Visual Patterns:**

| Pattern | Source | Application in BMAD Studio |
|---------|--------|---------------------------|
| Dark mode density | Linear | High information density on dark backgrounds. Color-coded badges (phase colors, agent colors) provide scanability without visual noise |
| Minimal chrome | Zed | Thin title bars, minimal toolbars, maximum workspace. The product trusts the user |
| Color as semantic signal | Linear | Phase colors (blue=Analysis, green=Planning, amber=Solutioning, red=Implementation) consistent across all views — dashboard badges, phase graph containers, breadcrumb strip |
| Agent avatars as visual anchors | OpenCode (personas) | Agent colored initials (M for Mary, J for John, W for Winston) on workflow nodes provide instant "who's at the controls" recognition |

## Anti-Patterns to Avoid

1. **The Jira Trap: Too Much Configuration.** Every field optional, every view customizable, every workflow configurable. Results in blank-canvas anxiety and no two users seeing the same thing. BMAD Studio is opinionated — one dashboard layout, one phase graph visualization, one conversation panel position. Configuration is for preferences (theme, shortcuts), not for layout.

2. **The Electron Bloat Feel.** Slack, Teams, and older Electron apps feel heavy — slow to open, slow to navigate, memory-hungry. BMAD Studio must feel native-fast. View transitions under 100ms. App startup under 3 seconds. No perceptible lag on stream switching.

3. **The IDE Chrome Tax.** VS Code has powerful features behind layers of tabs, panels, status bars, breadcrumbs, minimap, activity bar. Each individually useful; collectively they create chrome overload. BMAD Studio has fewer concepts (streams, phases, conversations, artifacts) and should have proportionally less chrome.

4. **The "Two Apps" Seam.** GitHub Desktop embedding a terminal. Postman embedding a browser. Any product where you can feel the boundary between the wrapper and the embedded tool. The OpenCode session transition must be seamless — the conversation panel is part of BMAD Studio's design language, not a foreign embed with a border.

5. **The Wizard Anti-Pattern.** Multi-step wizards with back/next buttons, progress bars, and form validation for simple operations. Stream creation is three inputs in a modal, not a wizard. Workflow launching is one click, not a configuration dialog.

## Design Inspiration Strategy

**Adopt Directly:**
- Linear's `Cmd+K` command palette pattern — it's the proven navigation model for this user persona
- Zed's panel collapse-to-strip pattern — maps directly to the phase graph ↔ conversation transition
- Linear's inline status badges — the stream list and dashboard need this density
- Linear's modal creation pattern — stream creation as a focused overlay

**Adapt for BMAD Studio:**
- Linear's list views → two-level phase graph (Linear shows flat lists; BMAD Studio shows nested phase containers with workflow nodes inside — same density principle, different topology)
- Zed's panel resize → conversation panel with phase-aware behavior (collapse shows breadcrumb strip with phase progress, not just a generic panel icon)
- OpenCode's streaming output → framed within BMAD Studio's layout (the terminal content is OpenCode's; the surrounding chrome — breadcrumb strip, artifact indicators — is BMAD Studio's)
- Warp's block model → artifact list as discrete workflow outputs (each session produces a viewable, navigable artifact block)

**Avoid Explicitly:**
- Jira's configurability-as-feature approach — conflicts with the opinionated cockpit principle
- VS Code's chrome density — too many competing UI elements for a focused orchestrator
- Wizard-based creation flows — conflicts with the "one click to productive" principle
- Generic Electron wrapper aesthetics — conflicts with the native-fast, trust-building emotional goals
