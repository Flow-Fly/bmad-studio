# Component Strategy

## Design System Components

**shadcn/ui components to adopt (copy from registry):**

| Component | BMAD Studio Usage | Customization Needed |
|-----------|-------------------|---------------------|
| **Button** | Create stream, launch workflow, retry actions | Custom variants: `ghost` for toolbar, `outline` for secondary actions. Phase-colored variants for workflow launch |
| **Dialog** | Stream creation modal, confirmations | Overlay styling to match `--surface-overlay` |
| **Command** (cmdk) | `Cmd+K` palette — primary keyboard navigation | Custom result groups (Streams, Artifacts, Actions), recent items, phase-colored badges in results |
| **Tooltip** | Context dependency tooltips on workflow nodes, agent info | Wider max-width (320px) for context dependency content. Monospace for file paths |
| **Popover** | Settings panels, filter dropdowns | Standard styling |
| **Badge** | Phase badges, flow type labels, status indicators | Phase-colored variants, agent-colored variants. Compact sizing (`--text-xs`) |
| **ScrollArea** | Stream list, artifact content, conversation overflow | Thin scrollbar styling for dark mode |
| **Input** | Stream name, search fields, branch name | Dark mode focus ring using `--interactive-accent` |
| **Checkbox** | Worktree creation toggle | Standard |
| **Separator** | Panel dividers, section breaks | Using `--surface-border` |
| **Tabs** | Future: settings sections, artifact type filters | Standard |
| **Resizable** (panels) | Sidebar resize, conversation panel resize | Persist sizes to local storage. Collapse thresholds |

**Not using from shadcn/ui:** Table (stream list is custom), Card (stream cards are custom), Accordion (phase graph replaces this pattern), Sheet (no side drawers needed), AlertDialog (errors are inline, not modal).

## Custom Components

### PhaseGraph

**Purpose:** The product's signature element. Renders the two-level BMAD methodology topology for a stream — phase containers with workflow nodes inside.

**Anatomy:**

```
┌─ Analysis (container) ──────┐  ┌─ Planning ─────────────────┐  ┌─ Solutioning ───────────────┐
│                              │  │                             │  │                               │
│  ┌──────────────────────┐   │  │  ┌──────────────────────┐  │  │  ┌──────────────────────┐    │
│  │ [M] brainstorm    ✓  │───┼──┼─▶│ [J] create-prd    ✓  │──┼──┼─▶│ [W] create-arch   ✓  │    │
│  └──────────────────────┘   │  │  └──────────────────────┘  │  │  └──────────────────────┘    │
│                              │  │  ┌──────────────────────┐  │  │  ┌──────────────────────┐    │
│                              │  │  │ [S] create-ux    ◇   │  │  │  │ [J] create-epics  🔵 │    │
│                              │  │  └──────────────────────┘  │  │  └──────────────────────┘    │
│                              │  │         ▲ Has UI?          │  │                               │
└──────────────────────────────┘  └─────────────────────────────┘  └───────────────────────────────┘
```

**Props:** `streamId`, `flowTemplate` (Full/Quick), `workflowStates[]`, `onNodeClick`, `onNodeHover`

**States:**
- Default: all nodes rendered with current status
- Hover on node: elevated shadow + tooltip trigger (300ms delay)
- Node clicked: triggers zoom-in transition to breadcrumb strip
- First-stream: first available node has subtle pulse animation

**Variants:**
- `FullFlow`: 4 phase containers, all workflow nodes per methodology topology
- `QuickFlow`: centered layout, 2 nodes (quick-spec → quick-dev), violet color scheme

**Accessibility:** Arrow key navigation between nodes (left/right across phases, up/down within phase). Enter to launch. Tab to move between interactive regions. Each node has `aria-label`: "brainstorm workflow, completed, agent Mary"

### WorkflowNode

**Purpose:** Individual interactive node within a phase container. Displays workflow identity, agent, status, and artifact indicator.

**Anatomy:**

```
┌─────────────────────────────┐
│  [M]  brainstorm        ✓   │
│        research.md      📄   │
└─────────────────────────────┘
 ↑      ↑                ↑  ↑
agent  name           status artifact
badge                  icon  indicator
```

**Props:** `workflow`, `agent`, `status`, `artifact?`, `contextDeps[]`, `onClick`, `onHover`, `isNextSuggested`

**States:**

| State | Visual Treatment |
|-------|-----------------|
| Complete | Filled background (`--status-complete` at 15% opacity), checkmark icon, artifact indicator visible |
| Active | Highlighted border (`--status-active`), pulsing dot, agent badge prominent |
| Next suggested | Subtle glow (`--interactive-accent` at 8% opacity), slightly elevated |
| Available | Outline border (`--surface-border`), normal weight |
| Not yet relevant | Dimmed (50% opacity), non-interactive |
| Conditional gate | Diamond icon (◇), gate label below ("Has UI?") |
| Skipped | Dashed border (`--status-skipped`), strikethrough on name |

