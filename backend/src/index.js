// backend/src/index.js
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import voiceRoutes from './api/routes/voiceRoutes.js';
import taskRoutes from './api/routes/taskRoutes.js';
import integrationRoutes from './api/routes/integrationRoutes.js';
import authRoutes from './api/routes/authRoutes.js';
import slackRoutes from './api/routes/slackRoutes.js';
import bufferRoutes from './api/routes/bufferRoutes.js';
import syncRoutes from './api/routes/syncRoutes.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { attachWebSocket } from './realtime/wsHub.js';

dotenv.config();

const app = express();
// Phase 2: default to 3001 to match the frontend's VITE_API_URL / VITE_WS_URL.
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/voice', voiceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/integrations', integrationRoutes);
// Social-media phase: Slack (outbound subagent-chat) + Buffer (scheduling) +
// the Google-Sheets sync stub. All keyless-first — they no-op / return the
// "not connected" contract shape until SLACK_BOT_TOKEN / BUFFER_API_KEY are set.
app.use('/api/slack', slackRoutes);
app.use('/api/buffer', bufferRoutes);
app.use('/api/sync', syncRoutes);
// Google OAuth consent flow (Calendar + Gmail agents). Redirect URI is served
// here on PORT and must match GOOGLE_REDIRECT_URI / the Google Cloud Console.
app.use('/auth/google', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server (HTTP + WebSocket share one port so the frontend can use ws://host:PORT)
const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`🎙️  MotherCode backend running on http://localhost:${PORT}`);
  console.log(`   Voice command:  POST http://localhost:${PORT}/api/voice/command`);
  console.log(`   Conversations:  GET  http://localhost:${PORT}/api/voice/conversations`);
  console.log(`   Metrics:        GET  http://localhost:${PORT}/api/voice/metrics`);
  console.log(`   Agent status:   GET  http://localhost:${PORT}/api/voice/agent/status`);
  console.log(`   WebSocket:      ws://localhost:${PORT}`);
  console.log(`   Health check:   GET  http://localhost:${PORT}/health`);
});

export default app;
