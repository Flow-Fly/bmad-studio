# Visual Design Foundation

## Color System

**Philosophy:** Dark mode with semantic color language. Phase colors are the primary visual vocabulary — they appear everywhere (graph, dashboard, breadcrumbs, badges) and must be instantly recognizable. The palette uses soft, pastel-toned phase colors for the Full Flow pipeline (calm, methodical) and more intense, saturated colors for Quick Flow (direct, punchy).

**Surface Palette (Dark Mode):**

| Token | Role | Value | Usage |
|-------|------|-------|-------|
| `--surface-base` | App background | `#0a0a0b` | Main window background |
| `--surface-raised` | Cards, panels | `#141416` | Phase containers, stream cards, sidebar |
| `--surface-overlay` | Modals, popovers | `#1c1c20` | Command palette, creation modal, tooltips |
| `--surface-sunken` | Inset areas | `#07070a` | Code blocks, artifact content area, conversation panel background |
| `--surface-border` | Subtle borders | `#27272a` | Panel dividers, card edges, separator lines |
| `--surface-border-hover` | Interactive borders | `#3f3f46` | Hovered cards, focused inputs |

**Phase Colors — Full Flow (Pastel/Muted):**

Cool-to-warm progression. Soft enough to serve as container backgrounds and badges without visual aggression. High enough contrast to be distinct from each other on dark surfaces.

| Phase | Token | Foreground | Background (10% opacity tint) | Usage |
|-------|-------|-----------|------------------------------|-------|
| Analysis | `--phase-analysis` | `#7cacf0` | `rgba(124, 172, 240, 0.10)` | Phase container, badges, breadcrumb marker |
| Planning | `--phase-planning` | `#7ad4a0` | `rgba(122, 212, 160, 0.10)` | Phase container, badges, breadcrumb marker |
| Solutioning | `--phase-solutioning` | `#e4b874` | `rgba(228, 184, 116, 0.10)` | Phase container, badges, breadcrumb marker |
| Implementation | `--phase-implementation` | `#e88a8a` | `rgba(232, 138, 138, 0.10)` | Phase container, badges, breadcrumb marker |

**Phase Colors — Quick Flow (Intense/Saturated):**

Visually distinct from the Full Flow pastels. More saturated and vivid to convey "fast track, fewer phases, ship it."

| Phase | Token | Foreground | Background (12% opacity tint) | Usage |
|-------|-------|-----------|-------------------------------|-------|
| Quick Spec | `--phase-quickflow-spec` | `#a78bfa` | `rgba(167, 139, 250, 0.12)` | Violet — spec phase |
| Quick Dev | `--phase-quickflow-dev` | `#c084fc` | `rgba(192, 132, 252, 0.12)` | Brighter violet — dev phase |

**Agent Colors:**

Each BMAD agent gets a consistent accent color for their initial badge. These are secondary to phase colors — used for the colored circle behind the agent's letter on workflow nodes.

| Agent | Letter | Token | Color | Personality |
|-------|--------|-------|-------|-------------|
| Mary | M | `--agent-mary` | `#f0abfc` | Analyst — soft pink/magenta |
| John | J | `--agent-john` | `#86efac` | PM — crisp green |
| Winston | W | `--agent-winston` | `#fbbf24` | Architect — warm gold |
| Sally | S | `--agent-sally` | `#c4b5fd` | UX Designer — lavender |
| Bob | B | `--agent-bob` | `#67e8f9` | SM — bright cyan |
| Amelia | A | `--agent-amelia` | `#fca5a5` | Dev — soft coral |
| Barry | B | `--agent-barry` | `#a78bfa` | Quick Flow — matches Quick Flow violet |

**Status Colors:**

| Status | Token | Color | Usage |
|--------|-------|-------|-------|
| Complete | `--status-complete` | `#4ade80` | Filled node indicator, checkmarks |
| Active | `--status-active` | `#60a5fa` | Currently running session indicator |
| Pending | `--status-pending` | `#71717a` | Available but not started |
| Skipped | `--status-skipped` | `#3f3f46` | Manually skipped workflow |
| Blocked | `--status-blocked` | `#ef4444` | Gate check failed, prerequisite missing |

**Interactive Colors:**

| Token | Color | Usage |
|-------|-------|-------|
| `--interactive-default` | `#a1a1aa` | Default text, icons |
| `--interactive-hover` | `#e4e4e7` | Hovered text, icons |
| `--interactive-active` | `#ffffff` | Active/focused elements |
| `--interactive-muted` | `#52525b` | Disabled, secondary text |
| `--interactive-accent` | `#60a5fa` | Primary actions, links, focus rings |

## Typography System

**Font Stack:**

```
--font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
```

No custom fonts. System font stack ensures native-fast rendering, zero FOUT (flash of unstyled text), and visual consistency with the OS. Monospace for all code-related content: artifact bodies, file paths, skill names, terminal output.

