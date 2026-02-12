# Epic 4: App Shell & Per-Stream Phase Graph

**Goal:** Users see a visual map of their stream's progress through the BMAD pipeline, navigate between streams, and have the full application frame for all subsequent features.

**FRs covered:** FR-WN1, FR-WN2, FR-WN3, FR-S3 (frontend)
**NFRs addressed:** NFR2 (100ms UI interactions), NFR3 (1s phase graph render)
**Carry-forward:** Heavy rework of old Epic 2 (per-project → per-stream). AppShell/ActivityBar layout concepts carry forward.

## Story 4.1: Design Tokens & Tailwind Configuration

As a developer,
I want a consistent design foundation across the entire application,
So that all components share the same visual language from day one.

**Acceptance Criteria:**

**Given** the UX design specification defines CSS custom properties for colors, typography, and spacing
**When** the design system is initialized
**Then** `globals.css` contains all CSS custom properties (surface colors, phase colors, status colors, interactive accents) as defined in the visual design foundation
**And** `tailwind.config.ts` extends the default config with custom colors referencing CSS variables, font families, spacing scale, and breakpoints (Compact 1024-1279, Standard 1280-1439, Full 1440+)

**Given** the app targets dark mode only for MVP
**When** the design tokens are applied
**Then** all color values are dark-mode appropriate with no light mode toggle

**Given** shadcn/ui is the component library
**When** the project is configured
**Then** shadcn/ui CLI is initialized with the project's Tailwind config, and base primitives (Button, Dialog, Command, Tooltip, Popover, Badge, ScrollArea, Input, Checkbox, Separator) are installed in `src/components/ui/`

## Story 4.2: App Shell Layout

As a developer,
I want a consistent application frame with sidebar navigation,
So that I can switch between dashboard, stream detail, and settings views.

**Acceptance Criteria:**

**Given** the application loads
**When** the App Shell renders
**Then** it displays an ActivityBar (48px wide, icon-only) on the left and a content area filling the remaining width

**Given** the ActivityBar
**When** the user clicks mode icons
**Then** the content area switches between Dashboard view, Stream Detail view, and Settings view
**And** the active mode is visually indicated on the ActivityBar

**Given** a window smaller than 1024x768 (minimum)
**When** the user resizes
**Then** the window enforces minimum dimensions

**Given** the application starts
**When** no project is registered
**Then** the content area shows an empty state prompting the user to open a project folder

## Story 4.3: Frontend Stores & Service Layer

As a developer,
I want centralized state management and backend communication,
So that all components share consistent data and the UI stays in sync with the backend.

**Acceptance Criteria:**

**Given** the Zustand store architecture (one store per domain)
**When** stores are initialized
**Then** `project.store.ts` manages project registry and active project, `stream.store.ts` manages streams, active stream, and phase state, `connection.store.ts` manages Go sidecar WebSocket status, `settings.store.ts` manages global config
**And** each store has `loading` and `error` state fields

**Given** the service layer separation
**When** services are implemented
**Then** `project.service.ts`, `stream.service.ts`, `artifact.service.ts`, and `settings.service.ts` communicate with the Go sidecar via `fetch()` REST calls
**And** `websocket.service.ts` manages the WebSocket connection and dispatches events to stores

**Given** a WebSocket event arrives (e.g., `stream:phase-changed`)
**When** the WebSocket service receives it
**Then** it dispatches to the appropriate store, which updates its state
**And** subscribed components re-render via Zustand selectors

**Given** the Go sidecar is unreachable
**When** `connection.store.ts` detects the failure
**Then** it sets status to disconnected and components can read this state

## Story 4.4: Stream Navigation UI

As a developer,
I want to see and switch between my streams,
So that I can quickly navigate to the stream I want to work on.

**Acceptance Criteria:**

**Given** a project with active streams
**When** the stream list renders
**Then** it displays a `StreamList` with `StreamCard` components for each stream, showing: stream name, project name, flow type, phase dot indicators (`PhaseDotIndicator`), current phase label, and last activity timestamp

**Given** a `StreamCard`
**When** the user clicks it
**Then** the active stream switches, the stream store updates `activeStreamId`, and the content area loads the stream detail view with the phase graph

**Given** phase dot indicators
**When** they render for a stream
**Then** they show small colored circles (filled = complete, half-filled = in-progress, outline = pending) for each BMAD phase, colored per the phase color tokens

