# MotherCode — Progress Log

Reverse-chronological log of meaningful work. Newest first.

---

## 2026-06-17 — Desktop double-clap launcher ("Lefty") working + ElevenLabs hardening

Stood up the project's original **double-clap launcher** — a separate Python app at
`Downloads\Mother Code\jarvis-main\jarvis-main\jarvis.py` — and made its four actions
fire reliably. The real ElevenLabs/Deepgram keys are now in use.

### Launcher
- Reviewed the existing `jarvis.py`: the clap-detection state machine and Win32 window
  control were already solid. The one real defect was the **welcome silently failing**
  on a free ElevenLabs key.
- Rewrote the TTS path to call ElevenLabs over **stdlib `urllib`** (dropped the
  `elevenlabs` SDK + its ffmpeg dependency) so it can read the exact HTTP status, and
  added a **402 → free premade voice fallback** (`cjVigY5qzO86Huf0OWal`, "Eric").
- **Scoped out the Binance** window (`OPEN_BINANCE_BTC_IN_CHROME=False`) — not part of
  the requested 4-action feature (flag kept for re-enabling).
- Trimmed `requirements.txt` to what's imported (numpy, sounddevice, python-dotenv);
  added `.env` (gitignored), `start-lefty.cmd`, and README/`.gitignore` updates.

### Environment fix
- The machine's system Pythons are **corrupted** — `python` (3.12) is missing
  `html.entities` and a working pip; `C:\Python314` is missing `enum`/`typing`. Built
  an isolated **`.venv` from the healthy Python install-manager 3.14.6**
  (`%LOCALAPPDATA%\Python`) and installed deps there.

### Verification
- Probed ElevenLabs directly: free tier; configured voice `dOqxOZEisn8SiUH1dPCC` returns
  **402 `paid_plan_required`** (library voice); free voice "Eric" returns 200 incl. `pcm_24000`.
- Ran the real paths: mic `InputStream` reads live blocks; configured → 402 → fallback →
  **200 + audible playback**; `jarvis.py` reaches "Listening" with the right plan and **no
  Binance line**.
- Did **not** auto-fire the full chain (it seizes screens/audio and F11s Cursor) — the
  physical double-clap is the user's test.

### Notes
- Same paid-voice 402 finding as the dashboard's `voice/tts.js`; both now fall back to a free voice.
- If Chrome is already open, `--new-window` can land as a tab → Claude opens unpositioned (close Chrome first).

---

## 2026-06-17 — Phase 3: Multi-view dashboard

**Branch**: `phase-3-dashboard` (off `phase-2-voice-loop`)

Turned the single voice screen into a navigable multi-view dashboard while keeping
the voice loop intact, all still keyless.

### Frontend
- Added `AppShell` with a nav rail (VOICE / HISTORY / SCHEDULE / LIBRARY / SETTINGS)
  and lifted the theme-variant tabs to be global; `themeVariant` + `activeView` moved
  into the store so every view shares the accent.
- Extracted shared theme tokens to `src/theme.ts`; `OrbCanvas` now imports the shared `OrbTheme`.
- Refactored the voice dashboard to read the shared theme (removed its local tabs/THEMES) — verified unchanged in-browser.
- New views (all themed via `ViewChrome`):
  - **History** — searchable, intent-filtered command log from `/api/voice/conversations`.
  - **Schedule** — task list + create form from `/api/tasks` (keyless via in-memory fallback).
  - **Settings** — read-only agent/provider/integration status + how-to-enable notes (no credential entry).
  - **Library** — honest "no content source / Phase 4" placeholder (no mock data).

### Backend
- `state/taskStore.js` + made `taskRoutes` non-fatal (DB-first, in-memory fallback) so Schedule works keyless.
- Made `integrationRoutes` non-fatal (returns empty `source: 'memory'` instead of 500) so Settings degrades cleanly.

### Verification
- `npm run build` clean (`tsc -b`, 32 modules).
- Kapture walk-through of all 5 views: voice view intact + animating, History/Schedule/Settings show live
  backend data, Library placeholder, **no console errors**. Keyless task CRUD confirmed via curl.

---

## 2026-06-17 — Phase 2a: Conversational voice loop (functional)

**Branch**: `phase-2-voice-loop`

Took the project from "Phase 1 scaffold that 500s on a voice command" to a
working, keyless, end-to-end voice loop with the Glass-Metric dashboard.

### Backend
- Switched port **5000 → 3001** and moved to `http.createServer` so HTTP + WebSocket
  share one port (frontend expects `ws://localhost:3001`).
- Added a WebSocket hub (`realtime/wsHub.js`, `ws@8`) broadcasting `{ type: 'voice_call', data }`.
- Registered 6 `StubAgent`s (`agents/StubAgent.js`) so `routeIntent` resolves and
  `aggregateResults` returns a real sentence instead of the fallback.
- Made the `voice_commands` insert **non-fatal** — a logging write no longer 500s the request.
- Added an in-memory voice store (`state/voiceStore.js`) as the live source of truth, feeding
  three new endpoints: `GET /api/voice/conversations`, `/metrics`, `/agent/status`
  (shapes match the frontend `VoiceCall` / `VoiceMetrics`).
- Implemented ElevenLabs TTS (`voice/tts.js`) + Deepgram STT (`voice/stt.js`), gated by a
  placeholder-aware key check (`voice/keys.js`) so they return `501` until real keys exist.

### Frontend
- Ported the **Glass-Metric Orchestration** design (from the downloaded artifact) to React:
  `OrbCanvas.tsx` (animated orbital core = voice visualizer) and `OrchestrationDashboard.tsx`
  (3-column layout, 3 themes, live data, TASK STREAM, DIAGNOSTICS).
- Added a voice provider abstraction (`voice/providers.ts`) defaulting to the browser Web
  Speech API, plus `useVoiceLoop` (mic → POST → spoken reply) and `useVoiceData` (poll + WS).
- Extended the Zustand store additively with voice-loop UI state (`voiceUiState`, `voiceRunning`,
  `liveTranscript`, `liveResponse`, domains, providers).
- App now renders the new full-screen dashboard; old `Dashboard`/`Sidebar`/`VoiceCallLog`
  left in place (unused, still compiles).

### Verification
- curl: 200 success path, 400 validation, 501 provider gating.
- WS client received `connected` + `voice_call`.
- `npm run build` clean (`tsc -b`, vite).
- Rendered live in Chrome via Kapture: no console errors, 6 agents live, drove the
  **text-command** loop (CALLS 1 → 2). Mic leg wired but not yet live-tested.

### Known gaps
- Live mic (`SpeechRecognition`) not smoke-tested (needs foreground tab + gesture).
- No Docker/psql on this machine; all paid keys are placeholders → keyless-first design.
