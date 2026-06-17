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

Planning docs live in `docs/` (`IMPLEMENTATION_PLAN.md`, `PHASE_1_README.md`, `QUICKSTART.md`).

---

## Quick start

### 1. Infrastructure (Postgres + Redis)

```bash
docker-compose up -d        # postgres:15 + redis:7 (+ pgAdmin, redis-commander)
```

### 2. Backend API

The backend is a self-contained package under `backend/` with its own deps.

```bash
cd backend
cp .env.example .env        # fill in DB/Redis + API keys
npm install                 # Phase-1 deps only (no native builds)
npm run migrate             # apply db/schema.sql
npm run seed                # optional: default dev user
npm run dev                 # http://localhost:5000  (node --watch)
```

Or drive it from the repo root: `npm run api`, `npm run db:migrate`.

### 3. Frontend (web dev server)

```bash
npm install
npm run dev                 # Vite dev server at http://localhost:5173
```

### 4. Desktop app (Electron)

```bash
npm run electron:dev        # waits for Vite, then launches the Electron shell
npm run electron:build      # packaged installer via electron-builder -> release/
```

---

## API surface (Phase 1)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET`  | `/health` | Liveness check → `{ status, timestamp }` |
| `POST` | `/api/voice/command` | Process a voice command `{ userId, transcript }` |
| `GET`  | `/api/voice/history` | Recent voice commands for a user |
| `GET`/`POST` | `/api/tasks` | Task list / create |
| `GET`  | `/api/integrations` | Connected integrations (credentials never returned) |

The Electron shell talks to the backend at `http://localhost:5000` (see
`frontend/main.js`).

---

## Status

**Phase 1** — scaffold + orchestration skeleton. The backend boots and serves
without external API keys; `MotherCodeAgent` routes intents but specialized
agents are not yet registered, so commands return a graceful "not able to
complete" response until Phase 2 wires them up.

Heavy/native dependencies (voice capture, ffmpeg, OS keychain, auth) were
pruned from `backend/package.json` to keep `npm install` clean — they're
listed under `_phase2Dependencies` and re-added as features land.

## License

MIT