**Type Scale (Compact — Linear-density):**

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 11px | 400 | 1.4 | Metadata, timestamps, tooltips |
| `--text-sm` | 12px | 400 | 1.5 | Secondary labels, badges, status text |
| `--text-base` | 13px | 400 | 1.5 | Body text, stream names, workflow labels |
| `--text-md` | 14px | 500 | 1.4 | Section headers, phase names |
| `--text-lg` | 16px | 600 | 1.3 | Page titles, stream detail header |
| `--text-xl` | 20px | 600 | 1.2 | Dashboard project names (rare) |

**Font Weight Usage:**
- 400 (Regular): Body text, labels, descriptions
- 500 (Medium): Emphasis, interactive labels, phase names
- 600 (Semibold): Headers, stream names, titles — never bold (700), which feels heavy in dark mode

**Monospace Usage:**
- Artifact content rendering
- File paths and skill names in tooltips (`/bmad:bmm:workflows:create-prd`)
- Breadcrumb strip workflow identifier
- Command palette input
- Terminal/conversation panel content

## Spacing & Layout Foundation

**Base Unit: 4px**

Dense cockpit layouts need a tight spacing grid. 4px base allows fine-grained control (4, 8, 12, 16, 20, 24, 32, 40, 48) while maintaining visual rhythm.

**Spacing Scale:**

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline spacing, icon-to-label gaps |
| `--space-2` | 8px | Compact padding (badges, small buttons), list item gaps |
| `--space-3` | 12px | Standard padding (cards, inputs), stream list row padding |
| `--space-4` | 16px | Section spacing, panel padding |
| `--space-5` | 20px | Group separation |
| `--space-6` | 24px | Major section gaps |
| `--space-8` | 32px | Panel margins, dashboard section spacing |
| `--space-10` | 40px | Page-level spacing |

**Layout Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  Title Bar (28px — Electron frameless, drag region)     │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │           Main Content Area                  │
│ (240px)  │                                              │
│          │  ┌─────────────────────────────────────────┐ │
│ Project  │  │ Phase Graph / Dashboard / Artifact View │ │
│ selector │  │                                         │ │
│          │  │                                         │ │
│ Stream   │  │                                         │ │
│ list     │  │                                         │ │
│          │  │                                         │ │
│          │  └─────────────────────────────────────────┘ │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│  Status Bar (24px — stream name, session status)        │
└─────────────────────────────────────────────────────────┘
```

**During Active Session (Conversation Mode):**

```
┌─────────────────────────────────────────────────────────┐
│  Title Bar (28px)                                       │
├──────────┬──────────────────────────────────────────────┤
│          │ Breadcrumb Strip (36px)                      │
│ Sidebar  │ Analysis ✓ → Planning ✓ → [Sol: arch 🔵] → │
│ (240px)  ├──────────────────────────────────────────────┤
│          │                                              │
│          │         Conversation Panel                   │
│          │         (OpenCode TUI)                       │
│          │                                              │
│          │         Streaming output,                    │
│          │         tool calls,                          │
│          │         agent conversation                   │
│          │                                              │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│  Status Bar (24px — stream, agent, session duration)    │
└─────────────────────────────────────────────────────────┘
```

**Key Layout Dimensions:**

| Element | Dimension | Notes |
|---------|-----------|-------|
| Sidebar width | 240px default, collapsible to 48px (icon-only) | Resizable, remembers user preference |
| Title bar | 28px | Frameless Electron, custom drag region |
| Breadcrumb strip | 36px | Phase progress during active sessions |
| Status bar | 24px | Stream name, session info |
| Phase container min-width | 200px | Ensures workflow nodes are readable |
| Workflow node height | 56-64px | Agent badge + workflow name + artifact indicator |
| Stream list row height | 40px | Name + phase badge + last activity |

**Responsive Behavior:**

- Minimum window: 1024 x 640 (below this, sidebar auto-collapses)
- Sidebar collapse: at narrow widths, sidebar becomes icon-only (48px)
- Phase graph: horizontal scroll if phases exceed viewport width (no wrapping — maintain left-to-right reading order)
- Conversation panel: fills available space minus sidebar. No minimum width — the terminal adapts to available columns

## Accessibility Considerations

**Contrast Ratios (WCAG AA minimum):**

All text must meet 4.5:1 contrast against its background. The pastel phase colors are specifically chosen to achieve this on dark surfaces:
- `#7cacf0` (Analysis blue) on `#141416` (raised surface) = ~6.2:1 ✓
- `#7ad4a0` (Planning green) on `#141416` = ~8.1:1 ✓
- `#e4b874` (Solutioning amber) on `#141416` = ~8.4:1 ✓
- `#e88a8a` (Implementation red) on `#141416` = ~5.8:1 ✓

**Keyboard Accessibility:**

- All interactive elements reachable via Tab navigation
- Focus rings visible (2px `--interactive-accent` outline with 2px offset)
- `Cmd+K` command palette as universal keyboard navigation
- `Escape` closes modals, popovers, and collapses conversation panel to graph view
- Arrow keys navigate within phase graph nodes

**Color Not as Sole Indicator:**

Phase status is communicated through both color AND shape:
- Complete nodes: filled background + checkmark icon
- Active nodes: highlighted border + pulsing dot
- Pending nodes: outline only (no fill)
- Skipped nodes: dashed outline + skip icon

Agent identity is communicated through both color AND letter initial. Never rely on color alone for agent recognition.
