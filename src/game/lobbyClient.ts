import type { User } from 'firebase/auth';
import {
  fetchPublicCloudLobbies,
  leaveCloudLobby,
  updateCloudLobbyStatus,
  upsertCloudLobby,
  upsertCloudLobbyMember,
} from './firebase';
import type {
  CarId,
  LobbyMode,
  LobbyState,
  MapId,
  RemotePlayerSnapshot,
  TeamId,
  WeatherPreset,
} from './types';

export interface PublicLobbySummary {
  code: string;
  mode: LobbyMode;
  mapId: MapId;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  source: 'live' | 'cloud';
}

export class LobbySocketClient {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private onLobbyState?: (lobby: LobbyState | null) => void;
  private onMatchStarted?: (lobby: LobbyState) => void;
  private onSnapshots?: (snapshots: RemotePlayerSnapshot[]) => void;
  private onError?: (msg: string) => void;
  private onConnected?: (clientId: string) => void;
  private pendingQueue: string[] = [];

  constructor(handlers: {
    onConnected?: (clientId: string) => void;
    onLobbyState?: (lobby: LobbyState | null) => void;
    onMatchStarted?: (lobby: LobbyState) => void;
    onSnapshots?: (snapshots: RemotePlayerSnapshot[]) => void;
    onError?: (msg: string) => void;
  }) {
    this.onConnected = handlers.onConnected;
    this.onLobbyState = handlers.onLobbyState;
    this.onMatchStarted = handlers.onMatchStarted;
    this.onSnapshots = handlers.onSnapshots;
    this.onError = handlers.onError;
  }

  public getClientId(): string | null {
    return this.clientId;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      while (this.pendingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = this.pendingQueue.shift()!;
        ws.send(msg);
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as Record<string, unknown>;
        if (msg.type === 'welcome') {
          this.clientId = String(msg.clientId);
          this.onConnected?.(this.clientId);
        } else if (msg.type === 'lobby_state') {
          const lobby = (msg.lobby as LobbyState) ?? null;
          this.onLobbyState?.(lobby);
        } else if (msg.type === 'match_started') {
          const lobby = msg.lobby as LobbyState;
          this.onMatchStarted?.(lobby);
        } else if (msg.type === 'room_snapshots') {
          const snaps = (msg.snapshots as RemotePlayerSnapshot[]) ?? [];
          this.onSnapshots?.(snaps);
        } else if (msg.type === 'lobby_error') {
          this.onError?.(String(msg.message ?? 'Lobby error'));
        }
      } catch {
        // Ignore bad frames
      }
    };

    ws.onclose = () => {
      this.ws = null;
    };
  }

  private send(payload: unknown): void {
    this.connect();
    const encoded = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encoded);
    } else {
      this.pendingQueue.push(encoded);
    }
  }

  public createLobby(params: {
    name: string;
    user: User | null;
    carId: CarId;
    mode: LobbyMode;
    mapId: MapId;
    weatherPreset: WeatherPreset;
    fillWithBots: boolean;
    preferredCode?: string;
  }): void {
    this.send({
      type: 'create_lobby',
      name: params.name,
      uid: params.user?.uid ?? null,
      carId: params.carId,
      mode: params.mode,
      mapId: params.mapId,
      weatherPreset: params.weatherPreset,
      fillWithBots: params.fillWithBots,
      preferredCode: params.preferredCode,
    });
  }

  public async syncCreatedCloudLobby(
    lobby: LobbyState,
    user: User | null,
  ): Promise<void> {
    if (!user) return;
    try {
      await upsertCloudLobby({
        code: lobby.code,
        user,
        mode: lobby.mode,
        mapId: lobby.mapId,
        weatherPreset: lobby.weatherPreset,
        maxPlayers: lobby.maxPlayers,
      });
    } catch {
      // Cloud mirror failed gracefully; live WebSocket lobby remains active
    }
  }

  public joinLobby(params: {
    code: string;
    name: string;
    user: User | null;
    carId: CarId;
  }): void {
    const cleanCode = params.code.trim().toUpperCase();
    this.send({
      type: 'join_lobby',
      code: cleanCode,
      name: params.name,
      uid: params.user?.uid ?? null,
      carId: params.carId,
    });
  }

  public async syncJoinedCloudLobby(
    lobby: LobbyState,
    user: User | null,
    carId: CarId,
    team: TeamId,
  ): Promise<void> {
    if (!user) return;
    try {
      await upsertCloudLobbyMember({
        code: lobby.code,
        user,
        carId,
        team,
        ready: true,
      });
    } catch {
      // Non-fatal fallback
    }
  }

  public updateMember(
    code: string,
    patch: { team?: TeamId; carId?: CarId; ready?: boolean; name?: string },
  ): void {
    this.send({ type: 'update_member', code, ...patch });
  }

  public updateLobby(
    code: string,
    patch: { mapId?: MapId; weatherPreset?: WeatherPreset; mode?: LobbyMode; fillWithBots?: boolean },
  ): void {
    this.send({ type: 'update_lobby', code, ...patch });
  }

  public startMatch(code: string, user: User | null): void {
    this.send({ type: 'start_match', code });
    if (user) {
      void updateCloudLobbyStatus(code, 'racing').catch(() => undefined);
    }
  }

  public sendSnapshot(code: string, snapshot: RemotePlayerSnapshot): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'state_update', code, snapshot }));
  }

  public finishRace(code: string, winnerLabel: string, user: User | null): void {
    this.send({ type: 'finish_race', code, winnerLabel });
    if (user) {
      void updateCloudLobbyStatus(code, 'finished', winnerLabel).catch(() => undefined);
    }
  }

  public leaveLobby(code: string | null, user: User | null): void {
    this.send({ type: 'leave_lobby' });
    this.onLobbyState?.(null);
    if (code && user) {
      void leaveCloudLobby(code).catch(() => undefined);
    }
  }

  public disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export async function fetchAvailableLobbies(user: User | null): Promise<PublicLobbySummary[]> {
  const out: PublicLobbySummary[] = [];
  const seen = new Set<string>();
  try {
    const res = await fetch('/api/lobbies');
    if (res.ok) {
      const json = (await res.json()) as {
        lobbies?: Array<{
          code: string;
          mode: LobbyMode;
          mapId: MapId;
          playerCount: number;
          maxPlayers: number;
          hostName: string;
        }>;
      };
      for (const l of json.lobbies ?? []) {
        seen.add(l.code);
        out.push({ ...l, source: 'live' });
      }
    }
  } catch {
    // Ignore transient network errors
  }

  if (user) {
    try {
      const cloudList = await fetchPublicCloudLobbies();
      for (const c of cloudList) {
        if (seen.has(c.code)) continue;
        out.push({
          code: c.code,
          mode: c.mode,
          mapId: c.mapId,
          playerCount: 1,
          maxPlayers: c.maxPlayers,
          hostName: c.hostName,
          source: 'cloud',
        });
      }
    } catch {
      // Ignore unauthenticated or quota issues
    }
  }
  return out;
}
