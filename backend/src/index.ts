import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database/db';
import { apiRouter } from './controllers/apiRoutes';
import { TelemetryServer } from './websocket/telemetryServer';
import { TimingWheelService } from './services/TimingWheelService';
import { StaleWorkerReaper } from './workers/StaleWorkerReaper';
import { WorkerDaemon } from './workers/WorkerDaemon';
import { MetricsService } from './services/MetricsService';
import { runSeed } from './seed/seedRunner';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 1. Initialize SQLite Database & Auto-Seed if empty
initDatabase();
runSeed();

// 2. Mount API Routes
app.use('/api/v1', apiRouter);

// 3. Mount Prometheus Metrics Endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(MetricsService.generatePrometheusMetrics());
});

// 4. Mount Health Check Endpoint
app.get('/health', (req, res) => {
  res.json(MetricsService.getSystemHealth());
});

// 5. Serve React Dashboard Static Bundle & SPA Fallback
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/metrics') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('🚀 ApexQueue Backend Engine Running! Access REST API at /api/v1');
  });
}

// 6. Initialize WebSocket Telemetry Server
TelemetryServer.init(server);

// 7. Start Background Infrastructure Services
TimingWheelService.start();
StaleWorkerReaper.start();

// 8. Spawn Worker Daemons
const worker1 = new WorkerDaemon(5);
const worker2 = new WorkerDaemon(5);
worker1.start();
worker2.start();

server.listen(PORT, () => {
  console.log(`
  🚀 ApexQueue Enterprise Distributed Scheduler Engine
  ======================================================
  📡 REST API & Gateway: http://localhost:${PORT}/api/v1
  📊 Prometheus Metrics: http://localhost:${PORT}/metrics
  ⚡ WebSocket Telemetry: ws://localhost:${PORT}/ws/telemetry
  ======================================================
  `);
});

// Graceful Shutdown Handler
function shutdown() {
  console.log('🛑 Shutting down ApexQueue node gracefully...');
  worker1.stop();
  worker2.stop();
  TimingWheelService.stop();
  StaleWorkerReaper.stop();
  TelemetryServer.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
