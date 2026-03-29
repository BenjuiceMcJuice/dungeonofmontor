# ⚔️ Dungeon of Montor
## 03 — Technical Architecture
*Stack, data model, AI system, token management, multiplayer, build phases*
*v0.3 — March 2026*

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React PWA | Mobile-first, installable, offline-capable |
| Auth | Firebase Auth | Email + Google sign-in |
| Database | Firestore | Real-time sync for multiplayer via onSnapshot |
| Server Logic | Firebase Cloud Functions | AI proxy, game validation, turn enforcement |
| AI Provider | Groq API | Fast inference; user-supplied key |
| API Key Storage | Browser localStorage | Per-user, per-device; never stored server-side |
| Hosting | Firebase Hosting | CDN, PWA manifest |
| Push Notifications | Firebase Cloud Messaging | Async turn alerts |
| Sprites | Canvas grid arrays | No image files; sprites are data |

---

## 2. Project Structure

```
/src
  /components
    /game         — GameBoard, EncounterView, DiceRoller, ActionPanel
    /character    — CharacterSheet, StatBlock, InventoryGrid, LevelUpModal
    /campaign     — CampaignLobby, CampaignBrief, RunSummary
    /story        — StoryPage, ChronicleEntry, KeyMoments
    /sprites      — SpriteRenderer, SPRITE_DATA (all grids live here)
    /ui           — shared buttons, modals, toasts, loaders
  /hooks
    useGameState.js     — onSnapshot subscriber for campaign doc
    useCharacter.js     — character CRUD + local cache
    useDice.js          — dice roll logic, animation triggers
    useAI.js            — Groq calls via Cloud Function proxy
    useInventory.js     — inventory management + battle lock enforcement
  /lib
    dice.js             — all dice math
    combat.js           — attack resolution, damage calc, initiative
    loot.js             — loot table rolls, rarity resolution
    xp.js               — XP thresholds, level up logic
    aiContext.js        — builds compressed AI prompt context
    sprites.js          — sprite grid data + draw function
  /firebase
    firestore.js        — collection refs, helpers
    functions.js        — Cloud Function callers
  /pages
    Home, Character, Campaign, Game, Story, Settings
```

---

## 3. UI Structure — Tab System

The game UI is built around **five persistent tabs** on a fixed bottom nav bar. The View tab is the primary game surface; all others are reference.

| Tab | Icon | Purpose | Editable During Combat? |
|---|---|---|---|
| View | 👁 | The game — encounter, action, dice, narration | Yes — actions only |
| Party | ⚔️ | All combatants' HP, status, turn order | Read-only |
| Stats | 📋 | Character sheet — all 14 stats, abilities, scars | Read-only in-run |
| Inventory | 🎒 | Gear, relics, consumables | Locked during combat |
| Story | 📜 | Campaign chronicle, key moments, shareable link | Always readable |

### View Tab States

**Your turn:** Situation text (2–4 sentences AI narration) → action buttons → target selection → confirmation strip → single ROLL button → result + narration. Three taps max to resolve a turn.

**Not your turn (spectator):** Live feed with pulsing LIVE indicator. Events appear sequentially as they happen — who's acting, dice roll breakdown with coloured outcome labels, damage, then narration paragraph. Full weight narration for enemy turns — identical visual treatment to player turns.

**Out of combat:** Scene description → choices (if applicable) → skill check flow if triggered → Continue button.

**Key rule:** No HP bars, no stat blocks on the View tab. All reference information requires tapping to another tab. The View tab feels like a scene, not a dashboard.

---

## 4. Firebase Data Model

### `/users/{uid}`
```javascript
{
  displayName: string,
  email: string,
  createdAt: timestamp,
  // No API key — localStorage only
}
```

