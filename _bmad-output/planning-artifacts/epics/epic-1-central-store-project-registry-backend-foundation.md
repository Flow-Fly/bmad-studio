# Epic 1: Central Store, Project Registry & Backend Foundation

**Goal:** System has a home for all project data; projects can be registered and managed through a REST API with real-time event broadcasting.

**FRs covered:** FR-PM1, FR-PM4, FR-AM3, FR-AM5
**NFRs addressed:** NFR11 (immediate persistence), NFR12 (crash-safe writes), NFR13 (corruption tolerance)
**Carry-forward:** Partial from old Epic 1 (Go backend foundation), old Epic 6 (project registry concept)

## Story 1.1: Central Store Initialization & Atomic Write Layer

As a developer,
I want the system to create and manage a reliable central store at `~/.bmad-studio/`,
So that all my project data persists safely across sessions without corruption.

**Acceptance Criteria:**

**Given** the application starts for the first time
**When** the central store directory does not exist
**Then** the system creates `~/.bmad-studio/` with `registry.json` (empty projects array) and `config.json` (default settings)

**Given** any JSON metadata file needs to be written
**When** the atomic write helper is called
**Then** content is written to a `.tmp` file, fsynced, then renamed to the target path (atomic on POSIX)
**And** a crash at any point leaves either the old or new file — never corrupt

**Given** the central store already exists
**When** the application starts
**Then** the system validates the directory structure without overwriting existing files

**Given** a corrupted JSON file exists in the central store
**When** the system reads the file on startup
**Then** the system logs a warning and continues with defaults rather than crashing (NFR13)

## Story 1.2: Project Registration & Store Directory Setup

As a developer,
I want to register my project folder with BMAD Studio,
So that the system creates a project store and tracks it in the registry.

**Acceptance Criteria:**

**Given** a valid project folder path containing a git repository
**When** the user registers the project
**Then** the system creates `~/.bmad-studio/projects/{project-name}/` with a `project.json` containing `name`, `repoPath`, `createdAt`, and `settings`
**And** adds the project to `registry.json` with `name`, `repoPath`, and `storePath`

**Given** a project is already registered
**When** the user attempts to register the same repo path
**Then** the system returns an error indicating the project is already registered

**Given** a registered project
**When** the user unregisters the project
**Then** the project entry is removed from `registry.json`
**And** the project store directory is NOT deleted (user must manually clean up)

**Given** the registry contains multiple projects
**When** the system lists projects
**Then** all registered projects are returned with their `name`, `repoPath`, and `storePath`

## Story 1.3: Project Management REST API

As a developer,
I want to manage projects through a REST API,
So that the frontend can register, list, view, and unregister projects.

**Acceptance Criteria:**

**Given** the Go sidecar starts on port 3008
**When** the HTTP server initializes
**Then** it serves REST endpoints with CORS middleware (allowing `localhost:3007`) and JSON error format `{ "error": { "code": "...", "message": "..." } }`

**Given** a `POST /projects` request with `{ "repoPath": "/path/to/project" }`
**When** the path is valid and not already registered
**Then** the system registers the project and returns the project details with 201 status
**And** all JSON responses use `camelCase` field names

**Given** a `GET /projects` request
**When** there are registered projects
**Then** the system returns the full list from `registry.json`

**Given** a `GET /projects/:id` request
**When** the project exists
**Then** the system returns project details from `project.json`

**Given** a `DELETE /projects/:id` request
**When** the project is registered
**Then** the system unregisters the project and returns 200 status

**Given** a `GET /settings` or `PUT /settings` request
**When** the request is valid
**Then** the system reads or updates `config.json` with global settings

## Story 1.4: WebSocket Event Hub

As a developer,
I want the system to broadcast real-time events over WebSocket,
So that the frontend stays up-to-date without polling.

**Acceptance Criteria:**

**Given** the Go sidecar is running
**When** a client connects to the WebSocket endpoint
**Then** the hub registers the connection and sends a `connection:status` event with `{ "status": "connected" }`

**Given** a registered WebSocket connection
**When** a server-side event occurs (project, stream, or artifact change)
**Then** the hub broadcasts the event to all connected clients

**Given** a WebSocket connection drops
**When** the client reconnects
**Then** the hub registers the new connection and sends `connection:status` connected

**Given** multiple concurrent WebSocket connections
**When** an event is broadcast
**Then** all connected clients receive the event

---
