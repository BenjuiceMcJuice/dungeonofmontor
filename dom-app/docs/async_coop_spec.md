# Async Co-op Multiplayer — Option A (Shared Exploration)

## Overview
Two players share one dungeon run. Same position, same rooms. Turns alternate: Player 1 acts, Player 2 acts, enemies act. Async — players can take turns hours apart. Push notification when it's your turn.

## How It Plays

### Starting a Co-op Run
1. Player 1 taps "Create Campaign" from landing screen
2. Gets a campaign code (e.g. `DOM-XXXXX`)
3. Player 2 enters code to join
4. Both see a lobby: character names, stats, "Ready" buttons
5. Both ready → dungeon generates, campaign starts

### Exploration (Free, Not Turn-Gated)
- Both players are always in the same room
- EITHER player can pick doors, search junk, loot corpses, use merchants — no waiting
- First to tap wins on conflicts (Firestore transaction)
- Both see shared state updates in near-real-time via onSnapshot
- Merchants: each player shops independently (separate gold)
- Combat is the ONLY turn-gated phase

### Combat (Alternating Turns)
```
Initiative roll → turn order: [P1, Enemy A, P2, Enemy B, ...]

P1's turn:
  → P1 sees action panel (Attack/Use Item/Throw/Flee)
  → P1 acts → result resolves → combat log updates
  → Turn advances to Enemy A

Enemy A's turn:
  → Auto-resolves (same as solo)
  → Both players see the result via Firestore sync

P2's turn:
  → P2 sees action panel
  → P1 sees "Waiting for [P2 name]..." with spectator feed
  → P2 acts → result resolves
  → Turn advances to Enemy B

Repeat until victory or defeat.
```

### Async Turn Flow
- `currentTurnUid` on campaign doc controls whose turn it is
- Only that player can act — action panel only renders for them
- Other player sees: "Waiting for {name}..." + last action log
- Push notification fires when your turn starts
- 24-hour timeout → auto-skip (configurable)
- Enemy turns auto-resolve immediately (no waiting)

### Victory / Defeat
- Victory: all enemies down → both see XP + loot
- Defeat: all players down → campaign over
- If one player dies, the other continues solo until they die or win

## Technical Architecture

### Firestore Structure
```
/campaigns/{campaignId}
  status: 'lobby' | 'active' | 'completed' | 'abandoned'
  createdBy: uid
  campaignCode: 'DOM-XXXXX'
  
  participants: [
    { uid: string, name: string, character: {...}, ready: boolean }
  ]
  
  // Turn control
  currentPhase: 'exploration' | 'combat'
  currentTurnUid: string
  turnStartedAt: timestamp
  turnTimeoutSeconds: 86400  // 24 hours
  
  // Dungeon state (shared)
  floorId: string
  zone: {...}  // Full zone with chambers, position, cleared, corpses
  
  // Combat state (when in combat)
  battleState: {...}  // Same structure as solo — players keyed by uid
  
  // Run tracking
  totalXp: number
  runLevel: number
```

### State Sync via Firestore onSnapshot
```javascript
// In Game.jsx — subscribe to campaign doc
useEffect(function() {
  if (!campaignId) return
  var unsub = onSnapshot(doc(db, 'campaigns', campaignId), function(snap) {
    var data = snap.data()
    setBattle(data.battleState)
    setZone(data.zone)
    setCurrentTurnUid(data.currentTurnUid)
  })
  return unsub
}, [campaignId])
```

### Action Submission (no Cloud Functions needed initially)
For simplicity in v1, the acting player writes directly to Firestore:
```javascript
function submitAction(action) {
  // Resolve locally (same combat.js logic)
  var result = resolvePlayerAttack(battle, user.uid, targetId)
  
  // Advance turn to next actor
  var nextBattle = advanceTurn(result.newBattle)
  var nextActorId = getCurrentTurnId(nextBattle)
  var nextActor = getActor(nextBattle, nextActorId)
  
  // Auto-resolve enemy turns locally too
  while (nextActor && nextActor.type === 'enemy') {
    var enemyResult = resolveEnemyAttack(nextBattle, nextActorId)
    nextBattle = advanceTurn(enemyResult.newBattle)
    nextActorId = getCurrentTurnId(nextBattle)
    nextActor = getActor(nextBattle, nextActorId)
  }
  
  // Write updated state to Firestore — other player sees it via onSnapshot
  updateDoc(doc(db, 'campaigns', campaignId), {
    battleState: nextBattle,
    currentTurnUid: nextActorId,
    turnStartedAt: serverTimestamp(),
  })
}
```

