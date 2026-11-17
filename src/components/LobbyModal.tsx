import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Cloud,
  Copy,
  Globe,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { getCarSpec } from '../game/cars';
import { signInWithGoogle, signOutGoogle } from '../game/firebase';
import { fetchAvailableLobbies, type PublicLobbySummary } from '../game/lobbyClient';
import { MAP_LIST } from '../game/maps';
import type { CarId, LobbyMode, LobbyState, MapId, TeamId, WeatherPreset } from '../game/types';

interface LobbyModalProps {
  user: User | null;
  clientId: string | null;
  activeLobby: LobbyState | null;
  lobbyError: string | null;
  equippedCar: CarId;
  defaultMapId: MapId;
  onClose: () => void;
  onCreateLobby: (opts: {
    name: string;
    mode: LobbyMode;
    mapId: MapId;
    weatherPreset: WeatherPreset;
    fillWithBots: boolean;
  }) => void;
  onJoinLobby: (code: string, name: string) => void;
  onUpdateMember: (patch: { team?: TeamId; ready?: boolean; name?: string }) => void;
  onUpdateLobby: (patch: {
    mapId?: MapId;
    weatherPreset?: WeatherPreset;
    mode?: LobbyMode;
    fillWithBots?: boolean;
  }) => void;
  onStartMatch: () => void;
  onLeaveLobby: () => void;
}

