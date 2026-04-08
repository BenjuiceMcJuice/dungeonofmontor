# Stage 2 — Persistent Characters

## Overview
Characters persist between runs via Firestore. 3 slots per account. On death: only unlocked gift types survive. Stats, gold, items, level all reset. Roguelike — each run is fresh but you carry accumulated gift knowledge.

## What Persists Between Runs
- **Banked gifts** — unlocked gift TYPE ids (petal, stone, etc.). Re-pick powers each run.
- **Run history** — run count, death count, victory count, best floor
- **Last run result** — for display on tavern card

## What Resets on Death
- Stats (back to archetype base)
- Level
- Gold
- All items and equipment
- Active gift slot assignments
- Inventory and junk bag

## Firestore Structure
```
/users/{uid}/characters/{charId}
  name, archetype, createdAt
  bankedGifts: ['petal', 'stone', ...]
  runCount, deathCount, victoryCount, bestFloor
  lastRunResult: { victory, floors, xp, killedBy, timestamp }

/users/{uid}/characters/{charId}/activeRun/current
  (same payload as current run save, plus charId)
```

## Flow
```
Auth → Tavern (3 slots)
  → Create character (name + archetype)
  → Select character → check activeRun → Resume / New Run
  → Preparation (stat allocation + shop)
  → Game (dungeon)
  → Death/Victory → bank gifts → update character → Results
  → Return to Tavern
```

## New Files
- `src/lib/characterSave.js` — Firestore CRUD for character docs
- `src/pages/Tavern.jsx` — rewrite as 3-slot hub

## Modified Files
- `src/App.jsx` — tavern routing, selectedCharacter state, per-character resume
- `src/lib/runSave.js` — add charId to paths
- `src/hooks/useRunSave.js` — accept charId parameter
- `src/pages/Game.jsx` — init gifts from bankedGifts, include in onEndRun
- `src/pages/Results.jsx` — show banked gifts

## Implementation Order
1. characterSave.js (Firestore CRUD)
2. runSave.js + useRunSave.js (add charId)
3. Tavern.jsx (3-slot UI)
4. App.jsx (new routing)
5. Game.jsx (bankedGifts init + onEndRun data)
6. Results.jsx (show banked gifts)
