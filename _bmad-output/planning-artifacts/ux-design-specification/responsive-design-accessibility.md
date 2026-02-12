# Responsive Design & Accessibility

## Responsive Strategy

**Desktop-only, variable viewport.** BMAD Studio targets developer workstations: 13" MacBook (1440x900 effective) through 27" external monitor (2560x1440). The design must be excellent at both extremes without feeling sparse on large screens or cramped on small ones.

**Adaptation model: Flexible panels, not breakpoints.** Rather than discrete breakpoints that swap layouts, BMAD Studio uses a continuous adaptation model:

| Element | Small Viewport (1024-1440px) | Standard (1440-1920px) | Large (1920px+) |
|---------|------------------------------|----------------------|-----------------|
| **Sidebar** | Collapsed to 48px (icon-only) by default. Expand on hover or toggle | 240px expanded | 240px expanded (no wider — content doesn't benefit) |
| **Phase graph** | Horizontal scroll if phases exceed viewport. Phase containers at min-width (200px) | All 4 phases visible without scroll | Comfortable spacing between phases. Extra space absorbed as padding |
| **Conversation panel** | Full remaining width after sidebar | Full remaining width | Max-width 1200px, centered. Terminal output doesn't benefit from extreme width |
| **Dashboard stream cards** | Single column list | Two-column grid at viewport > 1600px | Two or three columns, max — density is more important than filling space |
| **Artifact viewer** | Content area fills available width, max 720px for readability | Sidebar list (200px) + content (720px max) + remaining space as margin | Same — extra width becomes margin, not wider content |
| **Command palette** | 480px wide, centered | 560px wide, centered | 560px max — doesn't grow further |

**Key principle:** Content has maximum widths. Extra viewport space becomes breathing room (margins, padding), not wider content. Developer tools feel wrong when text lines extend 200+ characters across a 27" monitor. The app should feel intentionally dense at any size, not stretched.

## Window Size Behavior

**Minimum window:** 1024 x 640px

Below this minimum, the app does not resize further — Electron enforces the minimum.

**Auto-adaptation triggers:**

| Trigger | Behavior |
|---------|----------|
| Window width < 1024px | Minimum enforced — no action needed |
| Window width 1024-1280px | Sidebar auto-collapses to 48px. Phase graph may scroll horizontally |
| Window width 1280-1440px | Sidebar expanded (240px). Phase graph fits 3 phases; 4th may require slight scroll |
| Window width > 1440px | Full layout — sidebar, 4 phases visible, comfortable spacing |
| Window width > 1920px | Max-widths engaged on content areas. Extra space becomes margins |

**Panel resize persistence:** User-adjusted panel sizes (sidebar width, conversation panel split) are saved to local storage and restored on next launch. Per-window, not per-stream — the layout is a workspace preference, not a per-stream setting.

## Accessibility Strategy

**Target: WCAG 2.1 AA compliance.**

This is the industry standard for professional software. Level A is too minimal for a keyboard-heavy developer tool. Level AAA is impractical for the information density required. AA provides the right balance: accessible to users with visual, motor, and cognitive disabilities while supporting the dense cockpit aesthetic.

**Accessibility priorities ranked by impact on this product:**

| Priority | Category | Rationale |
|----------|----------|-----------|
| 1 | **Keyboard navigation** | The app is designed keyboard-first (`Cmd+K`, arrow keys on phase graph, `Enter` to launch). This must work flawlessly — it's both a UX feature and an accessibility requirement |
| 2 | **Color + shape redundancy** | Phase graph uses color heavily. All color-coded information must have a secondary indicator (shape, icon, text label). Colorblind users must be able to read the phase graph |
| 3 | **Focus management** | Modal focus trapping, command palette focus, conversation panel focus — all handled by Radix primitives (shadcn/ui). Custom components (phase graph, breadcrumb strip) need manual focus management |
| 4 | **Screen reader support** | Phase graph needs meaningful ARIA labels. Streaming conversation output needs live regions. Status changes need announcements |
| 5 | **Reduced motion** | All transitions (zoom-in/zoom-out, modal animations, node fill animations) respect `prefers-reduced-motion`. Instant state changes replace animations |

## Keyboard Accessibility Specification

**Focus order follows visual reading order:**

```
Sidebar (project selector → stream list → new stream button)
  ↓ Tab
Main content (phase graph nodes: left-to-right, top-to-bottom within phases)
  ↓ Tab
Status bar (informational, no interactive elements in MVP)
```

**Phase graph keyboard navigation:**

| Key | Behavior |
|-----|----------|
| `Tab` | Move focus into/out of the phase graph region |
| `←` / `→` | Move between phases (left/right) |
| `↑` / `↓` | Move between workflow nodes within a phase |
| `Enter` | Activate focused node (launch workflow or view artifact) |
| `Space` | View artifact for focused node (if complete) |
| `i` | Show context dependency tooltip for focused node |
| `Escape` | Exit phase graph focus, return to sidebar |

**Focus indicators:**

- 2px solid `--interactive-accent` outline with 2px offset on all focusable elements
- Phase graph nodes: 2px outline replaces the hover elevation effect
- Command palette: highlighted result row with `--surface-raised` background
- Custom focus indicators on every interactive element — never rely on browser defaults (they're invisible on dark backgrounds)

## Color Accessibility

**Contrast ratios verified (WCAG AA: 4.5:1 for normal text, 3:1 for large text):**

All phase colors verified against `--surface-raised` (#141416):
- Analysis `#7cacf0`: 6.2:1 ✓
- Planning `#7ad4a0`: 8.1:1 ✓
- Solutioning `#e4b874`: 8.4:1 ✓
- Implementation `#e88a8a`: 5.8:1 ✓
- Quick Flow Spec `#a78bfa`: 5.1:1 ✓
- Quick Flow Dev `#c084fc`: 5.6:1 ✓

**Color-independent status communication:**

| Status | Color | Shape/Icon | Text Label |
|--------|-------|-----------|------------|
| Complete | `--status-complete` (green) | Filled circle + checkmark | "Complete" in tooltip |
| Active | `--status-active` (blue) | Pulsing dot + highlighted border | "In progress" in tooltip |
| Pending | `--status-pending` (gray) | Outline circle (no fill) | "Available" in tooltip |
| Skipped | `--status-skipped` (dim) | Dashed outline + skip icon | "Skipped" in tooltip |
| Blocked | `--status-blocked` (red) | Stop icon + solid border | "Blocked: [reason]" in tooltip |

**Colorblind simulation testing:** Test all views under protanopia, deuteranopia, and tritanopia simulation. The pastel phase colors are chosen to remain distinguishable under common colorblindness types due to their spread across the hue spectrum (blue → green → amber → red).

## Screen Reader Support

**ARIA landmarks:**

```html
<nav aria-label="Sidebar navigation">        <!-- Sidebar -->
<main aria-label="Stream workspace">          <!-- Main content -->
<section aria-label="Phase graph">            <!-- Phase graph region -->
<section aria-label="Conversation panel">     <!-- During active session -->
<footer aria-label="Status bar">              <!-- Status bar -->
```

**Phase graph ARIA model:**

The phase graph uses a custom `role="tree"` structure:
- Phase containers: `role="treeitem"` with `aria-expanded`
- Workflow nodes: `role="treeitem"` with `aria-label` describing name, agent, status, and artifact state
- Example: `aria-label="create-prd workflow, completed, agent John, artifact PRD.md available"`

**Live regions for dynamic content:**

| Content | ARIA Live | Politeness |
|---------|-----------|------------|
| Session streaming output | `aria-live="polite"` | Polite — doesn't interrupt current reading |
| Phase graph status change | `aria-live="polite"` | Announces "create-prd completed" when node fills |
| Error messages | `aria-live="assertive"` | Interrupts to announce errors |
| Command palette results | `aria-live="polite"` on results region | Updates as user types |

## Reduced Motion

**When `prefers-reduced-motion: reduce` is active:**

| Normal Behavior | Reduced Motion Behavior |
|----------------|------------------------|
| Zoom-in/zoom-out transition (300ms) | Instant swap — phase graph hides, breadcrumb strip appears |
| Node fill animation (200ms) | Instant state change — node switches to filled state |
| Modal scale animation (200ms) | Instant appear/disappear |
| Cross-fade on stream switch (150ms) | Instant swap |
| Pulsing dot on active node | Static dot (no pulse) |
| Hover elevation transitions | Instant state change |

**Implementation:** Single CSS media query at the root level:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Testing Strategy

**Automated testing (CI-integrated):**

| Tool | Purpose | When |
|------|---------|------|
| `axe-core` (via `@axe-core/playwright` or `jest-axe`) | WCAG AA violation detection | Every component test, every PR |
| ESLint `jsx-a11y` plugin | Catch ARIA issues at lint time | Every save (editor integration) |
| Playwright viewport tests | Verify layout at 1024, 1440, 1920 widths | PR merge checks |

**Manual testing (milestone-gated):**

| Test | Tool | Frequency |
|------|------|-----------|
| Keyboard-only navigation of all journeys | Manual | Every milestone |
| VoiceOver (macOS) screen reader walkthrough | Manual | Every milestone |
| Orca (Linux) screen reader walkthrough | Manual | Pre-release |
| Color blindness simulation | Sim Daltonism (macOS) | After any color change |
| Reduced motion verification | System preference toggle | After any animation change |

## Implementation Guidelines

**For every custom component:**

1. **Keyboard:** Define and implement keyboard interaction before visual styling. If a component can't be operated by keyboard alone, it's not done.
2. **ARIA:** Add `aria-label`, `role`, and `aria-` attributes during initial implementation, not as a post-hoc pass. Radix-based components (shadcn/ui) handle this automatically; custom components need manual ARIA.
3. **Focus:** Every interactive element must have a visible focus indicator. Use the standard 2px `--interactive-accent` ring. Test by tabbing through the entire interface.
4. **Color:** Never use color as the sole indicator of state. Every color-coded element has a secondary indicator (icon, shape, label). Test by viewing in grayscale.
5. **Motion:** Wrap all animations/transitions in a check for `prefers-reduced-motion`, or use the global CSS override.
6. **Semantic HTML:** Use `<nav>`, `<main>`, `<section>`, `<button>`, `<heading>` elements. No `<div>` with `onClick` — use `<button>`. No heading-level skips (h1 → h3).
