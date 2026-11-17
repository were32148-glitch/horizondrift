# Firestore Security Specification — Horizon Drift: Wildlands & Los Santos

## 1. Data Invariants
1. **User Profile Ownership**: `/users/{uid}` documents may only be read, created, or updated by `request.auth.uid == uid` with `email_verified == true`.
2. **Lobby Master Gate**: `/lobbies/{lobbyId}` uses `lobbyId == incoming().code` matching `^[A-Z0-9]{6}$`. Only the lobby host (`hostUid == request.auth.uid`) may update lobby status/map/weather or delete the lobby.
3. **Subcollection Parent Existence & Integrity**: Every `/lobbies/{lobbyId}/members/{uid}` requires the parent `/lobbies/{lobbyId}` to exist via `exists()` / `get()`, and `uid == request.auth.uid` on create/update/delete.
4. **Immutable Ownership & Creation Timestamps**: `uid`, `hostUid`, `code`, `lobbyCode`, `createdAt`, and `joinedAt` can never change after document creation.
5. **Strict Server Time**: All `createdAt`, `joinedAt`, and `updatedAt` fields must equal `request.time`.
6. **Terminal State Lock**: Once `/lobbies/{lobbyId}` transitions to `status == 'finished'`, no subsequent updates are allowed.
7. **Zero Unbounded Strings or Lists**: All strings have explicit `.size()` caps and `ownedCars` is capped at `<= 5` entries with element verification.
8. **Secure List Queries**: No blanket `allow list`. Queries on `/lobbies` require `resource.data.isPublic == true || resource.data.hostUid == request.auth.uid`; queries on `/leaderboards` require `resource.data.bestTimeSec > 0`.

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on UserProfile**: `{ uid: "u1", displayName: "Ace", coins: 100, ownedCars: ["apex"], equippedP1: "apex", equippedP2: "apex", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> Blocked by `hasOnly`.
2. **Spoofed User UID**: Writing to `/users/victim` with `{ uid: "victim", ... }` as user `"attacker"` -> Blocked by `request.auth.uid == uid && incoming().uid == request.auth.uid`.
3. **Negative or Poisoned Coin Balance**: `{ ..., coins: -999999 }` or `{ ..., coins: "1000" }` -> Blocked by `coins is number && coins >= 0 && coins <= 10000000`.
4. **Forged Client Timestamp on Create**: `/users/u1` with `{ ..., createdAt: "2020-01-01T00:00:00Z" }` -> Blocked by `createdAt == request.time`.
5. **Unverified Email Token**: Authenticated user with `email_verified: false` attempting any write -> Blocked by `isVerifiedUser()`.
6. **1.5KB Junk Lobby ID Poisoning**: Creating `/lobbies/AAAAA...1500chars` -> Blocked by `isValidLobbyCode(lobbyId)`.
7. **Host Hijacking on Lobby Update**: Non-host member attempting `{ hostUid: "attacker" }` on `/lobbies/ABC123` -> Blocked by `existing().hostUid == request.auth.uid` and `affectedKeys().hasOnly(...)`.
8. **Resurrecting Finished Lobby**: Host updating `/lobbies/ABC123` where `existing().status == 'finished'` back to `'waiting'` -> Blocked by terminal state lock `existing().status != 'finished'`.
9. **Orphaned Lobby Member**: Creating `/lobbies/NONEXISTENT/members/u1` -> Blocked by `exists(/databases/$(database)/documents/lobbies/$(lobbyId))`.
10. **Team Switching For Another Player**: Writing to `/lobbies/ABC123/members/otherUid` -> Blocked by `request.auth.uid == uid`.
11. **Oversized ownedCars Array**: `{ ..., ownedCars: ["apex", "baja", "viper", "phantom", "titan", "hack"] }` -> Blocked by `ownedCars.size() <= 5`.
12. **Fake Zero-Second Leaderboard Cheat**: Submitting `{ ..., bestTimeSec: 0.01 }` to `/leaderboards/lb1` -> Blocked by `bestTimeSec >= 5 && bestTimeSec <= 7200`.
