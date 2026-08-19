import { Server as WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { MetricsService } from '../services/MetricsService';

export class TelemetryServer {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<WebSocket> = new Set();
  private static heartbeatInterval: NodeJS.Timeout | null = null;

  static init(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws/telemetry' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial metrics snapshot
      const health = MetricsService.getSystemHealth();
      ws.send(JSON.stringify({ type: 'METRICS_SNAPSHOT', data: health }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // Broadcast system metrics pulse every 2 seconds
    this.heartbeatInterval = setInterval(() => {
      this.broadcastMetricsPulse();
    }, 2000);
  }

  static broadcastJobStateChange(jobId: string, status: string, workerId?: string) {
    this.broadcast({
      type: 'JOB_STATE_CHANGE',
      data: { jobId, status, workerId, timestamp: new Date().toISOString() }
    });
  }

  static broadcastLog(jobId: string, message: string, level: string = 'INFO') {
    this.broadcast({
      type: 'JOB_LOG_STREAM',
      data: { jobId, message, level, timestamp: new Date().toISOString() }
    });
  }

  static broadcastMetricsPulse() {
    if (this.clients.size === 0) return;
    const health = MetricsService.getSystemHealth();
    this.broadcast({ type: 'METRICS_PULSE', data: health });
  }

  private static broadcast(event: { type: string; data: any }) {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  static close() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.wss) this.wss.close();
  }
}
