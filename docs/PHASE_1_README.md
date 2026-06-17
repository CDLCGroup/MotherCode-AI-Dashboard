# Lucky Lefty — Phase 1 Implementation (Weeks 1-2)

## What's Included

You now have a **complete, buildable Phase 1 foundation** with:

✅ **Database Schema** - All 8 core tables with indexes  
✅ **Backend Architecture** - Express.js, agent system, voice processing  
✅ **Agent System** - BaseAgent + MotherCode orchestrator  
✅ **Voice Controller** - Command processing pipeline  
✅ **Electron App** - System tray, window management, IPC handlers  
✅ **Configuration** - docker-compose, .env template, package.json  
✅ **11-Week Roadmap** - Detailed implementation plan  
✅ **Quick Start Guide** - 5-minute setup  

---

## File Structure to Create

```
lucky-lefty/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── BaseAgent.js ✅
│   │   │   ├── MotherCodeAgent.js ✅
│   │   │   ├── CalendarAgent.js (Week 2)
│   │   │   ├── EmailAgent.js (Week 2)
│   │   │   └── SocialMediaAgent.js (Week 2)
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   │   └── voiceController.js ✅
│   │   │   ├── routes/
│   │   │   │   ├── voiceRoutes.js (create)
│   │   │   │   └── taskRoutes.js (create)
│   │   │   ├── middleware/
│   │   │   │   └── errorHandler.js (create)
│   │   │   ├── config/
│   │   │   │   ├── database.js (create)
│   │   │   │   └── redis.js (create)
│   │   │   └── index.js ✅
│   │   └── services/ (Week 2)
│   │
│   ├── db/
│   │   ├── schema.sql ✅
│   │   ├── migrations/ (Week 2)
│   │   └── seeds/ (Week 2)
│   │
│   ├── package.json ✅
│   ├── .env.example ✅
│   └── docker-compose.yml ✅
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceIndicator.jsx (create)
│   │   │   ├── Dashboard.jsx (Week 2)
│   │   │   └── common/
│   │   ├── pages/
│   │   │   ├── Home.jsx (create)
│   │   │   └── Settings.jsx (Week 2)
│   │   ├── services/
│   │   │   └── api.js (create)
│   │   ├── App.jsx (create)
│   │   └── main.jsx (create)
│   │
│   ├── main.js ✅
│   ├── preload.js (create)
│   ├── package.json (create)
│   ├── vite.config.js (create)
│   └── tailwind.config.js (create)
│
├── .github/
│   └── workflows/ (Week 2)
│
├── docker-compose.yml ✅
├── .env.example ✅
├── IMPLEMENTATION_PLAN.md ✅
├── QUICKSTART.md ✅
├── PHASE_1_README.md ✅
└── package.json (root)
```

---

## Getting Started

### 1. Create GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit: Lucky Lefty Phase 1 foundation"
git remote add origin https://github.com/yourusername/lucky-lefty.git
git push -u origin main
```

### 2. Set Up Local Development

```bash
# Clone repo (or open your local copy)
cd lucky-lefty

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

# Create .env file
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start Services

```bash
# Terminal 1: Database & Cache
docker-compose up -d

# Terminal 2: Backend
cd backend
npm run migrate  # Run database migrations first
npm run dev      # Starts on http://localhost:5000

# Terminal 3: Frontend
cd frontend
npm run dev      # Starts on http://localhost:3000
```

### 4. Verify Everything Works

```bash
# Backend health check
curl http://localhost:5000/health

# Should return: { "status": "ok" }
```

---

## Files You Have (Copy to Your Project)

All files are in your **outputs folder**. Copy them to your project structure:

**Backend Files:**
- `backend-index.js` → `backend/src/index.js`
- `backend-database-schema.sql` → `backend/db/schema.sql`
- `BaseAgent.js` → `backend/src/agents/BaseAgent.js`
- `MotherCodeAgent.js` → `backend/src/agents/MotherCodeAgent.js`
- `voiceController.js` → `backend/src/api/controllers/voiceController.js`
- `lucky-lefty-backend-package.json` → `backend/package.json`
- `docker-compose.yml` → `docker-compose.yml`
- `.env.example` → `.env.example`

**Frontend Files:**
- `electron-main.js` → `frontend/main.js`

---

## Still Need to Create (Next Steps)

**This Week:**

1. **Backend Routes** (`backend/src/api/routes/`)
   - voiceRoutes.js (POST /api/voice/command)
   - taskRoutes.js (GET/POST /api/tasks)

2. **Configuration Files** (`backend/src/config/`)
   - database.js (PostgreSQL connection)
   - redis.js (Redis connection)

3. **Error Handler** (`backend/src/api/middleware/`)
   - errorHandler.js (Express middleware)

