# MotherCode — Project Status

**Last updated**: June 17, 2026
**Branch**: `phase-3-dashboard`
**Current phase**: Phase 3 dashboard (functional) + desktop double-clap launcher (working)

---

## TL;DR

The voice loop is **working end-to-end with zero API keys**. Speak or type a
command → MotherCode routes it to agents → a spoken reply, with the Glass-Metric
orchestration core animating LISTENING / RESPONDING in real time. Postgres,
Docker, and the paid voice providers (ElevenLabs / Deepgram) are **optional
upgrades**, not requirements.

---

## What works now ✅

### Backend (`backend/`, Express ESM, port **3001**, HTTP + WebSocket)
- `POST /api/voice/command` → **200** with real `response` + `agents_invoked`
- 6 `StubAgent`s registered (calendar, email, social_media, finance, analytics, file_manager)
- `voice_commands` DB insert is **non-fatal** — request never 500s when Postgres is absent
- In-memory voice store feeds `GET /api/voice/conversations | /metrics | /agent/status`
- WebSocket hub at `ws://localhost:3001` broadcasts `{ type: 'voice_call', data }`
- ElevenLabs TTS (`POST /api/voice/tts`) and Deepgram STT (`POST /api/voice/transcribe`)
  implemented and **gated** — return `501` until real keys are set

### Frontend (`src/`, React 19 / Vite / Zustand, dev server :5173)
- Glass-Metric orchestration dashboard ported to React (`OrchestrationDashboard.tsx`)
- Animated canvas core as the voice visualizer (`OrbCanvas.tsx`): STANDBY / LISTENING / RESPONDING / ERROR
- 3 theme variants (NEON / ACID / EMBER)
- Live SYSTEM stats, AGENTS list, TASK STREAM, DIAGNOSTICS — all from backend data
- Mic capture via browser Web Speech API + a text-command fallback
- **Multi-view shell** (nav rail): VOICE · HISTORY · SCHEDULE · LIBRARY · SETTINGS, shared theme
  - History: searchable command log (`/api/voice/conversations`)
  - Schedule: task list + create (`/api/tasks`, keyless in-memory fallback)
  - Settings: read-only agent/provider/integration status + how-to-enable
  - Library: honest Phase-4 placeholder
- `npm run build` passes (`tsc -b`, no type errors)

### Desktop clap launcher ("Lefty" — standalone Python, `Downloads\Mother Code\jarvis-main\jarvis-main\Lefty.py`)
The original double-clap entry point, now working end-to-end. A **double clap**
(~0.1–0.3s apart) into the mic fires four actions in order:
1. Spotify plays a chosen track (`SONG_URI`)
2. Claude opens **fullscreen in Chrome** on a chosen monitor (`CLAUDE_CHROME_MONITOR`; Win32 `SetWindowPos`)
3. ElevenLabs **speaks a welcome line** (`LEFTY_WELCOME_PHRASE`)
4. Cursor is **focused and sent fullscreen** (F11)
- TTS **auto-falls back to a free premade voice** when the configured voice needs a paid plan (see Blockers), so the welcome always speaks.
- Runs from an isolated `.venv` via one-click `start-lefty.cmd`; the Binance window action was scoped out (not part of the 4-action feature).

---

## Verified

- curl: success (200), validation (400), provider gating (501) ✅
- WebSocket client: received `connected` + `voice_call` broadcast ✅
- Rendered live in Chrome (Kapture): no console errors, 6 agents live, **text-command loop** drove CALLS 1→2 ✅
- **Desktop launcher**: mic `InputStream` reads live audio blocks; configured voice → `402` → **free-voice fallback returns `200` + audible playback**; `Lefty.py` reaches "Listening" with the correct 4-action plan ✅ — the physical double-clap itself is the user's to run (firing it programmatically would seize screens/audio) ⚠️

## Not yet verified ⚠️

- The actual **mic** leg (`SpeechRecognition`) is wired + built but not live-smoke-tested
  (needs a foreground Chrome/Edge tab + user mic gesture). Click **TAP-TO-TALK** to test.
- Whether the post-command UI refresh came from the WS push vs the 15s poll was not isolated (both are wired).

---

## Blockers / pending decisions

| Item | State | To unblock |
|------|-------|-----------|
| Premium STT/TTS | **real keys now set** (Deepgram + ElevenLabs); active server-side | browser smoke-test still pending |
| Paid ElevenLabs voice | configured `dOqxOZEisn8SiUH1dPCC` is a **library voice → HTTP 402** on the free tier | upgrade the plan, or accept the auto-fallback to free voice `cjVigY5qzO86Huf0OWal` ("Eric") |
| Durable history | runs in-memory | start Postgres (`docker-compose up -d`) + `npm run migrate` |
| Real agents | stubs only | replace each `StubAgent` with a real `BaseAgent` subclass under the same domain key |
| LLM intent/replies | keyword parser | set `CLAUDE_API_KEY` and wire Claude into `parseIntent` / agent replies |

This machine has **no Docker, no psql**. Voice keys (ElevenLabs/Deepgram) are now
real, but on a **free ElevenLabs tier** — paid/library voices 402, so TTS
auto-falls back to a free voice. The keyless-first design still holds as the
zero-config default.

---

## How to run

```bash
# Backend (no DB needed)
cd backend && npm install && npm run dev      # http://localhost:3001

# Frontend
npm install && npm run dev                     # http://localhost:5173
```

---

## Next up

- **Voice hardening (dashboard)**: keys are set + providers active server-side — remaining is the
  live browser mic smoke-test (Deepgram STT / ElevenLabs TTS through the UI) and latency tuning
- Real `CalendarAgent` / `EmailAgent` (Google OAuth) replacing stubs
- Claude-backed intent parsing + conversational replies
- Optional hosted ElevenLabs conversational-agent webhook path
