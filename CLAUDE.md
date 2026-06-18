# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Vite dev server on :5173 (frontend only)
npm run api          # Backend Express dev server on :3001 (via nested npm in backend/)
npm run electron:dev # Vite + Electron together (concurrently)
```

### Build & Lint
```bash
npm run build        # tsc + vite build
npm run lint         # ESLint across all files
```

### Backend tests
```bash
cd backend && npm test            # Jest (all tests)
cd backend && npm run test:watch  # Jest watch mode
```

### Infrastructure (Postgres + Redis)
```bash
docker-compose up -d              # Start Postgres 15, Redis 7, pgAdmin, Redis Commander
npm run db:migrate                # Apply backend/db/schema.sql
cd backend && npm run seed        # Populate dev data
```

The frontend works without Docker (falls back to in-memory state). Postgres and Redis are optional.

## Architecture Overview

**MotherCode** is a voice-first AI orchestration dashboard. A user speaks (or types) a command; the frontend sends it to the Express backend, which routes it through an agent orchestrator and returns a spoken reply. The project is in Phase 3 — dashboard and voice loop functional, real agent integrations (Google OAuth, Claude-backed NLP) not yet wired.

### Three-tier structure

| Tier | Location | Purpose |
|------|----------|---------|
| Frontend | `src/` | React 19 + Zustand + Vite; runs in browser or Electron renderer |
| Backend | `backend/src/` | Express 4 + WebSocket (ws); HTTP on :3001 |
| Desktop | `frontend/main.js` | Electron 33 shell with system tray and IPC |

The root `package.json` is the monorepo orchestrator. The backend is a **nested npm package** with its own `backend/package.json`; run its scripts from inside `backend/` or via `npm run api` from root.

### Frontend state & voice loop

All state lives in a single Zustand store (`src/store.ts` — `useDashboardStore`). There is no React Context.

The voice loop is driven by two custom hooks:
- **`src/voice/useVoiceLoop.ts`** — Orchestrates mic → `POST /api/voice/command` → speak. Manages `voiceUiState` (IDLE / USER_TALKING / AI_SPEAKING / AGENT_ERROR) which drives the `OrbCanvas` animation.
- **`src/voice/useVoiceData.ts`** — Syncs the store with the backend: polls REST every 15 s + subscribes to WebSocket for real-time pushes.

Voice providers (`src/voice/providers.ts`) implement a `SpeechProvider` interface:
- **BrowserSpeechProvider** — Web Speech API + browser `speechSynthesis` (zero keys needed).
- **ServerSpeechProvider** — MediaRecorder → Deepgram STT + ElevenLabs TTS.
- **HybridProvider** — Routes STT/TTS independently to server when keys are present, browser otherwise.

### Backend agent system

```
MotherCodeAgent (orchestrator)
  └── routes intent → StubAgent × 6 (calendar, email, social_media, finance, analytics, file_manager)
```

- **`BaseAgent.js`** — Abstract EventEmitter with `process(command)` / `execute(command)` template.
- **`MotherCodeAgent.js`** — Extends BaseAgent; dispatches intent to registered agents in parallel.
- **`StubAgent.js`** — All 6 domain agents are stubs; replacing them with real OAuth-backed implementations is Phase 2.
- Intent parsing is currently keyword regex in `voiceController.js`. The Phase 2 upgrade swaps it for `CLAUDE_API_KEY`-backed NLP.

### Persistence strategy

The backend uses an **in-memory ring buffer** (`backend/src/state/voiceStore.js`, MAX_CALLS=100) as the live source of truth. Postgres writes (`voice_commands` table) are **non-fatal** — a DB failure never 500s a request. Redis is optional. Always treat in-memory state as authoritative during development.

### Styling

Pure inline React styles — no CSS framework, no Tailwind. All color/glow tokens live in `src/theme.ts` as three named variants (Neon / Acid / Ember). Components read the active variant from the Zustand store and compute tokens at render time. Font stack: Fira Code (monospace labels/metrics), Inter (body).

## Key Conventions

- **ESM everywhere**: Both root and backend use `"type": "module"`. Use `.js` extensions on imports in backend Node files.
- **TypeScript strict** for frontend (`tsconfig.app.json` sets `strict: true`, target ES2023).
- **Backend is plain JS** (no TypeScript); ESLint is configured separately in `backend/`.
- **No error-suppressing fallbacks in the voice path** — catch blocks set `voiceUiState = 'AGENT_ERROR'` and auto-recover to IDLE after 2 s; they do not swallow errors silently.
- **Optional env keys** — the app must function without any `.env` keys. Gate premium features (Deepgram, ElevenLabs, Claude API) behind `keys.js` validity checks and always provide a browser/stub fallback.
- **Phase-gated dependencies** — several backend deps (openai, bull, node-microphone, keytar, etc.) are commented out in `backend/package.json`; add them only when implementing the corresponding feature.

## Environment Variables

None are required for local development. To enable premium features create `backend/.env` (see `env.example`):

| Variable | Feature |
|----------|---------|
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | Server-side TTS |
| `DEEPGRAM_API_KEY` | Server-side STT |
| `CLAUDE_API_KEY` | Intent parsing + agent replies (Phase 2) |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres (defaults in docker-compose) |
| `REDIS_URL` | Redis cache |
