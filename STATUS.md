# MotherCode — Project Status

**Last updated**: June 17, 2026
**Branch**: `phase-2-voice-loop`
**Current phase**: Phase 2a — Conversational Voice Loop (functional)

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
- `npm run build` passes (`tsc -b`, no type errors)

---

## Verified

- curl: success (200), validation (400), provider gating (501) ✅
- WebSocket client: received `connected` + `voice_call` broadcast ✅
- Rendered live in Chrome (Kapture): no console errors, 6 agents live, **text-command loop** drove CALLS 1→2 ✅

## Not yet verified ⚠️

- The actual **mic** leg (`SpeechRecognition`) is wired + built but not live-smoke-tested
  (needs a foreground Chrome/Edge tab + user mic gesture). Click **TAP-TO-TALK** to test.
- Whether the post-command UI refresh came from the WS push vs the 15s poll was not isolated (both are wired).

---

## Blockers / pending decisions

| Item | State | To unblock |
|------|-------|-----------|
| Premium STT/TTS | placeholder keys in `backend/.env` | set `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` |
| Durable history | runs in-memory | start Postgres (`docker-compose up -d`) + `npm run migrate` |
| Real agents | stubs only | replace each `StubAgent` with a real `BaseAgent` subclass under the same domain key |
| LLM intent/replies | keyword parser | set `CLAUDE_API_KEY` and wire Claude into `parseIntent` / agent replies |

This machine currently has **no Docker, no psql**, and all paid keys are placeholders —
hence the keyless-first design.

---

## How to run

```bash
# Backend (no DB needed)
cd backend && npm install && npm run dev      # http://localhost:3001

# Frontend
npm install && npm run dev                     # http://localhost:5173
```

---

## Next up (Phase 2b candidates)

- Live mic smoke-test + latency tuning
- Real `CalendarAgent` / `EmailAgent` (Google OAuth)
- Claude-backed intent parsing + conversational replies
- Optional hosted ElevenLabs conversational-agent webhook path
