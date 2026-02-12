# UX Consistency Patterns

## Action Hierarchy

**Three-tier action model across all views:**

| Tier | Visual Treatment | Usage | Examples |
|------|-----------------|-------|----------|
| **Primary** | Solid fill, `--interactive-accent` background | One per view context. The single most important action | "Create Stream" in modal, "Start" on a workflow node |
| **Secondary** | Ghost/outline, `--surface-border` border | Supporting actions. Multiple allowed per context | "View Artifact" on completed node, "Archive" in stream detail |
| **Destructive** | Ghost with red text (`--status-blocked`) | Irreversible actions. Always requires confirmation | "Delete Stream," "Cancel Session" |
| **Muted** | Text-only, `--interactive-muted` | Tertiary/escape actions | "Cancel" in modals (also Escape key), "Skip" for optional workflows |

**Rules:**
- Never place two primary actions in the same visual context. If two things compete for attention, one is secondary.
- Destructive actions are never primary-styled. Red text on ghost button, never red fill.
- `Enter` triggers the primary action. `Escape` triggers the muted/cancel action. No exceptions.
- Workflow nodes on the phase graph are their own action model — clicking IS the primary action. No separate "Start" button on the node.

## Feedback Patterns

**The "silence is trust" principle applied to feedback:**

| Scenario | Feedback Pattern | Duration | Visual |
|----------|-----------------|----------|--------|
| **Routine success** | No feedback. State change is the feedback | — | Node fills in, artifact appears, graph updates. The state IS the confirmation |
| **Async operation started** | Inline status indicator | Until complete | Pulsing dot on active workflow node. "Starting session..." in conversation panel header |
| **Operation failed** | Inline error with specific message + retry | Persistent until dismissed or retried | Red border on affected element. Error text below. Retry button |
| **Background event** | Subtle indicator, no interruption | 3 seconds auto-dismiss | Stream card briefly highlights if a background session completes. No toast, no modal |
| **Destructive confirmation** | Inline confirm prompt, not modal | Until user responds | "Archive this stream? This hides it from the dashboard. [Archive] [Cancel]" |

**What we never do:**
- No success toasts for routine operations (creating a stream, saving an artifact, completing a session)
- No confirmation dialogs for non-destructive actions (launching a workflow, switching streams, viewing an artifact)
- No generic "Something went wrong" messages. Every error identifies *what* failed and *what to do*
- No loading spinners for operations under 200ms. The result appears, or nothing happens visibly

**Error message pattern:**

```
[Specific thing that failed]: [Specific reason]
[Specific action to fix it]

Example:
"OpenCode session failed to start: connection refused on port 3008"
"Check that the BMAD Studio backend is running, then retry."
[Retry]
```

## Navigation Patterns

**Three navigation mechanisms, each with a clear domain:**

| Mechanism | Domain | Trigger | Behavior |
|-----------|--------|---------|----------|
| **Sidebar** | Spatial orientation — where am I? | Always visible (unless collapsed) | Shows project → stream hierarchy. Click to switch stream. Current stream highlighted with phase-colored left border |
| **Command palette** | Action — what do I want to do? | `Cmd+K` from any view | Fuzzy search across streams, artifacts, actions. Grouped results. Escape to dismiss |
| **Phase graph** | Work — what's next? | Click stream in sidebar/dashboard | Visual topology. Click nodes to launch workflows or view artifacts. The "map" |

**Navigation rules:**
- Stream switch always navigates to the phase graph. Never to the last-viewed artifact or session. The graph is the resume screen.
- `Cmd+K` never changes the current view until a result is selected. It's an overlay, not a navigation.
- Back/forward browser-style navigation is not supported. The app has a flat hierarchy: Dashboard → Stream (Phase Graph) → Session. Sidebar is the "back" button.
- URL-style deep linking (future): `bmad://project/stream/workflow` for potential IDE integration.

**Sidebar behavior:**

| State | Width | Content |
|-------|-------|---------|
| Expanded | 240px | Project name, stream list with phase badges, "+ New Stream" button |
| Collapsed | 48px | Project icon, stream initials, "+" icon |
| Auto-collapse | Triggers at window width < 1024px | Collapses to icon-only |

## Empty & Loading States

**Every view has exactly one empty state with exactly one call-to-action:**

| View | Empty State | CTA |
|------|------------|-----|
| Dashboard (no projects) | "Connect a project to get started" | [Open Project Folder] |
| Dashboard (no streams) | "Create your first stream" | [+ New Stream] |
| Phase graph (never empty) | N/A — graph always renders from template | — |
| Artifact viewer (no artifacts) | "No artifacts yet. Launch a workflow to produce artifacts." | — (informational) |
| Artifact viewer (no stream selected) | "Select a stream to view artifacts" | — |
| Command palette (no results) | "No results for '[query]'" | — |

**Loading states:**

| Operation | Loading Pattern | Budget |
|-----------|----------------|--------|
| App startup | Blank window → sidebar + dashboard render | < 2s total, no skeleton |
| Stream switch | Instant swap — stream metadata is cached | < 100ms, no loading state |
| Phase graph render | Immediate — topology is computed client-side from metadata | < 200ms, no loading state |
| Session launch | "Starting session..." text in conversation panel header | < 1s before first output |
| Artifact render | Content appears. Large files (>100KB) show skeleton for markdown render | < 500ms for typical artifacts |

