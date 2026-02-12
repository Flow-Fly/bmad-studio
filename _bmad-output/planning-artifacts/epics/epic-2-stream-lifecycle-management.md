# Epic 2: Stream Lifecycle Management

**Goal:** Users can create, view, switch, and archive streams — the core entity of the cockpit. Each stream represents an idea/feature progressing through BMAD phases.

**FRs covered:** FR-S1, FR-S2, FR-S3, FR-S4, FR-S5
**NFRs addressed:** NFR11 (immediate persistence), NFR12 (crash-safe)
**Carry-forward:** ENTIRELY NEW (streams are a new concept)

## Story 2.1: Create Stream

As a developer,
I want to create a new stream within my project,
So that I can track a feature/idea through the BMAD pipeline with its own artifact space.

**Acceptance Criteria:**

**Given** a registered project
**When** the user creates a stream with a name (e.g., "payment-integration")
**Then** the system creates `~/.bmad-studio/projects/{project}-{stream}/` directory
**And** writes a `stream.json` with `name`, `project`, `status: "active"`, `type: "full"`, `phase: null`, `branch: null`, `worktree: null`, `createdAt`, `updatedAt`
**And** persists immediately via atomic JSON write (NFR11)

**Given** a stream name that already exists for the project
**When** the user attempts to create a duplicate
**Then** the system returns an error indicating the name is taken

**Given** a stream name with special characters
**When** the user creates the stream
**Then** the system validates the name contains only alphanumeric characters, hyphens, and underscores

**Given** a stream is successfully created
**When** the WebSocket hub receives the event
**Then** a `stream:created` event is broadcast with `{ "projectId", "streamId", "name" }`

## Story 2.2: List & View Streams

As a developer,
I want to view all streams for my project with their current phase and status,
So that I can see what's in flight and where each feature stands.

**Acceptance Criteria:**

**Given** a registered project with active streams
**When** the user requests the stream list
**Then** the system scans all `{project}-*` sibling directories, reads each `stream.json`, and returns the list sorted by `updatedAt` descending

**Given** a specific stream
**When** the user requests stream detail
**Then** the system returns the full `stream.json` content including derived phase state

**Given** a project with no streams
**When** the user requests the stream list
**Then** the system returns an empty array

**Given** a stream directory exists but `stream.json` is corrupted
**When** the system scans streams
**Then** it skips the corrupted stream, includes remaining streams, and logs a warning (NFR13)

## Story 2.3: Archive Stream

As a developer,
I want to archive a stream as completed or abandoned,
So that finished work moves out of my active view while preserving its artifacts.

**Acceptance Criteria:**

**Given** an active stream
**When** the user archives with outcome `"merged"`
**Then** the system moves the stream directory from `projects/{project}-{stream}/` to `projects/archive/{project}-{stream}/`
**And** updates `stream.json` with `status: "archived"`, `outcome: "merged"`, and `updatedAt`

**Given** an active stream
**When** the user archives with outcome `"abandoned"`
**Then** the system moves the stream directory to `archive/` and sets `outcome: "abandoned"`

**Given** a stream is archived
**When** the WebSocket hub receives the event
**Then** a `stream:archived` event is broadcast with `{ "projectId", "streamId", "outcome" }`

**Given** the archive directory does not exist
**When** the first stream is archived
**Then** the system creates `projects/archive/` before moving the stream

## Story 2.4: Stream REST Endpoints

As a developer,
I want stream operations exposed through the REST API,
So that the frontend can manage streams for any registered project.

**Acceptance Criteria:**

**Given** a `POST /projects/:id/streams` request with `{ "name": "payment-integration" }`
**When** the project exists and name is valid
**Then** the system creates the stream and returns stream details with 201 status

**Given** a `GET /projects/:id/streams` request
**When** the project has streams
**Then** the system returns all active streams (excludes archived) for that project

**Given** a `GET /projects/:id/streams/:sid` request
**When** the stream exists
**Then** the system returns full stream detail including phase state

**Given** a `PUT /projects/:id/streams/:sid` request with metadata updates
**When** the stream exists
**Then** the system updates `stream.json` and broadcasts `stream:updated`

**Given** a `POST /projects/:id/streams/:sid/archive` request with `{ "outcome": "merged" }`
**When** the stream is active
**Then** the system archives the stream and returns 200

---
