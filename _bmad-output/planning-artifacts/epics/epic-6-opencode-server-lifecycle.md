# Epic 6: OpenCode Server Lifecycle

**Goal:** System manages the OpenCode process automatically — users never manually start, monitor, or restart it. The app degrades gracefully when OpenCode isn't installed.

**FRs covered:** FR-O4, FR-PC4
**NFRs addressed:** NFR8 (error display + retry within 2s)
**Carry-forward:** ENTIRELY NEW (replaces old provider abstraction from Epic 1)

## Story 6.1: Go Sidecar Process Management

As a developer,
I want the Electron app to automatically start the Go backend sidecar,
So that the backend is always available when the app is running without manual setup.

**Acceptance Criteria:**

**Given** the Electron main process starts
**When** the app initializes
**Then** it spawns the bundled Go sidecar binary as a child process on port 3008
**And** waits for a health check response before allowing the renderer to connect

**Given** the Go sidecar process exits unexpectedly
**When** the main process detects the exit
**Then** it attempts to restart the sidecar (up to 3 retries with 1-second backoff)
**And** notifies the renderer via IPC of the restart status

**Given** the sidecar fails to start after 3 retries
**When** the main process gives up
**Then** it sends an `opencode:server-error` IPC event to the renderer with a clear error message
**And** the app remains usable for browsing local data but backend-dependent features are disabled

**Given** the app is quitting
**When** the Electron `before-quit` event fires
**Then** the main process terminates the Go sidecar child process cleanly (SIGTERM, then SIGKILL after 5s)

## Story 6.2: OpenCode Server Spawning & Health Monitoring

As a developer,
I want the system to spawn and monitor the OpenCode server,
So that AI sessions are available without me managing a separate process.

**Acceptance Criteria:**

**Given** the Electron main process initializes
**When** OpenCode CLI is detected on PATH
**Then** the system spawns `opencode serve --port <random>` as a child process
**And** selects a random port (49152-65535 range), retrying up to 3 times on port collision
**And** sends `opencode:server-ready` IPC event to the renderer with `{ "port" }` once the server responds to health check

**Given** the OpenCode server process exits unexpectedly
**When** the main process detects the child process exit
**Then** it sends `opencode:server-restarting` IPC event to the renderer
**And** attempts to respawn with a new random port
**And** on successful restart, sends `opencode:server-ready` again

**Given** the OpenCode server fails to start after 3 retries
**When** the main process gives up
**Then** it sends `opencode:server-error` with `{ "code": "server_start_failed", "message": "..." }`
**And** the phase graph still renders but workflow launch buttons indicate OpenCode is unavailable

**Given** the app is quitting
**When** cleanup runs
**Then** the OpenCode server child process is terminated cleanly

## Story 6.3: OpenCode Detection & Not-Installed Handling

As a developer,
I want the system to detect whether OpenCode is installed and guide me through setup if not,
So that I can get started without hunting for installation instructions.

**Acceptance Criteria:**

**Given** the Electron main process starts
**When** `opencode` is not found on PATH
**Then** the app starts normally — Go sidecar launches, stream management works, artifact viewing works
**And** workflow launch buttons on the phase graph are disabled with tooltip: "OpenCode not detected — install to enable AI sessions"
**And** no `opencode:server-ready` event is sent

**Given** OpenCode is not installed
**When** the user navigates to the Settings panel
**Then** a prominent section shows "OpenCode not detected" with a link to installation instructions (FR-PC4)

**Given** OpenCode is installed and has existing configuration (providers, API keys)
**When** the system detects the `opencode` binary
**Then** it reads existing OpenCode configuration to determine available providers and models (FR-O4)
**And** syncs this information to the settings store so the UI can display provider status

**Given** the user installs OpenCode while the app is running
**When** the user triggers a manual "Detect OpenCode" action from Settings
**Then** the system re-checks PATH, spawns the server if found, and updates the UI

---
