# Technical Research: BMAD File Structure for UI Integration

**Research Type:** Technical (Local Codebase Analysis)
**Date:** 2026-01-28
**Author:** Mary (Business Analyst Agent)
**Purpose:** Inform the design of missing Epic stories for the BMAD-to-UI integration layer in bmad-studio

---

## Executive Summary

This research documents the complete file structure and integration points of the BMAD Method as installed in a project. The findings reveal a well-structured, convention-based system that can be deterministically parsed by a Go sidecar without LLM involvement for workflow state, agent selection, and artifact tracking.

**Key Findings:**
1. Workflow state is tracked via two YAML files with clear status definitions
2. Agents are self-contained markdown files with embedded XML for menu/activation
3. Artifacts use YAML frontmatter for linking to workflows and tracking completion
4. Phase/workflow definitions are hierarchical YAML files in a `paths/` folder
5. A micro-file architecture governs step execution with clear continuation patterns

---

## Table of Contents

1. [Overall Directory Structure](#1-overall-directory-structure)
2. [The `_bmad/` Folder - Source of Truth](#2-the-_bmad-folder---source-of-truth)
3. [The `_bmad-output/` Folder - Generated Artifacts](#3-the-_bmad-output-folder---generated-artifacts)
4. [How BMAD Knows Which Workflow Step You're On](#4-how-bmad-knows-which-workflow-step-youre-on)
5. [How Artifacts Are Linked to Workflows](#5-how-artifacts-are-linked-to-workflows)
6. [How Agents Get Loaded/Selected](#6-how-agents-get-loadedselected)
7. [Integration Points for Go Sidecar](#7-integration-points-for-go-sidecar)
8. [Recommendations for UI Integration Stories](#8-recommendations-for-ui-integration-stories)

---

## 1. Overall Directory Structure

```
project-root/
├── _bmad/                          # BMAD Installation (read-only for UI)
│   ├── core/                       # Core BMAD system (shared across modules)
│   │   ├── agents/                 # Core agents (bmad-master)
│   │   ├── config.yaml             # Core configuration
│   │   ├── tasks/                  # Task definitions (workflow.xml is critical)
│   │   ├── resources/              # Shared resources (excalidraw helpers, etc.)
│   │   └── workflows/              # Core workflows (brainstorming, party-mode)
│   │
│   ├── bmm/                        # BMad Method Module
│   │   ├── agents/                 # All BMAD agents (analyst, architect, pm, etc.)
│   │   ├── config.yaml             # Module configuration
│   │   ├── data/                   # Templates and standards
│   │   ├── teams/                  # Team configurations
│   │   ├── testarch/               # Test architecture patterns
│   │   └── workflows/              # All workflow definitions
│   │       ├── 1-analysis/         # Phase 1 workflows
│   │       ├── 2-plan-workflows/   # Phase 2 workflows
│   │       ├── 3-solutioning/      # Phase 3 workflows
│   │       ├── 4-implementation/   # Phase 4 workflows
│   │       └── workflow-status/    # Status tracking system
│   │
│   ├── bmb/                        # BMad Builder Module (for creating BMAD extensions)
│   ├── cis/                        # Creative Innovation Suite Module
│   ├── _config/                    # Installation configuration
│   └── _memory/                    # Persistent memory (if enabled)
│
└── _bmad-output/                   # Generated Artifacts (read/write for UI)
    ├── project-context.md          # Project rules for AI agents
    ├── planning-artifacts/         # Analysis, Planning, Solutioning outputs
    │   ├── bmm-workflow-status.yaml    # **CRITICAL: Workflow progress tracking**
    │   ├── product-brief-*.md
    │   ├── prd.md
    │   ├── architecture.md
    │   ├── epics.md
    │   ├── ux-design-specification/    # Sharded folder example
    │   │   ├── index.md
    │   │   └── *.md
    │   ├── research/
    │   └── brainstorming/
    │
    ├── implementation-artifacts/   # Phase 4 outputs
    │   ├── sprint-status.yaml      # **CRITICAL: Implementation progress tracking**
    │   └── {story-id}.md           # Individual story files
    │
    └── automation-summary.md       # Optional automation notes
```

---

## 2. The `_bmad/` Folder - Source of Truth

### 2.1 Configuration Files

**`_bmad/bmm/config.yaml`** - Module configuration:
```yaml
project_name: bmad-studio
user_skill_level: intermediate
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
user_name: Flow
communication_language: English
document_output_language: English
output_folder: "{project-root}/_bmad-output"
```

**Key Integration Point:** The Go sidecar should read this file to resolve all `{config_source}:` references in workflow definitions.

### 2.2 Workflow Definitions

Workflows exist in two formats:

**Format 1: `workflow.yaml`** (structured data):
```yaml
name: dev-story
description: "Execute a story by implementing tasks/subtasks..."
config_source: "{project-root}/_bmad/bmm/config.yaml"
installed_path: "{project-root}/_bmad/bmm/workflows/4-implementation/dev-story"
instructions: "{installed_path}/instructions.xml"
validation: "{installed_path}/checklist.md"
standalone: true
```

**Format 2: `workflow.md`** (hybrid markdown with frontmatter):
```yaml
---
name: create-architecture
description: Collaborative architectural decision facilitation...
web_bundle: true
---

# Architecture Workflow

**Goal:** Create comprehensive architecture decisions...

## INITIALIZATION
Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve...

## EXECUTION
Load and execute `steps/step-01-init.md` to begin the workflow.
```

**Key Insight:** Both formats contain:
- `name` - Workflow identifier
- `description` - Human-readable purpose
- `config_source` - Path to config for variable resolution
- `installed_path` - Base path for relative references
- `instructions` - Path to step files (either `.xml` or `.md`)

### 2.3 Phase/Path Definitions

**`_bmad/bmm/workflows/workflow-status/paths/method-greenfield.yaml`**:
```yaml
method_name: "BMad Method"
track: "bmad-method"
field_type: "greenfield"
description: "Complete product and system design methodology..."

phases:
  - phase: 1
    name: "Analysis (Optional)"
    optional: true
    workflows:
      - id: "brainstorm-project"
        exec: "{project-root}/_bmad/core/workflows/brainstorming/workflow.md"
        optional: true
        agent: "analyst"
        command: "/bmad:bmm:workflows:brainstorming"
      # ... more workflows

  - phase: 2
    name: "Planning"
    required: true
    workflows:
      - id: "prd"
        exec: "{project-root}/_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md"
        required: true
        agent: "pm"
        command: "/bmad:bmm:workflows:create-prd"
        output: "Product Requirements Document with FRs and NFRs"
      # ... more workflows
```

**Key Integration Point:** This file defines the complete workflow graph including:
- Phase numbers and names
- Workflow IDs within each phase
- Required vs optional status
- Which agent handles each workflow
- The command to invoke each workflow
- Expected outputs

Available path files:
- `method-greenfield.yaml` - Standard BMAD for new projects
- `method-brownfield.yaml` - BMAD for existing codebases
- `enterprise-greenfield.yaml` - Extended enterprise version
- `enterprise-brownfield.yaml` - Enterprise for existing codebases

### 2.4 Agent Definitions

**`_bmad/bmm/agents/architect.md`**:
```markdown
---
name: "architect"
description: "Architect"
---

You must fully embody this agent's persona...

```xml
<agent id="architect.agent.yaml" name="Winston" title="Architect" icon="🏗️">
  <activation critical="MANDATORY">
    <step n="1">Load persona from this current agent file</step>
    <step n="2">Load and read {project-root}/_bmad/bmm/config.yaml</step>
    <step n="3">Remember: user's name is {user_name}</step>
    <step n="4">Show greeting using {user_name}, then display menu</step>
    <step n="5">STOP and WAIT for user input</step>
  </activation>

  <persona>
    <role>System Architect + Technical Design Leader</role>
    <identity>Senior architect with expertise in distributed systems...</identity>
    <communication_style>Speaks in calm, pragmatic tones...</communication_style>
    <principles>Channel expert lean architecture wisdom...</principles>
  </persona>

  <menu>
    <item cmd="MH">[MH] Redisplay Menu Help</item>
    <item cmd="CH">[CH] Chat with the Agent</item>
    <item cmd="CA" exec="...workflow.md">[CA] Create an Architecture Document</item>
    <!-- ... more menu items -->
  </menu>
</agent>
```

**Available Agents in `_bmad/bmm/agents/`:**
| File | Name | Title | Icon |
|------|------|-------|------|
| analyst.md | Mary | Business Analyst | 📊 |
| architect.md | Winston | Architect | 🏗️ |
| dev.md | (varies) | Developer | 💻 |
| pm.md | (varies) | Product Manager | 📋 |
| sm.md | (varies) | Scrum Master | 🎯 |
| tea.md | (varies) | Test Architect | 🧪 |
| ux-designer.md | (varies) | UX Designer | 🎨 |
| tech-writer.md | (varies) | Technical Writer | 📝 |
| quick-flow-solo-dev.md | (varies) | Solo Dev | ⚡ |

**Key Integration Point:** Each agent file contains:
- YAML frontmatter with `name` and `description`
- XML block with `<agent>` containing:
  - `id`, `name`, `title`, `icon` attributes
  - `<persona>` with role, identity, communication style
  - `<menu>` with available commands/workflows

---

## 3. The `_bmad-output/` Folder - Generated Artifacts

### 3.1 Workflow Status Tracking

**`_bmad-output/planning-artifacts/bmm-workflow-status.yaml`**:
```yaml
# STATUS DEFINITIONS:
# - required: Must be completed to progress
# - optional: Can be completed but not required
# - {file-path}: Workflow completed, artifact at path
# - skipped: Optional workflow that was skipped

generated: "2026-01-27"
project: "bmad-studio"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  # Phase 1: Analysis (Optional)
  brainstorm-project: "_bmad-output/planning-artifacts/brainstorming/..."
  research: skipped
  product-brief: "_bmad-output/planning-artifacts/product-brief-bmad-studio.md"

  # Phase 2: Planning
  prd: "_bmad-output/planning-artifacts/prd.md"
  create-ux-design: "_bmad-output/planning-artifacts/ux-design-specification/index.md"

  # Phase 3: Solutioning
  create-architecture: "_bmad-output/planning-artifacts/architecture.md"
  create-epics-and-stories: required    # <-- Next workflow
  test-design: optional
  implementation-readiness: required

  # Phase 4: Implementation
  sprint-planning: required
```

**Status Value Interpretation:**
| Value | Meaning | UI State |
|-------|---------|----------|
| `required` | Must be done, not yet started | Locked or Available |
| `optional` | Can be skipped | Available (dimmed) |
| `recommended` | Suggested but optional | Available (highlighted) |
| `conditional` | Depends on conditions (e.g., `if_has_ui`) | Conditional lock |
| `skipped` | Explicitly skipped | Completed (gray) |
| `{file-path}` | Completed, artifact exists | Completed (green) |

### 3.2 Sprint/Implementation Status Tracking

**`_bmad-output/implementation-artifacts/sprint-status.yaml`**:
```yaml
generated: 2026-01-27
project: bmad-studio
project_key: bmad-studio
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  # Epic 1: Application Foundation
  epic-1: in-progress
  1-1-project-scaffolding: review
  1-2-go-backend-foundation: backlog
  1-3-provider-interface-claude: backlog
  epic-1-retrospective: optional

  # Epic 2: Project & Workflow State
  epic-2: backlog
  2-1-project-open-bmad-config: backlog
  # ... more stories
```

**Status Definitions:**
| Status | Meaning |
|--------|---------|
| `backlog` | Not started (epic or story) |
| `ready-for-dev` | Story file created, ready to implement |
| `in-progress` | Currently being worked on |
| `review` | Ready for code review |
| `done` | Completed |
| `optional` | For retrospectives |

### 3.3 Artifact Frontmatter Pattern

**All generated artifacts use YAML frontmatter:**

```yaml
---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
completedAt: '2026-01-27'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification/index.md
---

# Document Title

Content...
```

**Frontmatter Fields:**
| Field | Purpose |
|-------|---------|
| `stepsCompleted` | Array of completed workflow steps |
| `status` | `in-progress` or `complete` |
| `completedAt` | ISO date of completion |
| `inputDocuments` | Array of documents used as input |
| `workflowType` | Which workflow created this (optional) |
| `classification` | Project type metadata (optional) |

---

## 4. How BMAD Knows Which Workflow Step You're On

### 4.1 Workflow Step Tracking

BMAD uses a **micro-file architecture** where each step is a separate file:

```
_bmad/bmm/workflows/3-solutioning/create-architecture/
├── workflow.md                    # Entry point
├── architecture-decision-template.md  # Output template
└── steps/
    ├── step-01-init.md           # Initialization
    ├── step-01b-continue.md      # Continuation handler
    ├── step-02-context.md        # Project context analysis
    ├── step-03-starter.md        # Starter template evaluation
    ├── step-04-decisions.md      # Core decisions
    ├── step-05-patterns.md       # Implementation patterns
    ├── step-06-structure.md      # Project structure
    ├── step-07-validation.md     # Architecture validation
    └── step-08-complete.md       # Completion
```

### 4.2 Step State Tracking

Step progress is tracked in the **artifact's frontmatter**, not a separate file:

```yaml
---
stepsCompleted: [1, 2, 3, 4, 5]
status: in-progress
---
```

When a workflow resumes:
1. Read the output artifact's frontmatter
2. Check `stepsCompleted` array
3. If exists, load `step-01b-continue.md` (continuation handler)
4. Continue from next incomplete step

### 4.3 The Workflow Execution Engine

**`_bmad/core/tasks/workflow.xml`** is the core execution engine that:
1. Loads workflow configuration (`.yaml` or `.md`)
2. Resolves all variable references from config
3. Executes instructions step by step
4. Handles step attributes (optional, conditional, repeat)
5. Saves to template output after each `<template-output>` tag
6. Tracks completion in frontmatter

**Key Mandates:**
- Execute ALL steps in exact order
- Save after EVERY template-output tag
- NEVER skip a step
- Handle continuation from existing artifacts

---

## 5. How Artifacts Are Linked to Workflows

### 5.1 Linking Mechanism

Artifacts are linked to workflows through:

1. **Status File Path Value:**
   ```yaml
   workflow_status:
     prd: "_bmad-output/planning-artifacts/prd.md"
   ```
   The workflow ID (`prd`) maps to the artifact path.

2. **Artifact Frontmatter:**
   ```yaml
   inputDocuments:
     - _bmad-output/planning-artifacts/prd.md
     - _bmad-output/planning-artifacts/architecture.md
   ```
   Documents reference their input sources.

3. **Story Files Reference Sources:**
   ```markdown
   ### References
   - [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation]
   - [Source: _bmad-output/planning-artifacts/prd.md#Technical-Architecture]
   ```

### 5.2 Artifact Discovery Patterns

BMAD uses glob patterns to discover artifacts:

```
*prd*.md           → PRD document
*architecture*.md  → Architecture document
*brief*.md         → Product brief
*epics*.md         → Epic breakdown
*ux-design*/index.md → UX design (sharded folder)
*research*.md      → Research documents
```

**Sharded Folder Pattern:**
When content is large, it's split into folders:
```
ux-design-specification/
├── index.md                      # Master index
├── core-user-experience.md
├── design-system-foundation.md
├── user-journey-flows.md
└── ...
```

The `index.md` serves as table of contents.

---

## 6. How Agents Get Loaded/Selected

### 6.1 Agent Selection Flow

1. **Path File Defines Agent-Workflow Mapping:**
   ```yaml
   - id: "create-architecture"
     agent: "architect"
     command: "/bmad:bmm:workflows:create-architecture"
   ```

2. **User Invokes Agent or Workflow:**
   - Direct: `/bmad:bmm:agents:architect`
   - Via workflow: `/bmad:bmm:workflows:create-architecture`

3. **Agent File Loaded:**
   - Read `_bmad/bmm/agents/architect.md`
   - Parse YAML frontmatter for metadata
   - Parse XML block for persona, menu, activation

4. **Activation Sequence:**
   - Load config from `_bmad/bmm/config.yaml`
   - Store session variables (`user_name`, `communication_language`)
   - Show greeting and menu
   - Wait for user input

### 6.2 Agent Menu System

Each agent has a menu with workflow bindings:

```xml
<menu>
  <item cmd="MH">[MH] Redisplay Menu Help</item>
  <item cmd="CH">[CH] Chat with the Agent</item>
  <item cmd="WS" workflow="...workflow-status/workflow.yaml">[WS] Workflow Status</item>
  <item cmd="CA" exec="...create-architecture/workflow.md">[CA] Create Architecture</item>
  <item cmd="DA">[DA] Dismiss Agent</item>
</menu>
```

**Menu Item Attributes:**
| Attribute | Purpose |
|-----------|---------|
| `cmd` | Trigger command (short code or fuzzy match) |
| `workflow` | Path to workflow.yaml (uses workflow.xml runner) |
| `exec` | Path to workflow.md (direct execution) |
| `data` | Optional data file to pass as context |
| `action` | Special action (e.g., dismiss) |

### 6.3 Agent Handoff

Agents suggest handoffs via conversation:
```
"For the architecture decisions, I recommend switching to Winston (Architect).
Would you like me to hand off to the Architect agent?"
```

The UI can detect handoff suggestions and show a "Switch to Architect" button.

---

## 7. Integration Points for Go Sidecar

### 7.1 Files to Parse

| File | Purpose | Parse Method |
|------|---------|--------------|
| `_bmad/bmm/config.yaml` | Configuration | YAML |
| `_bmad/bmm/workflows/workflow-status/paths/*.yaml` | Phase/workflow definitions | YAML |
| `_bmad/bmm/agents/*.md` | Agent definitions | YAML frontmatter + XML extraction |
| `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` | Workflow progress | YAML |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint progress | YAML |
| `_bmad-output/**/*.md` | Artifact frontmatter | YAML frontmatter extraction |

### 7.2 Deterministic Operations (No LLM Needed)

| Operation | Data Source |
|-----------|-------------|
| "What phase am I in?" | Parse `bmm-workflow-status.yaml`, find first non-complete workflow, look up phase in path file |
| "What workflow is next?" | Same as above |
| "Is workflow X complete?" | Check `workflow_status[x]` - file path = complete |
| "What agents are available?" | List files in `_bmad/bmm/agents/` |
| "What workflows can agent X run?" | Parse agent file, extract menu items with workflow/exec attributes |
| "What artifacts exist?" | Scan `_bmad-output/`, parse frontmatter |
| "What stories are in progress?" | Parse `sprint-status.yaml` |

### 7.3 Artifact Registry Structure

The Go sidecar should build and maintain an artifact registry:

```json
{
  "artifacts": [
    {
      "id": "prd",
      "type": "prd",
      "path": "_bmad-output/planning-artifacts/prd.md",
      "status": "complete",
      "completedAt": "2026-01-27",
      "stepsCompleted": ["step-01-init", "step-02-discovery", ...],
      "inputDocuments": [...],
      "workflowId": "prd",
      "phase": 2
    },
    {
      "id": "architecture",
      "type": "architecture",
      "path": "_bmad-output/planning-artifacts/architecture.md",
      "status": "complete",
      ...
    }
  ],
  "shardedArtifacts": [
    {
      "id": "ux-design",
      "type": "ux-design",
      "indexPath": "_bmad-output/planning-artifacts/ux-design-specification/index.md",
      "shards": [
        "core-user-experience.md",
        "design-system-foundation.md",
        ...
      ]
    }
  ]
}
```

### 7.4 Classification Strategy

Multi-layer artifact classification:

1. **Filename Pattern Matching:**
   | Pattern | Type |
   |---------|------|
   | `*prd*` | PRD |
   | `*architecture*` | Architecture |
   | `*brief*` | Product Brief |
   | `*epic*` | Epics |
   | `*ux-design*` | UX Design |
   | `*research*` | Research |
   | `*story*` or `{n}-{n}-*` | Story |

2. **Frontmatter Parsing:**
   - Check `workflowType` field if present
   - Check `status` for completion
   - Check `stepsCompleted` for progress

3. **Cross-Reference with Status Files:**
   - Match paths in `bmm-workflow-status.yaml`
   - Match story IDs in `sprint-status.yaml`

4. **Content Structure Analysis (fallback):**
   - Section headings (e.g., "## Functional Requirements" → PRD)
   - Template markers

---

## 8. Recommendations for UI Integration Stories

Based on this research, the following stories are needed:

### Epic 0 (or additions to Epic 2): BMAD Integration Layer

**Story: Parse BMAD Configuration**
- Read `_bmad/bmm/config.yaml`
- Resolve all variable placeholders
- Make config available to all services
- AC: Config values accessible via API endpoint

**Story: Parse Workflow Path Definitions**
- Read all files from `_bmad/bmm/workflows/workflow-status/paths/`
- Build workflow graph with phases, workflows, dependencies
- Map workflow IDs to agents and commands
- AC: Phase graph data available via API

**Story: Build Artifact Registry**
- Scan `_bmad-output/` on startup
- Parse frontmatter from all `.md` files
- Classify artifacts by pattern + frontmatter
- Store in `~/.bmad-studio/projects/{name}/artifact-registry.json`
- AC: Registry endpoint returns all artifacts with metadata

**Story: Watch for File Changes**
- Use fsnotify to watch `_bmad-output/`
- Update artifact registry on file create/modify/delete
- Emit events for UI to refresh
- AC: Registry updates within 1s of file change

**Story: Compute Phase Completeness**
- Parse `bmm-workflow-status.yaml`
- Cross-reference with path definitions
- Calculate phase completion percentages
- Determine current phase and next workflow
- AC: Phase status endpoint returns computed state

**Story: Parse Agent Definitions**
- Read all files from `_bmad/bmm/agents/`
- Extract YAML frontmatter
- Parse XML for persona, menu, icon
- AC: Agent list endpoint with full metadata

**Story: Read Sprint Status**
- Parse `sprint-status.yaml`
- Build story status map
- Calculate epic completion
- AC: Sprint status endpoint for implementation phase

### Context Injection Contract

When sending messages to LLM, inject:

```xml
<bmad_context>
  <project name="bmad-studio" track="bmad-method" field_type="greenfield" />

  <current_state>
    <phase>3</phase>
    <phase_name>Solutioning</phase_name>
    <next_workflow>create-epics-and-stories</next_workflow>
    <next_agent>pm</next_agent>
  </current_state>

  <artifact_registry>
    <artifact type="prd" status="complete" path="..." />
    <artifact type="architecture" status="complete" path="..." />
    <!-- ... -->
  </artifact_registry>

  <active_agent>
    <name>Mary</name>
    <title>Business Analyst</title>
    <persona>Strategic Business Analyst + Requirements Expert</persona>
  </active_agent>
</bmad_context>
```

---

## Appendix A: Key File Paths Quick Reference

| Purpose | Path |
|---------|------|
| Module Config | `_bmad/bmm/config.yaml` |
| Path Definitions | `_bmad/bmm/workflows/workflow-status/paths/*.yaml` |
| Workflow Status | `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` |
| Sprint Status | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Agents | `_bmad/bmm/agents/*.md` |
| Workflow Definitions | `_bmad/bmm/workflows/{phase}/{workflow-name}/workflow.md` or `.yaml` |
| Workflow Steps | `_bmad/bmm/workflows/{phase}/{workflow-name}/steps/step-*.md` |
| Workflow Engine | `_bmad/core/tasks/workflow.xml` |
| Project Context | `_bmad-output/project-context.md` |

---

## Appendix B: Status Value Quick Reference

### bmm-workflow-status.yaml

| Value | Meaning |
|-------|---------|
| `required` | Must complete, not started |
| `optional` | Can skip |
| `recommended` | Suggested |
| `conditional` | Depends on conditions |
| `skipped` | Explicitly skipped |
| `{file-path}` | Completed, artifact at path |

### sprint-status.yaml

| Value | Meaning |
|-------|---------|
| `backlog` | Not started |
| `ready-for-dev` | Story file created |
| `in-progress` | Being worked on |
| `review` | Ready for review |
| `done` | Completed |

---

*Research completed: 2026-01-28*
