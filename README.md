# MotherCode AI Dashboard

A voice-first AI agent dashboard (codename **Lucky Lefty**). A user speaks a
command, the **MotherCode** orchestrator routes it to specialized agents
(calendar, email, social media, finance, analytics, files), and the result is
returned to the dashboard and as a spoken response.

This repo holds three things:

| Area | Path | Stack |
|------|------|-------|
| **Desktop / web UI** | `frontend/` | React + Vite, wrapped in an Electron shell (system tray, voice IPC) |
| **Backend API** | `backend/` | Express (ESM), PostgreSQL, Redis — standalone nested npm package |
| **Design handoff** | `project/` | Original Claude Design mockups (`MotherCode AI Dashboard.dc.html`) + assets |

Current state lives in [`STATUS.md`](STATUS.md). Planning + history live in `docs/`
(`IMPLEMENTATION_PLAN.md`, `PHASE_1_README.md`, `QUICKSTART.md`, `progress.md`, `decisions.md`).

> **Companion desktop launcher ("Lefty").** The project's original physical entry
> point is a standalone Python **double-clap launcher**, kept in a separate folder
> (`Downloads\Mother Code\jarvis-main\jarvis-main\jarvis.py`): a double clap opens
> Spotify, Claude fullscreen in Chrome on a chosen monitor, an ElevenLabs welcome
> line, and Cursor fullscreen. It shares the ElevenLabs setup — including the
> free-tier paid-voice fallback ([`decisions.md`](docs/decisions.md) D-009) — with
> this repo's backend but ships independently. See that folder's own `README.md`.

---

## Quick start

### 1. Infrastructure (optional in Phase 2)

```bash
docker-compose up -d        # postgres:15 + redis:7 (+ pgAdmin, redis-commander)
```

Phase 2 runs **without** Postgres/Redis: the voice loop keeps recent calls in
memory and persistence to `voice_commands` is best-effort. Start the DB only
when you want durable history.

### 2. Backend API

The backend is a self-contained package under `backend/` with its own deps.

```bash
cd backend
cp .env.example .env        # DB/Redis + API keys are all optional for the voice loop
npm install                 # no native builds
npm run migrate             # optional: apply db/schema.sql (needs Postgres)
npm run dev                 # http://localhost:3001  (HTTP + WebSocket, node --watch)
```

Or drive it from the repo root: `npm run api`, `npm run db:migrate`.

### 3. Frontend (web dev server)

```bash
npm install
npm run dev                 # Vite dev server at http://localhost:5173
```

The dashboard talks to the backend at `http://localhost:3001` and `ws://localhost:3001`
(override with `VITE_API_URL` / `VITE_WS_URL`).

### 4. Desktop app (Electron)

```bash
npm run electron:dev        # waits for Vite, then launches the Electron shell
npm run electron:build      # packaged installer via electron-builder -> release/
```

---

## API surface

| Method | Route | Purpose |
|--------|-------|---------|
| `GET`  | `/health` | Liveness check → `{ status, timestamp }` |
| `POST` | `/api/voice/command` | Process a command `{ userId, transcript, durationSec? }` → `{ response, agents_invoked, … }` |
| `GET`  | `/api/voice/history` | Recent commands for a user (DB, falls back to memory) |
| `GET`  | `/api/voice/conversations` | Recent calls in the dashboard `VoiceCall` shape |
| `GET`  | `/api/voice/metrics` | Aggregate `VoiceMetrics` (total/completed/avgDuration/intentCounts) |
| `GET`  | `/api/voice/agent/status` | Registered agents + configured voice providers |
| `POST` | `/api/voice/tts` | ElevenLabs TTS `{ text }` → audio (501 until key set) |
| `POST` | `/api/voice/transcribe` | Deepgram STT (raw audio) → `{ transcript }` (501 until key set) |
| `WS`   | `ws://localhost:3001` | Real-time push: `{ type: 'voice_call', data }` |
| `GET`/`POST` | `/api/tasks` | Task list / create |
| `GET`  | `/api/integrations` | Connected integrations (credentials never returned) |

---

## Status

**Phase 2** — conversational voice loop. Speak (or type) a command → MotherCode
routes it to registered agents → a spoken reply, with the orchestration core
animating LISTENING / RESPONDING in real time.

- **Speech** defaults to the browser's Web Speech API (`SpeechRecognition` +
  `speechSynthesis`) — **no API keys required**, Chrome/Edge for mic input.
  Set `DEEPGRAM_API_KEY` / `ELEVENLABS_API_KEY` to upgrade STT/TTS to the
  server-side providers (same interface, gated until keys are present).
- **Agents** are registered as stubs (`StubAgent`) so the loop is end-to-end
  today; swap each for a real `BaseAgent` subclass under the same domain key.
- **No infra required**: runs without Postgres/Redis; DB persistence is
  best-effort.

Heavy/native dependencies (ffmpeg, OS keychain, auth) remain pruned from
`backend/package.json` (`_phase2Dependencies`) and are re-added as features land.

## License

MIT
