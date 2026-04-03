# ⚔️ Dungeon of Montor
## 06 — Build Plan
*Staged development from playable MVP to full game*
*v0.1 — March 2026*

---

## Guiding Principles

**Build it right once.** The data model and auth are full from day one. No throwaway scaffolding. Every stage builds on the previous without rework.

**Make it fun first.** The core loop — enter dungeon, fight, loot, level, return — must feel good before anything else is added. If the dice don't feel satisfying, nothing else matters.

**One eye on the future.** Every decision made in Stage 1 should accommodate Stage 4. No dead ends.

**Separate concerns clearly.** Basic Crawler (deterministic mechanics) and Montor (AI narrative) are distinct layers. The crawler works without Montor. Montor enriches a working crawler.

---

## The Five Stages

```
Stage 1 — The Crawl         Solo. One character. One class. Playable dungeon loop.
Stage 2 — The Tavern        Pre-game hub. Named persistent character. Multi-class.
Stage 3 — The Party         Multiplayer. Friends join. Async turns.
Stage 4 — Montor Awakens    AI narrative layer. Mood system. Offers and Curses.
Stage 5 — The Long Game     Factions, deities, legacy, embuing. Cross-campaign depth.
```

Each stage is a shippable, playable game. Each one is better than the last.

---

## Stage 1 — The Crawl
*Goal: a working solo dungeon loop you can actually play*

### What Gets Built

**One character, one class — the Knight.**
Knight is the right starting class: high HP, straightforward mechanics, no spell system to build. The simplest combat case. Everything else is built around making the Knight work, then other classes are variations on that foundation.

**Character is temporary in Stage 1.** Stats are generated at run start, not persisted. Each playthrough starts fresh. This is intentional — you're testing the loop, not the persistence.

**One run = one session.** Fixed encounter count (8 encounters + 1 boss). No campaign structure yet. Enter, fight, exit. Did it feel good?

**Encounters:**
- Combat (enemies: all 5 types, Dust and Slate tiers only)
- Rest (HP recovery, no narrative)
- Merchant (buy potions with gold, flat items only)
- Boss (fixed Void-tier Orc to end every run)

**Combat system — full from day one:**
- Initiative roll (d20 + AGI)
- Turn order displayed
- Attack action only (no spells, no flee in Stage 1 — keep it tight)
- d20 + STR vs enemy DEF TN
- Damage calculation with DEF reduction
- Critical hits (×2 damage) and fumbles (lose turn)
- Enemy auto-turn (simple attack logic, no AI)
- Downed state + run failure on full party wipe
- Post-combat loot roll (d100 + LCK → rarity)

**Items — subset only:**
- 3 weapon types (Dagger, Shortsword, Longsword)
- 2 armour types (Leather, Chainmail)
- 3 consumables (Health Potion, Rage Draught, Smoke Bomb)
- 2 flat relics (Ring of Vitality, Lucky Coin)
- No multiplier items, no synergies yet

**Stats — full 14 implemented but Knight auto-build:**
- Player distributes 70 points freely
- No level up in Stage 1 — character is flat for the run
- All 14 stats present in data model (future-proofed)

**UI — View tab only:**
- Scene header
- Situation text (placeholder text, no AI yet — simple coded descriptions)
- Action buttons (Attack / Use Item)
- Target selection
- Dice roll moment
- Result + basic narration text (coded strings, not AI)
- Loot reveal post-combat
- Run summary on boss defeat

**No bottom nav yet.** Just the game screen. Everything needed is on one view.

**Sprites:**
- All 5 enemy sprites implemented and rendering
- Tier colour system working
- Knight sprite placeholder (simple shape is fine)

### What Gets Architected (Even If Not Used Yet)

The following are built correctly even though Stage 1 doesn't fully use them:

