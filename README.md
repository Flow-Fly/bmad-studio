# BMAD Studio

AI Agent Workflow Assistant - A desktop application for managing BMAD methodology workflows.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Lit + Vite |
| State | @lit-labs/signals + @lit-labs/context |
| UI Library | Shoelace (compact theme) |
| Desktop | Tauri |
| Backend | Go (chi router) |
| Icons | Lucide |

## Prerequisites

- Node.js 18+
- Go 1.21+
- Rust (for Tauri)

## Development Setup

### 1. Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend && go mod tidy
```

### 2. Start Development Servers

**Frontend (port 3007):**
```bash
npm run dev
```

**Backend (port 3008):**
```bash
cd backend && go run .
```

**Desktop App (launches both):**
```bash
npm run tauri dev
```

## Project Structure

```
bmad-studio/
├── src/                    # Lit Frontend
│   ├── components/         # UI components
│   ├── services/           # Backend communication
│   ├── state/              # Signal stores
│   ├── styles/             # Design tokens, themes
│   └── types/              # TypeScript interfaces
├── backend/                # Go Backend
│   ├── api/                # HTTP handlers, middleware
│   ├── services/           # Business logic
│   ├── providers/          # LLM provider integrations
│   ├── storage/            # File-based storage
│   └── types/              # Go types
├── src-tauri/              # Tauri Desktop Shell
└── tests/                  # Test suites
```

## Port Configuration

- **Frontend:** localhost:3007
- **Backend:** localhost:3008

## Privacy

BMAD Studio respects your privacy:
- No telemetry or analytics
- All data stays on your machine
- BYOK (Bring Your Own Keys) for LLM providers

## License

Private
