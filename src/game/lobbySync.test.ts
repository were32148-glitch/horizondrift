import assert from 'node:assert/strict';
import test from 'node:test';
import { computeTeamScores, createRaceGrid, stepRaceProgress } from './raceLogic.ts';
import { getMapWorldData } from './terrain.ts';
import type { LobbyState } from './types.ts';

test('Online 2v2 creates balanced 2v2 grid with AI backfill and computes team scores', () => {
  const lobby: LobbyState = {
    code: 'LS2V2X',
    mode: 'online_2v2',
    mapId: 'valley',
    weatherPreset: 'clear',
    status: 'racing',
    hostClientId: 'c-host',
    maxPlayers: 4,
    fillWithBots: true,
    members: [
      {
        clientId: 'c-host',
        name: 'HostRacer',
        carId: 'viper',
        team: 'red',
        ready: true,
        isHost: true,
      },
      {
        clientId: 'c-guest',
        name: 'GuestRacer',
        carId: 'phantom',
        team: 'blue',
        ready: true,
        isHost: false,
      },
    ],
  };

  const racers = createRaceGrid('online_2v2', 'valley', lobby, 'c-host');
  assert.equal(racers.length, 4);
  assert.equal(racers[0].profile.id, 'c-host');
  assert.equal(racers[0].profile.isHuman, true);
  assert.equal(racers[0].profile.isRemote, false);

  const remoteGuest = racers.find((r) => r.profile.id === 'c-guest');
  assert.ok(remoteGuest, 'Remote guest present in race grid');
  assert.equal(remoteGuest.profile.isRemote, true);
  assert.equal(remoteGuest.profile.team, 'blue');

  const redTeam = racers.filter((r) => r.profile.team === 'red');
  const blueTeam = racers.filter((r) => r.profile.team === 'blue');
  assert.equal(redTeam.length, 2);
  assert.equal(blueTeam.length, 2);

  // Remote player keeps its synchronized place when stepping local race progress
  remoteGuest.lap = 3;
  remoteGuest.progressScore = 999;
  const world = getMapWorldData('valley');
  stepRaceProgress(racers, world, 15.0);
  assert.equal(remoteGuest.place, 1);

  const scores = computeTeamScores(racers);
  assert.equal(scores.red + scores.blue, 10 + 6 + 4 + 2);
});

test('Online FFA puts local player in slot 0 with up to 6 racers total when bots fill enabled', () => {
  const lobby: LobbyState = {
    code: 'FFA888',
    mode: 'online_ffa',
    mapId: 'coast',
    weatherPreset: 'clear',
    status: 'racing',
    hostClientId: 'c-1',
    maxPlayers: 8,
    fillWithBots: true,
    members: [
      { clientId: 'c-1', name: 'Alpha', carId: 'apex', team: 'ffa', ready: true, isHost: true },
      { clientId: 'c-2', name: 'Bravo', carId: 'titan', team: 'ffa', ready: true, isHost: false },
    ],
  };

  const racers = createRaceGrid('online_ffa', 'coast', lobby, 'c-2');
  assert.equal(racers[0].profile.id, 'c-2');
  assert.equal(racers[0].profile.isHuman, true);
  assert.equal(racers.length, 6);
});
