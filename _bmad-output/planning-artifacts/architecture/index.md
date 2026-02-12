---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-12'
inputDocuments:
  - planning-artifacts/prd/index.md (8 files)
  - planning-artifacts/prd/executive-summary.md
  - planning-artifacts/prd/functional-requirements.md
  - planning-artifacts/prd/non-functional-requirements.md
  - planning-artifacts/prd/project-scoping-phased-development.md
  - planning-artifacts/prd/user-journeys.md
  - planning-artifacts/prd/success-criteria.md
  - planning-artifacts/prd/desktop-app-specific-requirements.md
  - planning-artifacts/sprint-change-proposal-2026-02-12-orchestrator-pivot.md
  - planning-artifacts/architecture/core-architectural-decisions.md
  - planning-artifacts/architecture/implementation-patterns-consistency-rules.md
  - planning-artifacts/architecture/project-structure-boundaries.md
  - planning-artifacts/architecture/project-context-analysis.md
  - planning-artifacts/architecture/starter-template-evaluation.md
  - planning-artifacts/architecture-tool-execution-layer.md
workflowType: 'architecture'
workflow: 'update'
project_name: 'bmad-studio'
user_name: 'Flow'
date: '2026-02-12'
scope: 'Orchestrator Pivot — streams, OpenCode integration, central artifact store, worktree management. Replaces chat-centric architecture with developer cockpit model.'
---

# Architecture Decision Document - bmad-studio

## Table of Contents

- [Architecture Decision Document - bmad-studio](#table-of-contents)
  - [Project Context Analysis](./project-context-analysis.md)
    - [Requirements Overview](./project-context-analysis.md#requirements-overview)
    - [Technical Constraints & Dependencies](./project-context-analysis.md#technical-constraints-dependencies)
    - [Cross-Cutting Concerns Identified](./project-context-analysis.md#cross-cutting-concerns-identified)
  - [Starter Template Evaluation](./starter-template-evaluation.md)
    - [Primary Technology Domain](./starter-template-evaluation.md#primary-technology-domain)
    - [Selected Approach: Vite React-TS + Electron](./starter-template-evaluation.md#selected-approach-vite-react-ts-electron)
  - [Core Architectural Decisions](./core-architectural-decisions.md)
    - [Decision Summary](./core-architectural-decisions.md#decision-summary)
    - [Data Architecture](./core-architectural-decisions.md#data-architecture)
    - [API & Communication](./core-architectural-decisions.md#api-communication)
    - [Provider Architecture](./core-architectural-decisions.md#provider-architecture)
    - [Deferred Decisions (Post-MVP)](./core-architectural-decisions.md#deferred-decisions-post-mvp)
  - [Implementation Patterns & Consistency Rules](./implementation-patterns-consistency-rules.md)
    - [Naming Conventions](./implementation-patterns-consistency-rules.md#naming-conventions)
    - [API Conventions](./implementation-patterns-consistency-rules.md#api-conventions)
    - [WebSocket Events](./implementation-patterns-consistency-rules.md#websocket-events)
    - [State Management (Zustand + React Hooks)](./implementation-patterns-consistency-rules.md#state-management-zustand--react-hooks)
    - [Error Handling](./implementation-patterns-consistency-rules.md#error-handling)
  - [Project Structure & Boundaries](./project-structure-boundaries.md)
    - [Complete Project Directory Structure](./project-structure-boundaries.md#complete-project-directory-structure)
    - [Architectural Boundaries](./project-structure-boundaries.md#architectural-boundaries)
    - [FR to Structure Mapping](./project-structure-boundaries.md#fr-to-structure-mapping)
  - [Architecture Validation Results](./architecture-validation-results.md)
    - [Validation Status](./architecture-validation-results.md#validation-status)
    - [Architecture Completeness Checklist](./architecture-validation-results.md#architecture-completeness-checklist)
    - [Implementation Handoff](./architecture-validation-results.md#implementation-handoff)
  - [Architecture Completion Summary](./architecture-completion-summary.md)
    - [Final Deliverables](./architecture-completion-summary.md#final-deliverables)
    - [Implementation Sequence](./architecture-completion-summary.md#implementation-sequence)