- **Firebase Auth** — full sign-in. Even Stage 1 has accounts. Temporary characters are still tied to a UID.
- **Firestore data model** — full character schema, full campaign schema, even if most fields are empty. No shortcuts.
- **Cloud Function for turn validation** — even in solo play, actions go through the function. Establishes the pattern.
- **`inBattle` flag and inventory lock** — implemented from day one even if only one player.
- **Sprite render system** — full `drawSprite(canvas, type, tierColour, shadowColour)` function in `sprites.js`.
- **Dice library** — all dice (`d4` through `d100`), modifier calculations, crit/fumble detection, all in `dice.js`.
- **Combat library** — full attack resolution, damage calc, initiative. In `combat.js`.
- **Loot library** — full rarity table, item generation by type. In `loot.js`.

### Stage 1 Done When

- [ ] Can create an account and start a run
- [ ] Combat feels good — dice animate, crits feel special, fumbles sting
- [ ] Can die (party wipe) and it feels meaningful
- [ ] Can complete a run (defeat the boss)
- [ ] Loot drops make sense and feel rewarding
- [ ] Run summary shows what happened

### Known Limitations in Stage 1

- No persistence between runs
- No levelling
- No narrative (placeholder text only)
- Solo only
- One class
- No bottom nav / other tabs

---

## Stage 2 — The Tavern
*Goal: persistent character, the pre-game hub, multi-class, levelling*

### The Tavern

The Tavern is the pre-game area — where players exist between runs. It's a home screen with personality. Everything that isn't the dungeon happens here.

**Tavern screens:**

**Character Creation**
- Name your character
- Choose class (Stage 2 adds: Ranger, Mage, Rogue — 4 classes total)
- Distribute 70 stat points (with class minimums suggested)
- Character saved to Firestore permanently

**Character Sheet**
- View all stats, current level, XP progress
- View inventory and stash
- View scars and titles (empty at first — but the fields are there)
- View equipped gear

**Run Setup**
- Choose difficulty (Novice / Seasoned / Veteran / Legendary)
- Choose run length (Short: 6 encounters / Standard: 10 / Long: 14)
- Enter dungeon button

**Run History**
- List of completed runs with outcome, XP earned, notable loot
- Placeholder for Story Page (Stage 4)

### Persistence

Characters now persist between runs. After a run ends:
- XP awarded to character doc
- Level up triggers if threshold crossed
- Loot carried over to stash
- Equipped gear retained
- Scars written if character was Downed

**Levelling — full system:**
- XP thresholds implemented
- On level up: HP increase, auto-skill gains, free skill points UI
- Ability unlocks every 5 levels (Knight abilities first, then others)
- Max skill cap (`Level + 10`) enforced

**Death Mode selection** — Standard or Ironman per character (not per run). Set at character creation, cannot be changed.

### Additional Classes

Add Ranger, Mage, Rogue. Each requires:
- Class-specific auto-skills
- Class-specific ability pool (unlocks at L5, L10 etc.)
- Ranger and Rogue: AGI-based attacks implemented
- Mage: spell system introduced (INT-based, uses same d20 roll, different damage dice)

### Additional Items

- Full weapon set (all 10 weapons)
- Full armour set (all 6 armour types)
- Multiplier relics introduced (Blood Signet, Arcane Lens)
- Consumable expansion (full list)

### UI Expansion

Bottom nav appears. All 5 tabs present:
- View (game)
- Party (solo for now — just your character)
- Stats (full character sheet)
- Inventory (gear management, stash access out of combat, lock during combat)
- Story (run history placeholder)

Inventory lock UI implemented — *"Battle Active — Inventory Locked"* banner.

### Stage 2 Done When

- [ ] Character persists across multiple runs — gains XP, levels up
- [ ] Character creation feels meaningful — stat distribution matters
- [ ] 4 classes play noticeably differently
- [ ] Levelling feels rewarding
- [ ] Inventory tab works — can manage gear, see what's equipped
- [ ] Can play 5 runs with the same character and feel them growing

---

## Stage 3 — The Party
*Goal: multiplayer, friends joining, async turns, the social loop*

### Campaign Structure

Runs become **Campaigns** — the full season/episode structure.

- Campaign has a name, difficulty, and run count
- Each run is one session with 5–15 encounters
- Completing a run advances campaign state
- Boss at end of each run
- Campaign boss at final run (harder, better rewards)

### The Tavern — Multiplayer Layer