**Given** no streams exist for the project
**When** the stream list renders
**Then** an empty state is shown with a "Create your first stream" call-to-action

## Story 4.5: Phase Graph Rendering

As a developer,
I want to see a visual map of where my stream is in the BMAD pipeline,
So that I can orient instantly and know exactly what's been done and what's next.

**Acceptance Criteria:**

**Given** an active stream with phase state data
**When** the phase graph renders
**Then** it displays a two-level visualization: phase containers (Analysis, Planning, Solutioning, Implementation) as horizontal sections, with `WorkflowNode` components inside each phase representing specific BMAD workflows

**Given** each `WorkflowNode`
**When** it renders
**Then** it shows the workflow name, an `AgentBadge` (colored circle with agent initial letter), status icon (checkmark for complete, pulsing dot for active, outline for available, dimmed for not-yet-relevant), and artifact indicator if an artifact exists

**Given** the Full Flow template
**When** the phase graph renders
**Then** all 4 phase containers with all workflow nodes per the BMAD methodology topology are shown

**Given** the Quick Flow template
**When** the phase graph renders
**Then** a centered layout with 2 nodes (quick-spec → quick-dev) is shown with the violet color scheme

**Given** a stream with no artifacts (fresh stream)
**When** the phase graph renders
**Then** the first available workflow node has a subtle pulse animation indicating the suggested starting point

## Story 4.6: Phase Graph Interaction & Accessibility

As a developer,
I want to click workflow nodes on the phase graph and navigate with my keyboard,
So that I can launch workflows, view artifacts, and use the app efficiently.

**Acceptance Criteria:**

**Given** a completed workflow node
**When** the user clicks it
**Then** it navigates to the artifact viewer showing the produced artifact (read-only) (FR-WN3)

**Given** a current or upcoming workflow node
**When** the user clicks it
**Then** it shows available BMAD skills/workflows for that phase (FR-WN3) — in later epics this triggers OpenCode session launch

**Given** the Full Flow template
**When** the phase graph renders with conditional gates
**Then** conditional gates (e.g., "Has UI?" for create-ux-design) are displayed as diamond icons with gate labels, and gated workflow nodes are shown/hidden based on gate state

**Given** accessibility requirements
**When** the user navigates the phase graph
**Then** arrow keys move between nodes (left/right across phases, up/down within phase), Enter activates the focused node, and each node has an `aria-label` describing workflow, status, and agent

**Given** the Tab key
**When** pressed from outside the phase graph
**Then** focus enters the phase graph at the currently active or first available node, and Tab again exits to the next interactive region

## Story 4.7: Session Orientation Components

As a developer,
I want to maintain orientation during active sessions and see what context an agent will use before launching,
So that I never lose my place and I trust the agent has the right information.

**Acceptance Criteria:**

**Given** an active OpenCode session (rendered in later epics)
**When** the BreadcrumbStrip renders
**Then** it shows a compact 36px horizontal strip: phase labels with completion indicators, the active workflow highlighted with agent badge, and future phases dimmed
**And** clicking the strip expands back to the full phase graph

**Given** a workflow node on the phase graph
**When** the user hovers for 300ms
**Then** a `ContextDependencyTooltip` appears (max-width 320px) showing: agent name and role, BMAD skill command, artifacts that will be loaded as context (monospace file paths), and the artifact this workflow produces

**Given** the tooltip content
**When** upstream artifacts are missing
**Then** the tooltip indicates which context files are not yet available, helping the user decide whether to proceed

## Story 4.8: Electron Packaging & Distribution

As a developer,
I want the application packaged as a distributable desktop app,
So that I can install it like any other application and share it with early adopters.

**Acceptance Criteria:**

**Given** the project uses electron-builder
**When** the build pipeline runs for macOS
**Then** it produces a `.dmg` installer containing the bundled Electron app, React frontend, and Go sidecar binary
**And** the app launches correctly from the installed location

**Given** the project uses electron-builder
**When** the build pipeline runs for Linux
**Then** it produces an `.AppImage` that runs on common Linux distributions (Ubuntu 22+, Fedora 38+)

**Given** the packaged application
**When** a user installs and opens it for the first time
**Then** the Go sidecar binary is found and launched from the app bundle
**And** the central store initializes at `~/.bmad-studio/`
**And** no external dependencies are required beyond git and optionally OpenCode

**Given** the build configuration
**When** the app is signed (macOS)
**Then** the code signing certificate is applied so macOS Gatekeeper allows installation without security warnings

---
