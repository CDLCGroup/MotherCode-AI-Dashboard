# Lucky Lefty — Quick Start Guide

Get Lucky Lefty running locally in 5 minutes.

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **Docker** & **Docker Compose** ([download](https://www.docker.com/products/docker-desktop))
- **Git** ([download](https://git-scm.com))

## Setup (First Time Only)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/lucky-lefty.git
cd lucky-lefty
```

### 2. Create Environment File
```bash
cp .env.example .env
# Edit .env with your API keys:
# - OPENAI_API_KEY (for Whisper or Claude)
# - CLAUDE_API_KEY (for intent parsing)
# - ELEVENLABS_API_KEY (for voice)
# - Google OAuth credentials (optional)
# - Stripe API key (optional)
```

### 3. Install Dependencies
```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 4. Start Services
```bash
# Terminal 1: Start databases
docker-compose up -d

# Wait 10 seconds for services to be healthy
sleep 10

# Terminal 2: Start backend
cd backend
npm run migrate  # Run database migrations
npm run dev      # Starts on http://localhost:5000

# Terminal 3: Start frontend
cd frontend
npm run dev      # Starts on http://localhost:3000 (Electron app)
```

## Verify It's Working

1. **Backend Health Check**
   ```bash
   curl http://localhost:5000/health
   # Expected: { "status": "ok" }
   ```

2. **Electron App**
   - Should open automatically with voice listening indicator
   - Pulsing blue circle = listening

3. **Database**
   - pgAdmin: http://localhost:5050 (admin / admin)
   - Redis Commander: http://localhost:8081

## Development Workflow

### Daily Development
```bash
# Terminal 1
docker-compose up -d  # Start services (if not running)

# Terminal 2
cd backend && npm run dev

# Terminal 3
cd frontend && npm run dev
```

### Running Tests
```bash
cd backend
npm run test              # Unit tests
npm run test:watch       # Watch mode

cd ../frontend
npm run test
```

### Making Changes
1. Edit files in `backend/src/` or `frontend/src/`
2. Backend auto-reloads (nodemon)
3. Frontend auto-reloads (Electron dev mode)
4. Test your changes: `npm run test`
5. Commit with meaningful messages

## Quick Commands Reference

```bash
# Backend
npm run dev           # Start with hot reload
npm run test          # Run tests
npm run migrate       # Run database migrations
npm run seed          # Seed test data
npm run lint          # Fix linting issues

# Frontend
npm run dev           # Start Electron app
npm run test          # Run tests
npm run build         # Build for distribution

# Database
docker-compose logs postgres    # See DB logs
docker-compose logs redis       # See Redis logs
docker-compose down             # Stop all services
docker-compose down -v          # Stop & delete data
```

## Troubleshooting

### "Port 5000 already in use"
```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

### "PostgreSQL connection refused"
```bash
# Make sure containers are running
docker-compose ps

# If not running, start them
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### "Cannot find module 'express'"
```bash
cd backend
npm install
npm run dev
```

### "Whisper/Claude API errors"
1. Check your `.env` file has valid API keys
2. Verify keys have the right permissions in dashboard
3. Check API status pages (OpenAI, Anthropic, ElevenLabs)

### "Voice not working in Electron"
1. Check microphone permissions (Settings → Privacy → Microphone)
2. Verify microphone is connected
3. Check browser console for errors (F12 in Electron)
4. Try different microphone: `MICROPHONE_INDEX=1 npm run dev`

## Project Structure

```
lucky-lefty/
├── backend/              # Node.js/Express server
│   ├── src/
│   │   ├── agents/       # Agent implementations
│   │   ├── api/          # Routes, controllers, middleware
│   │   ├── services/     # Business logic
│   │   └── config/       # Configuration
│   ├── db/               # Database migrations & seeds
│   └── package.json
├── frontend/             # Electron + React app
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page views
│   │   └── App.jsx
│   ├── main.js           # Electron main process
│   └── package.json
├── docker-compose.yml    # Services (PostgreSQL, Redis)
├── .env                  # Your configuration
├── package.json          # Root workspace config
└── README.md
```

## First Development Task

To get familiar with the codebase:

1. **Add a simple endpoint**
   - Edit: `backend/src/api/routes/taskRoutes.js`
   - Add: `GET /tasks/hello` that returns `{ message: "Hello, World!" }`
   - Test: `curl http://localhost:5000/api/tasks/hello`

2. **Add a React component**
   - Create: `frontend/src/components/HelloWidget.jsx`
   - Add: A simple button that says "Hello from React"
   - Import in: `frontend/src/App.jsx` and display it

3. **Connect them together**
   - Make HelloWidget button call your backend endpoint
   - Display the response

This will get you comfortable with the backend → frontend flow.

## Next Steps

- Read [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full development roadmap
- Check [backend/README.md](backend/README.md) for backend-specific docs
- Check [frontend/README.md](frontend/README.md) for frontend-specific docs
- Join the team Slack channel for questions

## Need Help?

- Check the [docs/](docs/) folder
- Read through existing code with good comments
- Ask in Slack before getting stuck for >15 minutes
- Look at test files for usage examples

---

**Happy coding! 🎙️**
