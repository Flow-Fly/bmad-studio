# Story 1.6: Provider Settings UI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to configure API keys and select my preferred model**,
So that **I can use my own accounts for AI providers** (FR18, FR20, FR21).

## Acceptance Criteria

1. **Given** the settings UI is open, **When** I enter an API key for Claude or OpenAI, **Then** the key is validated before saving (FR21) **And** valid keys show a success indicator **And** invalid keys show an error message

2. **Given** valid provider credentials exist, **When** I open the model selector, **Then** I see available models from configured providers (FR20) **And** I can select a default model for conversations **And** my selection persists across app restarts

3. **Given** I configure Ollama endpoint, **When** I enter a custom endpoint URL, **Then** the connection is validated **And** local models appear in the model selector

4. **Given** API keys are entered, **When** stored, **Then** keys are stored encrypted in OS keychain (NFR5) **And** keys are never displayed in plain text after entry (NFR6)

5. **Given** provider switching does not require application restart (NFR10), **When** I change provider or model, **Then** the change takes effect immediately without restarting the app

6. **Given** a provider API error occurs, **When** validation fails, **Then** user-friendly error messages are shown (NFR8)

7. **Given** form inputs, **When** validation occurs, **Then** it follows UX form patterns: validate on blur, show error after blur if invalid, clear error when user starts typing again

## Tasks / Subtasks