**Hover tooltip content:**
```
Agent: John (PM)
Skill: /bmad:bmm:workflows:create-epics-and-stories
Loads: architecture.md, PRD.md, ux-spec.md
Produces: epics.md
```

### BreadcrumbStrip

**Purpose:** Collapsed phase graph displayed during active OpenCode sessions. Provides orientation without consuming workspace.

**Anatomy:**

```
[Analysis ✓] → [Planning ✓] → [Solutioning: create-architecture 🔵 W] → [Implementation]
```

**Props:** `phases[]`, `activeWorkflow`, `activeAgent`, `onExpand`

**States:**
- Default: horizontal strip showing phase progression
- Hover on phase label: subtle highlight, cursor pointer
- Click: triggers zoom-out transition back to full phase graph

**Height:** 36px fixed. Phase labels use `--text-sm`. Active phase is visually prominent (brighter text, agent initial badge). Completed phases show ✓ in phase color. Future phases dimmed.

### StreamCard

**Purpose:** Dashboard card representing a single stream. Shows enough information for triage without clicking.

**Anatomy:**

```
┌──────────────────────────────────────────────────┐
│  auth-refactor                      2 days ago   │
│  bmad-studio · Full Flow                         │
│  ● ● ● ◐ ○  Solutioning: create-epics next      │
│              John · 4/7 workflows                │
└──────────────────────────────────────────────────┘
```

**Props:** `stream`, `onClick`

**States:**
- Default: `--surface-raised` background
- Hover: `--surface-border-hover` border, slight elevation
- Active (currently selected in sidebar): left accent border in current phase color

**Phase dots:** Small colored circles (8px) — filled for complete, half for in-progress, outline for pending. Colored per phase.

### AgentBadge

**Purpose:** Colored circle with agent initial letter. Provides instant "who's at the controls" recognition.

**Anatomy:** Circle (20px diameter for nodes, 16px for inline) with agent color background and white letter.

**Props:** `agent` (enum: mary, john, winston, sally, bob, amelia, barry), `size` ('sm' | 'md')

**Variants:**
- `md` (20px): used on workflow nodes
- `sm` (16px): used inline in breadcrumb strip, stream cards, tooltips

### ArtifactViewer

**Purpose:** Rendered markdown viewer for produced artifacts. Sidebar list + content area.

**Anatomy:**

```
┌─ Artifact List (200px) ─┬─ Content Area (flex) ────────────────────┐
│                          │                                          │
│  ✓ research.md      [M] │  # Architecture Decision Record          │
│  ✓ prd.md           [J] │                                          │
│  ✓ architecture.md  [W] │  ## Context                              │
│  ● epics.md         [J] │  Based on the requirements defined in    │
│    stories.md       [B] │  the PRD, we evaluated three approaches  │
│                          │  for the notification system...          │
│                          │                                          │
└──────────────────────────┴──────────────────────────────────────────┘
```

**Props:** `streamId`, `artifacts[]`, `selectedArtifact?`

**States:**
- Artifact list shows: status icon (✓/●/—), artifact name (monospace), agent badge
- Selected artifact highlighted in list, content rendered in main area
- Content area: rendered markdown, `720px` max-width, `--font-mono` for code blocks
- Empty state: "No artifacts yet. Launch a workflow to produce artifacts."

### ConversationPanel

**Purpose:** Native chat UI for OpenCode sessions. Renders streaming messages, tool calls, and tool results from the OpenCode SDK within BMAD Studio's design language. Manages session lifecycle and provides the primary workspace during active AI sessions.

**Anatomy:**

```
┌─ Header (40px) ─────────────────────────────────────────────┐
│  [W] Winston · create-architecture · Solutioning            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ChatPanel (scrollable message list)                        │
│  ├─ MessageBlock (user): plain text                         │
│  ├─ MessageBlock (assistant): markdown, code blocks         │
│  ├─ ToolCall: collapsible tool name + params                │
│  ├─ ToolResult: linked result with success/error styling    │
│  └─ StreamingIndicator: typing/streaming for active message │
│                                                             │
├─ ChatInput (48px) ──────────────────────────────────────────┤
│  [message input field]                          [Send]      │
└─────────────────────────────────────────────────────────────┘
```

**Props:** `streamId`, `workflow`, `agent`, `onSessionEnd`

**States:**
- Initializing: "Starting OpenCode session..." with agent name and workflow label
- Active: streaming messages rendered via SDK events, header shows agent + workflow, input enabled when session idle
- Completed: session ended, "Session complete" indicator, auto-transition to phase graph
- Error: inline error banner with retry button, specific failure reason

