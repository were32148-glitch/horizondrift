import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { CAR_ROSTER } from './cars';
import type {
  CarId,
  GarageSaveData,
  LobbyMode,
  MapId,
  TeamId,
  WeatherPreset,
} from './types';

import { getAuth } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const firebaseAuth = getAuth(app);
export const auth = firebaseAuth;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const user = firebaseAuth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory Firestore boot connectivity check
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
if (typeof window !== 'undefined') {
  void testConnection();
}

const VALID_CAR_IDS = new Set<CarId>(CAR_ROSTER.map((c) => c.id));
function sanitizeCarId(id: string): CarId {
  return VALID_CAR_IDS.has(id as CarId) ? (id as CarId) : 'apex';
}

function sanitizeDisplayName(name: string | null | undefined): string {
  const clean = (name || 'Driver').trim().slice(0, 40);
  return clean.length > 0 ? clean : 'Driver';
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(firebaseAuth, provider);
    return res.user;
  } catch (error) {
    console.warn('Google sign-in aborted or unavailable:', error);
    return null;
  }
}

export async function signOutGoogle(): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(firebaseAuth, cb);
}

const CLOUD_CAR_IDS = new Set<CarId>(['apex', 'baja', 'viper', 'phantom', 'titan']);
function sanitizeCloudCarId(id: string): CarId {
  return CLOUD_CAR_IDS.has(id as CarId) ? (id as CarId) : 'apex';
}

