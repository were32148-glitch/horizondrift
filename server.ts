import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  CarId,
  LobbyMember,
  LobbyMode,
  LobbyState,
  MapId,
  RemotePlayerSnapshot,
  TeamId,
  WeatherPreset,
} from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface RoomEntry {
  lobby: LobbyState;
  sockets: Map<string, WebSocket>;
  snapshots: Map<string, RemotePlayerSnapshot>;
}

const rooms = new Map<string, RoomEntry>();

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateJoinCode() : code;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: RoomEntry, payload: unknown, exceptClientId?: string) {
  const encoded = JSON.stringify(payload);
  for (const [cid, sock] of room.sockets.entries()) {
    if (cid !== exceptClientId && sock.readyState === WebSocket.OPEN) {
      sock.send(encoded);
    }
  }
}

function pickAutoTeam(lobby: LobbyState): TeamId {
  if (lobby.mode === 'online_ffa') return 'ffa';
  let red = 0;
  let blue = 0;
  for (const m of lobby.members) {
    if (m.team === 'red') red++;
    else if (m.team === 'blue') blue++;
  }
  return red <= blue ? 'red' : 'blue';
}

function sanitizeName(name: unknown): string {
  const s = typeof name === 'string' ? name.trim().slice(0, 24) : '';
  return s.length > 0 ? s : 'Driver';
}

function sanitizeCarId(car: unknown): CarId {
  return ['apex', 'baja', 'viper', 'phantom', 'titan'].includes(String(car))
    ? (car as CarId)
    : 'apex';
}

function sanitizeMapId(mapId: unknown): MapId {
  return ['valley', 'canyon', 'alpine', 'coast'].includes(String(mapId))
    ? (mapId as MapId)
    : 'valley';
}

function sanitizeWeather(w: unknown): WeatherPreset {
  return ['clear', 'overcast', 'rain', 'blizzard', 'night', 'auto'].includes(String(w))
    ? (w as WeatherPreset)
    : 'clear';
}

