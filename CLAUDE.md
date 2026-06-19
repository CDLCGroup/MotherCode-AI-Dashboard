# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MotherCode (codename **Lucky Lefty**) is a voice-first AI agent dashboard. A user speaks or types a
command → the **MotherCode** orchestrator routes it to one or more specialized agents → results come
back as a spoken reply and live dashboard updates, with a "Glass-Metric" orchestration core animating
the turn (STANDBY / LISTENING / RESPONDING / ERROR). `STATUS.md` always holds the current phase and
the live blocker list — read it first.

## Repository layout (three independent pieces)

| Area | Path | Notes |
|------|------|-------|
| **React dashboard** | `src/` (root npm package `mothercode-dashboard`) | The live UI. Vite serves `index.html` → `src/main.tsx`. This is what `npm run dev` runs. |
| **Electron shell** | `frontend/` | `main.js` + `preload.cjs` only (system tray, voice IPC). `package.json:main` points here. NOT the React app — don't confuse `frontend/` with `src/`. |
| **Backend API** | `backend/` | Self-contained nested npm package (its own `package.json`/`node_modules`). Express ESM, port 3001. |

Planning/history live in `docs/` (`IMPLEMENTATION_PLAN.md`, `decisions.md`, `progress.md`). The
`project/` dir is the original Claude Design mockup handoff.

## Commands

Run backend and frontend in **separate terminals**. From the repo root:

```bash
npm run dev          # frontend → http://localhost:5173 (Vite)
npm run api          # backend  → http://localhost:3001 (proxies to backend/ npm run dev, node --watch)
npm run build        # tsc -b && vite build  (type-check is part of the build)
npm run lint         # eslint .
```

Backend, from `backend/`:

```bash
npm run dev          # node --watch src/index.js
npm run migrate      # apply db/schema.sql — needs Postgres (optional, see keyless-first)
npm test             # jest
npx jest <pattern>   # single test
```

Self-tests live in `backend/scripts/*.mjs` and run **offline** (no servers, no keys). Use them to
verify a domain end-to-end:

```bash
node backend/scripts/social-selftest.mjs        # SocialAgent / Buffer + Slack
node backend/scripts/voice-fallback-selftest.mjs # STT/TTS provider fallback
node backend/scripts/tiktok-selftest.mjs         # TikTokAgent → tt_scraper bridge
node backend/scripts/google-selftest.mjs         # Calendar/Email OAuth wiring
```

Optional infra (only for durable history): `docker-compose up -d` → postgres:15 + redis:7.

## Architecture

### Voice loop (one conversational turn)
`src/voice/useVoiceLoop.ts` drives: mic→STT → `POST /api/voice/command {userId, transcript}` →
spoken reply (TTS), while setting `voiceUiState` in the Zustand store (`src/store.ts`, persisted).
Frontend talks to the backend at `VITE_API_URL` / `VITE_WS_URL` (default `http://localhost:3001` /
`ws://localhost:3001`). The WebSocket hub broadcasts `{ type: 'voice_call', data }` on every command.

### Orchestration (the core mental model)
`backend/src/api/routes/voiceRoutes.js` is where the agent graph is **wired**: it constructs one
`MotherCodeAgent` and calls `registerAgent(domain, agent)` for each specialized agent. This is the
file to edit to add/replace an agent — NOT `index.js` (which only mounts routes).

- Routing is two-tier. Preferred: the **LLM router** (`backend/src/voice/intentRouter.js`,
  `claude-opus-4-8` via a forced `route_command` tool call) classifies the transcript into an intent +
  agent domains; the controller passes `command.domains` straight through. Keyless fallback: when
  `ANTHROPIC_API_KEY`/`CLAUDE_API_KEY` is unset or the API errors, it drops to the **regex router**
  `MotherCodeAgent.routeIntent()`. `execute()` runs the chosen agents in parallel via `Promise.all`
  and aggregates replies. `routeIntent` and its 9/9 selftest are the keyless path — keep them.
- All agents extend `BaseAgent` (`backend/src/agents/BaseAgent.js`): implement `execute(command)`;
  the base wraps it with timing, `command_executed`/`command_failed` events, and the
  `{ success, data, error }` envelope. `command = { intent, params, userId, transcript }`.
- Registered domains today: **real** — `calendar`, `email` (Google OAuth), `social_media` (Buffer),
  `tiktok`; **stubs** — `finance`, `analytics`, `file_manager` (one `StubAgent` per domain).
- New agent domains **auto-surface** as cards on the frontend via `/api/voice/agent/status` — no
  frontend change needed to expose a new agent.

### TikTok agent → external pipeline
`backend/src/integrations/tiktokClient.js` does NOT scrape in-process — it `spawn`s a Windows
PowerShell runner (`TT_SCRAPER_RUNNER`, default `C:\Users\o3sha\tt_scraper_runner.ps1`) driving the
user's deployed `tt_scraper` pipeline (`TT_SCRAPER_DIR`, default `F:\tiktok_archiver`), with
`-SkipDriveUpload` so a voice-triggered run never blocks on Drive auth. The `archive`/`scrape` intent
routes here (distinct from `social_media` posting).

## Keyless-first — the defining constraint

The whole stack runs with **no API keys and no Postgres/Redis**. Every paid dependency is an optional
upgrade behind a gate; the request path must never 500 because a key/DB is absent:

- `voice_commands` DB insert is best-effort — logs `persistence skipped` and continues when Postgres
  is down. Recent calls live in an in-memory store (`backend/src/state/voiceStore.js`).
- Voice providers fall back: TTS ElevenLabs→OpenAI, STT Deepgram→OpenAI Whisper, then browser speech.
- Slack subagent-chat and Buffer posting are fire-and-forget / gated: when their token is unset (or
  the bot can't reach a channel) the hook no-ops or speaks a "connect X to enable" message — it must
  never fail the voice command.

**When adding integrations, preserve this:** gate on the env var, degrade to a stub/no-op, keep the
response contract shape identical whether or not the key is present. Verify with the offline
self-tests above.

## Secrets & env

The real `SLACK_BOT_TOKEN` is loaded from the **process environment**, not from `backend/.env` (which
holds an `xoxb-...` placeholder). `.gitignore` covers `.env*`, `*ServiceAccount*.json`,
`.google-tokens.json`, and `.mcp.json` (the live Obsidian REST key) — keep their `.example`
counterparts as the tracked templates. Frontend config is `VITE_*` only (`VITE_API_URL`,
`VITE_WS_URL`, `VITE_USER_ID`, plus `VITE_*_MCP_URL` for the buffer/slack/sheets service shims).