export async function syncUserProfileToCloud(
  user: User,
  localGarage: GarageSaveData,
): Promise<GarageSaveData> {
  if (!user.emailVerified) return localGarage;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const cloudOwned = Array.from(
        new Set<CarId>(['apex', ...localGarage.ownedCars.filter((c) => CLOUD_CAR_IDS.has(c))]),
      ).slice(0, 5);
      await setDoc(ref, {
        uid: user.uid,
        displayName: sanitizeDisplayName(user.displayName),
        coins: Math.min(10000000, Math.max(0, Math.floor(localGarage.coins))),
        ownedCars: cloudOwned,
        equippedP1: sanitizeCloudCarId(localGarage.equippedP1),
        equippedP2: sanitizeCloudCarId(localGarage.equippedP2),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return localGarage;
    }
    const cloud = snap.data() as Partial<GarageSaveData>;
    const mergedOwned = Array.from(
      new Set<CarId>(['apex', ...(cloud.ownedCars ?? []), ...localGarage.ownedCars]),
    );
    const cloudOwned = mergedOwned.filter((c) => CLOUD_CAR_IDS.has(c)).slice(0, 5);
    const mergedCoins = Math.max(
      typeof cloud.coins === 'number' ? cloud.coins : 0,
      localGarage.coins,
    );
    const merged: GarageSaveData = {
      coins: mergedCoins,
      ownedCars: mergedOwned,
      equippedP1: sanitizeCarId(localGarage.equippedP1),
      equippedP2: sanitizeCarId(localGarage.equippedP2),
      equippedCharacter: localGarage.equippedCharacter ?? 'default',
      unlockedCharacters: localGarage.unlockedCharacters ?? ['default'],
      equippedWeapon: localGarage.equippedWeapon ?? 'fists',
      unlockedWeapons: localGarage.unlockedWeapons ?? ['fists'],
    };
    await updateDoc(ref, {
      displayName: sanitizeDisplayName(user.displayName),
      coins: merged.coins,
      ownedCars: cloudOwned,
      equippedP1: sanitizeCloudCarId(merged.equippedP1),
      equippedP2: sanitizeCloudCarId(merged.equippedP2),
      updatedAt: serverTimestamp(),
    });
    return merged;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function upsertCloudLobby(params: {
  code: string;
  user: User;
  mode: LobbyMode;
  mapId: MapId;
  weatherPreset: WeatherPreset;
  maxPlayers: number;
}): Promise<void> {
  if (!params.user.emailVerified) return;
  const code = params.code.toUpperCase().slice(0, 6);
  const path = `lobbies/${code}`;
  try {
    await setDoc(doc(db, 'lobbies', code), {
      code,
      hostUid: params.user.uid,
      hostName: sanitizeDisplayName(params.user.displayName),
      mode: params.mode,
      mapId: params.mapId,
      weatherPreset: params.weatherPreset,
      status: 'waiting',
      maxPlayers: params.maxPlayers,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await upsertCloudLobbyMember({
      code,
      user: params.user,
      carId: 'apex',
      team: params.mode === 'online_2v2' ? 'red' : 'ffa',
      ready: true,
      isNew: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function upsertCloudLobbyMember(params: {
  code: string;
  user: User;
  carId: CarId;
  team: TeamId;
  ready: boolean;
  isNew?: boolean;
}): Promise<void> {
  if (!params.user.emailVerified) return;
  const code = params.code.toUpperCase().slice(0, 6);
  const memberPath = `lobbies/${code}/members/${params.user.uid}`;
  const ref = doc(db, 'lobbies', code, 'members', params.user.uid);
  try {
    if (params.isNew) {
      await setDoc(ref, {
        uid: params.user.uid,
        lobbyCode: code,
        displayName: sanitizeDisplayName(params.user.displayName),
        carId: sanitizeCarId(params.carId),
        team: params.team,
        ready: params.ready,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: params.user.uid,
          lobbyCode: code,
          displayName: sanitizeDisplayName(userName(params.user)),
          carId: sanitizeCarId(params.carId),
          team: params.team,
          ready: params.ready,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          displayName: sanitizeDisplayName(params.user.displayName),
          carId: sanitizeCarId(params.carId),
          team: params.team,
          ready: params.ready,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, memberPath);
  }
}

function userName(user: User): string {
  return user.displayName || 'Driver';
}

export async function updateCloudLobbyStatus(
  code: string,
  status: 'racing' | 'finished',
  winnerTeam?: string,
): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || !user.emailVerified) return;
  const cleanCode = code.toUpperCase().slice(0, 6);
  const path = `lobbies/${cleanCode}`;
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (status === 'finished' && winnerTeam) {
      payload.winnerTeam = winnerTeam.slice(0, 32);
    }
    await updateDoc(doc(db, 'lobbies', cleanCode), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function leaveCloudLobby(code: string): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || !user.emailVerified) return;
  const cleanCode = code.toUpperCase().slice(0, 6);
  const memberPath = `lobbies/${cleanCode}/members/${user.uid}`;
  try {
    await deleteDoc(doc(db, 'lobbies', cleanCode, 'members', user.uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, memberPath);
  }
}

export async function fetchPublicCloudLobbies(): Promise<
  Array<{ code: string; mode: LobbyMode; mapId: MapId; hostName: string; maxPlayers: number }>
> {
  if (!firebaseAuth.currentUser) return [];
  const path = 'lobbies';
  try {
    const q = query(collection(db, path), where('isPublic', '==', true), limit(12));
    const snaps = await getDocs(q);
    return snaps.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((d) => d.status === 'waiting')
      .map((d) => ({
        code: String(d.code ?? ''),
        mode: (d.mode === 'online_ffa' ? 'online_ffa' : 'online_2v2') as LobbyMode,
        mapId: (['valley', 'canyon', 'alpine', 'coast'].includes(String(d.mapId))
          ? d.mapId
          : 'valley') as MapId,
        hostName: String(d.hostName ?? 'Host'),
        maxPlayers: Number(d.maxPlayers ?? 4),
      }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export function subscribeCloudLobby(
  code: string,
  onUpdate: (data: Record<string, unknown> | null) => void,
): Unsubscribe {
  const cleanCode = code.toUpperCase().slice(0, 6);
  const path = `lobbies/${cleanCode}`;
  return onSnapshot(
    doc(db, 'lobbies', cleanCode),
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}
