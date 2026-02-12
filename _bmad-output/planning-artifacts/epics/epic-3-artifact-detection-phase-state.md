# Epic 3: Artifact Detection & Phase State

**Goal:** System automatically tracks artifacts and derives which BMAD phase each stream is in — no manual status tracking. Artifacts created by OpenCode sessions are detected in real-time.

**FRs covered:** FR-AM1, FR-AM2, FR-AM4, FR-O3, FR-WN2
**NFRs addressed:** NFR3 (1s phase graph render — fast derivation)
**Carry-forward:** Rework of old Epic 0 Stories 0.5 (artifact registry) + 0.6 (file watcher) — now targeting central store

## Story 3.1: Artifact File Watcher

As a developer,
I want the system to watch my stream directories for new or changed files,
So that artifacts are detected automatically as OpenCode sessions produce them.

**Acceptance Criteria:**

**Given** a registered project with active streams
**When** the watcher service starts
**Then** it creates fsnotify watches on all `{project}-{stream}/` directories under `~/.bmad-studio/projects/`

**Given** a new file is created in a stream directory
**When** the fsnotify event fires
**Then** the watcher debounces events (100ms) to handle rapid writes
**And** ignores `.tmp` files (atomic write pattern)

**Given** a file is modified or deleted in a stream directory
**When** the debounced event processes
**Then** the watcher determines which stream the file belongs to (from path)
**And** broadcasts `artifact:created`, `artifact:updated`, or `artifact:deleted` via WebSocket with `{ "projectId", "streamId", "filename", "phase" }`

**Given** a new stream is created (after watcher is running)
**When** the stream directory appears
**Then** the watcher adds a watch for the new directory

**Given** a stream is archived
**When** the stream directory moves to `archive/`
**Then** the watcher removes the watch for that directory

## Story 3.2: Phase Derivation Logic

As a developer,
I want the system to know which BMAD phase each stream is in based on what artifacts exist,
So that I never need to manually update progress — the phase graph reflects reality.

**Acceptance Criteria:**

**Given** the phase → artifact mapping:
- Analysis: `brainstorm*`, `research*` (at least one)
- Planning: `prd.md` OR `prd/index.md`
- Solutioning: `architecture*` OR `architecture/index.md`
- Implementation: `epics/` folder with at least one file

**When** the system derives phase state for a stream
**Then** it checks artifacts using glob patterns, checking both flat files and sharded folders
**And** returns the highest completed phase

**Given** an artifact event fires (create/update/delete)
**When** the watcher processes the event
**Then** it re-derives phase state for the affected stream
**And** if the phase changed, broadcasts `stream:phase-changed` with `{ "projectId", "streamId", "phase", "artifacts" }`
**And** updates the cached `phase` field in `stream.json`

**Given** a stream with no artifacts
**When** phase is derived
**Then** phase is `null` (no phase completed)

**Given** a stream is loaded (e.g., on app start or stream list request)
**When** phase state is needed
**Then** the system derives phase from the filesystem (source of truth) rather than relying solely on cached `stream.json` value

## Story 3.3: Artifact Listing & Content Reading

As a developer,
I want to see all artifacts in a stream and read their content,
So that I can review what's been produced at each phase.

**Acceptance Criteria:**

**Given** a `GET /projects/:id/streams/:sid/artifacts` request
**When** the stream has artifacts
**Then** the system returns a list of artifacts with `filename`, `phase`, `type` (file or directory), `modifiedAt`, and `size`
**And** both flat files (e.g., `prd.md`) and sharded folders (e.g., `prd/index.md`) are listed

**Given** a `GET /projects/:id/streams/:sid/artifacts/*path` request for a flat file (e.g., `prd.md`)
**When** the file exists
**Then** the system returns the file content as text

**Given** a `GET /projects/:id/streams/:sid/artifacts/*path` request for a nested file (e.g., `prd/executive-summary.md`)
**When** the file exists within a sharded artifact folder
**Then** the system returns the nested file content

**Given** an artifact path that doesn't exist
**When** the read request is made
**Then** the system returns 404 with appropriate error message

**Given** a `stream.json` or other metadata file in the stream directory
**When** artifacts are listed
**Then** metadata files are excluded from the artifact list (only content files returned)

---