**Create Campaign:**
- Campaign Master sets name, difficulty, run length, player slots (2–6)
- Gets a shareable **Campaign Code**
- Writes a **Campaign Brief** (text field — no AI yet, just stored for Stage 4)

**Join Campaign:**
- Enter Campaign Code
- Select your persistent character
- Lobby screen shows who's joined, their character names and levels
- CM starts when ready

**Party Screen:**
- All players' HP, status, turn order — live via Firestore `onSnapshot`
- Initiative order during combat
- Who's turn it is, clearly

### Turn System

Full multiplayer turn enforcement:
- `currentTurnUid` on campaign doc
- Action Panel only renders for the active player
- All other players see Spectator Feed on View tab
- FCM push notifications when your turn starts
- Turn timeout: 24 hours default (configurable per campaign)
- Auto-skip on timeout

### Cross-Level Party

Morale Aura and Lucky Charm mechanics active:
- Lower-level character in party gives +1 to all skill checks while alive
- Highest LCK in party contributes full LCK modifier to loot rolls

### Healing Other Players

- Cleric added (and Berserker, Orc Warchief, Bard, Druid, Paladin — all 10 classes)
- Heal actions can target any party member
- Item trading during Rest encounters

### Async Play

- Players can take turns hours apart
- Push notification fires when it's your turn
- Campaign state saved perfectly between actions — can close app entirely

### Stage 3 Done When

- [ ] Two players can play a full campaign together
- [ ] Async works — one player takes their turn, other gets notified, takes theirs hours later
- [ ] Spectator feed shows clearly what just happened on another player's turn
- [ ] Turn timeout and auto-skip works
- [ ] Different classes in a party feel complementary
- [ ] Campaign completes across multiple runs with persistent characters

---

## Stage 4 — Montor Awakens
*Goal: AI narrative layer, dungeon mood, Offers and Curses*

### Basic Crawler → Montor Mode

Stage 4 introduces the AI as an optional layer. Basic Crawler still works exactly as before. Montor Mode is enabled per-account in Settings via a Groq API key.

**When Montor is disabled:**
- Encounter descriptions use coded placeholder text
- Story Page shows run summary (structured data, no prose)
- Mood system runs silently — only affects loot rolls
- Offer/Curse events replaced by standard Narrative Events

**When Montor is enabled:**
- All narration AI-generated via Groq
- Campaign Brief feeds into all AI calls
- Mood system fully active — named moods, shift scenes, direct address
- Offer/Curse events fire at threshold moods
- Story Page generates prose chronicle

### AI Integration

Full compressed context system:
- Campaign Brief (always)
- Current mood (always — 1 token)
- Party summary with faction/deity tier (always)
- Conditional: enemies, recent events, run summary
- Token budget per trigger type enforced

Mood shift scenes between encounters.

### Narrative Encounters

Exploration and Narrative Event encounters now have AI descriptions. Skill checks have AI-flavoured outcomes. Rest encounters have AI atmosphere. Merchant NPCs have names.

### The Story Page

- Live chronicle built from AI narration during play
- Key moments tagged
- Shareable link
- Readable without an account

### Campaign Brief

- Text field in Create Campaign is now actually used
- Brief injected into every AI call
- Or: "Generate a brief for me" button — AI writes one based on style prompts

### Offer/Curse Events

Full system as specced in Section 13 of the Mechanics doc:
- Montor's Offer (Delighted/Reverent)
- Montor's Curse (Wrathful)
- The Strange Offer (score 86+)
- Condition enforcement via Cloud Function
- Lift conditions tracked and checked

### Stage 4 Done When

- [ ] Can play a full campaign with Montor enabled and narration feels alive
- [ ] Campaign Brief meaningfully changes how the dungeon is described
- [ ] Mood shifts feel noticeable — narration tone clearly changes
- [ ] Received at least one Offer and one Curse in testing
- [ ] Story Page at end of campaign reads like a short story
- [ ] Basic Crawler mode still works perfectly without a Groq key

---

## Stage 5 — The Long Game
*Goal: factions, deities, legacy, embuing, cross-campaign depth*

### Factions