### `/characters/{characterId}`
```javascript
{
  uid: string,
  name: string,
  class: string,
  level: number,
  xp: number,
  status: 'active' | 'legacy' | 'deleted',
  deathMode: 'standard' | 'legacy' | 'ironman',

  baseStats: { str, agi, def, end, int, wis, per, lck, cha, vit, res, sth, cun, wil },
  abilities: [string],

  inventory: [Item],           // active slots (max 10) — locked at battle start
  equipped: {
    weapon: Item | null,
    offhand: Item | null,
    armour: Item | null,
    relics: [Item],            // max 3; Bound relics have sourceCharacterId
  },
  stash: [Item],
  gold: number,

  scars: [{ stat, amount, flavour, campaignId }],
  titles: [string],
  campaignHistory: [{ campaignId, runCount, outcome, deathMode }],

  // Faction record — persists across all campaigns
  factionRecord: {
    [factionId]: {
      name: string,
      standing: number,        // −100 to +100
      tier: string,
      firstEncountered: campaignId,
      history: [{ campaignId, change, reason }]
    }
  },

  // Deity — persists across all campaigns
  deity: {
    deityId: string | null,
    deityName: string | null,
    devotion: number,          // 0–1000
    tier: string,
    interventionUsedThisCampaign: boolean,
    history: [{ campaignId, gain, loss }]
  },

  // Legacy / Embue
  legacy: {
    embuesGiven: number,       // max 3 lifetime
    embuesReceived: [{
      fromCharacterId, fromCharacterName, type, detail, campaignId, isFromLegacyChar
    }],
    noviceEmbuedThisCampaign: boolean,
    legacyEulogy: string | null,
    retiredAt: timestamp | null
  },

  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `/campaigns/{campaignId}`
```javascript
{
  name: string,
  brief: string,
  cmUid: string,
  difficulty: 'novice' | 'seasoned' | 'veteran' | 'legendary',
  status: 'lobby' | 'active' | 'complete' | 'failed',
  ironmanMode: boolean,
  currentRunNumber: number,

  players: [{ uid, characterId, displayName, turnOrder }],
  currentTurnUid: string,      // enforces whose turn it is — key concurrency control
  inBattle: boolean,           // locks inventories when true

  encounterDeck: [string],     // shuffled encounter type list for current run
  currentEncounterIndex: number,
  battleState: BattleState | null,

  runSummary: string,          // AI-written summary of last completed run
  chronicle: [ChronicleEntry], // Story Page content
  keyMoments: [KeyMoment],

  dungeonMood: {
    current: 'amused'|'bored'|'delighted'|'wrathful'|'strange'|'reverent',
    score: number,             // 0–100; position within current mood
    runCarryover: number,      // partial score carried into next run (20% of current)
    lastShiftAt: timestamp,    // when mood last changed — prevents rapid flickering
    lastEventEncounterIndex: number, // cooldown — min 3 encounters between Offer/Curse events
  },

  activeConditions: [{         // Montor Offer/Curse conditions currently in effect
    type: string,              // 'no_abilities_next_encounter' | 'voluntary_damage' | etc.
    triggeredBy: string,       // 'montor_offer' | 'montor_curse'
    expiresAfter: string,      // 'next_encounter' | 'run_end'
    liftCondition: string | null,
    isMet: boolean
  }],

  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `BattleState` (nested in campaign doc)
```javascript
{
  players: {
    [uid]: {
      currentHp: number,
      maxHp: number,
      combatStats: { ...snapshotted at battle start },
      activeInventory: [Item],   // snapshotted — cannot change mid-battle
      statusEffects: [],
      initiativeRoll: number,
      isDown: boolean
    }
  },
  enemies: [{
    id, name, tier, icon,        // name is AI-generated
    currentHp, maxHp,
    stats: { str, agi, def, int },
    phase: number,               // boss multi-phase tracker
    spriteType: string           // 'rat'|'orc'|'rock'|'slug'|'wraith'
  }],
  turnOrder: [string],           // interleaved uid / enemy ids
  currentTurnIndex: number,
  round: number
}
```

### `/campaigns/{campaignId}/turns/{turnId}`
```javascript
{
  actorUid: string,             // player uid or 'enemy'
  actorName: string,
  action: string,
  targetId: string,
  diceResult: { die, roll, modifier, total },
  outcome: 'hit' | 'miss' | 'crit' | 'fumble' | 'success' | 'fail',
  narration: string,            // AI-generated, stored permanently
  timestamp: timestamp
}
```

---

## 5. Turn Enforcement

Only one entity acts at a time. `currentTurnUid` on the campaign doc is the single source of truth.

**Client:** renders Action Panel only if `currentTurnUid === currentUser.uid`

**Cloud Function** validates every action:
```javascript
exports.validateAndAdvanceTurn = onCall(async (data, context) => {
  const campaign = await db.doc(`campaigns/${campaignId}`).get();
  if (campaign.data().currentTurnUid !== context.auth.uid) {
    throw new HttpsError('permission-denied', 'Not your turn');
  }
  // Process action, resolve dice, update battleState
  // Advance currentTurnUid to next in turnOrder
});
```

No Firestore transactions needed for normal gameplay — turn system serialises all writes naturally.

---

## 6. Inventory Locking

On battle start, Cloud Function:
1. Sets `campaign.inBattle = true`
2. Snapshots each player's `inventory + equipped` into `battleState.players[uid].activeInventory`
3. Firestore Security Rules block character doc inventory writes while `inBattle: true`

Items used during battle deducted from `battleState` snapshot. On resolution, Cloud Function syncs diff back to character doc.

---

## 7. AI System & Token Management

### Core Principle: Compressed Game State, Not Full History

The AI never sees the full story or chronicle. Every call receives a **Compressed Context Object** — only what the AI needs right now.

```javascript
function buildCompressedContext(campaign, battleState, triggerType) {
  return {
    brief: campaign.brief,                   // always — ~100–300 tokens
    runNumber: campaign.currentRunNumber,    // always — tiny
    difficulty: campaign.difficulty,         // always — tiny
    mood: campaign.dungeonMood.current,      // always — 1 token; shapes entire narration voice
    trigger: triggerType,                    // always
    encounter: getCurrentEncounterSummary(), // always — ~30–50 tokens
    party: buildPartySummary(battleState),   // always — ~60–100 tokens

    // Conditional:
    enemies: isInBattle ? buildEnemySummary() : null,
    recentEvents: isNarrativeTrigger ? getRecentEventLog(5) : null,
    lastRunSummary: isRunStart ? campaign.runSummary : null,
  };
}
```

### Party Summary — Includes Faction/Deity Context

```javascript
function buildPartySummary(battleState) {
  // "Torren (Knight L8, 67/110HP [wounded], Honoured:IronVeil, Devoted:Serath, Scarred×3)"
  return Object.values(battleState.players).map(p => {
    const hpPct = p.currentHp / p.maxHp;
    const status = hpPct < 0.3 ? '[critical]' : hpPct < 0.6 ? '[wounded]' : '';
    const faction = getSignificantFactionSummary(p);  // max 2 non-neutral factions
    const deity   = getDeitySummary(p);
    const legacy  = getLegacyMarkers(p);              // scars count, embue source
    return `${p.name} (${p.class} L${p.level}, ${p.currentHp}/${p.maxHp}HP${status}, ${faction}, ${deity}${legacy})`;
  }).join(' | ');
}
```

### Token Budget Per Trigger

| Trigger | Input ~tokens | Max Output tokens | Notes |
|---|---|---|---|
| crit / fumble | 150–250 | 60 | 1–2 sentences |
| turn_result | 250–400 | 120 | 2–3 sentences |
| combat_start | 300–450 | 200 | Short paragraph |
| exploration | 350–500 | 250 | Short paragraph |
| narrative_event | 400–550 | 300 | 2 paragraphs |
| run_start | 400–600 | 400 | Opening scene |
| run_end | 500–700 | 500 | Chapter summary |
| campaign_end | 800–1200 | 800 | Full epilogue |

### Estimated Tokens Per Run

A typical run (10 encounters, 3 combats, 2 explorations, 1 rest, 1 narrative, 1 boss):
~16,000–18,000 tokens total. Well within Groq free tier for casual play.

### API Key Flow

```
User enters Groq key in Settings
        ↓
localStorage.setItem('groq_api_key', key)
        ↓
On AI trigger: key read from localStorage
        ↓
Sent via HTTPS to Cloud Function
        ↓
Cloud Function calls Groq — key never touches Firestore
        ↓
Narration returned → stored in Firestore turns collection
        ↓
Clients receive via onSnapshot
```

### Token Usage Indicator

Optional Settings toggle. Tracks `sessionTokens` in localStorage. A "Brief Narration" mode halves all output limits for token-conscious players.

---

## 8. Sprite System

All enemy and player sprites are stored as **2D grid arrays** in JavaScript — no image files. Each cell is one of: `null` (transparent), `K` (black outline), `C` (main tier colour), `S` (shadow — darker version of tier colour).

```javascript
// sprites.js — example entry
export const SPRITES = {
  orc: {
    cols: 18, rows: 24,
    grid: [
      [_, _, _, _, K, K, K, K, K, K, K, K, K, K, _, _, _, _],
      // ... 23 more rows
    ]
  },
  rat: { ... },
  rock: { ... },
  slug: { ... },
  wraith: { ... },
};

// Draw function — colour swapped at render time
export function drawSprite(canvas, spriteKey, tierColour, shadowColour) {
  const { grid, cols, rows } = SPRITES[spriteKey];
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c];
      if (!v) continue;
      ctx.fillStyle = v === 'K' ? '#000000' : v === 'C' ? tierColour : shadowColour;
      ctx.fillRect(c * PX, r * PX, PX, PX);
    }
  }
}
```

**Tier colours:**
```javascript
export const TIERS = {
  dust:    { hex: '#c8c8c8', shadow: '#888888' },
  slate:   { hex: '#6a8fa8', shadow: '#3a5a70' },
  iron:    { hex: '#4a4e52', shadow: '#222428' },
  crimson: { hex: '#6b1a1a', shadow: '#3a0a0a' },
  void:    { hex: '#111111', shadow: '#000000' },
};
```

Benefits: zero storage, infinitely scalable, colour swaps are a single variable, entire sprite sheet is a few kilobytes of JS.

---

## 9. Multiplayer Architecture

### Real-Time Sync

All players subscribe to campaign doc via `onSnapshot`. State changes push to all clients instantly.

```javascript
useEffect(() => {
  const unsub = onSnapshot(doc(db, 'campaigns', campaignId), snap => {
    setGameState(snap.data());
  });
  return unsub;
}, [campaignId]);
```

### Async Turn Notifications

When `currentTurnUid` changes, Cloud Function sends FCM push to the new active player.

### Turn Timeout

Scheduled Cloud Function checks every hour for stale turns. Default timeout: 24 hours. Inactive player skipped; party notified.

---

## 10. Security Rules

```javascript
match /characters/{charId} {
  allow read: if request.auth != null;
  allow create: if request.auth.uid == request.resource.data.uid;
  allow update: if request.auth.uid == resource.data.uid
    && !isPlayerInActiveBattle(request.auth.uid);
}

match /campaigns/{campaignId} {
  allow read: if request.auth.uid in resource.data.players[*].uid;
  allow write: if false;  // all writes via Cloud Functions only
}

match /campaigns/{campaignId}/turns/{turnId} {
  allow read: if isPartyMember(campaignId, request.auth.uid);
  allow write: if false;
}
```

All meaningful game state writes go through Cloud Functions. Clients read freely, never write directly to campaign or turn documents. All combat outcome resolution happens server-side.

---

## 11. Build Phases

### Phase 1 — Solo Foundation
Character creation, stat system, class selection. Solo campaign with basic encounter deck. Combat loop with dice UI. Groq AI narration (run_start, combat_start, turn_result, run_end). Story Page. Loot system. Item synergy detection. Sprite renderer with tier colours.

### Phase 2 — Multiplayer
Campaign lobby + Campaign Code. Turn enforcement via Cloud Function. Real-time Firestore sync. FCM push notifications for async turns. Inventory lock during battle. Cross-level party mechanics (Morale Aura, Lucky Charm). Dungeon Mood system — score tracking, mood shifts, mood-shift scenes. Basic Montor Offer and Curse events (no Strange yet).

### Phase 3 — Faction & Deity Foundation
Faction Record on character. Standing tracking from narrative events. Faction merchants at Allied+. Deity selection at Narrative Events. Devotion tracking (AI-judged alignment). Faithful/Devoted tier effects. Character arc phase reflected in AI narration.

### Phase 4 — Legacy & Embue
Standard / Legacy / Ironman death modes. Scar system. Veteran Embue (skill, relic, blessing). Novice Embue. Legacy Characters preserved read-only. AI eulogy on death. Exalted/Avatar deity tiers + Divine Intervention. Champion faction standing + Faction Legendaries.

### Phase 5 — Polish
Token usage indicator + brief narration mode. Shareable Story Page link. Faction Conflict Events in multiplayer. Faction × Deity synergies. Achievement / title system. AI-generated campaign brief option.

---

## 12. Open Questions

- [ ] Groq model: `llama-3.3-70b-versatile` (quality) vs `llama-3.1-8b-instant` (speed/cost)? Consider per-trigger — cheap model for devotion checks, better model for run_end.
- [ ] Montor Offer conditions: how large should the condition pool be at launch? Start with 6–8 well-tested conditions rather than open-ended AI generation.
- [ ] Strange Offer "type a message" mechanic: needs content moderation before the AI reads it — even light filtering required.
- [ ] Curse lift conditions: enforce via Cloud Function on every action, or check only at specific trigger points (end of encounter)? Latter is simpler.
- [ ] Basic Crawler mode toggle: per-account setting or per-campaign? Per-campaign gives more flexibility.
- [ ] Faction IDs: canonical cross-campaign IDs, or campaign-scoped with fuzzy matching on re-introduction?
- [ ] Embue validation: level gap, lifetime limits, cross-user character auth — needs careful design.
- [ ] Legacy Characters: same `/characters` collection (`status: 'legacy'`) or separate `/legacyCharacters`?
- [ ] Firestore offline persistence vs service worker caching — one strategy, documented, consistent.
- [ ] FCM web push on iOS requires PWA install — document clearly for users.
- [ ] Multiplier cap (×2): enforced client-side for display, Cloud Function for combat resolution — don't trust client math.
- [ ] Novice Embue "Carry the Story": player-written text needs length cap and light moderation before storage.

---

*Technical Architecture — v0.3 — March 2026*
