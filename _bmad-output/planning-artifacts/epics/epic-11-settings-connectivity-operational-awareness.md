# Epic 11: Settings, Connectivity & Operational Awareness

**Goal:** Users configure the app, see provider status, work when offline in view-only mode, and track AI session costs.

**FRs covered:** FR-PC1, FR-PC2, FR-PC3, FR-CO1, FR-CO2, FR-CO3, FR-CT1, FR-CT2
**NFRs addressed:** NFR5 (keychain encryption), NFR6 (no key exposure), NFR7 (no telemetry), NFR10 (no-restart provider switch)
**Carry-forward:** Rework of old Epic 7 (operational awareness)

## Story 11.1: Settings Panel

As a developer,
I want a central place to view and manage application settings,
So that I can configure BMAD Studio's behavior and see system status at a glance.

**Acceptance Criteria:**

**Given** the user navigates to Settings (via ActivityBar)
**When** the Settings panel renders
**Then** it displays sections for: OpenCode status (installed/not, server running/stopped, version), Provider configuration status (detected providers and models), Global preferences (default worktree creation toggle, artifact store path), and Application info (version, platform)

**Given** any setting is changed
**When** the user modifies a value
**Then** the system saves to `config.json` via the settings API
**And** the change takes effect without application restart (NFR10)

**Given** OpenCode is not installed
**When** the settings panel renders
**Then** the OpenCode section shows a prominent "Not Detected" status with installation instructions link and a "Re-detect" button

**Given** OpenCode is installed and running
**When** the settings panel renders
**Then** the OpenCode section shows "Running" with the server port, detected providers, and available models

## Story 11.2: Provider Configuration Sync

As a developer,
I want BMAD Studio to detect my existing OpenCode provider configuration,
So that I don't have to configure API keys twice.

**Acceptance Criteria:**

**Given** OpenCode is installed with existing provider configuration
**When** the system detects OpenCode on startup
**Then** it reads OpenCode's config to determine available providers (e.g., Anthropic, OpenAI) and their configured models
**And** displays this in the Settings panel and makes it available for session launch (FR-PC2)

**Given** OpenCode has no provider configuration (fresh install)
**When** the user accesses first-time setup
**Then** the Settings panel shows a provider setup form where the user can enter API keys and select a default model (FR-PC1)
**And** the system writes this configuration to OpenCode's config location so both tools share it

**Given** API keys are entered
**When** the user saves provider configuration
**Then** API keys are stored encrypted in the OS keychain (macOS Keychain / Linux Secret Service) (NFR5)
**And** keys are never displayed in plain text in the UI after initial entry (NFR6)

**Given** provider credentials
**When** the user triggers validation
**Then** the system tests the credentials against the provider API and reports success or specific failure reason (FR-PC3)

## Story 11.3: Connectivity Detection & Offline Mode

As a developer,
I want to browse my streams and artifacts when I'm offline,
So that I can review decisions and orient myself even without internet access.

**Acceptance Criteria:**

**Given** the system monitors network connectivity
**When** internet connection is lost
**Then** `connection.store.ts` updates to offline status
**And** a subtle banner appears indicating offline mode (FR-CO1)

**Given** the app is offline
**When** the user navigates the dashboard, stream list, phase graph, and artifact viewer
**Then** all view-only operations work normally — data is read from the local central store (FR-CO2)

**Given** the app is offline
**When** the user attempts to launch a workflow (click a phase graph node)
**Then** the action is disabled with a message: "Requires internet connection for cloud AI providers" (FR-CO3)
**And** if the user has local models configured through OpenCode, the message indicates local models may still work

**Given** internet connectivity is restored
**When** the system detects the change
**Then** the offline banner dismisses, workflow launch buttons re-enable, and normal operation resumes

## Story 11.4: Cost Tracking Display

As a developer,
I want to see how much my AI sessions cost,
So that I can track spending and make informed decisions about model usage.

**Acceptance Criteria:**

**Given** OpenCode session data includes token usage and cost information
**When** the data is available from OpenCode's output
**Then** the system captures and stores cost metadata per session: tokens used (input/output), estimated cost, model used, and timestamp (FR-CT1)

**Given** cost data exists for a stream
**When** the user views stream detail
**Then** a cost summary shows total tokens and estimated cost across all sessions in that stream

**Given** cost data exists across streams
**When** the user views the project dashboard
**Then** a project-level cost summary aggregates cost across all streams (FR-CT2)

**Given** OpenCode does not expose cost data (or the data format is not yet known)
**When** cost information is unavailable
**Then** the cost section shows "Cost data not available" rather than errors
**And** the feature degrades gracefully — no cost UI appears if there's nothing to show