- Faction Record on character — persists across all campaigns
- Standing tracking from Narrative Event choices
- Faction merchants at Allied+ standing
- Faction-exclusive gear (flat at Allied, multiplier at Honoured, Legendary at Champion)
- Faction Conflict Events in multiplayer
- Blood Enemy assassination events

### Deities

- Deity selection at Narrative Events
- Devotion tracking 0–1000 via AI-judged alignment
- Faithful → Devoted → Exalted → Avatar tier effects
- Divine Intervention (once per campaign at Exalted)
- Renunciation events

### Item Synergies

- Full synergy detection on character sheet
- Weapon + Relic synergies
- Armour + Relic synergies
- Triple synergies (Legendary-tier combinations)
- Faction × Deity synergies

### Legacy & Embuing

- Standard / Legacy / Ironman death modes (Ironman introduced here — Stage 1–4 use Standard only)
- Legacy Characters preserved read-only on death
- Veteran Embuing (Level 20+): skill, relic, blessing transfers
- Novice Embuing: fortune's touch, inspired, carry the story
- AI eulogy on Legacy/Ironman death

### Character Arc

- Character phase display (Wanderer → Known → Established → Legend)
- Faction/deity synergy bonuses at Honoured + Devoted simultaneously
- AI references character history in narration — scars, titles, faction standing

### Stage 5 Done When

- [ ] Character played through 10+ runs has visible history in UI
- [ ] Faction standing changes how NPCs are described in AI narration
- [ ] At least one character has reached Devoted deity tier
- [ ] Veteran Embue successfully transfers a relic to a lower-level character
- [ ] Story Page at end of Stage 5 campaign reads like a proper saga

---

## The Tavern — Full Vision

The Tavern is worth designing fully even in Stage 1 as a shell, because it shapes everything else. Here's what it grows into across stages:

### Stage 1 (Shell)
```
[ Home ]  →  Start Run  →  [ Dungeon ]
```
Minimal. Just enough to get in.

### Stage 2 (Character)
```
[ Tavern ]
  ├── My Character (stats, gear, history)
  ├── Start Run (difficulty, length)
  └── Settings (display, preferences)
```

### Stage 3 (Social)
```
[ Tavern ]
  ├── My Character
  ├── My Campaigns (active + past)
  ├── Create Campaign (brief, difficulty, code)
  ├── Join Campaign (enter code)
  ├── Campaign Lobby (party, ready up)
  └── Settings
```

### Stage 4 (Montor)
```
[ Tavern ]
  ├── My Character (with scars, titles visible)
  ├── My Campaigns
  │     └── Each campaign has Story Page link
  ├── Create Campaign (brief + AI brief generator)
  ├── Join Campaign
  ├── Campaign Lobby
  └── Settings (Groq API key, narration mode)
```

### Stage 5 (Full)
```
[ Tavern ]
  ├── My Character
  │     ├── Stats + gear
  │     ├── Faction Standing (all known factions)
  │     ├── Deity Devotion
  │     ├── Legacy & Embues
  │     └── Career Chronicle (all campaigns)
  ├── My Campaigns
  ├── Create / Join Campaign
  ├── Legacy Characters (retired/dead — read only)
  └── Settings
```

---

## Data Model — Day One

Even in Stage 1, build the full data model. Empty fields are fine. Reworking the schema later is not.

**What must be right from day one:**
- Character doc has all 14 stat fields
- Character doc has `factionRecord`, `deity`, `legacy` objects (empty initially)
- Campaign doc has `dungeonMood` object
- Campaign doc has `activeConditions` array
- Campaign doc has `brief` field (empty string initially)
- All writes go through Cloud Functions — no direct client writes to campaign or turn docs
- `inBattle` flag exists and is checked

**What can wait:**
- Faction record being populated (Stage 5)
- Deity devotion being tracked (Stage 5)
- `activeConditions` being evaluated (Stage 4)
- `brief` being used in AI calls (Stage 4)

---

## Technology Decisions — Fixed

These don't change across stages:

