# Multiplayer

> Vision and architecture for multiplayer in Dungeon of Montor.
> Updated 2026-04-03.
> Status: All multiplayer features are **planned** (Stage 3+). The architecture is multiplayer-ready from day one.

---

## 1. Design Principles

**Multiplayer-ready from day one.** The combat and run state data model is structured for multiplayer even in Stage 1 solo play. The `BattleState` structure uses per-player dictionaries keyed by UID, turn order arrays, and `currentTurnUid` enforcement. No single-player assumptions are baked in.

**Solo play is first-class.** Solo players are never penalised with XP reductions or gated content. Multiplayer advantage comes from party synergy (complementary classes, shared resources, social fun) -- not from punishing those who play alone.

---

## 2. Co-op Multiplayer (Stage 3 -- planned)

### Party System
- Up to 4 players in a party
- Shared dungeon -- all players explore the same zone grid
- Turn-based combat with interleaved player and enemy turns
- Initiative determines turn order each round

### Campaign Structure
- Campaigns have a name, difficulty, and multiple runs
- Campaign Master creates the campaign and gets a shareable Campaign Code
- Other players join via the code, selecting their persistent character
- Lobby screen shows who's joined before the CM starts

### Turn Enforcement
- `currentTurnUid` on the campaign Firestore document is the single source of truth
- Action Panel only renders for the active player
- All other players see a live Spectator Feed showing dice rolls, damage, narration
- Turn timeout: 24 hours default (configurable), auto-skip on timeout

### Async Play
- Players can take turns hours or days apart
- Firebase Cloud Messaging push notifications fire when it's your turn
- Campaign state saved perfectly between actions -- can close the app entirely
- This is the killer feature for "D&D for busy adults"

### Cross-Level Party Mechanics
- **Morale Aura:** Lower-level character in party gives +1 to all skill checks while alive
- **Lucky Charm:** Highest LCK in party contributes full modifier to loot rolls
- **Healing:** Cleric and other support classes can target any party member
- **Item Trading:** During Rest encounters, players can trade items

---

## 3. PvP Options (Stage 3+ -- planned)

### 1v1 Character Duels
- Arena-style combat between two player characters
- Same combat system, same dice, same conditions
- Bragging rights and potential wagered items

### Competitive Dungeon Racing
- Two parties enter the same dungeon simultaneously
- Race to the boss -- first party to clear wins
- Shared dungeon map shows rival party progress

---

## 4. Playable Montor (Stage 4+ -- planned)

Asymmetric multiplayer: one player controls the dungeon itself.

- The Montor player sees all chambers, all enemies, all loot
- They can place enemies, set traps, trigger events, and speak as Montor
- The party plays against a human intelligence instead of AI/random
- Montor player has a resource budget (can't just spawn infinite enemies)
- This turns the game into a digital D&D with one player as the dungeon master

---

## 5. Firebase as Multiplayer Backbone

### Real-Time Sync
All players subscribe to the campaign document via Firestore `onSnapshot`. State changes push to all clients instantly.

### Data Model
- Campaign document holds all shared state: battle state, turn order, encounter deck, dungeon mood
- `BattleState` is nested in the campaign doc with per-player HP, stats, inventory snapshots
- Turn enforcement serialises all writes naturally -- no Firestore transactions needed for normal gameplay

### Inventory Locking
On battle start:
1. `inBattle` flag set to true on campaign doc
2. Each player's inventory + equipped items snapshotted into `BattleState`
3. Firestore security rules block character doc inventory writes while `inBattle` is true
4. Items used during battle deducted from the snapshot
5. On battle end, diff synced back to character doc

### Security
- All meaningful game writes go through Cloud Functions
- Clients read freely, never write directly to campaign or turn documents
- Combat resolution happens server-side -- client math is never trusted

### Data Usage Considerations
- Firestore `onSnapshot` listeners create persistent connections
- Each state change triggers a document read for all connected clients
- For a 4-player party, each game action results in 4 document reads
- Free-tier Firestore (Spark plan) has 50k reads/day -- sufficient for casual play
- Token usage for AI narration estimated at ~16k-18k per run (within Groq free tier)

---

*Multiplayer -- v1.0 -- April 2026*
