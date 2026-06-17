# MotherCode — Decision Log

Lightweight ADRs. Each records a decision, why, and what it rules out. Newest first.

---

## 2026-06-17 (Desktop launcher)

### D-011 · Call ElevenLabs over stdlib `urllib`, not the SDK; scope out Binance
**Decision**: In `jarvis.py`, drop the `elevenlabs` SDK and POST to the REST endpoint with
`urllib.request`; disable the Binance-window action (`OPEN_BINANCE_BTC_IN_CHROME=False`).
**Why**: The SDK obscures the HTTP status (needed to detect 402) and pulls in ffmpeg for playback
we don't use — we only need the raw PCM bytes, which `sounddevice` plays directly. Binance wasn't
part of the requested 4-action feature.
**Trade-off**: We hand-build the request/headers; the Binance flag stays in code (flip to re-enable).

### D-010 · Run the launcher from an isolated venv built with the Python install-manager runtime
**Decision**: Build `.venv` from `%LOCALAPPDATA%\Python\bin\python.exe` (Python install-manager
3.14.6) and launch via `start-lefty.cmd` / `.venv\Scripts\python.exe`, not the system `python`.
**Why**: Both system Pythons are corrupted — `python` (3.12) is missing `html.entities` and a working
pip; `C:\Python314` is missing `enum`/`typing`. The install-manager runtime is the only healthy
interpreter with a working pip + venv.
**Alternatives ruled out**: Repairing the system Pythons (slower, may need elevation/reinstall, and the
corruption scope is unknown); installing into a broken interpreter (can't — pip is dead).

### D-009 · Free-tier 402 on a paid voice auto-falls back to a free premade voice (project-wide)
**Decision**: When ElevenLabs returns **402 `paid_plan_required`** for the configured voice, retry once
with a free premade voice (`cjVigY5qzO86Huf0OWal`, "Eric"). Applies to both the desktop launcher
(`jarvis.py`) and the dashboard backend (`voice/tts.js`).
**Why**: The user's chosen voice `dOqxOZEisn8SiUH1dPCC` is a library voice that needs a paid plan; on the
free key it 402s. Silently skipping speech is worse than a slightly different voice — the welcome/reply
should always be heard. Upgrading the plan makes the chosen voice work with no code change.
**Trade-off**: On the free tier you hear "Eric", not the chosen voice, until the plan is upgraded.

---

## 2026-06-17 (Phase 3)

### D-008 · Keyless fallback extended to tasks and integrations
**Decision**: Mirror the voice store pattern — `taskRoutes` is DB-first with an in-memory
fallback; `integrationRoutes` returns an empty `source: 'memory'` payload instead of 500.
**Why**: STATUS.md promises "no infra required". Phase-3 views that 500 without Postgres would
break that contract and dirty the console. Views must degrade, not crash.
**Trade-off**: Task data is volatile without a DB; integrations simply show "not tracked" until one exists.

### D-007 · One app shell + nav rail; voice view stays the home view
**Decision**: Introduce `AppShell` (nav rail + global theme tabs) hosting one active view; move
`themeVariant`/`activeView` into the store; refactor the voice dashboard to read the shared theme.
Build views in realness-order; keep Library an honest placeholder rather than mock tiles.
**Why**: "Incorporate the dashboard" = a navigable product, not parallel dashboards. Sharing theme +
view state in the store keeps the accent consistent and the shell thin.
**Alternatives ruled out**: Router library (overkill for 5 views); per-view theme state (would desync the accent);
fabricated content in Library (same anti-fake discipline as ignoring the Wayta bundle).

---

## 2026-06-17 (Phase 2)

### D-006 · Add `ws` as a backend dependency
**Decision**: Use the `ws` package for the WebSocket server, attached to the shared HTTP server.
**Why**: The frontend opens a native `WebSocket`; `ws` is pure-JS (no native build, clean on
Windows) and the lightest way to satisfy that contract.
**Alternatives ruled out**: SSE (frontend already hardcodes `WebSocket`); socket.io (heavier,
needs a matching client).

### D-005 · Glass-Metric design becomes the primary full-screen dashboard
**Decision**: Render `OrchestrationDashboard` from `App.tsx`; port the Glass-Metric artifact
faithfully (canvas core, 3 sidebars, 3 themes). Ignore the design bundle's "Wayta" design system.
**Why**: The design is a full-screen dashboard, so "incorporate" = make it the dashboard. Wayta
is an unrelated product (a nightlife app) that happened to ride along in the export.
**Alternatives ruled out**: Bolting a second dashboard beside the old neon one; deleting the old
`Dashboard`/`Sidebar`/`VoiceCallLog` (left in place — `tsc` confirms nothing broke, no need to churn).

### D-004 · Register stub agents for all 6 domains
**Decision**: Boot `MotherCodeAgent` with a `StubAgent` per domain, each returning a deterministic
per-domain reply.
**Why**: Makes the loop observable end-to-end before the real integrations land — routing resolves
and `aggregateResults` produces a real sentence instead of "I wasn't able to complete that."
**Migration path**: `motherCode.registerAgent('calendar', new CalendarAgent(...))` replaces a stub
under the same key — no other changes needed.

### D-003 · Backend port 3001, HTTP + WebSocket on one server
**Decision**: Move from 5000 to 3001 and from `app.listen` to `http.createServer` + `ws`.
**Why**: The frontend defaults to `http://localhost:3001` and `ws://localhost:3001`; sharing one
port keeps config and CORS simple.

### D-002 · In-memory voice store is the source of truth; Postgres is best-effort
**Decision**: Record every processed command in an in-memory ring buffer that backs the dashboard
endpoints; persist to `voice_commands` in a try/catch that logs and continues.
**Why**: This machine has no Postgres/Docker. A logging write must never fail the user-facing
request, and the dashboard must work without infra. DB becomes durable history when present.
**Trade-off**: History is volatile across restarts until a DB is attached.

### D-001 · Browser Web Speech API is the default voice path; ElevenLabs/Deepgram are flag-gated upgrades
**Decision**: Default STT/TTS to the browser (`SpeechRecognition` + `speechSynthesis`). Implement
ElevenLabs/Deepgram server-side behind a placeholder-aware key check; they activate only when real
keys are present.
**Why**: All paid keys in `.env` are placeholders. The user's goal — an observable, working voice
loop — is achievable today with zero keys; the paid path is a config flip, not a rewrite.
**Trade-off**: Mic STT is Chrome/Edge-only and needs localhost/https + network. Noted as a dev
limitation, not a regression.
