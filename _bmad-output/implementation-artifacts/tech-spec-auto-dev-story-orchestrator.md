---
title: 'Auto-Dev Story Orchestrator'
slug: 'auto-dev-story-orchestrator'
created: '2026-02-03'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Claude Code skills (markdown)', 'Task tool (agent dispatch)', 'Bash (git ops)', 'YAML (sprint-status state)']
files_to_modify: ['.claude/commands/auto-dev.md']
code_patterns: ['Skill thin wrapper pattern', 'Task agent dispatch with YOLO mode', 'Sprint-status.yaml as shared state', 'workflow.xml + workflow.yaml agent execution']
test_patterns: ['Manual execution testing']
---

# Tech-Spec: Auto-Dev Story Orchestrator

**Created:** 2026-02-03

## Overview

### Problem Statement

Running the BMAD development loop (create-story, dev-story, commit, code-review, fix, commit, PR, merge) requires manual orchestration — checking sprint status, invoking skills in separate contexts, switching between agents, and handling git operations. This is repetitive, error-prone, and begging to be automated.

### Solution

A Claude Code skill that automates the single-story development cycle by reading sprint status, spawning fresh agents for each phase (create, develop, review), and handling git operations between phases. Each major step runs in an isolated agent context via the Task tool, with sprint-status.yaml as the shared state between steps.

### Scope

**In Scope:**
- Single story automation loop: status check → create-story → dev-story → commit → parallel-code-review → fix → commit → PR → merge
- Fresh agent context per major step (create-story, dev-story, code-review)
- Autonomous execution within the story loop (no user gates)
- Uses existing workflows (create-story, dev-story, parallel-code-review) via agent instructions
- Git operations between phases (commit, branch, PR, merge)

**Out of Scope:**
- Multi-story looping (story-to-story repeat)
- Epic-level gating (gate between epics)
- Cross-epic orchestration
- Modifications to existing BMAD workflows
- New UI components in bmad-studio

## Context for Development

### Codebase Patterns