**Rule:** If an operation completes in < 200ms, show nothing. If 200ms-1s, show inline text indicator. If > 1s, show a skeleton or progress indicator. Never a full-page spinner.

## Modal & Overlay Patterns

**When to use each overlay type:**

| Pattern | Use Case | Behavior | Example |
|---------|----------|----------|---------|
| **Modal (Dialog)** | Focused creation/confirmation requiring input | Backdrop dims. Focus trapped. `Escape` closes. Content centered | Stream creation modal |
| **Command palette** | Search/navigate/execute across the app | Backdrop dims subtly. Focus trapped. `Escape` closes. Top-center positioned | `Cmd+K` palette |
| **Tooltip** | Contextual information on hover | No backdrop. 300ms delay. Dismissed on mouse leave. Max-width 320px | Context dependency tooltip on workflow nodes |
| **Popover** | Interactive content triggered by click | No backdrop. Focus trapped. `Escape` or click-outside closes | Settings menu, filter options |
| **Inline expand** | Content expansion within the current view | No overlay. Content pushes surrounding elements. Toggleable | Breadcrumb strip expanding to full phase graph |

**Rules:**
- Modals never stack. Only one modal at a time. If a second context needs a modal (e.g., confirmation within creation), it replaces the first with a back path.
- Command palette can appear over a modal (it's a global overlay that takes priority).
- Tooltips disappear before any interactive overlay opens.
- All overlays close on `Escape`. No exceptions.

## Transition Patterns

**The zoom-in/zoom-out pattern — BMAD Studio's signature transition:**

| Transition | From | To | Animation | Duration |
|-----------|------|-----|-----------|----------|
| **Zoom In** | Phase graph | Breadcrumb strip + conversation panel | Graph compresses upward into strip, conversation expands from bottom | 300ms ease-out |
| **Zoom Out** | Breadcrumb strip + conversation panel | Phase graph | Strip expands downward into graph, conversation contracts | 250ms ease-in |
| **Stream Switch** | Stream A phase graph | Stream B phase graph | Cross-fade (stream A fades, stream B appears) | 150ms |
| **View Switch** | Phase graph | Artifact viewer (or vice versa) | Slide/cross-fade within main content area | 150ms |
| **Modal Open** | Any view | Modal overlay | Backdrop fades in, modal scales from 95% → 100% | 200ms |
| **Modal Close** | Modal overlay | Any view | Modal scales 100% → 95%, backdrop fades out | 150ms |

**Rules:**
- All transitions use `ease-out` for opening (fast start, soft landing) and `ease-in` for closing (natural departure).
- No transition exceeds 300ms. Anything longer feels sluggish for a developer tool.
- Transitions can be disabled globally via a user preference (for accessibility: `prefers-reduced-motion`).
- During zoom-in/zoom-out, the sidebar does not animate — it's the stable anchor.

## Keyboard Patterns

**Global shortcuts (work from any view):**

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+N` | New stream (opens creation modal) |
| `Escape` | Close modal / collapse to phase graph / dismiss overlay (context-dependent) |
| `Cmd+1` through `Cmd+9` | Switch to stream 1-9 in sidebar order |
| `Cmd+[` / `Cmd+]` | Previous / next stream |

**Phase graph shortcuts (when graph is focused):**

| Shortcut | Action |
|----------|--------|
| Arrow keys | Navigate between workflow nodes |
| `Enter` | Launch selected workflow node |
| `Space` | View artifact for selected node (if complete) |
| `i` | Show context dependency info for selected node |

**Conversation panel shortcuts (during active session):**

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+G` | Expand breadcrumb strip to full phase graph (without ending session) |
| `Escape` | Return to phase graph (ends session if confirmed) |

## Content Display Patterns

**Text hierarchy across all views:**

| Content Type | Font | Size | Weight | Color |
|-------------|------|------|--------|-------|
| Page title | Sans | `--text-lg` (16px) | 600 | `--interactive-active` |
| Section header | Sans | `--text-md` (14px) | 500 | `--interactive-hover` |
| Body text | Sans | `--text-base` (13px) | 400 | `--interactive-default` |
| Secondary/metadata | Sans | `--text-sm` (12px) | 400 | `--interactive-muted` |
| Timestamps | Sans | `--text-xs` (11px) | 400 | `--interactive-muted` |
| Code/paths/skills | Mono | `--text-sm` (12px) | 400 | `--interactive-default` |
| Artifact content | Mono | `--text-base` (13px) | 400 | `--interactive-default` |

**Truncation rules:**
- Stream names: truncate with ellipsis at container width. Full name in tooltip.
- Artifact names: never truncate (they're short filenames).
- Phase names: never truncate (fixed vocabulary: Analysis, Planning, Solutioning, Implementation).
- Workflow names: truncate with ellipsis if needed. Full name in tooltip.
- Timestamps: relative ("2 days ago", "3 hours ago") on dashboard. Absolute ("Feb 10, 14:23") in detail views.