### StreamCreationModal

**Purpose:** Fast, structured stream creation. Composed from shadcn/ui Dialog + Input + custom FlowTemplateSelector.

**Composed from:** `Dialog` (shadcn/ui) + `Input` (shadcn/ui) + `Checkbox` (shadcn/ui) + `FlowTemplateSelector` (custom)

**Content:** Stream name input (autofocused), flow template selector, worktree checkbox with auto-generated branch name.

### FlowTemplateSelector

**Purpose:** Card-style two-option picker for selecting Full Flow vs Quick Flow during stream creation.

**Anatomy:**

```
┌─ Full Flow ─────────────────────┐  ┌─ Quick Flow ────────────────────┐
│  ● ● ● ●                       │  │  ⚡ ● ●                          │
│  Research through implementation │  │  Fast track — spec and ship     │
│  4 phases · all workflow steps   │  │  2 steps · Barry agent          │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

**Props:** `selected`, `onSelect`

**States:** Unselected (outline border), selected (phase-colored border + subtle fill), hover (border highlight).

### PhaseDotIndicator

**Purpose:** Compact horizontal dots representing phase progress on stream cards and sidebar entries.

**Anatomy:** `● ● ● ◐ ○` — row of small circles (8px), each representing a phase.

**Props:** `phases[]` with status per phase

**States per dot:** Filled (complete, phase color), half-filled (in-progress, phase color), outline (pending, `--status-pending`).

### ContextDependencyTooltip

**Purpose:** Extended tooltip shown on workflow node hover displaying what artifacts will be loaded as context for the agent.

**Composed from:** `Tooltip` (shadcn/ui) with custom content layout.

**Content layout:**

```
Agent: John (PM)
Skill: /bmad:bmm:workflows:create-epics
───────────────────────────────
Loads:    architecture.md
          PRD.md
          ux-spec.md
───────────────────────────────
Produces: epics.md → (create-story, check-readiness)
```

**Props:** `workflow`, `agent`, `contextFiles[]`, `outputArtifact`, `downstreamConsumers[]`

**Max-width:** 320px. File paths in monospace. 300ms hover delay before showing.

## Component Implementation Strategy

**Layering approach:**

```
Layer 3: Page compositions (Dashboard, StreamDetail, ActiveSession)
         ↑ composed from
Layer 2: Domain components (PhaseGraph, StreamCard, ArtifactViewer, ConversationPanel)
         ↑ composed from
Layer 1: Primitives (shadcn/ui) + Atoms (AgentBadge, PhaseDotIndicator, WorkflowNode)
         ↑ styled by
Layer 0: Design tokens (CSS custom properties + Tailwind config)
```

- **Layer 0** is implemented first: all CSS custom properties and Tailwind extensions
- **Layer 1** components are independent — can be built and tested in isolation
- **Layer 2** components compose Layer 1 and add domain logic (data fetching, state management)
- **Layer 3** composes everything into routable pages

**State management per layer:**

- Layer 1: Stateless presentation components (props in, events out)
- Layer 2: Connected to Zustand stores for stream/phase/session state
- Layer 3: Route-level state (which stream is selected, which view is active)

## Implementation Roadmap

**Phase 1 — Core (blocks all user journeys):**

| Component | Justification | Dependencies |
|-----------|--------------|--------------|
| Design tokens (Layer 0) | Everything else depends on these | None |
| AgentBadge | Used in PhaseGraph, BreadcrumbStrip, StreamCard, ArtifactViewer | Tokens |
| PhaseDotIndicator | Used in StreamCard, sidebar | Tokens |
| WorkflowNode | Core interactive element of the phase graph | AgentBadge, tokens |
| PhaseGraph | The signature element — validates the core UX promise | WorkflowNode |
| StreamCard | Dashboard display — the "morning coffee" view | PhaseDotIndicator, AgentBadge |
| BreadcrumbStrip | Required for active session orientation | Tokens |

**Phase 2 — Session Flow (enables workflow execution):**

| Component | Justification | Dependencies |
|-----------|--------------|--------------|
| ConversationPanel | OpenCode terminal wrapper — the work surface | BreadcrumbStrip |
| ContextDependencyTooltip | Trust-building pre-launch pattern | shadcn Tooltip |
| StreamCreationModal | New stream entry point | shadcn Dialog + Input, FlowTemplateSelector |
| FlowTemplateSelector | Flow template selection during creation | PhaseDotIndicator |

**Phase 3 — Content & Navigation (enriches the experience):**

| Component | Justification | Dependencies |
|-----------|--------------|--------------|
| ArtifactViewer | Artifact browsing and review | AgentBadge, markdown renderer |
| Command palette customization | `Cmd+K` with stream/artifact/action groups | shadcn Command |