function removeClientFromRooms(clientId: string) {
  for (const [code, room] of rooms.entries()) {
    if (!room.sockets.has(clientId)) continue;
    room.sockets.delete(clientId);
    room.snapshots.delete(clientId);
    room.lobby.members = room.lobby.members.filter((m) => m.clientId !== clientId);

    if (room.lobby.members.length === 0) {
      rooms.delete(code);
    } else {
      if (room.lobby.hostClientId === clientId) {
        room.lobby.hostClientId = room.lobby.members[0].clientId;
        room.lobby.members[0].isHost = true;
      }
      broadcastRoom(room, { type: 'lobby_state', lobby: room.lobby });
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/lobbies', (_req, res) => {
    const publicList = Array.from(rooms.values())
      .filter((r) => r.lobby.status === 'waiting')
      .map((r) => ({
        code: r.lobby.code,
        mode: r.lobby.mode,
        mapId: r.lobby.mapId,
        playerCount: r.lobby.members.length,
        maxPlayers: r.lobby.maxPlayers,
        hostName: r.lobby.members[0]?.name ?? 'Host',
      }));
    res.json({ lobbies: publicList });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  let nextClientSeq = 1;

  wss.on('connection', (ws) => {
    const clientId = `c-${Date.now().toString(36)}-${nextClientSeq++}`;
    sendJson(ws, { type: 'welcome', clientId });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as Record<string, unknown>;
        const msgType = String(msg.type || '');

        if (msgType === 'create_lobby') {
          removeClientFromRooms(clientId);
          const mode: LobbyMode = msg.mode === 'online_ffa' ? 'online_ffa' : 'online_2v2';
          const code =
            typeof msg.preferredCode === 'string' && /^[A-Z0-9]{6}$/.test(msg.preferredCode) && !rooms.has(msg.preferredCode)
              ? msg.preferredCode
              : generateJoinCode();
          const member: LobbyMember = {
            clientId,
            uid: typeof msg.uid === 'string' ? msg.uid : null,
            name: sanitizeName(msg.name),
            carId: sanitizeCarId(msg.carId),
            team: mode === 'online_2v2' ? 'red' : 'ffa',
            ready: true,
            isHost: true,
          };
          const lobby: LobbyState = {
            code,
            mode,
            mapId: sanitizeMapId(msg.mapId),
            weatherPreset: sanitizeWeather(msg.weatherPreset),
            status: 'waiting',
            hostClientId: clientId,
            maxPlayers: mode === 'online_2v2' ? 4 : 8,
            fillWithBots: msg.fillWithBots !== false,
            winnerLabel: null,
            members: [member],
          };
          const room: RoomEntry = {
            lobby,
            sockets: new Map([[clientId, ws]]),
            snapshots: new Map(),
          };
          rooms.set(code, room);
          sendJson(ws, { type: 'lobby_state', lobby });
        } else if (msgType === 'join_lobby') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            sendJson(ws, { type: 'lobby_error', message: `Lobby code "${code}" not found.` });
            return;
          }
          if (room.lobby.members.length >= room.lobby.maxPlayers) {
            sendJson(ws, { type: 'lobby_error', message: `Lobby "${code}" is full.` });
            return;
          }
          removeClientFromRooms(clientId);
          const member: LobbyMember = {
            clientId,
            uid: typeof msg.uid === 'string' ? msg.uid : null,
            name: sanitizeName(msg.name),
            carId: sanitizeCarId(msg.carId),
            team: pickAutoTeam(room.lobby),
            ready: true,
            isHost: false,
          };
          room.lobby.members.push(member);
          room.sockets.set(clientId, ws);
          broadcastRoom(room, { type: 'lobby_state', lobby: room.lobby });
        } else if (msgType === 'update_member') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) return;
          const m = room.lobby.members.find((x) => x.clientId === clientId);
          if (!m) return;
          if (msg.team === 'red' || msg.team === 'blue' || msg.team === 'ffa') {
            m.team = msg.team;
          }
          if (msg.carId) m.carId = sanitizeCarId(msg.carId);
          if (typeof msg.ready === 'boolean') m.ready = msg.ready;
          if (msg.name) m.name = sanitizeName(msg.name);
          broadcastRoom(room, { type: 'lobby_state', lobby: room.lobby });
        } else if (msgType === 'update_lobby') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room || room.lobby.hostClientId !== clientId) return;
          if (msg.mapId) room.lobby.mapId = sanitizeMapId(msg.mapId);
          if (msg.weatherPreset) room.lobby.weatherPreset = sanitizeWeather(msg.weatherPreset);
          if (msg.mode === 'online_2v2' || msg.mode === 'online_ffa') {
            room.lobby.mode = msg.mode;
            room.lobby.maxPlayers = msg.mode === 'online_2v2' ? 4 : 8;
            room.lobby.members.forEach((m, idx) => {
              m.team = msg.mode === 'online_ffa' ? 'ffa' : idx % 2 === 0 ? 'red' : 'blue';
            });
          }
          if (typeof msg.fillWithBots === 'boolean') {
            room.lobby.fillWithBots = msg.fillWithBots;
          }
          broadcastRoom(room, { type: 'lobby_state', lobby: room.lobby });
        } else if (msgType === 'start_match') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room || room.lobby.hostClientId !== clientId) return;
          room.lobby.status = 'racing';
          room.snapshots.clear();
          broadcastRoom(room, { type: 'match_started', lobby: room.lobby });
        } else if (msgType === 'state_update') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) return;
          const snap = msg.snapshot as RemotePlayerSnapshot | undefined;
          if (!snap) return;
          snap.clientId = clientId;
          room.snapshots.set(clientId, snap);
          broadcastRoom(
            room,
            { type: 'room_snapshots', snapshots: Array.from(room.snapshots.values()) },
            clientId,
          );
        } else if (msgType === 'finish_race') {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) return;
          if (room.lobby.status === 'racing') {
            room.lobby.status = 'finished';
            room.lobby.winnerLabel =
              typeof msg.winnerLabel === 'string' ? msg.winnerLabel.slice(0, 48) : null;
            broadcastRoom(room, { type: 'lobby_state', lobby: room.lobby });
          }
        } else if (msgType === 'leave_lobby') {
          removeClientFromRooms(clientId);
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      removeClientFromRooms(clientId);
    });
  });

  if (IS_PROD) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Horizon Drift server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