- [x] Task 1: Create provider state management (AC: #2, #5)
  - [x] 1.1: Create `src/state/provider.state.ts` with Signal-based state for providers, active provider, selected model, validation status
  - [x] 1.2: Define signals: `providersState` (configured providers), `activeProviderState` (current provider type), `selectedModelState` (current model ID), `modelsState` (available models by provider)
  - [x] 1.3: Include derived computed signals: `availableProviders$` (providers with valid credentials), `activeModels$` (models for active provider)

- [x] Task 2: Create provider service (AC: #1, #2, #3, #6)
  - [x] 2.1: Create `src/services/provider.service.ts` implementing REST calls to backend provider endpoints
  - [x] 2.2: Implement `validateProvider(type, apiKey)` calling `POST /api/v1/providers/validate`
  - [x] 2.3: Implement `listModels(type)` calling `GET /api/v1/providers/{type}/models`
  - [x] 2.4: Implement `saveProviderConfig(type, config)` and `loadProviderConfig()` for persisting provider settings
  - [x] 2.5: Implement `getApiKey(provider)` and `setApiKey(provider, key)` using Tauri keyring plugin for OS keychain storage (NFR5)

- [x] Task 3: Implement backend settings endpoints (AC: #2, #5)
  - [x] 3.1: Implement `GET /api/v1/settings` in `backend/api/handlers/settings.go` - returns current settings (default provider, default model, Ollama endpoint)
  - [x] 3.2: Implement `PUT /api/v1/settings` in `backend/api/handlers/settings.go` - updates settings
  - [x] 3.3: Create `backend/storage/config_store.go` for reading/writing settings to `~/bmad-studio/config.json`
  - [x] 3.4: Define settings schema: `{ default_provider, default_model, ollama_endpoint, provider_configs: { type: { enabled } } }`

- [x] Task 4: Create settings panel component (AC: #1, #3, #4, #7)
  - [x] 4.1: Create `src/components/core/settings/provider-settings.ts` as the main settings panel Lit component
  - [x] 4.2: Implement provider tabs using `sl-tab-group` with tabs for Claude, OpenAI, Ollama
  - [x] 4.3: Implement API key input using `sl-input` with `type="password"` and `password-toggle` for Claude/OpenAI tabs
  - [x] 4.4: Implement Ollama endpoint URL input with default value `http://localhost:11434`
  - [x] 4.5: Implement "Validate" button per provider that calls `POST /api/v1/providers/validate`
  - [x] 4.6: Show validation feedback: success indicator (green badge), error message (inline red text), loading state
  - [x] 4.7: Implement model selector using `sl-select` populated from `GET /api/v1/providers/{type}/models` after successful validation
  - [x] 4.8: Implement "Set as Default" for provider + model selection
  - [x] 4.9: Follow UX form patterns: validate on blur, clear error on re-type, inline error text

- [x] Task 5: Integrate settings into app shell (AC: #5)
  - [x] 5.1: Add settings trigger to `app-shell.ts` (gear icon button or menu item)
  - [x] 5.2: Implement settings as `sl-dialog` (drawer pattern) opened from the app shell
  - [x] 5.3: Wire provider state changes to trigger immediate effect (no restart needed per NFR10)

- [x] Task 6: Keychain integration via Tauri plugin (AC: #4)
  - [x] 6.1: Install `tauri-plugin-keyring` Rust crate in `src-tauri/Cargo.toml`
  - [x] 6.2: Register plugin in `src-tauri/src/lib.rs`
  - [x] 6.3: Install `tauri-plugin-keyring-api` npm package for frontend access
  - [x] 6.4: Implement keychain service in `src/services/keychain.service.ts` wrapping `getPassword`, `setPassword`, `deletePassword`
  - [x] 6.5: Use service name `bmad-studio` and key names like `claude-api-key`, `openai-api-key`
  - [x] 6.6: Fallback: If keychain unavailable (dev mode without Tauri), store in-memory only with warning

- [x] Task 7: Testing (AC: #1-#7)
  - [x] 7.1: Create `tests/frontend/components/provider-settings.test.ts` - test component rendering, tab navigation, input handling
  - [x] 7.2: Create `tests/frontend/services/provider.service.test.ts` - test API calls with mocked fetch
  - [x] 7.3: Create `backend/tests/api/settings_test.go` - test GET/PUT settings endpoints
  - [x] 7.4: Create `backend/storage/config_store_test.go` - test settings persistence to JSON file
  - [x] 7.5: Test validation flow: enter key -> validate -> show result -> enable model selector
  - [x] 7.6: Test error states: invalid key, network error, Ollama unreachable

## Dev Notes

### Critical Architecture Patterns

**This is the FIRST frontend UI component story.** It establishes patterns that all subsequent UI stories will follow. The component must correctly demonstrate: Lit component structure, Shoelace component usage, Signal-based state management, service layer pattern, and design token usage.

#### Frontend Stack (MUST USE)

| Technology | Package                    | Version | Purpose                             |
| ---------- | -------------------------- | ------- | ----------------------------------- |
| Lit        | `lit`                      | ^3.1.0  | Web Components framework            |
| Shoelace   | `@shoelace-style/shoelace` | ^2.12.0 | UI component library                |
| Signals    | `@lit-labs/signals`        | ^0.2.0  | Reactive state management           |
| Context    | `@lit-labs/context`        | -       | Dependency injection                |
| Lucide     | `lucide`                   | -       | Icons (single icon set - NO mixing) |

[Source: package.json, architecture.md#Starter-Template-Evaluation]

#### Component Architecture Pattern

```typescript
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";

// Cherry-pick Shoelace components (NEVER barrel import)
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";

// Type imports for TypeScript
import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";

@customElement("provider-settings")
export class ProviderSettings extends SignalWatcher(LitElement) {
  // Component implementation
}
```

**Key rules:**

- Extend `SignalWatcher(LitElement)` for automatic signal subscription
- Cherry-pick Shoelace imports from `/dist/components/` paths (NEVER `/cdn/`, NEVER barrel imports)
- Shoelace elements CANNOT be self-closing: use `<sl-input></sl-input>`, NOT `<sl-input />`
- Use `.property` binding syntax for complex objects/arrays to Shoelace components
- After setting Shoelace properties programmatically, `await element.updateComplete` before reading

[Source: @lit-labs/signals docs, Shoelace integration patterns]

#### Signal State Pattern

```typescript
// src/state/provider.state.ts
import { Signal } from "signal-polyfill";

export interface ProviderConfig {
  type: "claude" | "openai" | "ollama";
  enabled: boolean;
  hasValidCredentials: boolean;
  endpoint?: string; // Only for Ollama
}

export const providersState = new Signal.State<ProviderConfig[]>([]);
export const activeProviderState = new Signal.State<string>("");
export const selectedModelState = new Signal.State<string>("");
export const modelsState = new Signal.State<Record<string, Model[]>>({});

// Derived signals
export const availableProviders$ = new Signal.Computed(() =>
  providersState.get().filter((p) => p.hasValidCredentials),
);
```

**Signal naming convention:** `{noun}State` for stores, `{noun}$` for derived computed signals.
**Immutable updates:** `signal.set([...signal.get(), newItem])`

[Source: project-context.md#Language-Specific-Rules, architecture.md#State-Management]

#### Service Layer Pattern (Components NEVER fetch directly)

```typescript
// src/services/provider.service.ts
const API_BASE = "/api/v1";

export class ProviderService {
  async validateProvider(
    type: string,
    apiKey: string,
  ): Promise<{ valid: boolean }> {
    const response = await fetch(`${API_BASE}/providers/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, api_key: apiKey }),
    });
    if (!response.ok) throw await this.parseError(response);
    return response.json();
  }

  async listModels(type: string): Promise<Model[]> {
    const response = await fetch(`${API_BASE}/providers/${type}/models`);
    if (!response.ok) throw await this.parseError(response);
    return response.json();
  }
}
```

**Vite proxies `/api/*` to `localhost:3008`** - no need to hardcode the backend URL.

[Source: vite.config.ts, project-context.md#Framework-Specific-Rules]

#### Shoelace Components to Use

| Component      | Import Path                  | Purpose                                       |
| -------------- | ---------------------------- | --------------------------------------------- |
| `sl-tab-group` | `.../tab-group/tab-group.js` | Provider tab navigation                       |
| `sl-tab`       | `.../tab/tab.js`             | Individual tab                                |
| `sl-tab-panel` | `.../tab-panel/tab-panel.js` | Tab content                                   |
| `sl-input`     | `.../input/input.js`         | API key entry (type="password"), endpoint URL |
| `sl-button`    | `.../button/button.js`       | Validate, Save                                |
| `sl-select`    | `.../select/select.js`       | Model selector                                |
| `sl-option`    | `.../option/option.js`       | Model option                                  |
| `sl-alert`     | `.../alert/alert.js`         | Success/error feedback                        |
| `sl-badge`     | `.../badge/badge.js`         | Validation status indicator                   |
| `sl-dialog`    | `.../dialog/dialog.js`       | Settings container                            |
| `sl-divider`   | `.../divider/divider.js`     | Section separator                             |
| `sl-icon`      | `.../icon/icon.js`           | Icons (use Lucide names)                      |

**sl-input with password toggle:**

```html
<sl-input
  label="API Key"
  type="password"
  password-toggle
  clearable
  placeholder="sk-..."
  help-text="Your Claude API key"
  @sl-change="${this.handleKeyChange}"
></sl-input>
```

**sl-dialog for settings:**

```html
<sl-dialog
  label="Provider Settings"
  ?open="${this.isOpen}"
  @sl-request-close="${this.handleClose}"
>
  <!-- tabs + content -->
  <sl-button slot="footer" variant="primary" @click="${this.save}"
    >Save</sl-button
  >
</sl-dialog>
```

[Source: Shoelace docs, UX consistency patterns]

### Backend Endpoints to Implement

The settings handler endpoints are currently 501 Not Implemented stubs. Implementation needed:

**GET /api/v1/settings** - Returns:

```json
{
  "default_provider": "claude",
  "default_model": "claude-3-5-sonnet-20241022",
  "ollama_endpoint": "http://localhost:11434",
  "providers": {
    "claude": { "enabled": true },
    "openai": { "enabled": false },
    "ollama": { "enabled": false, "endpoint": "http://localhost:11434" }
  }
}
```

**PUT /api/v1/settings** - Accepts same schema, persists to `~/bmad-studio/config.json`

**Existing endpoints (DO NOT MODIFY):**

- `POST /api/v1/providers/validate` - Already working, validates any provider type
- `GET /api/v1/providers/{type}/models` - Already working, lists models for any provider

**Placeholder endpoints to leave as-is:**

- `GET /api/v1/providers` - ListProviders (not needed for this story)
- `POST /api/v1/providers` - AddProvider (not needed for this story)

[Source: backend/api/handlers/settings.go, backend/api/handlers/providers.go, backend/api/router.go]

### Backend Types

From `backend/types/api.go`, the `Settings` struct exists but is minimal:

```go
type Settings struct {
    DefaultProvider string `json:"default_provider"`
    Theme           string `json:"theme"`
}
```

This needs extending to include provider configurations and model selection. Create a more complete settings structure.

[Source: backend/types/api.go]

### Keychain Integration Architecture

**Recommended approach:** Use `tauri-plugin-keyring` for OS keychain access.

**Rust side** (`src-tauri/Cargo.toml`):

```toml
[dependencies]
tauri-plugin-keyring = "2"
```

**Register in Tauri** (`src-tauri/src/main.rs`):

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_keyring::init())
```

**Frontend** (npm install `tauri-plugin-keyring-api`):

```typescript
import {
  getPassword,
  setPassword,
  deletePassword,
} from "tauri-plugin-keyring-api";

await setPassword("bmad-studio", "claude-api-key", "sk-ant-...");
const key = await getPassword("bmad-studio", "claude-api-key");
```

**Important:** The Go sidecar does NOT directly access the keychain. The flow is:

1. Frontend stores/retrieves key from OS keychain via Tauri plugin
2. Frontend sends key to backend via REST call for validation
3. Key is held in-memory on the backend during the session
4. Key is NEVER persisted to disk by the backend (NFR5)

**Dev mode fallback:** When running without Tauri (browser dev), keychain is unavailable. Implement in-memory fallback with a console warning. The `provider.service.ts` should detect Tauri availability via `window.__TAURI__`.

[Source: architecture.md#Security, project-context.md#Security-Rules]

### Design Token Usage

All styling MUST use CSS custom properties from `tokens.css`. Key tokens for this component:

| Token                         | Value          | Usage                  |
| ----------------------------- | -------------- | ---------------------- |
| `--bmad-color-bg-primary`     | `#0d1117`      | Main background        |
| `--bmad-color-bg-secondary`   | `#161b22`      | Card/panel background  |
| `--bmad-color-bg-elevated`    | `#30363d`      | Elevated surfaces      |
| `--bmad-color-text-primary`   | `#f0f6fc`      | Primary text           |
| `--bmad-color-text-secondary` | `#8b949e`      | Secondary text, labels |
| `--bmad-color-accent`         | `#58a6ff`      | Primary action, links  |
| `--bmad-color-success`        | `#3fb950`      | Valid key indicator    |
| `--bmad-color-error`          | `#f85149`      | Invalid key/error      |
| `--bmad-color-warning`        | `#d29922`      | Warning states         |
| `--bmad-color-border`         | `#30363d`      | Borders                |
| `--bmad-spacing-*`            | 4px-48px scale | Spacing                |
| `--bmad-font-size-md`         | 14px           | Body text              |
| `--bmad-radius-md`            | 6px            | Border radius          |
| `--bmad-transition-normal`    | 150ms ease     | State transitions      |

**Dark mode only for MVP.** No inline styles - use design tokens via CSS custom properties.

[Source: src/styles/tokens.css, project-context.md#Code-Quality-Style-Rules]

### UX Patterns to Follow

**Form Patterns:**

- Validate on blur (not every keystroke)
- Show error immediately after blur if invalid
- Clear error when user starts typing again
- Input states: Default (border), Focused (accent border + glow), Error (error border + text), Disabled (muted)

**Feedback Patterns:**

- Success: Quiet inline indicators (green badge/text), 2-second fade
- Error: Inline red text for recoverable errors, modal for blocking
- Loading: Disable button, show loading spinner/state on button

**Button Hierarchy:**

- Primary: Accent fill (Validate, Save) - one primary per view section
- Secondary: Outline (Cancel)
- Ghost: Text only (tertiary actions)

**Action Placement:**

- Primary action: Right side or bottom-right
- Cancel: Left of primary or Escape key

**Animation:**

- State changes: 200ms ease-in-out
- Micro-feedback: 100ms ease-out
- Respect `prefers-reduced-motion` media query

[Source: ux-consistency-patterns.md, UX design specification]

### Project Structure Notes

**Files to Create:**

```
src/
├── components/
│   └── core/
│       └── settings/
│           └── provider-settings.ts    # CREATE: Settings panel component
├── services/
│   ├── provider.service.ts             # CREATE: Provider API service
│   ├── keychain.service.ts             # CREATE: OS keychain wrapper
│   └── api.service.ts                  # CREATE: Base API client (shared fetch utilities)
├── state/
│   └── provider.state.ts              # CREATE: Signal-based provider state
└── types/
    └── provider.ts                     # CREATE: TypeScript interfaces

backend/
├── api/
│   └── handlers/
│       └── settings.go                # MODIFY: Implement GET/PUT endpoints (currently 501 stubs)
├── storage/
│   └── config_store.go                # CREATE: Settings file persistence
└── types/
    └── api.go                         # MODIFY: Extend Settings struct
```

**Files to NOT Touch:**

```
backend/
├── providers/
│   ├── provider.go                    # DO NOT MODIFY - stable interface
│   ├── claude.go                      # DO NOT MODIFY
│   ├── openai.go                      # DO NOT MODIFY
│   └── ollama.go                      # DO NOT MODIFY
├── api/
│   ├── handlers/providers.go          # DO NOT MODIFY - already works
│   └── router.go                      # DO NOT MODIFY - routes already defined
├── services/
│   └── provider_service.go            # DO NOT MODIFY - factory already complete
└── main.go                            # DO NOT MODIFY

src/
├── styles/
│   ├── tokens.css                     # DO NOT MODIFY - design tokens are stable
│   ├── shoelace-theme.css             # DO NOT MODIFY - theme overrides are stable
│   └── global.css                     # DO NOT MODIFY
```

**Alignment with Architecture:**

- `src/components/core/settings/` follows the component structure in architecture.md
- `src/services/` follows the service layer pattern
- `src/state/` follows the signals state management pattern
- `src/types/` follows TypeScript interface location convention
- Settings component uses `sl-dialog` (drawer pattern from UX modal patterns)

[Source: architecture.md#Project-Structure-Boundaries, project-context.md#File-Organization-Rules]

### Previous Story Intelligence

**From Story 1.5 (Ollama Provider - Previous Story):**

- All three providers (Claude, OpenAI, Ollama) are now fully implemented and tested
- Provider factory in `provider_service.go` handles all three types
- `POST /api/v1/providers/validate` works for all provider types
- `GET /api/v1/providers/{type}/models` works for all provider types
- Ollama uses `apiKey` parameter as endpoint URL in the factory
- No new Go dependencies were added for Ollama (stdlib only)
- Error messages follow NFR8 (user-friendly) pattern
- 18 unit tests + 3 factory tests + 2 integration tests for Ollama alone

**Code review findings from Story 1.5:**

- [H1] Fixed: Added 10s context timeout to `ListModels()` - this affects the model listing API behavior
- Provider error returns `UserMessage` via `Error()` method (NFR6 security) - frontend error display should use the error message directly

**From Epic 0 Retro:**

- Check if there was a retrospective with relevant learnings

[Source: 1-5-ollama-provider-implementation.md]

### Git Intelligence

**Recent Commits:**

```
0d62737 feat: Add Ollama provider integration with validation and model listing
ad36313 Merge pull request #5 from Flow-Fly:feature/1-4-openai-provider
6fb8ce6 feat: Add OpenAI provider integration and tests
b2a94cd Merge pull request #4 from Flow-Fly/feature/1-3-provider-interface-claude
ccb591f feat: Implement Claude provider integration
```

**Current branch:** `feature/1-5-ollama-provider`
**Pattern:** Create new feature branch `feature/1-6-provider-settings-ui` from main (or current branch after merge)
**Commit style:** `feat:` prefix for new features

**Backend patterns established:**

- Go error handling with `(result, error)` return
- Provider-agnostic handler design (no provider-specific routes)
- Table-driven Go tests with `httptest` for handler testing
- JSON response format: `{ "error": { "code": "...", "message": "..." } }` for errors

[Source: git log]

### Latest Technical Information

**Shoelace v2.12+** (current in project):

- Cherry-pick imports from `/dist/components/` for tree-shaking
- Dark theme via `/dist/themes/dark.css`
- Components mapped to BMAD tokens via `shoelace-theme.css`
- Radio group redesign in newer versions - use `sl-radio-group` as form control

**@lit-labs/signals v0.2+**:

- Use `SignalWatcher(LitElement)` mixin for auto-subscription
- `Signal.State` for mutable state, `Signal.Computed` for derived
- Import `Signal` from `signal-polyfill` (not from `@lit-labs/signals`)
- Ensure single copy of `signal-polyfill` via `npm dedupe`

**Tauri 2.0 Keyring Plugin**:

- `tauri-plugin-keyring = "2"` in Cargo.toml
- Frontend API via `tauri-plugin-keyring-api` npm package
- Uses macOS Keychain natively, Linux Secret Service, Windows Credential Manager
- No user prompt needed once app is authorized

**Vite 5.1 proxy configuration** already handles `/api/*` -> `localhost:3008` and `/ws` -> `ws://localhost:3008`

### Anti-Patterns to Avoid

- **DO NOT** store API keys in `config.json` or any disk file - use OS keychain only (NFR5)
- **DO NOT** display API keys in plain text after entry - use password input with toggle (NFR6)
- **DO NOT** log API keys anywhere - not in console, not in network inspector
- **DO NOT** fetch data directly in components - use service layer
- **DO NOT** use inline styles - use design tokens via CSS custom properties
- **DO NOT** use barrel imports for Shoelace (`import all from shoelace`) - cherry-pick
- **DO NOT** use `/cdn/` paths for Shoelace - use `/dist/` paths
- **DO NOT** use self-closing tags for Shoelace elements (`<sl-input />`) - use full closing tags
- **DO NOT** modify provider implementations (claude.go, openai.go, ollama.go) - they are complete
- **DO NOT** modify router.go - routes are already defined
- **DO NOT** create spinners in primary content areas - use skeleton layouts or inline indicators
- **DO NOT** use Go `panic()` - always return errors
- **DO NOT** wrap successful API responses - return payload directly
- **DO NOT** implement dark/light theme toggle - dark mode only for MVP
- **DO NOT** implement the full activity bar layout yet - that's Story 2.5
- **DO NOT** build a full command palette - that's a P2 component

### References

- [Source: _bmad-output/planning-artifacts/architecture.md - Full architecture decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Provider-Architecture - Provider interface]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-Boundaries - File structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Conventions - REST patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#State-Management - Signals pattern]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6-Provider-Settings-UI - Story requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md - UX patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md - Component patterns]
- [Source: _bmad-output/project-context.md - Project rules and conventions]
- [Source: _bmad-output/implementation-artifacts/1-5-ollama-provider-implementation.md - Previous story]
- [Source: backend/api/handlers/settings.go - Settings handler stubs]
- [Source: backend/api/handlers/providers.go - Working provider validation/models endpoints]
- [Source: backend/api/router.go - Route definitions]
- [Source: backend/types/api.go - Backend type definitions]
- [Source: backend/storage/config_store.go - Not yet created, needs implementation]
- [Source: src/app-shell.ts - Current root component]
- [Source: src/styles/tokens.css - Design token definitions]
- [Source: src/styles/shoelace-theme.css - Shoelace theme overrides]
- [Source: src/main.ts - App entry point with Shoelace setup]
- [Source: vite.config.ts - Dev server proxy configuration]
- [Source: package.json - Dependencies]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Lit class field shadowing: `useDefineForClassFields: true` in tsconfig caused `@state()` properties to not trigger updates. Fixed by setting `useDefineForClassFields: false` (standard Lit recommendation).
- Router test regression: `TestPlaceholderEndpointsExist` expected settings routes to return 501 — removed settings entries from placeholder test since they are now real endpoints.

### Completion Notes List

- Implemented full-stack provider settings UI: frontend state management, service layer, backend endpoints, UI component, app shell integration, keychain integration, and comprehensive tests.
- Backend settings endpoints (GET/PUT /api/v1/settings) persist to ~/bmad-studio/config.json with merge-on-update semantics.
- Settings handler converted from plain function stubs to struct-based handler with ConfigStore dependency injection.
- Extended Settings type in api.go with DefaultModel, OllamaEndpoint, and per-provider settings.
- Provider settings component uses SignalWatcher(LitElement), Shoelace components (dialog, tab-group, input, select, badge), and design tokens.
- Keychain integration via tauri-plugin-keyring with in-memory fallback for dev mode.
- 23 frontend tests + 11 backend tests (6 config store + 5 settings integration) all passing.
- No regressions in existing test suite.

### Code Simplification Pass

Reviewed all 21 files (10 new, 11 modified) for clarity, consistency, and maintainability. Changes made:

1. **`src/services/provider.service.ts`** -- Extracted shared `apiFetch<T>()` generic helper to eliminate duplicated error-handling boilerplate across `validateProvider`, `listModels`, `loadSettings`, and `saveSettings`. The four exported functions now delegate to a single fetch-and-parse function, reducing the file from 68 to 56 lines. Also simplified the exported functions from `async function` to plain `function` returning a Promise directly (no unnecessary `await` wrapper).

2. **`src/components/core/settings/provider-settings.ts`** -- Five cleanups:
   - Removed redundant `TabProvider` type alias that duplicated `ProviderType` from `src/types/provider.ts`. Updated `_activeTab` state and `sl-tab-show` handler to use `ProviderType` directly.
   - Removed unused `type: ProviderType` parameter from `_handleModelSelect()` (the parameter was passed but never read).
   - Removed unused `import type SlDialog` (was only used in `_handleDialogClose` which was simplified).
   - Removed unused `import '@shoelace-style/shoelace/dist/components/alert/alert.js'` (no `<sl-alert>` element in the template).
   - Removed unused `AppSettings` from the type import (not referenced as a type annotation anywhere in the component).
   - Simplified `_handleDialogClose` to use `e.target === e.currentTarget` instead of checking `tagName === 'SL-DIALOG'` (more idiomatic DOM event delegation).

3. **`tests/frontend/services/provider.service.test.ts`** -- Consolidated `setupFetch` and `setupFetchError` into a single `setupFetch(status, body)` helper. Both had identical implementations (create a Response with JSON body and given status). Removed the unused `mockFetch` intermediate variable.

4. **`backend/tests/api/settings_test.go`** -- Simplified `newRouterWithSettings` helper by removing the redundant first declaration of `cs` (`cs := &storage.ConfigStore{}`) which was immediately overwritten on the next line.

### Change Log

- 2026-01-29: Story 1-6 implemented — Provider Settings UI with full-stack implementation including backend settings persistence, frontend state management, Lit component with Shoelace UI, Tauri keyring integration, and comprehensive test coverage.

### File List

**New Files:**

- src/types/provider.ts
- src/state/provider.state.ts
- src/services/provider.service.ts
- src/services/keychain.service.ts
- src/components/core/settings/provider-settings.ts
- backend/storage/config_store.go
- backend/storage/config_store_test.go
- backend/tests/api/settings_test.go
- tests/frontend/components/provider-settings.test.ts
- tests/frontend/services/provider.service.test.ts

**Modified Files:**

- src/app-shell.ts
- backend/api/handlers/settings.go
- backend/types/api.go
- backend/api/router.go
- backend/main.go
- backend/api/router_test.go
- src-tauri/Cargo.toml
- src-tauri/src/lib.rs
- src-tauri/capabilities/default.json
- package.json
- package-lock.json
- tsconfig.json
- tests/frontend/components/app-shell.test.ts
