# Lucky Lefty — Backend

Standalone Express (ESM) service for the Lucky Lefty / MotherCode voice agent.
Runs independently of the root app and has its own `package.json` and dependencies.

## Quick start

```bash
cd backend
cp .env.example .env        # then fill in values
npm install

# from the repo root: start Postgres + Redis
# (docker-compose.yml lives at the repo root and mounts backend/db/schema.sql)
docker-compose up -d

npm run migrate             # apply db/schema.sql
npm run seed                # optional: insert a default dev user (id 1)
npm run dev                 # starts on http://localhost:5000 (node --watch)
```

The root `package.json` proxies these: `npm run api` → `dev`, `npm run db:migrate` → `migrate`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET`  | `/health` | `{ status: 'ok', timestamp }` |
| `POST` | `/api/voice/command` | `{ userId, transcript }` — parses intent, routes via MotherCode, logs to `voice_commands` |
| `GET`  | `/api/voice/history` | `?userId=1&limit=50` |
| `GET`/`POST` | `/api/tasks` | list / create tasks |
| `GET`  | `/api/integrations` | list integrations (no credentials returned) |

## Layout

```
backend/
├── src/
│   ├── index.js                       # Express app + server (port 5000)
│   ├── agents/{BaseAgent,MotherCodeAgent}.js
│   ├── api/
│   │   ├── controllers/voiceController.js
│   │   ├── routes/{voice,task,integration}Routes.js
│   │   └── middleware/errorHandler.js
│   └── config/{database,redis}.js      # pg Pool + ioredis client
├── db/{schema.sql, migrate.js, seed.js}
├── package.json
└── .env.example
```

## Status (Phase 1)

`index.js`, the agents, `voiceController.js`, and `schema.sql` are from the
original design session. The `routes/`, `config/`, `middleware/`, and `db/migrate.js`
files are the connecting scaffold so the service boots and the voice pipeline runs
end-to-end. Specialized agents (Calendar, Email, Social, Finance) arrive in Phase 2 —
see `../docs/IMPLEMENTATION_PLAN.md`.

> Known scaffold mismatch to revisit in Phase 2: `voiceController.processVoiceCommand`
> reads `result.response` / `result.agents_invoked` directly, but `MotherCodeAgent`
> (via `BaseAgent.process`) nests those under `result.data`. The endpoint still boots,
> logs, and responds — the response payload's `response` field will just be empty until
> this is reconciled.