| Decision | Rationale |
|---|---|
| React PWA | Mobile-first, installable, no app store |
| Firebase Auth | Already using Firebase; email + Google |
| Firestore | Real-time sync; `onSnapshot` for multiplayer |
| Cloud Functions | All game writes server-side from day one |
| localStorage for Groq key | Simple, private, per-device |
| Sprites as canvas arrays | Zero assets; instant load; colour swap free |
| Uncial Antiqua + Sorts Mill Goudy | Set in Stage 1, never changed |
| `#09080a` background | Set in Stage 1, never changed |

---

## Stage 1 — Detailed Sprint Breakdown

Stage 1 is the most important to get right. Suggested sprint order:

**Sprint 1 — Foundation**
- Firebase project setup (Auth, Firestore, Functions, Hosting)
- React PWA scaffold (manifest, service worker, mobile viewport)
- Design system in CSS (colours, fonts, all tokens)
- Firebase Auth — email sign-in working
- Basic routing (Home → Game → Results)

**Sprint 2 — Sprites & Dice**
- `sprites.js` — all 5 enemy grids + draw function
- Tier colour system working
- `dice.js` — all dice, modifiers, crit/fumble detection
- DiceRoller component — animation, wobble, result reveal
- Manual test: roll dice, see them animate, feel right

**Sprint 3 — Combat Engine**
- `combat.js` — attack resolution, damage calc, initiative
- Cloud Function: `validateAndAdvanceTurn`
- Enemy auto-turn logic (simple: attack random living player)
- `inBattle` flag + inventory lock
- BattleState snapshot on encounter start
- Manual test: full combat encounter works end to end

**Sprint 4 — Items & Loot**
- `loot.js` — rarity table, item generation
- Stage 1 item set (3 weapons, 2 armours, 3 consumables, 2 relics)
- Post-combat loot reveal
- Basic inventory — equip/unequip
- Manual test: complete a combat, get loot, equip it, feel stronger

**Sprint 5 — The Run**
- Encounter deck (weighted, shuffled)
- Rest encounter (HP recovery)
- Merchant encounter (buy potions)
- Run progression (8 encounters + boss)
- Run summary screen
- Manual test: complete a full run start to finish

**Sprint 6 — Polish & Feel**
- View tab screen states (your turn, result, loot)
- Coded placeholder narration strings (atmospheric, not generic)
- HP bars, damage floats, entity shake/flash
- Run failure (all Downed) — game over screen
- Manual test: play 5 runs, does it feel like a game?

---

## Success Metrics Per Stage

| Stage | Question to answer |
|---|---|
| 1 | Does the core loop feel fun? Would you play another run? |
| 2 | Does your character feel like *yours*? Do you care about levelling? |
| 3 | Is playing with a friend better than playing alone? |
| 4 | Does the AI make it feel alive? Does the dungeon have a personality? |
| 5 | Do you feel the weight of your character's history? Does it feel like a legend? |

---

## Rough Timeline Estimate

*Assuming solo developer, part-time. Adjust to your reality.*

| Stage | Estimated Time |
|---|---|
| Stage 1 | 4–6 weeks |
| Stage 2 | 3–4 weeks |
| Stage 3 | 4–5 weeks |
| Stage 4 | 3–4 weeks |
| Stage 5 | 5–8 weeks |
| **Total** | **~20–27 weeks** |

Stage 3 (multiplayer) is the most technically risky. Stage 4 (AI) is the most unknown in terms of prompt tuning. Stage 5 is the most feature-heavy but least architecturally complex — by then the patterns are established.

---

## What to Hand to Claude Code

When you're ready to start building, give Claude Code:

1. This build plan doc (06)
2. The technical architecture doc (03) — full data model and stack
3. The UI specification doc (04) — tab structure and screen states
4. The game mechanics doc (02) — dice, combat, items
5. The sprite sheet HTML (06_Sprite_Sheet.html) — enemy grid data to extract
6. The conditions spec (07) — full Body/Mind/Soul condition system, persistence rules, gold banking
7. The dungeon architecture doc (08) — floor themes, room types, environmental mechanics
8. Tell it: *"Start with Stage 1 Sprint 1. Build the Firebase scaffold and design system. Do not build features from later stages."*

The constraint on scope is important. Claude Code will want to build everything. Your job is to hold the line on stages.

---

*Build Plan — v0.1 — March 2026*
