# Design System Foundation

## Design System Choice

**shadcn/ui** — Radix primitives with Tailwind CSS styling, components copied into the project as owned source code.

This is a **themeable system with full source ownership** approach. Not a traditional component library (nothing in `node_modules` to update), not a fully custom system (Radix handles accessibility, keyboard navigation, and focus management). The foundation provides production-quality standard components while leaving complete freedom for BMAD Studio's custom signature elements.

## Rationale for Selection

| Factor | Requirement | shadcn/ui Fit |
|--------|------------|---------------|
| **Visual control** | Opinionated cockpit aesthetic — Linear density, dark mode, custom colors | Full source ownership. No library visual identity to override. Components look like whatever you make them look like |
| **Speed (solo dev)** | Can't build standard components from scratch | Copy-paste components with Radix accessibility baked in. Command palette, modals, tooltips, popovers, dropdowns — all available immediately |
| **Dark mode** | Dark mode only for MVP, structured for future light mode | Tailwind's `dark:` variant system + shadcn/ui's built-in dark theme. Dark mode is configuration, not custom work |
| **Command palette** | `Cmd+K` is the primary keyboard navigation pattern | `cmdk` library is part of the shadcn/ui ecosystem. Same component Linear uses |
| **Customization depth** | Phase graph, breadcrumb strip, dashboard are fully custom | shadcn/ui handles standard primitives; custom components are built with the same Tailwind + React patterns. No framework boundary between "library components" and "custom components" |
| **Accessibility** | Developer tool, but keyboard-first interaction model demands proper focus management | Radix primitives handle ARIA, focus trapping, keyboard navigation, screen reader announcements |
| **Maintenance** | Solo developer, long-term project | No dependency updates to break things. Components are your code. Update when you want, not when a library ships a breaking change |

## Implementation Approach

**Component Categories:**

| Category | Approach | Examples |
|----------|----------|---------|
| **Standard primitives** | shadcn/ui (copy from registry) | Button, Input, Dialog (modals), Tooltip, Popover, DropdownMenu, Separator, Badge, ScrollArea |
| **Command palette** | shadcn/ui Command component (wraps `cmdk`) | `Cmd+K` palette for stream/project switching, artifact search, workflow launching |
| **Signature components** | Fully custom (React + Tailwind) | Phase graph, breadcrumb strip, stream dashboard, artifact viewer, conversation panel |
| **Layout components** | Custom using Tailwind + Radix patterns | App shell, resizable panels (sidebar, conversation panel), collapsible regions |
| **Data display** | Hybrid — shadcn/ui Table + custom stream list | Stream list with inline badges, artifact list with metadata |

**Component Location:**

```
src/
├── components/
│   ├── ui/               # shadcn/ui primitives (Button, Dialog, Tooltip, etc.)
│   ├── layout/           # App shell, sidebar, resizable panels
│   ├── phase-graph/      # Two-level phase graph, breadcrumb strip
│   ├── streams/          # Stream list, creation modal, detail view
│   ├── dashboard/        # Multi-project/multi-stream overview
│   ├── conversation/     # OpenCode session panel, terminal embed
│   ├── artifacts/        # Artifact viewer, markdown renderer
│   ├── navigation/       # Command palette, sidebar nav
│   └── shared/           # Reusable composed components
```

## Customization Strategy

**Design Tokens (Tailwind + CSS Custom Properties):**

The design token system bridges Tailwind's utility classes with semantic meaning for BMAD Studio's domain concepts.

```
Semantic tokens (CSS custom properties):
├── Phase colors
│   ├── --phase-analysis: blue spectrum
│   ├── --phase-planning: green spectrum
│   ├── --phase-solutioning: amber spectrum
│   ├── --phase-implementation: red spectrum
│   └── --phase-quickflow: gray spectrum
├── Agent colors (consistent per-agent across all views)
│   ├── --agent-mary, --agent-john, --agent-winston,
│   ├── --agent-bob, --agent-amelia, --agent-barry, --agent-sally
├── Status colors
│   ├── --status-complete, --status-active, --status-pending,
│   └── --status-skipped, --status-blocked
├── Surface colors (dark mode palette)
│   ├── --surface-base (app background)
│   ├── --surface-raised (cards, panels)
│   ├── --surface-overlay (modals, popovers)
│   └── --surface-sunken (inset areas, code blocks)
└── Interactive colors
    ├── --interactive-default, --interactive-hover,
    └── --interactive-active, --interactive-muted
```

**Phase Color System:**

Phase colors are the most important semantic signal in the product. They appear on:
- Phase graph containers (background tint)
- Workflow node borders and status indicators
- Breadcrumb strip phase markers
- Dashboard stream badges
- Sidebar stream indicators

Consistency across all surfaces is critical — if Analysis is blue in the phase graph, it must be blue in the dashboard badge, the breadcrumb strip, and the sidebar.

**Agent Color System:**

Each BMAD agent gets a consistent color used for:
- Agent initial badges on workflow nodes (colored circle with letter)
- Agent indicator during active sessions
- Subtle background tint in conversation panel header

Agent colors are secondary to phase colors. They provide "who's at the controls" at a glance without competing with phase status.

**Typography:**

- System font stack (no custom fonts) — matches the native-fast, developer-tool aesthetic
- Monospace for artifact content, code references, file paths
- Size scale: compact by default. Body text at 13-14px (Linear-scale density). Headers are functional, not decorative

**Iconography:**

- Lucide icons (already established in project conventions)
- Single icon set, no mixing
- Icons are functional indicators, not decoration. Used for: phase status, workflow type, artifact type, navigation actions
