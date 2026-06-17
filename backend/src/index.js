// backend/src/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import voiceRoutes from './api/routes/voiceRoutes.js';
import taskRoutes from './api/routes/taskRoutes.js';
import integrationRoutes from './api/routes/integrationRoutes.js';
import { errorHandler } from './api/middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Start server
app.listen(PORT, () => {
  console.log(`🎙️ Lucky Lefty backend running on http://localhost:${PORT}`);
  console.log(`   Voice endpoint: POST http://localhost:${PORT}/api/voice/command`);
  console.log(`   Health check: GET http://localhost:${PORT}/health`);
});

export default app;
