import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleChatRequest } from './src/server/chatHandler';
import { handleWeatherRequest } from './src/server/weatherHandler';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Live Weather Endpoint
app.all(['/api/weather', '/api/weather/'], (req, res) => handleWeatherRequest(req, res));

// Gemini AI Chat / Planner Endpoint
app.all(['/api/chat', '/api/chat/'], (req, res) => handleChatRequest(req, res));

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WanderWise AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
