# Tavern & Persistent Characters — Technical Spec

> Stage 2 foundation. Replaces the current LandingScene with a 3-slot character hub. Characters persist between runs; gifts bank on death; stats/items/gold reset.

---

## 1. What Changes

### Current Flow
```
Auth → LandingScene (name input) → Preparation → Game → Results → LandingScene
```
- No character persistence — every run creates a fresh Knight via generateKnight()
- Run save is per-user: users/{uid}/activeRun/current
- Results screen says "characters are not persisted between runs"

### New Flow
```
Auth → Tavern (3 character slots)
         ├─ Empty slot → Create Character (name + archetype)
         ├─ Existing slot (no active run) → New Run → Preparation → Game → Results → Tavern
         ├─ Existing slot (active run) → Resume Run → Game → Results → Tavern
         └─ Delete character (long press / confirm)
```

---

## 2. What Persists vs Resets

### Persists Between Runs (stored on character doc)
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Character name |
| `archetype` | string | 'knight' (only class for now, future: rogue, mage etc.) |
| `bankedGifts` | string[] | Gift TYPE ids unlocked (e.g. ['petal', 'stone']). Not the specific effects — just that you've found the gift. Re-pick slot effects each run. |
| `runCount` | number | Total runs started |
| `deathCount` | number | Runs ended in defeat |
| `victoryCount` | number | Runs ended in victory |
| `bestFloor` | string | Deepest floor reached (e.g. 'underbelly') |
| `totalEnemiesDefeated` | number | Lifetime kills |
| `totalChambersCleared` | number | Lifetime chambers |
| `createdAt` | timestamp | Character creation time |

### Resets on Death/Victory
- Stats (back to archetype base + freeStatPoints to allocate)
- Level (back to 1)
- Gold (back to starting gold)
- All items, equipment, inventory, junk bag
- Active gift slot assignments (body/mind/weapon/shield)
- Active buffs, conditions, run stats
- Floor/zone/chamber progress

### Gift Banking Logic
On run end (death or victory):
1. Read `collectedTreasures` from game state (gift type ids found this run)
2. Merge into character's `bankedGifts` (deduplicate)
3. Save character doc
4. On next run's Preparation screen, show banked gifts as available knowledge
5. Player doesn't get to pre-equip gifts — they still find treasures in-dungeon, but banked types unlock faster/better effects (future enhancement)

---

## 3. Firestore Schema

### New Collection: `/users/{uid}/characters/{charId}`
```javascript
{
  name: "Sir Bonk",
  archetype: "knight",
  bankedGifts: ["petal", "stone"],
  runCount: 12,
  deathCount: 11,
  victoryCount: 1,
  bestFloor: "quarters",
  totalEnemiesDefeated: 87,
  totalChambersCleared: 203,
  createdAt: Timestamp,
  lastRunResult: {
    outcome: "defeat",        // "defeat" | "victory"
    floorReached: "underground",
    zoneReached: "great_hall",
    xp: 667,
    killedBy: "orc",          // null on victory
    timestamp: Timestamp
  }
}
```

### Modified Path: Active Run Save
```
Old: /users/{uid}/activeRun/current
New: /users/{uid}/characters/{charId}/activeRun/current
```
Same payload as today (see runSave.js buildSavePayload), plus:
```javascript
{
  ...existingPayload,
  charId: "abc123"   // Link back to character doc
}
```

### Local Storage Key Change
```
Old: dom_activeRun_{uid}
New: dom_activeRun_{uid}_{charId}
```

### Run Log (unchanged path, new field)
```
/runLog/{logId}
  ...existing fields...
  + charId: "abc123"
```

### Max Characters
3 per account. Enforced client-side (count docs in collection before allowing create). No Firestore rule needed for Spark plan.

---

## 4. New Files

### `src/lib/characterSave.js`
Firestore CRUD for character documents.

