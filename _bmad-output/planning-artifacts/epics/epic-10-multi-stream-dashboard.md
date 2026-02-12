# Epic 10: Multi-Stream Dashboard

**Goal:** The "morning coffee" view — users see all projects and streams at a glance, create new streams, browse artifacts, and navigate with keyboard shortcuts.

**FRs covered:** FR-PM2, FR-PM3
**NFRs addressed:** NFR4 (2s dashboard load), NFR2 (100ms interactions)
**Carry-forward:** Rework of old Epic 2 Story 2.5 (App Shell) + new dashboard concept

## Story 10.1: Dashboard & Project Overview

As a developer,
I want a home view showing all my projects and their active streams,
So that I can triage what needs attention across everything I'm working on.

**Acceptance Criteria:**

**Given** the user navigates to the Dashboard view (via ActivityBar)
**When** projects are registered
**Then** the dashboard renders a `ProjectOverview` card for each project showing: project name, repo path, count of active streams, and a list of `StreamCard` summaries

**Given** a `ProjectOverview` card
**When** it displays stream summaries
**Then** each `StreamCard` shows stream name, flow type, phase dot indicators, current phase label, next suggested workflow, and last activity timestamp (e.g., "2 days ago")

**Given** multiple registered projects
**When** the user clicks a project
**Then** the active project switches in `project.store.ts` and the stream list updates to show that project's streams (FR-PM3)

**Given** the dashboard loads
**When** all stream statuses are fetched
**Then** the dashboard renders within 2 seconds regardless of stream count (NFR4)

**Given** no projects are registered
**When** the dashboard renders
**Then** an empty state shows with guidance: "Open a project folder to get started" with an action button

## Story 10.2: Stream Creation Modal

As a developer,
I want a fast, structured way to create a new stream,
So that I can start tracking a new feature/idea in under 10 seconds.

**Acceptance Criteria:**

**Given** the user triggers stream creation (button on dashboard or stream list)
**When** the modal opens
**Then** it displays: a stream name input (auto-focused), a `FlowTemplateSelector` (Full Flow / Quick Flow), and a worktree checkbox (default on) with auto-generated branch name preview `stream/{name}`

**Given** the `FlowTemplateSelector`
**When** it renders
**Then** it shows two card-style options: Full Flow (4 phases, all workflow steps, phase dot preview) and Quick Flow (2 steps, Barry agent, fast-track description)
**And** Full Flow is selected by default

**Given** the user enters a name and clicks Create
**When** the stream is created
**Then** the system calls the stream create API (Epic 2), optionally creates a worktree (Epic 5), and navigates to the new stream's phase graph

**Given** the worktree checkbox is unchecked
**When** the stream is created
**Then** no worktree is created, and `stream.json` has `worktree: null` and `branch: null`

**Given** validation
**When** the user enters an invalid name (empty, duplicates, special characters)
**Then** inline error feedback appears below the input field without dismissing the modal

## Story 10.3: Artifact Viewer

As a developer,
I want to browse and read artifacts produced within a stream,
So that I can review decisions, PRDs, architecture docs, and epics without leaving the app.

**Acceptance Criteria:**

**Given** a stream with artifacts
**When** the artifact viewer opens (from phase graph node click on completed workflow, or from artifact panel)
**Then** it renders a sidebar list (200px) of artifacts with: status icon (checkmark for complete), artifact name (monospace), and agent badge showing which agent produced it

**Given** the artifact sidebar
**When** the user clicks an artifact
**Then** the content area renders the artifact markdown through `MarkdownRenderer` with 720px max-width, proper heading hierarchy, code blocks, tables, and lists

**Given** a sharded artifact (e.g., `prd/index.md` with sub-files)
**When** the artifact list renders
**Then** the sharded artifact appears as a single entry that expands to show sub-files (e.g., `executive-summary.md`, `functional-requirements.md`)

**Given** a stream with no artifacts
**When** the artifact viewer renders
**Then** an empty state shows: "No artifacts yet. Launch a workflow to produce artifacts."

**Given** artifact content
**When** the user views it
**Then** the content is read-only — no editing capability in MVP

## Story 10.4: Command Palette

As a developer,
I want a keyboard-driven command palette for fast navigation,
So that I can switch streams, search artifacts, and trigger actions without reaching for the mouse.

**Acceptance Criteria:**

**Given** the user presses `Cmd+K` (macOS) or `Ctrl+K` (Linux) anywhere in the app
**When** the command palette opens
**Then** it displays a search input with grouped results: Streams (switch to stream), Projects (switch project), Artifacts (open artifact), and Actions (create stream, open settings)

**Given** the user types in the search input
**When** results filter
**Then** fuzzy matching applies across all groups, with the most relevant results ranked first
**And** each result shows an icon, label, and secondary text (e.g., stream name + current phase)

**Given** a result is selected (Enter or click)
**When** the action executes
**Then** the palette closes and the corresponding navigation occurs (e.g., switch to stream loads phase graph, open artifact loads viewer)

**Given** the palette is open
**When** the user presses Escape
**Then** the palette closes without action

**Given** recent items
**When** the palette opens with no search text
**Then** recently accessed streams and artifacts appear as a "Recent" group for quick access

---
