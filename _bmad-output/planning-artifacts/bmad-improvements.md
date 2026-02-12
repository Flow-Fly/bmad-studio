# BMAD Improvement Notes

Captured issues and improvement suggestions for BMAD workflows.

---

## 2026-01-23: Product Brief Completion Step Missing Continuation Menu

**File:** `_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-06-complete.md`

**Issue:** The completion step provides prose suggestions for next workflows but doesn't offer a structured menu (like the A/P/C pattern used in other steps). This creates a UX gap where users don't have clear actionable options to continue their project flow.

**Current behavior:**
- Lists suggested next steps as prose
- No menu options to select

**Expected behavior:**
- Structured menu like other steps:
  ```
  [PRD] Create Product Requirements Document
  [ARCH] Create Architecture
  [UX] Create UX Design
  [DONE] End session
  ```
- User selection triggers next workflow or graceful exit

**Impact:** Project flow feels "stuck" at completion instead of naturally transitioning to next phase.

**Suggested fix:** Add Section 5 menu handling similar to other steps, with options mapping to logical next workflows in the BMAD methodology.