```javascript
// Functions to export:

// Load all characters for a user (max 3)
function loadCharacters(uid)
  // → getDocs(collection(db, 'users', uid, 'characters'))
  // → returns array of { id, ...data } sorted by createdAt
  // → returns [] if none exist

// Load single character
function loadCharacter(uid, charId)
  // → getDoc(doc(db, 'users', uid, 'characters', charId))

// Create new character (returns generated charId)
function createCharacter(uid, name, archetype)
  // → addDoc with initial fields:
  //   name, archetype, bankedGifts: [], runCount: 0, deathCount: 0,
  //   victoryCount: 0, bestFloor: null, totalEnemiesDefeated: 0,
  //   totalChambersCleared: 0, createdAt: serverTimestamp(),
  //   lastRunResult: null

// Update character after run ends
function updateCharacterAfterRun(uid, charId, runData)
  // → updateDoc with:
  //   increment runCount
  //   increment deathCount or victoryCount
  //   merge bankedGifts (union of existing + new)
  //   update bestFloor if deeper
  //   increment totalEnemiesDefeated, totalChambersCleared
  //   set lastRunResult snapshot

// Delete character (and its activeRun subcollection)
function deleteCharacter(uid, charId)
  // → deleteDoc character
  // → deleteDoc activeRun/current (if exists)
```

---

## 5. Modified Files

### `src/lib/runSave.js`
- All functions now accept `(uid, charId)` instead of just `(uid)`
- Firestore path: `users/{uid}/characters/{charId}/activeRun/current`
- localStorage key: `dom_activeRun_{uid}_{charId}`
- `buildSavePayload` adds `charId` field

### `src/hooks/useRunSave.js`
- Accept `charId` parameter alongside `uid`
- Pass both to runSave functions
- Debounced saver re-initialises when charId changes

### `src/App.jsx` — Routing Overhaul
Current state variables:
```javascript
screen: 'loading' | 'landing' | 'resume' | 'prep' | 'game' | 'results'
character, runResult, savedRun
```

New state variables:
```javascript
screen: 'loading' | 'tavern' | 'prep' | 'game' | 'results'
characters: []              // All 3 slots (loaded from Firestore)
selectedCharId: null        // Which slot is active
character: null             // Runtime character object for current run
runResult: null
savedRun: null
```

New flow:
```javascript
// After auth resolves:
loadCharacters(uid) → setCharacters(list) → setScreen('tavern')

// Tavern: select existing character
onSelectCharacter(charId) →
  check for activeRun on that character
  if found → setSavedRun(data), show resume prompt inline in Tavern
  if not → setSelectedCharId(charId), generateKnight(char.name), setScreen('prep')

// Tavern: create new character
onCreateCharacter(name) →
  createCharacter(uid, name, 'knight') → reload characters → setScreen('tavern')

// Tavern: delete character
onDeleteCharacter(charId) →
  confirm dialog → deleteCharacter(uid, charId) → reload characters

// Preparation → Game (same as now, but charId threaded)

// Game ends:
onEndRun(result) →
  updateCharacterAfterRun(uid, charId, result)
  runSave.clear()
  setRunResult(result)
  setScreen('results')

// Results → Return to Tavern
onReturnToTavern() →
  reload characters (to show updated stats)
  setCharacter(null), setRunResult(null), setSelectedCharId(null)
  setScreen('tavern')
```

### `src/pages/Tavern.jsx` — Full Rewrite
Replace current name-input with 3-slot character hub.

**Layout:**
```
┌─────────────────────────────┐
│     MONTOR'S TAVERN         │
│     (signed in as ...)      │
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │ Sir Bonk│ │ Lady Meg│   │
│  │ Knight  │ │ Knight  │   │
│  │ 12 runs │ │ 3 runs  │   │
│  │ Best:   │ │ Best:   │   │
│  │ Quarters│ │ Garden  │   │
│  │ 2 gifts │ │ 0 gifts │   │
│  │         │ │         │   │
│  │[Continue]│ │[New Run]│   │
│  └─────────┘ └─────────┘   │
│                             │
│  ┌─────────┐                │
│  │  Empty  │                │
│  │         │                │
│  │ [Create]│                │
│  └─────────┘                │
│                             │
│  [Sign out]                 │
└─────────────────────────────┘
```