export function LobbyModal({
  user,
  clientId,
  activeLobby,
  lobbyError,
  equippedCar,
  defaultMapId,
  onClose,
  onCreateLobby,
  onJoinLobby,
  onUpdateMember,
  onUpdateLobby,
  onStartMatch,
  onLeaveLobby,
}: LobbyModalProps) {
  const [driverName, setDriverName] = useState<string>(
    () => user?.displayName?.split(' ')[0] || 'Racer',
  );
  const [selectedMode, setSelectedMode] = useState<LobbyMode>('online_2v2');
  const [selectedMap, setSelectedMap] = useState<MapId>(defaultMapId);
  const [fillWithBots, setFillWithBots] = useState(true);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [publicLobbies, setPublicLobbies] = useState<PublicLobbySummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setDriverName(user.displayName.split(' ')[0].slice(0, 20));
    }
  }, [user]);

  const refreshLobbies = async () => {
    setLoadingList(true);
    try {
      const list = await fetchAvailableLobbies(user);
      setPublicLobbies(list);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!activeLobby) {
      void refreshLobbies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLobby, user]);

  const myMember = activeLobby?.members.find((m) => m.clientId === clientId) ?? null;
  const isHost = Boolean(activeLobby && clientId && activeLobby.hostClientId === clientId);

  const handleCopyCode = async () => {
    if (!activeLobby) return;
    try {
      await navigator.clipboard.writeText(activeLobby.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard fallback not needed
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Online Multiplayer Lobby"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border-2 border-sky-400/70 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black tracking-widest text-sky-400 uppercase">
              <Globe size={13} />
              Cloud & Live Server Multiplayer
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase">
              {activeLobby ? `Lobby Room · ${activeLobby.code}` : 'Online 2v2 & Free-For-All'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <Cloud size={13} />
                <span className="max-w-[140px] truncate font-bold">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void signOutGoogle()}
                  title="Sign out"
                  className="ml-1 cursor-pointer text-slate-400 hover:text-white"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="google-signin-btn"
                onClick={() => void signInWithGoogle()}
                className="flex cursor-pointer items-center gap-1.5 border border-sky-400/60 bg-sky-500/15 px-3 py-1.5 text-xs font-black tracking-wider text-sky-300 uppercase hover:bg-sky-500/25"
              >
                <LogIn size={13} />
                Sign In (Cloud Sync)
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close lobby modal"
              className="flex h-8 w-8 cursor-pointer items-center justify-center border border-slate-700 bg-slate-900 text-slate-300 hover:border-white hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {lobbyError && (
            <div className="mb-4 border border-rose-500/70 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200">
              {lobbyError}
            </div>
          )}

          {!activeLobby ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Create Lobby Column */}
              <div className="flex flex-col gap-4 border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-xs font-black tracking-widest text-amber-400 uppercase">
                  Create Private or Public Lobby
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Driver Callsign
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver"
                    className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <div className="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Online Match Format
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="lobby-mode-2v2"
                      onClick={() => setSelectedMode('online_2v2')}
                      className={`cursor-pointer border px-3 py-2 text-left text-xs font-black uppercase ${
                        selectedMode === 'online_2v2'
                          ? 'border-rose-400 bg-rose-500/20 text-white'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <div>2v2 Teams</div>
                      <div className="text-[10px] font-medium text-slate-400">Red vs Blue Squad</div>
                    </button>
                    <button
                      type="button"
                      data-testid="lobby-mode-ffa"
                      onClick={() => setSelectedMode('online_ffa')}
                      className={`cursor-pointer border px-3 py-2 text-left text-xs font-black uppercase ${
                        selectedMode === 'online_ffa'
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <div>Free-For-All</div>
                      <div className="text-[10px] font-medium text-slate-400">Up to 8 Racers</div>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    World & Circuit
                  </div>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value as MapId)}
                    className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400"
                  >
                    {MAP_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={fillWithBots}
                    onChange={(e) => setFillWithBots(e.target.checked)}
                    className="h-4 w-4 accent-amber-400"
                  />
                  <span>Fill empty grid slots with AI racers</span>
                </label>

                <button
                  type="button"
                  data-testid="create-lobby-btn"
                  onClick={() =>
                    onCreateLobby({
                      name: driverName.trim() || 'Driver',
                      mode: selectedMode,
                      mapId: selectedMap,
                      weatherPreset: 'clear',
                      fillWithBots,
                    })
                  }
                  className="mt-auto flex cursor-pointer items-center justify-center gap-2 border-2 border-amber-400 bg-amber-500 px-4 py-2.5 text-xs font-black tracking-wider text-slate-950 uppercase hover:bg-amber-400"
                >
                  <Shield size={15} />
                  Create Lobby & Generate Code
                </button>
              </div>

              {/* Join by Code + Open Lobbies Column */}
              <div className="flex flex-col gap-4 border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-xs font-black tracking-widest text-sky-400 uppercase">
                  Join Existing Lobby
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    data-testid="join-code-input"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-CHAR CODE"
                    className="flex-1 border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-black tracking-widest text-white uppercase outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    data-testid="join-lobby-btn"
                    disabled={joinCodeInput.trim().length < 4}
                    onClick={() => onJoinLobby(joinCodeInput, driverName.trim() || 'Driver')}
                    className="cursor-pointer border-2 border-sky-400 bg-sky-500 px-4 py-2 text-xs font-black tracking-wider text-slate-950 uppercase hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Join
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Active Open Lobbies
                  </span>
                  <button
                    type="button"
                    onClick={() => void refreshLobbies()}
                    className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-sky-400 uppercase hover:text-sky-300"
                  >
                    <RefreshCw size={11} className={loadingList ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>

                <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                  {publicLobbies.length === 0 ? (
                    <div className="border border-dashed border-slate-800 py-8 text-center text-xs text-slate-500">
                      No open lobbies right now. Create one to get a shareable code!
                    </div>
                  ) : (
                    publicLobbies.map((item) => (
                      <div
                        key={item.code}
                        className="flex items-center justify-between border border-slate-800 bg-slate-950 px-3 py-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black tracking-widest text-amber-300">
                              {item.code}
                            </span>
                            <span className="border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 uppercase">
                              {item.mode === 'online_2v2' ? '2v2' : 'FFA'}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            Host: {item.hostName} · {item.playerCount}/{item.maxPlayers} racers
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onJoinLobby(item.code, driverName.trim() || 'Driver')}
                          className="cursor-pointer border border-sky-400/70 bg-sky-500/15 px-3 py-1 text-[10px] font-black text-sky-300 uppercase hover:bg-sky-500/30"
                        >
                          Join
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-auto text-[11px] text-slate-400">
                  Equipped Ride: <span className="font-bold text-amber-300">{getCarSpec(equippedCar).name}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Lobby Room View */
            <div className="flex flex-col gap-5">
              {/* Join Code Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-amber-400/70 bg-slate-900 px-5 py-4">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Share This Join Code With Friends
                  </div>
                  <div
                    data-testid="active-lobby-code"
                    className="mt-0.5 font-mono text-3xl font-black tracking-[0.28em] text-amber-400"
                  >
                    {activeLobby.code}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="flex cursor-pointer items-center gap-1.5 border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-bold text-white uppercase hover:border-amber-400"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={onLeaveLobby}
                    className="cursor-pointer border border-rose-500/60 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300 uppercase hover:bg-rose-500/25"
                  >
                    Leave
                  </button>
                </div>
              </div>

              {/* Match Settings Strip */}
              <div className="grid gap-3 border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Mode
                  </div>
                  {isHost ? (
                    <select
                      value={activeLobby.mode}
                      onChange={(e) => onUpdateLobby({ mode: e.target.value as LobbyMode })}
                      className="mt-1 w-full border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      <option value="online_2v2">Online 2v2 Teams</option>
                      <option value="online_ffa">Online Free-For-All</option>
                    </select>
                  ) : (
                    <div className="mt-1 text-sm font-black text-white uppercase">
                      {activeLobby.mode === 'online_2v2' ? 'Online 2v2 Teams' : 'Online Free-For-All'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Circuit & World
                  </div>
                  {isHost ? (
                    <select
                      value={activeLobby.mapId}
                      onChange={(e) => onUpdateLobby({ mapId: e.target.value as MapId })}
                      className="mt-1 w-full border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      {MAP_LIST.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 text-sm font-black text-white uppercase">
                      {MAP_LIST.find((m) => m.id === activeLobby.mapId)?.name}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Grid Backfill
                  </div>
                  {isHost ? (
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-200">
                      <input
                        type="checkbox"
                        checked={activeLobby.fillWithBots}
                        onChange={(e) => onUpdateLobby({ fillWithBots: e.target.checked })}
                        className="h-4 w-4 accent-amber-400"
                      />
                      AI Bots Enabled
                    </label>
                  ) : (
                    <div className="mt-1 text-sm font-black text-slate-300">
                      {activeLobby.fillWithBots ? 'AI Bots Enabled' : 'Humans Only'}
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Racers Roster */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <span className="flex items-center gap-1.5">
                    <Users size={13} />
                    Lobby Roster ({activeLobby.members.length}/{activeLobby.maxPlayers})
                  </span>
                  {activeLobby.mode === 'online_2v2' && (
                    <span>Switch between Red & Blue squads below</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {activeLobby.members.map((m) => {
                    const isSelf = m.clientId === clientId;
                    const carName = getCarSpec(m.carId).name;
                    const teamColorClass =
                      activeLobby.mode === 'online_2v2'
                        ? m.team === 'red'
                          ? 'border-l-4 border-l-rose-500'
                          : 'border-l-4 border-l-sky-400'
                        : 'border-l-4 border-l-amber-400';

                    return (
                      <div
                        key={m.clientId}
                        className={`flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-slate-900 px-3 py-2.5 ${teamColorClass}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-black text-white">{m.name}</span>
                          {m.isHost && (
                            <span className="bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 uppercase">
                              HOST
                            </span>
                          )}
                          {isSelf && (
                            <span className="bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 uppercase">
                              YOU
                            </span>
                          )}
                          <span className="text-xs text-slate-400">· {carName}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeLobby.mode === 'online_2v2' && isSelf && (
                            <div className="flex border border-slate-700">
                              <button
                                type="button"
                                onClick={() => onUpdateMember({ team: 'red' })}
                                className={`cursor-pointer px-2.5 py-1 text-[10px] font-black uppercase ${
                                  m.team === 'red'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-slate-950 text-slate-400 hover:text-white'
                                }`}
                              >
                                Red
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateMember({ team: 'blue' })}
                                className={`cursor-pointer px-2.5 py-1 text-[10px] font-black uppercase ${
                                  m.team === 'blue'
                                    ? 'bg-sky-500 text-slate-950'
                                    : 'bg-slate-950 text-slate-400 hover:text-white'
                                }`}
                              >
                                Blue
                              </button>
                            </div>
                          )}

                          {activeLobby.mode === 'online_2v2' && !isSelf && (
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                                m.team === 'red'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-sky-500/20 text-sky-300'
                              }`}
                            >
                              {m.team} team
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                              m.ready
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.ready ? 'Ready' : 'Waiting'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start Action */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                {myMember && !isHost && (
                  <button
                    type="button"
                    onClick={() => onUpdateMember({ ready: !myMember.ready })}
                    className="cursor-pointer border border-emerald-400/70 bg-emerald-500/15 px-4 py-2 text-xs font-black text-emerald-300 uppercase hover:bg-emerald-500/25"
                  >
                    {myMember.ready ? 'Ready Checked' : 'Mark Ready'}
                  </button>
                )}

                {isHost ? (
                  <button
                    type="button"
                    data-testid="start-online-match-btn"
                    onClick={onStartMatch}
                    className="ml-auto flex cursor-pointer items-center gap-2 border-2 border-amber-400 bg-amber-500 px-6 py-3 text-sm font-black tracking-wider text-slate-950 uppercase hover:bg-amber-400"
                  >
                    <Play size={16} fill="currentColor" />
                    Start Online Match
                  </button>
                ) : (
                  <div className="ml-auto text-xs font-bold tracking-wider text-amber-300 uppercase">
                    Waiting for host to start race...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
