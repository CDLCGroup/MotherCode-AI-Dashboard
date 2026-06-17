// backend/src/realtime/wsHub.js
//
// Minimal WebSocket fan-out hub. Attaches a ws.Server to the shared HTTP server
// and broadcasts JSON messages to every connected client.
//
// The frontend (src/components/VoiceCallLog.tsx and the new OrchestrationDashboard)
// opens `ws://<host>:<port>` and listens for `{ type: 'voice_call', data }`.

import { WebSocketServer } from 'ws';

let wss = null;

/** Attach the WS server to an existing http.Server. Call once at startup. */
export function attachWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (socket) => {
    console.log(`[ws] client connected (${wss.clients.size} total)`);
    // Greet so the client knows the channel is live.
    safeSend(socket, { type: 'connected', data: { ts: new Date().toISOString() } });

    socket.on('close', () => {
      console.log(`[ws] client disconnected (${wss.clients.size} total)`);
    });
    socket.on('error', (err) => console.error('[ws] socket error:', err.message));
  });

  console.log('[ws] WebSocket hub attached');
  return wss;
}

function safeSend(socket, obj) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

/** Broadcast a message to all connected clients. No-op if the hub isn't up. */
export function broadcast(type, data) {
  if (!wss) return;
  const payload = JSON.stringify({ type, data });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

export function clientCount() {
  return wss ? wss.clients.size : 0;
}

export default { attachWebSocket, broadcast, clientCount };
