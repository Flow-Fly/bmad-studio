---
workflowType: 'prd'
workflow: 'edit'
classification:
  domain: 'developer-tools'
  projectType: 'desktop-app'
  complexity: 'medium-high'
inputDocuments:
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-12-orchestrator-pivot.md'
  - '_bmad-output/planning-artifacts/product-brief-bmad-studio-2026-02-12.md'
stepsCompleted: ['step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
lastEdited: '2026-02-12'
editHistory:
  - date: '2026-02-12'
    changes: 'Major rewrite: orchestrator pivot — streams, OpenCode integration, developer cockpit vision. Replaced chat/insight/provider FRs with stream/worktree/OpenCode FRs. Revised MVP scope, user journeys, success criteria.'
  - date: '2026-02-12'
    changes: 'Brief alignment: single Alex persona (two entry points, removed Sam Rivera), OpenCode thin wrapper model (replaced SDK references), added Out of Scope section, MVP success gate, KPIs, 3-phase business objectives, problem statement, competitive gap table, expanded differentiators (3→5), future vision (4 phases with narrative arc), NFR measurability fixes.'
---

# Product Requirements Document — bmad-studio

## Table of Contents

- [Product Requirements Document — bmad-studio](#table-of-contents)
  - [Executive Summary](./executive-summary.md)
    - [Problem Statement](./executive-summary.md#problem-statement)
    - [Why Existing Solutions Fall Short](./executive-summary.md#why-existing-solutions-fall-short)
  - [Success Criteria](./success-criteria.md)
    - [User Success](./success-criteria.md#user-success)
    - [Business Success](./success-criteria.md#business-success)
    - [Key Performance Indicators](./success-criteria.md#key-performance-indicators)
    - [Technical Success](./success-criteria.md#technical-success)
  - [User Journeys](./user-journeys.md)
    - [Journey 1: Alex — The Methodology Adopter](./user-journeys.md#journey-1-alex--the-methodology-adopter-entry-point-a)
    - [Journey 2: Alex — The Methodology-Curious](./user-journeys.md#journey-2-alex--the-methodology-curious-entry-point-b)
    - [User Journey Lifecycle](./user-journeys.md#user-journey-lifecycle)
    - [Journey Requirements Summary](./user-journeys.md#journey-requirements-summary)
  - [Project Scoping & Phased Development](./project-scoping-phased-development.md)
    - [MVP Strategy & Philosophy](./project-scoping-phased-development.md#mvp-strategy--philosophy)
    - [MVP Feature Set (Phase 1)](./project-scoping-phased-development.md#mvp-feature-set-phase-1)
    - [Out of Scope for MVP](./project-scoping-phased-development.md#out-of-scope-for-mvp)
    - [MVP Success Criteria](./project-scoping-phased-development.md#mvp-success-criteria)
    - [Post-MVP Features](./project-scoping-phased-development.md#post-mvp-features)
    - [Risk Mitigation Strategy](./project-scoping-phased-development.md#risk-mitigation-strategy)
  - [Desktop App Specific Requirements](./desktop-app-specific-requirements.md)
    - [Platform Support](./desktop-app-specific-requirements.md#platform-support)
    - [Update Strategy](./desktop-app-specific-requirements.md#update-strategy)
    - [System Integration](./desktop-app-specific-requirements.md#system-integration)
    - [Offline Capability](./desktop-app-specific-requirements.md#offline-capability)
    - [Technical Architecture](./desktop-app-specific-requirements.md#technical-architecture)
  - [Functional Requirements](./functional-requirements.md)
    - [Stream Management](./functional-requirements.md#stream-management)
    - [Worktree Management](./functional-requirements.md#worktree-management)
    - [Project Management](./functional-requirements.md#project-management)
    - [Workflow Navigation](./functional-requirements.md#workflow-navigation)
    - [OpenCode Integration](./functional-requirements.md#opencode-integration)
    - [Provider Configuration](./functional-requirements.md#provider-configuration)
    - [Artifact Management](./functional-requirements.md#artifact-management)
    - [Connectivity & Offline](./functional-requirements.md#connectivity--offline)
    - [Cost Tracking](./functional-requirements.md#cost-tracking)
  - [Non-Functional Requirements](./non-functional-requirements.md)
    - [Performance](./non-functional-requirements.md#performance)
    - [Security](./non-functional-requirements.md#security)
    - [Integration](./non-functional-requirements.md#integration)
    - [Reliability](./non-functional-requirements.md#reliability)
