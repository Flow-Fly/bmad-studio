# Functional Requirements

## Stream Management

- **FR-S1:** User can create a new stream (name, flow template) within a project. MVP supports two flow templates: Full Flow (complete BMAD pipeline — Analysis, Planning, Solutioning, Implementation) and Quick Flow (two-step fast track — spec and dev). Users can skip phases manually in Full Flow.
- **FR-S2:** User can view all streams for a project with their current phase and status
- **FR-S3:** User can switch between streams; switching loads the stream's phase graph and artifact list
- **FR-S4:** User can archive a stream as completed or abandoned
- **FR-S5:** System persists stream metadata (status, creation date, current phase, associated branch) in the central store

## Worktree Management

- **FR-W1:** System creates a git worktree when a stream is created (user-configurable, on by default)
- **FR-W2:** System cleans up the worktree when a stream is archived
- **FR-W3:** User can switch to a stream's worktree directory from the UI

## Project Management

- **FR-PM1:** User can open an existing project folder containing BMAD configuration
- **FR-PM2:** User can view the project dashboard showing all streams and their current phases
- **FR-PM3:** User can switch between 2 or more registered projects
- **FR-PM4:** System maintains a project registry linking project folders to their central artifact store locations

## Workflow Navigation

- **FR-WN1:** User can view the per-stream phase graph showing BMAD phases (Analysis, Planning, Solutioning, Implementation)
- **FR-WN2:** User can see which phase and workflow step is currently active for the selected stream
- **FR-WN3:** User can click a completed phase node to view its artifact (read-only), or click a current/upcoming phase node to see available BMAD skills/workflows for that phase
- **FR-WN4:** User can launch a BMAD workflow from the phase graph, which triggers the OpenCode session launcher for the corresponding skill

## OpenCode Integration

- **FR-O1:** User can launch an OpenCode session for a specific BMAD skill (e.g., `/bmad:bmm:workflows:prd`). System creates an OpenCode session via SDK with the configured skill, working directory, and context from prior phases.
- **FR-O2:** User interacts with the OpenCode session through BMAD Studio's native chat UI, which renders streaming messages, tool calls, and tool results from the OpenCode SDK. The chat UI displays markdown, syntax-highlighted code blocks, collapsible tool call details, and streaming text indicators.
- **FR-O3:** When an OpenCode session ends, system reads produced artifacts from the stream's central store folder and updates the phase graph to reflect new artifacts.
- **FR-O4:** System detects and syncs with existing OpenCode configuration (agents, providers, keys) if already installed

## Provider Configuration

- **FR-PC1:** User can configure initial LLM provider settings (API keys, model selection) through BMAD Studio during first-time setup or when OpenCode configuration is not detected
- **FR-PC2:** System syncs provider configuration with OpenCode — reads existing config on detection, writes new config on initial setup
- **FR-PC3:** System validates provider credentials before use
- **FR-PC4:** If OpenCode is not installed, system guides user through installation and initial provider setup

## Artifact Management

- **FR-AM1:** User can view all artifacts produced within a stream, organized by type (brainstorm, PRD, architecture, epics, stories). Artifact viewing is read-only in MVP; editing is performed externally (editor or OpenCode session).
- **FR-AM2:** User can see which workflow/skill produced each artifact and when
- **FR-AM3:** Artifacts are stored in the centralized location: `~/.bmad-studio/projects/{project}/streams/{stream}/`
- **FR-AM4:** System maintains artifact metadata linking each artifact to its source workflow, stream, and creation date
- **FR-AM5:** Central artifact store can be independently git-versioned

## Connectivity & Offline

- **FR-CO1:** System detects when no internet connection is available
- **FR-CO2:** User can browse streams, artifacts, and the project dashboard in view-only mode when offline
- **FR-CO3:** System indicates which operations require connectivity (OpenCode sessions with cloud LLM providers)

## Cost Tracking

- **FR-CT1:** User can view cost data from OpenCode sessions (token usage, estimated cost) when available from OpenCode's output
- **FR-CT2:** User can view cumulative cost data across a stream's sessions and across the project
