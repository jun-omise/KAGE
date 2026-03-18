import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db/init.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import taskRoutes from './routes/tasks.js';
import toolRoutes from './routes/tools.js';
import securityRoutes from './routes/security.js';
import approvalRoutes from './routes/approval.js';
import memoryRoutes from './routes/memory.js';
import modelRoutes from './routes/models.js';
import fileRoutes from './routes/files.js';
import suggestionRoutes from './routes/suggestions.js';
import notificationRoutes from './routes/notifications.js';
import webhookRoutes from './routes/webhooks.js';
import messagingConfigRoutes from './routes/messaging-config.js';
import taskQueueRoutes from './routes/task-queue.js';
import agentRoutes from './routes/agents.js';
import dbRoutes from './routes/db.js';
import scheduler from './core/scheduler.js';
import skillLoader from './mcp/skill-loader.js';
import { errorHandler } from './middleware/error-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
getDb();

// Initialize cron scheduler (loads active cron tasks from DB)
scheduler.init();

// Initialize skill loader (scans SKILL.md files)
skillLoader.init();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/approval', approvalRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/messaging', messagingConfigRoutes);
app.use('/api/queue', taskQueueRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/db', dbRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0', uptime: process.uptime() });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// Production mode: serve client build
if (process.env.NODE_ENV === 'production' || process.env.ELECTRON) {
  const clientDist = join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(clientDist, 'index.html'));
    }
  });
}

const server = app.listen(PORT, () => {
  console.log(`KAGE server running on http://localhost:${PORT}`);
});

// Export for Electron
export { app, server };
export default app;

process.on('SIGINT', () => {
  scheduler.cancelAll();
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  scheduler.cancelAll();
  closeDb();
  process.exit(0);
});
