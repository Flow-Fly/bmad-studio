# Epic 5: Worktree Operations

**Goal:** Each stream gets an isolated git environment — safe parallel development on multiple features without branch switching.

**FRs covered:** FR-W1, FR-W2, FR-W3
**Carry-forward:** ENTIRELY NEW

## Story 5.1: Create Worktree for Stream

As a developer,
I want a git worktree created when I start a new stream,
So that I get an isolated working directory and branch without manually running git commands.

**Acceptance Criteria:**

**Given** a registered project with a valid git repository
**When** a worktree is requested for a stream named "payment-integration"
**Then** the system runs `git worktree add` to create a worktree at `{repo-parent}/bmad-wt-payment-integration/` on branch `stream/payment-integration`
**And** updates `stream.json` with `worktree` path and `branch` name

**Given** the branch `stream/payment-integration` already exists
**When** worktree creation is attempted
**Then** the system returns an error with the git output explaining the conflict

**Given** the worktree path already exists on disk
**When** worktree creation is attempted
**Then** the system returns an error indicating the path conflict

**Given** git is not installed on the system
**When** any worktree operation is attempted
**Then** the system returns an error indicating git is required for worktree features

**Given** a `POST /projects/:id/streams/:sid/worktree` request
**When** the stream exists and has no worktree
**Then** the system creates the worktree and returns the worktree path and branch name

## Story 5.2: Switch to Stream Worktree

As a developer,
I want to switch to a stream's worktree directory from the UI,
So that my editor and terminal are pointed at the right code for the stream I'm working on.

**Acceptance Criteria:**

**Given** a stream with an active worktree
**When** a `POST /projects/:id/streams/:sid/worktree/switch` request is made
**Then** the system returns the worktree path for the frontend to use (e.g., open in file manager or pass to OpenCode as working directory)

**Given** a stream without a worktree
**When** the switch request is made
**Then** the system returns an error indicating no worktree exists for this stream

**Given** a worktree path that no longer exists on disk
**When** the switch request is made
**Then** the system detects the missing directory and returns an error with guidance to recreate

## Story 5.3: Cleanup Worktree on Archive

As a developer,
I want worktrees cleaned up when I archive a stream,
So that stale branches and directories don't accumulate on my machine.

**Acceptance Criteria:**

**Given** a stream with a worktree whose branch has been merged
**When** the stream is archived
**Then** the system runs `git worktree remove` to delete the worktree directory
**And** deletes the branch `stream/{stream-name}`

**Given** a stream with a worktree that has unmerged changes
**When** the stream archive is requested
**Then** the system returns a warning indicating unmerged changes exist
**And** does NOT force-delete the worktree
**And** returns the unmerged status so the frontend can prompt the user to choose: keep worktree, delete anyway, or merge first

**Given** a `DELETE /projects/:id/streams/:sid/worktree` request
**When** the worktree exists
**Then** the system removes the worktree (with force check for dirty state) and clears the `worktree` and `branch` fields in `stream.json`

**Given** the worktree directory was already manually deleted
**When** cleanup runs on archive
**Then** the system runs `git worktree prune` to clean up stale references and proceeds with archival

---