This avoids Cloud Functions entirely for v1. The acting player resolves combat locally and writes the result. The other player's `onSnapshot` listener picks it up. Enemy turns auto-resolve in the same write.

Cloud Functions can be added later for:
- Turn timeout enforcement
- Anti-cheat validation
- Push notifications

### What Changes in Existing Code

#### Game.jsx
1. Accept `campaignId` prop (null = solo mode)
2. If campaignId: subscribe to campaign doc via onSnapshot
3. `isPlayerTurn` check: `currentTurnUid === user.uid`
4. When NOT your turn: show "Waiting for {name}..." + combat log
5. When your turn: normal action panel
6. On action: resolve locally + write to Firestore (not just local setBattle)
7. Enemy turns: auto-resolve and include in the same Firestore write

#### Combat initialization
```javascript
// Solo (current):
var players = [{ uid: user.uid, character: character }]

// Co-op:
var players = campaign.participants.map(function(p) {
  return { uid: p.uid, character: p.character }
})
```

#### Party bar
- Show both players: name, HP, conditions, equipment
- Highlight whose turn it is
- Show "DOWN" for dead players

#### Door picking (exploration)
- Either player can pick doors — no turn gating
- First tap wins (Firestore transaction prevents race conditions)
- Both see the room transition via onSnapshot

### Campaign Lobby
New component: `CampaignLobby.jsx`
- Create campaign → generate code
- Join campaign → enter code
- Show participants, ready status
- Both ready → start dungeon

### Landing Screen Changes
Current: "Enter your name" → prep → game
New: "Solo Run" / "Create Co-op" / "Join Co-op"
- Solo: current flow unchanged
- Create: name → lobby (waiting for friend)
- Join: code → name → lobby

## Implementation Order

### Sprint 1: Campaign data model + lobby (3-4 days)
- Campaign Firestore doc structure
- Create/join campaign with codes
- Lobby UI: participants, ready, start

### Sprint 2: Shared dungeon state via Firestore (3-4 days)
- onSnapshot subscription in Game.jsx
- Write zone/position changes to campaign doc
- Door picking with turn control
- Both players see same dungeon state

### Sprint 3: Multiplayer combat (4-5 days)
- Pass all participants to createBattleState
- Turn enforcement via currentTurnUid
- Action submission → local resolve → Firestore write
- Auto-resolve enemy turns in same write
- Spectator feed for non-active player
- Party bar showing both players

### Sprint 4: Polish + notifications (2-3 days)
- Push notifications (FCM) for turn alerts
- Turn timeout + auto-skip
- Disconnect handling
- Campaign abandonment

## Design Decisions

### Free exploration, turn-gated combat only
Exploration (door picks, junk searches, looting, merchants) is NOT turn-gated. Either player can act freely. Firestore syncs shared state — first write wins on conflicts (e.g. both tap a door simultaneously). Combat is the only phase with strict turn enforcement. This avoids the tedium of alternating turns for every junk pile search.

### Clean separation — solo stays untouched
Multiplayer is an optional layer, not a rewrite:
- `campaignId` prop is null → solo mode, zero changes to current code
- `campaignId` exists → Firestore sync hook wraps state
- All engine files (combat.js, conditions.js, dungeon.js) unchanged
- If multiplayer doesn't work out, remove the hook + lobby components — solo never breaks

### Why no Cloud Functions for v1?
- Faster to build — no backend deploy pipeline needed
- Firestore security rules can enforce basic validation
- Acting player resolves locally — same trusted logic as solo
- Cloud Functions added later for timeout + anti-cheat

### Why shared position (Option A)?
- Simpler state model — one `playerPosition` 
- No "what if players are in different rooms when combat triggers"
- Natural turn-taking for door picks
- Split exploration (Option B) is a future evolution

### Why async not real-time?
- Players might be in different timezones
- No WebSocket infrastructure needed
- Firestore onSnapshot gives near-real-time when both online
- 24-hour timeout keeps campaigns moving
- Can play like a board game — take your turn when ready

## What This Doesn't Include (Future)
- More than 2 players (engine supports it, UI doesn't yet)
- Split exploration (Option B)
- PvP arena mode
- Item trading between players
- Healing other players
- Cross-level party synergy bonuses
- New classes designed for multiplayer roles