- **Skill thin wrapper**: All skills in `.claude/commands/` follow identical pattern — load `workflow.xml`, pass `workflow.yaml` path, execute. Task agents replicate this by reading the same files directly.
- **Workflow engine**: `_bmad/core/tasks/workflow.xml` is the core OS — supports normal and YOLO execution modes. YOLO skips all confirmations and runs autonomously.
- **YOLO activation**: Triggered by responding `[y]` at template-output checkpoints. Agents can be instructed to activate YOLO immediately.
- **Custom workflows**: Live in `_bmad/_config/custom/` (e.g., parallel-code-review)
- **Sprint tracking**: `_bmad-output/implementation-artifacts/sprint-status.yaml` tracks epic/story statuses. Status flow: backlog → ready-for-dev → in-progress → review → done
- **Story files**: Created at `_bmad-output/implementation-artifacts/{story_key}.md` by create-story workflow
- **Auto-discovery**: Both create-story and dev-story auto-discover the next story by reading sprint-status.yaml top-to-bottom for the first matching status (backlog or ready-for-dev respectively)
- **Parallel code-review invocation**: Not a registered skill. Invoked via standard code-review skill with custom path override: `_bmad/_config/custom/parallel-code-review/`
- **Parallel code-review flow**: Writes prompt to `/tmp/bmad-gemini-review-prompt.md`, dispatches `cat prompt | gemini > output 2>&1` in background, runs Claude review in parallel, synthesizes findings with dedup + severity elevation for dual-confirmed issues
- **Review continuation**: dev-story detects post-review action items and can resume implementation for fixes

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint state — determines next story, shared state between steps |
| `_bmad/_config/custom/parallel-code-review/workflow.yaml` | Parallel review config — defines Gemini temp files, input patterns |
| `_bmad/_config/custom/parallel-code-review/instructions.xml` | Parallel review execution — 7-step dual-reviewer orchestration |
| `_bmad/_config/custom/parallel-code-review/checklist.md` | Review validation checklist |
| `_bmad/core/tasks/workflow.xml` | Core workflow engine — agents load this to execute any workflow |
| `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | Create-story config — auto-discovers backlog stories |
| `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml` | Create-story execution — 6-step story creation with context aggregation |
| `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` | Dev-story config — auto-discovers ready-for-dev stories |
| `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml` | Dev-story execution — 10-step TDD implementation loop |
| `.claude/commands/bmad/bmm/workflows/create-story.md` | Create-story skill (thin wrapper reference) |
| `.claude/commands/bmad/bmm/workflows/dev-story.md` | Dev-story skill (thin wrapper reference) |
| `.claude/commands/bmad/bmm/workflows/code-review.md` | Code-review skill (thin wrapper, accepts custom path override) |

### Technical Decisions

- **Orchestrator as Claude Code skill**: The skill IS the orchestrator — it reads state, spawns agents, handles git. Not a workflow.xml-based workflow (meta-workflow that coordinates other workflows).
- **Task tool for agent isolation**: Each major step (create, dev, review) gets a fresh `general-purpose` Task agent context. Agents read workflow.xml + workflow.yaml directly (bypassing Skill tool which isn't available in Task agents).
- **YOLO mode for all agent steps**: Orchestrator instructs each agent to activate YOLO immediately — no interactive checkpoints within automated steps.
- **sprint-status.yaml as shared state**: Orchestrator re-reads this between steps to determine progress, discover story keys, and verify status transitions.
- **Existing workflows unchanged**: Orchestrator instructs agents to load and execute existing workflow files as-is. No modifications to create-story, dev-story, or code-review workflows.
- **Gemini CLI always available**: No fallback needed for parallel code-review.
- **Single file implementation**: The entire orchestrator is a single `.claude/commands/auto-dev.md` skill file.

## Implementation Plan

### Tasks

All tasks target a single file: `.claude/commands/auto-dev.md`

- [x] Task 1: Create skill file with frontmatter and overview
  - File: `.claude/commands/auto-dev.md`
  - Action: Create with frontmatter (`name: auto-dev`, `description: Automates single-story dev cycle: create → implement → review → fix → PR → merge`). Add a brief overview explaining the skill's purpose and the full loop it executes.

- [x] Task 2: Write Phase 1 — Status Check & Story Discovery
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to read `_bmad-output/implementation-artifacts/sprint-status.yaml`, parse `development_status`, find the current in-progress epic, and determine the next actionable story. Logic:
    - Find first story with status `backlog` → start from create-story phase
    - Find first story with status `ready-for-dev` → skip to dev-story phase
    - Find first story with status `in-progress` → skip to dev-story phase (resume)
    - Find first story with status `review` → skip to code-review phase
    - No actionable stories → report epic complete or no work available
  - Notes: Extract `story_key` (e.g., `3-2-chat-service-message-sending`), `epic_num`, `story_num` from the matched entry. Store the current epic branch name.

- [x] Task 3: Write Phase 2 — Story Branch Creation
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to create a feature branch for the story from the current epic branch. Use Bash to run:
    - `git checkout -b story/{story_key}` (from current epic branch)
  - Notes: Only create branch if story is starting fresh (backlog or ready-for-dev). If resuming (in-progress/review), check if branch already exists and switch to it.

- [x] Task 4: Write Phase 3 — Create Story (Agent Dispatch)
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to spawn a `general-purpose` Task agent with the following prompt template:
    ```
    You are executing the BMAD create-story workflow autonomously.

    1. Read the FULL file at {project-root}/_bmad/core/tasks/workflow.xml
    2. This is the CORE OS for executing BMAD workflows
    3. Pass the workflow config path: _bmad/bmm/workflows/4-implementation/create-story/workflow.yaml
    4. Execute workflow.xml instructions EXACTLY as written
    5. CRITICAL: Activate YOLO mode immediately — when you encounter any template-output checkpoint, respond [y] to skip confirmations
    6. Save outputs after EACH section
    7. Run to completion without pausing for user input
    ```
  - Notes: After agent returns, re-read sprint-status.yaml and verify the story transitioned from `backlog` → `ready-for-dev`. If not, halt with error.
  - Skip condition: Skip this phase if story was already `ready-for-dev` or later.

- [x] Task 5: Write Phase 4 — Implement Story (Agent Dispatch)
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to spawn a `general-purpose` Task agent with the following prompt template:
    ```
    You are executing the BMAD dev-story workflow autonomously.

    1. Read the FULL file at {project-root}/_bmad/core/tasks/workflow.xml
    2. This is the CORE OS for executing BMAD workflows
    3. Pass the workflow config path: _bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml
    4. Execute workflow.xml instructions EXACTLY as written
    5. CRITICAL: Activate YOLO mode immediately — when you encounter any template-output checkpoint, respond [y] to skip confirmations
    6. Run continuously until ALL tasks in the story are complete
    7. Do NOT pause for user input — run to completion
    ```
  - Notes: After agent returns, re-read sprint-status.yaml and verify the story transitioned to `review`. If not, halt with error.
  - Skip condition: Skip if story was already in `review`.

- [x] Task 6: Write Phase 5 — Post-Dev Commit
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to commit all changes after dev-story completes. Use Bash:
    - `git add -A`
    - `git commit -m "feat({story_key}): implement story"` (use story key from Phase 1)
  - Notes: If nothing to commit (clean working tree), skip. Don't fail on empty commit.

- [x] Task 7: Write Phase 6 — Code Review (Agent Dispatch)
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to spawn a `general-purpose` Task agent with the following prompt template:
    ```
    You are executing the BMAD code-review workflow with the parallel dual-reviewer configuration.

    1. Read the FULL file at {project-root}/_bmad/core/tasks/workflow.xml
    2. This is the CORE OS for executing BMAD workflows
    3. Pass the workflow config path: _bmad/_config/custom/parallel-code-review/workflow.yaml
    4. Execute workflow.xml instructions EXACTLY as written
    5. The story to review is: {story_key} at {story_file_path}
    6. When presented with fix options, choose [1] Fix automatically for all HIGH and MEDIUM issues
    7. Run to completion
    ```
  - Notes: After agent returns, re-read sprint-status.yaml and check story status. If `done` → proceed to PR. If `in-progress` → fixes were created, proceed to fix phase.

- [x] Task 8: Write Phase 7 — Fix Handling
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to handle post-review fixes. If sprint-status shows story back to `in-progress`:
    - Spawn a `general-purpose` Task agent with dev-story prompt (same as Task 5) — dev-story auto-detects review continuation mode and processes `[AI-Review]` action items
    - After agent returns, verify story is back to `review` or `done`
    - Commit fixes: `git add -A && git commit -m "fix({story_key}): address code review findings"`
  - Notes: If story is already `done` after review, skip this phase entirely.

- [x] Task 9: Write Phase 8 — Finalize (Push + PR + Merge)
  - File: `.claude/commands/auto-dev.md`
  - Action: Instructions to finalize the story:
    - Push branch: `git push -u origin story/{story_key}`
    - Create PR: `gh pr create --title "Story {story_key}" --base {epic_branch} --body "Automated implementation via auto-dev orchestrator"`
    - Merge PR: `gh pr merge --merge`
    - Switch back to epic branch: `git checkout {epic_branch} && git pull`
  - Notes: Epic branch is the branch that was active when auto-dev started (e.g., `epic/3-agent-conversation-xp`).

- [x] Task 10: Write validation and error handling
  - File: `.claude/commands/auto-dev.md`
  - Action: Add validation rules between each phase:
    - After each agent dispatch: re-read sprint-status.yaml and verify expected status transition
    - If status didn't transition as expected: halt and report which phase failed and current state
    - If git operations fail: halt and report the error
    - If no actionable stories found: report "No stories to process" and exit gracefully
  - Notes: Each phase should have a clear success condition and failure mode documented inline.

### Acceptance Criteria

- [x] AC 1: Given sprint-status.yaml has a story in `backlog`, when auto-dev is invoked, then it spawns a create-story agent that produces the story file and sprint-status shows `ready-for-dev`
- [x] AC 2: Given a `ready-for-dev` story exists, when the dev-story phase runs, then it spawns a dev-story agent that implements the story and sprint-status shows `review`
- [x] AC 3: Given dev-story completes with code changes, when the commit phase runs, then all changes are committed with message format `feat({story_key}): implement story`
- [x] AC 4: Given committed changes on a story branch, when the review phase runs, then it spawns a parallel-code-review agent using `_bmad/_config/custom/parallel-code-review/workflow.yaml`
- [x] AC 5: Given code review identifies HIGH/MEDIUM issues and sets story to `in-progress`, when the fix phase runs, then it re-dispatches dev-story which detects review-continuation mode and implements fixes
- [x] AC 6: Given story reaches `done` status, when the finalize phase runs, then it pushes the branch, creates a PR targeting the epic branch, and merges it
- [x] AC 7: Given a phase fails or produces unexpected status, when the orchestrator detects the failure, then it halts execution and reports which phase failed and the current sprint-status state
- [x] AC 8: Given a story is already partially through the loop (e.g., `in-progress` or `review`), when auto-dev is invoked, then it resumes from the correct phase instead of starting over

## Additional Context

### Dependencies

- **Existing BMAD workflows**: create-story, dev-story, and code-review workflows must be functional and unchanged
- **sprint-status.yaml**: Must exist with at least one epic in `in-progress` and stories in actionable states
- **Gemini CLI**: Must be available on PATH for parallel code-review (`gemini` command)
- **GitHub CLI**: Must be authenticated for PR creation and merge (`gh` command)
- **Git**: Working tree must be clean when auto-dev starts (no uncommitted changes)

### Testing Strategy

- **Manual end-to-end test**: Invoke `/auto-dev` on the current project with epic-3 which has story `3-2-chat-service-message-sending` in `in-progress` status. Verify the full loop executes.
- **Phase-by-phase verification**: After each phase, manually check sprint-status.yaml to confirm expected status transitions.
- **Resume test**: Interrupt the orchestrator mid-loop, re-invoke, and verify it picks up from the correct phase.
- **Edge case test**: Invoke when no backlog stories exist — verify graceful exit message.

### Notes

- **Branching convention observed**: Epic branches follow `epic/{num}-{name}`, story branches observed as `Story/{story_key}` in git history. The orchestrator should use `story/{story_key}` (lowercase) for consistency.
- **Agent prompt quality is critical**: The Task agent prompts are the core interface between the orchestrator and the sub-workflows. If agents don't execute properly, the prompts need tuning. Consider this the primary iteration surface.
- **YOLO mode caveat**: YOLO is designed for template-output workflows. dev-story is an action-workflow that runs continuously by design. The YOLO instruction in the prompt is a safety net — dev-story may not need it but it won't hurt.
- **Future iteration — multi-story loop**: The natural next step is wrapping the single-story loop in a repeat that processes all stories in the current epic sequentially, with a gate between epics.
- **Future iteration — parallel stories**: Some stories could theoretically run in parallel if they have no dependencies. This is out of scope but worth noting for later.
- **Context budget consideration**: Each Task agent gets a fresh context. Complex workflows (especially dev-story with many files to implement) may hit context limits. Monitor for this during testing.

## Review Notes
- Adversarial review completed
- Findings: 13 total, 8 fixed, 5 skipped
- Resolution approach: walk-through
- Key fixes: dirty-tree guard, file verification before staging, sprint-status done write-back, agent prompt alignment, epic branch creation from dev, rebase before push, review-fix commit on done path, branch cleanup