4. **Frontend Setup** (`frontend/`)
   - package.json with React, Tailwind, Electron deps
   - vite.config.js
   - tailwind.config.js
   - src/App.jsx
   - src/main.jsx
   - src/components/VoiceIndicator.jsx
   - src/services/api.js
   - preload.js (security)

---

## Phase 1 Deliverables (End of Week 2)

✅ Express backend running  
✅ PostgreSQL database with schema  
✅ Redis cache running  
✅ Voice endpoint (`POST /api/voice/command`) functional  
✅ Agent system working (BaseAgent + MotherCode)  
✅ Electron app launching with system tray  
✅ Voice listening indicator UI  
✅ Health check endpoints working  
✅ All services dockerized  
✅ Development environment fully functional  

**Target**: You should be able to send a voice command via the API and have it routed to an agent.

---

## Development Workflow

### Daily Development

```bash
# Start services (if not running)
docker-compose up -d

# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Testing
npm run test:watch
```

### Common Commands

```bash
# Database
docker-compose exec postgres psql -U lefty_user -d lucky_lefty
docker-compose logs postgres
docker-compose down -v  # Reset all data

# Backend
npm run migrate         # Apply migrations
npm run seed           # Seed test data
npm run test           # Run tests

# Frontend
npm run build          # Build for production
npm run package        # Package Electron app
```

### Debugging

```bash
# Backend logs
tail -f backend/logs/app.log

# Database connection
psql postgresql://lefty_user:lefty_password@localhost:5432/lucky_lefty

# Redis
redis-cli
> KEYS *
> GET <key>
```

---

## Architecture Overview

### Voice Processing Pipeline

```
User speaks
    ↓
Electron app captures audio
    ↓
POST /api/voice/command { transcript }
    ↓
VoiceController.processVoiceCommand()
    ↓
parseIntent(transcript)
    ↓
MotherCode.process(command)
    ↓
MotherCode.routeIntent() → determine which agents
    ↓
Execute agent(s) in parallel
    ↓
Aggregate results
    ↓
Return voice response
    ↓
Frontend plays audio response
```

### Agent Communication

```
Specialized Agents (Calendar, Email, Social Media, etc.)
    ↑
    | (via Redis message queue)
    ↓
MotherCode Agent (Master Orchestrator)
    ↑
    | (from Electron app)
    ↓
Express API Layer
    ↑
    ↓
Frontend/Electron App
```

---

## Testing Checklist (Week 2)

- [ ] Can start all services without errors
- [ ] Database migrations run successfully
- [ ] Backend responds to `/health` endpoint
- [ ] Electron app launches with tray icon
- [ ] Voice indicator animates when "listening"
- [ ] Can send test command to `/api/voice/command`
- [ ] Command gets logged to database
- [ ] Response comes back as JSON
- [ ] Redis cache is working
- [ ] No errors in console logs

---

## Key Files Explained

### BaseAgent.js
Abstract class that all agents extend. Handles:
- Command processing
- Error recovery
- Caching (Redis)
- Event emission

### MotherCodeAgent.js
Master coordinator that:
- Routes intents to appropriate agents
- Executes agents in parallel
- Aggregates results
- Generates voice response

### voiceController.js
HTTP endpoint that:
- Receives voice transcript
- Parses intent
- Calls MotherCode
- Returns response
- Logs to database

### electron-main.js
Electron main process that:
- Creates app window
- Manages system tray
- Handles IPC communication
- Bridges frontend ↔ backend

---

## Troubleshooting

**"Port 5000 already in use"**
```bash
lsof -i :5000
kill -9 <PID>
# Or use different port: PORT=5001 npm run dev
```

**"Cannot connect to PostgreSQL"**
```bash
docker-compose ps
docker-compose logs postgres
docker-compose down && docker-compose up -d
```

**"Node modules not found"**
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

**"Electron won't start"**
```bash
# Make sure Vite dev server is running
cd frontend
npm install electron-is-dev  # Add if missing
npm run dev
```

---

## Next Phase Preview (Week 3-4)

Once Phase 1 is solid, implement:
- Calendar Agent (Google Calendar OAuth)
- Email Agent (Gmail API)
- Social Media Agent (TT_Scrapper integration)
- Full intent parsing with Claude API
- Multi-step workflows

---

## Questions?

- Check QUICKSTART.md for immediate setup help
- Read IMPLEMENTATION_PLAN.md for detailed timeline
- Review PRD_Comprehensive.md (in vault) for feature specs
- Check decisions.md (in vault) for architecture rationale

---

**You're ready to build!** 🚀

Next step: Copy files from outputs folder to your project, run `docker-compose up -d`, and start the dev servers.
