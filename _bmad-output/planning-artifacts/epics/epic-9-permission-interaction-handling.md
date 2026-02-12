# Epic 9: Permission & Interaction Handling

**Goal:** Users maintain control over what AI agents do — approving or denying tool actions and answering agent questions through native UI dialogs.

**FRs covered:** FR-O2 (trust/interaction aspect)
**NFRs addressed:** NFR8 (error display within 2s)
**Carry-forward:** ENTIRELY NEW

## Story 9.1: Permission Dialog

As a developer,
I want to see what tool the agent wants to use and approve or deny it,
So that I maintain control over filesystem operations, command execution, and other potentially impactful actions.

**Acceptance Criteria:**

**Given** an `opencode:permission-asked` IPC event arrives with `{ "permissionId", "tool", "params" }`
**When** the permission dialog renders
**Then** it displays the tool name prominently, the parameters in a readable format (monospace for file paths, formatted JSON for complex params), and Approve/Deny buttons

**Given** the user clicks Approve
**When** the response is sent
**Then** the system calls `window.opencode.approvePermission(permissionId, true)` via IPC
**And** the dialog closes and the session continues

**Given** the user clicks Deny
**When** the response is sent
**Then** the system calls `window.opencode.approvePermission(permissionId, false)` via IPC
**And** the dialog closes and the agent receives the denial

**Given** a permission dialog is showing
**When** keyboard shortcuts are used
**Then** Enter confirms (Approve) and Escape denies, matching standard dialog behavior

**Given** multiple permission requests arrive in quick succession
**When** the first dialog is still open
**Then** subsequent requests queue and display sequentially after the current one is resolved

## Story 9.2: Question Dialog

As a developer,
I want to answer questions the agent asks during a session,
So that the agent can make informed decisions based on my input.

**Acceptance Criteria:**

**Given** an `opencode:question-asked` IPC event with `{ "questionId", "question" }`
**When** the question dialog renders
**Then** it displays the agent's question text and a text input field for the user's answer, with a Submit button

**Given** the user types an answer and clicks Submit
**When** the response is sent
**Then** the system calls `window.opencode.answerQuestion(questionId, answer)` via IPC
**And** the dialog closes and the session continues with the provided answer

**Given** the question dialog
**When** the user presses Enter in the input field
**Then** it submits the answer (same as clicking Submit)

**Given** a question dialog appears during an active conversation
**When** it renders
**Then** it appears as a modal overlay above the chat panel, auto-focusing the input field
**And** the chat panel content remains visible but non-interactive behind the overlay

## Story 9.3: Error Recovery & Timeout Handling

As a developer,
I want clear error messages and retry options when OpenCode sessions fail,
So that I can recover quickly without losing my workflow context.

**Acceptance Criteria:**

**Given** an `opencode:error` IPC event with `{ "code", "message" }`
**When** the error is displayed
**Then** the chat panel shows an inline error banner identifying the failure reason and a "Retry" button (NFR8 — within 2 seconds of failure)

**Given** the user clicks Retry after a session error
**When** the retry is attempted
**Then** the system resends the last prompt to the same session
**And** displays a "Retrying..." indicator

**Given** a session has been idle for longer than the configured timeout (NFR9 — default 120s)
**When** the timeout is detected
**Then** the system displays a warning that the session may have stalled, with options to wait longer or end the session

**Given** the OpenCode server crashes during an active session
**When** the server restarts (Epic 6 auto-recovery)
**Then** the chat panel shows "OpenCode restarting..." and the session cannot resume (known MVP limitation)
**And** the user can launch a new session from the phase graph

---