**Character card shows:**
- Name (gold, display font)
- Archetype label
- Run count / death count / victory count
- Best floor reached
- Banked gift count (e.g. "3/6 gifts")
- Last run result (one-liner: "Killed by Orc Brute on Floor 2")
- Action button: "New Run" or "Continue" (if active run exists)
- Delete button (small, bottom corner, requires confirm)

**Empty slot shows:**
- "Create Character" button
- Inline name input (same pattern as current LandingScene)
- Archetype selector (just Knight for now, greyed-out future classes)

**Props:**
```javascript
Tavern({
  user,                     // Firebase user
  characters,               // Array of character docs (0-3)
  onCreateCharacter,        // (name, archetype) => void
  onSelectCharacter,        // (charId) => void
  onResumeRun,              // (charId, savedRun) => void
  onDeleteCharacter,        // (charId) => void
  onSignOut                 // () => void
})
```

### `src/pages/Game.jsx`
- Accept `charId` prop (thread to onSaveRun)
- `writeRunLog` adds `charId` field
- On run end, pass `collectedTreasures` in result so App can bank them

### `src/pages/Results.jsx`
- Remove "characters are not persisted" message
- Show banked gifts earned this run (e.g. "Gift unlocked: Petal of Gerald")
- Show character lifetime stats (runs, deaths, best floor)
- "Return to Tavern" button (same as now)

### `src/components/LandingScene.jsx`
- **Removed** — replaced by Tavern.jsx character creation flow

### `src/components/ResumeRunPrompt.jsx`
- **Removed** — resume is handled inline in Tavern (button on character card)

---

## 6. Implementation Order

| Step | What | Files | Depends On |
|------|------|-------|-----------|
| 1 | `characterSave.js` — Firestore CRUD | New file | Nothing |
| 2 | `runSave.js` — add charId to paths | Modify | Step 1 |
| 3 | `useRunSave.js` — accept charId param | Modify | Step 2 |
| 4 | `Tavern.jsx` — 3-slot character hub | Rewrite | Step 1 |
| 5 | `App.jsx` — new routing + state | Rewrite | Steps 1-4 |
| 6 | `Game.jsx` — charId prop + gift banking | Modify | Step 5 |
| 7 | `Results.jsx` — banked gifts display | Modify | Step 6 |
| 8 | Remove LandingScene + ResumeRunPrompt | Delete | Step 5 |

Steps 1-3 can be done together (save layer).
Steps 4-5 are the big ones (UI + routing).
Steps 6-8 are wiring and cleanup.

---

## 7. Migration / Backwards Compatibility

### Existing Users
- Users with an active run at `users/{uid}/activeRun/current` (old path) will lose it — the new code reads from `users/{uid}/characters/{charId}/activeRun/current`.
- Since we're still in early testing with 1-2 users, this is acceptable. No migration needed.
- First visit after update: Tavern shows 3 empty slots. User creates their first character.

### Existing Run Logs
- Old runLog docs don't have `charId`. That's fine — they still have `userId` and all stats. The charId field is additive.

---

## 8. Firestore Rules (future)

Currently in test mode (expires ~2026-04-28). When rules are tightened:

```
match /users/{uid}/characters/{charId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /users/{uid}/characters/{charId}/activeRun/{doc} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

---

## 9. Out of Scope (future)

- **Multi-class**: only Knight for now. Archetype field is stored for future use.
- **Gift loadout screen**: banked gifts are recorded but don't affect Preparation yet. Future: pick starting gift knowledge before a run.
- **The Dump**: pre-run junk trade hub. Separate feature, uses bankedGifts + new junk currency.
- **Narrative mode (The Tale)**: Tavern will eventually fork to Door 1 (Crawl) or Door 2 (Tale). This spec only wires The Crawl.
- **Multiplayer**: character docs are single-user. Party system is a separate feature.
