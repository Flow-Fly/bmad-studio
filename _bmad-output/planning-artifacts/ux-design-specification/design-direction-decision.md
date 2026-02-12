# Design Direction Decision

## Design Directions Explored

Seven visual directions were generated exploring different aspects of the BMAD Studio experience:

| Direction | Focus | Key Pattern |
|-----------|-------|-------------|
| **A: Multi-Stream Dashboard** | "Morning coffee" view — all streams at a glance | Stream cards with phase dot indicators, project grouping, last-activity metadata. Linear-density list with phase-colored badges |
| **B: Per-Stream Phase Graph** | The signature element — two-level topology visualization | Phase containers (horizontal swim lanes) with workflow nodes inside. Agent badges, artifact indicators, conditional gates, arrow connections showing artifact flow |
| **C: Active Session** | Conversation-dominant layout during OpenCode sessions | Breadcrumb strip collapses phase graph to single-line progress. Terminal panel fills workspace. Agent indicator in header. Minimal chrome |
| **D: Stream Creation Modal** | Fast, structured stream creation | Linear-style overlay: name field → flow template selector (Full/Quick) → worktree checkbox → create. Three inputs, no wizard |
| **E: Command Palette** | `Cmd+K` keyboard navigation hub | Fuzzy search across streams, artifacts, workflows, and actions. Grouped results with keyboard navigation. Recent items. Context-aware suggestions |
| **F: Artifact Viewer** | Rendered markdown viewing for produced artifacts | Sidebar artifact list (per-stream) + rendered content area (720px max-width). Artifact metadata header showing producing agent and workflow |
| **G: Quick Flow** | The fast-track parallel experience | Centered two-node graph (quick-spec → quick-dev). Violet color scheme (intense, distinct from Full Flow pastels). Barry agent throughout. Lightning bolt iconography |

## Chosen Direction

**Unified direction** — all seven mockups represent facets of a single cohesive experience rather than competing alternatives. Each direction maps to a distinct view/state in the application:

- **Dashboard** (Direction A) is the app's home view
- **Phase Graph** (Direction B) is the per-stream home view
- **Active Session** (Direction C) is the work mode during OpenCode sessions
- **Stream Creation** (Direction D) is a modal overlay on any view
- **Command Palette** (Direction E) is a global overlay triggered by `Cmd+K`
- **Artifact Viewer** (Direction F) is a content panel within a stream's context
- **Quick Flow** (Direction G) is the phase graph variant for quick-track streams

The visual foundation (colors, typography, spacing, surface hierarchy) is consistent across all seven. The design language established in the Visual Design Foundation (Step 8) unifies them.

## Design Rationale

The directions work as a unified system because:

1. **Consistent surface hierarchy.** All views use the same `base → raised → overlay → sunken` surface stack. Cards, panels, modals, and inset areas are visually predictable regardless of which view you're in.

2. **Phase colors as the universal thread.** The pastel cool-to-warm progression (blue → green → amber → red) appears in dashboard badges, phase graph containers, breadcrumb strip markers, and artifact metadata. Quick Flow's intense violet is immediately distinguishable.

3. **Agent colors as secondary identity.** Agent initial badges (colored circles with letters) appear on phase graph nodes, conversation panel headers, and artifact metadata. The same visual treatment everywhere.

4. **Interaction model matches view purpose.** Spatial/click for the phase graph (Direction B), keyboard-first for navigation (Direction E), minimal chrome for focus (Direction C). Each view optimizes for its primary use case.

5. **Transitions feel continuous.** Dashboard → Phase Graph (click a stream card, graph materializes). Phase Graph → Active Session (click a node, graph collapses to breadcrumb strip). Active Session → Phase Graph (click breadcrumb, graph expands). One app, three zoom levels.

## Implementation Approach

**Build order follows user journey:**

1. **App shell + sidebar + routing** — the container that holds everything
2. **Phase graph** (Direction B) — the product's signature element and highest-risk component
3. **Dashboard** (Direction A) — the multi-stream overview that links to phase graphs
4. **Active session layout** (Direction C) — breadcrumb strip + conversation panel
5. **Stream creation modal** (Direction D) — the entry point for new work
6. **Command palette** (Direction E) — `Cmd+K` global navigation
7. **Artifact viewer** (Direction F) — markdown rendering for produced artifacts
8. **Quick Flow variant** (Direction G) — phase graph variant with violet scheme

Each component can be built and tested independently. The phase graph is highest-priority because it validates the product's core UX promise and is the most novel/risky element.
