# Dungeon of Montor — 08: Dungeon Architecture & World Structure
**Version:** 0.3 Draft
**Date:** March 2026
**Status:** Concept reference — zone counts and chamber detail TBD by designer

---

## 1. Core Principle

The dungeon is always a dungeon. Stone walls, iron doors, torchlight, medieval dark. Every floor shares this base visual language. What changes per zone is its *function* — the purpose of that part of Montor's lair bleeds through the dungeon aesthetic on top.

Not a modern kitchen. A dungeon kitchen — cauldrons, hanging carcasses, massive hearths, rats.
Not a bedroom. A dungeon boudoir — chains, candelabras, moth-eaten tapestries.
Not a boiler room. A dungeon undercroft — stone pipes, furnaces, scalding vents.

The dungeon is the constant. The zone's purpose is the twist.

---

## 2. Hierarchy

```
Dungeon
└── Floor  (named, numbered — one per depth level)
    └── Zone  (thematic sub-areas within the floor — count TBD per floor)
        └── Chamber  (always 16 per zone — 4x4 grid)
```

### Floor
A named depth level of the dungeon. Each floor contains one or more zones. Floor numbering descends (0, -1, -2 etc — you are going down into Montor's lair). Floors are hardcoded — they do not change run to run.

### Zone
The primary exploration unit. Each zone is a distinct thematic area within its floor — e.g. the Kitchen and the Great Hall are both zones on Floor -1. Each zone is a 4x4 grid of 16 chambers. Zone contents shuffle each run; the zone itself is fixed.

### Chamber
The atomic unit. 16 per zone always. Types drawn from the zone's template pool, positions shuffled each run, doors generated via maze algorithm (all 16 always reachable).

---

## 3. Floor & Zone Reference

> Zone counts marked TBD — to be decided by designer. Examples given as starting point only.

| Floor | Name | Zones (examples) | Notes |
|---|---|---|---|
| 0 | **The Grounds** | Montor's Garden | Above ground. One zone. Entry point. |
| -1 | **The Underground** | The Great Hall, The Kitchen | Two zones. Introductory underground floors. |
| -2 | **The Underbelly** | The Trash Level, The Sewers (TBD) | Filth and gas. Zone count TBD. |
| -3 | **The Quarters** | The Boudoir, The Bathing House | Sleep and water mechanics. Zone count TBD. |
| -4 | **The Works** | The Boiler Room, The Furnace (TBD) | Heat mechanics. Zone count TBD. |
| -5 | **The Deep** | The Caverns, The Fissures (TBD) | Darkness mechanics. Zone count TBD. |
| -6 | **The Veins** | The Air Vents | Tight traversal. Die Hard / Alien flavour. |
| -7 | **Montor's Domain** | Montor's Zone | Mood-dependent. Changes run to run. |

---

## 4. Zone Characteristics

Each zone has its own:
- Environmental effect (active on all chambers within it)
- Enemy roster (which enemy types can appear)
- Chamber template pool (which chamber types are in the 16)
- Connecting route type to adjacent zones (locked door or connecting zone)
- Narrative tone and Groq prompt seed

### Environmental Effects by Zone (examples)

| Zone | Effect | Mechanical Impact |
|---|---|---|
| Montor's Garden | `DAY_NIGHT` cycle, `HIGH_POLLEN` | Night spawns change; pollen affects certain enemies/conditions |
| The Kitchen | `NO_REGEN` | HP regen from items and purchase disabled |
| The Trash Level | `SMOG` | Passive stat impact; visibility reduced |
| The Boudoir | `DROWSY` | % chance forced rest each turn |
| The Bathing House | `FLOODED` | Drowning risk; water breathing required for full effectiveness |
| The Boiler Room | `INTENSE_HEAT` | BURNING condition applies passively over time |
| The Caverns | `DARKNESS` | Visibility severely limited; torches become key items |
| The Air Vents | `TIGHT_SPACE` | Movement rules altered; ambush chance increased |
| Montor's Domain | Mood-dependent | Generated from Montor's current state each run |

---

## 5. Navigation

### Floor to Floor
Players descend floor by floor. Descent requires finding and using the stairwell chamber, which may require clearing a zone boss or obtaining a key.

### Zone to Zone (within a floor)
Two connection types:

**Locked Door** — requires a key item or lockpick. Key may be held by a boss, found in loot, or purchased. Forces engagement before progressing. Lockpick mechanic deferred.

**Connecting Zone** — enemy-filled traversal route. No key required. Risky bypass. Minimal loot. Floor-specific flavour:

| Floor | Connecting Zone Type | Flavour |
|---|---|---|
| The Grounds | Overgrown tunnels | Roots, soil, insects |
| The Underground | Service passages | Rats, grease |
| The Underbelly | Sewer pipes | Slugs, gas |
| The Deep | Natural fissures | Darkness, bats |
| The Veins | Stone ducts | Die Hard / Alien — ambush-heavy |

Connecting zones are a later build feature. Locked door is first implementation.

### Chamber to Chamber (within a zone)
After a chamber resolves, available doors shown as selectable options — same tap/click pattern as enemy selection. Player chooses direction.

---

## 6. Chamber Types

| Type | Description | Notes |
|---|---|---|
| **Combat — Standard** | Enemy encounter | Most common |
| **Combat — Elite** | Harder encounter | Rarer |
| **Mini Boss** | Named tougher enemy | ~1 per zone |
| **Boss** | Zone boss — required for key/stairwell | 1 per zone |
| **NPC — Merchant** | Shop, floor-themed inventory | |
| **NPC — Quest** | Scripted character encounter | Zone-specific variants |
| **Shrine** | Deity shrine — blessings / curses | |
| **Trap** | Trap-based challenge, few or no enemies | |
| **Loot** | Chest or item cache | Often locked |
| **Rest** | Safe room — HP regen, no enemies | Absent in Kitchen zone |
| **Stairwell — Entry** | Arrival point from above | Always safe |
| **Stairwell — Descent** | Down to next floor | May be locked |
| **Connecting Zone Entrance** | Access to bypass route | Later build |
| **Event** | Montor intervention / scripted moment | |
| **Hidden** | Concealed — detection or item required | |

---

## 7. Garden Floor — Worked Example

**Floor 0: The Grounds**
**Zone: Montor's Garden**
**Narrative hook:** *You leave the [Tavern TBD], follow the winding path, and arrive at the outer walls of Montor's estate. The garden is wild, overgrown, and strangely alive.*
**Active effects:** `DAY_NIGHT`, `HIGH_POLLEN`

Sample 16-chamber pool:

| # | Type | Notes |
|---|---|---|
| 1 | Stairwell — Entry | Arrival from tavern. Always safe. |
| 2 | Rest | Ruined gazebo |
| 3 | Combat — Standard | Day variant |
| 4 | Combat — Standard | Day variant |
| 5 | Combat — Standard | Day variant |
| 6 | Combat — Elite | Day variant |
| 7 | Combat — Standard | Night only — dormant during day |
| 8 | Combat — Standard | Night only — dormant during day |
| 9 | Mini Boss | Overgrown topiary guardian (name TBD) |
| 10 | NPC — Merchant | Wandering vendor |
| 11 | NPC — Quest | Trapped gardener / wounded traveller |
| 12 | Trap | Overgrown tripwires, pit traps under leaves |
| 13 | Loot | Hidden cache in hedgerows |
| 14 | Event | Montor intervention |
| 15 | Hidden | Concealed behind foliage — detection required |
| 16 | Stairwell — Descent | To Floor -1. Locked until Mini Boss cleared. |

---

## 8. Firebase Data Architecture

Everything content-related lives in Firestore. The engine reads and references it at runtime. Adding a floor, zone, or enemy = add/edit Firestore documents. No code deploy needed for content changes.

### Collection Structure

```
/floors/{floorId}
    /zones/{zoneId}
        /chamberTemplates/{templateId}

/enemies/{enemyId}
/npcs/{npcId}
/events/{eventId}
/lootTables/{tableId}
/zoneEffects/{effectId}
/defaultValues/{valueId}          <- base balance values, resettable

/runs/{runId}                     <- active run state per session
    /grid/{chamberId}             <- run-time generated grid with door states

/characters/{characterId}         <- persistent character data across runs
```

### Document Examples

**Floor** `/floors/grounds`
```json
{
  "id": "grounds",
  "name": "The Grounds",
  "order": 0,
  "zones": ["montors_garden"],
  "narrativeHook": "You leave the tavern and follow the winding path...",
  "groqPromptSeed": "Narrate a wild overgrown castle garden at dusk..."
}
```

**Zone** `/floors/grounds/zones/montors_garden`
```json
{
  "id": "montors_garden",
  "name": "Montor's Garden",
  "floorId": "grounds",
  "activeEffects": ["DAY_NIGHT", "HIGH_POLLEN"],
  "chamberTemplatePool": ["entry_stairwell", "rest_gazebo", "combat_standard_day"],
  "connectingZones": [],
  "lockedDoorTo": null
}
```

**Chamber template** `/floors/grounds/zones/montors_garden/chamberTemplates/combat_standard_day`
```json
{
  "id": "combat_standard_day",
  "type": "combat_standard",
  "activeCondition": "DAY",
  "enemyRosterIds": ["rat", "crow", "garden_slug"],
  "enemyCountMin": 1,
  "enemyCountMax": 3,
  "lootTableId": "garden_standard",
  "npcId": null,
  "eventId": null,
  "isSafe": false,
  "isHidden": false
}
```

**Enemy** `/enemies/rat`
```json
{
  "id": "rat",
  "name": "Rat",
  "tier": 1,
  "tierColour": "Dust",
  "spriteId": "rat_sprite",
  "stats": { "hp": 8, "atk": 3, "def": 1, "agi": 4 },
  "floorsAllowed": ["grounds", "underground", "underbelly", "deep"],
  "zonesAllowed": [],
  "chamberTypesAllowed": ["combat_standard", "combat_elite"],
  "conditionsCanApply": ["BLEED", "NAUSEA"],
  "conditionChance": 0.15,
  "lootTableId": "rat_loot",
  "xpValue": 5,
  "groqDescriptor": "scrawny, aggressive, travels in packs"
}
```

**Active run grid chamber** `/runs/{runId}/grid/7`
```json
{
  "chamberId": 7,
  "templateId": "combat_standard_day",
  "zoneId": "montors_garden",
  "floorId": "grounds",
  "doors": { "N": true, "S": false, "E": true, "W": true },
  "cleared": false,
  "visited": false,
  "lootClaimed": false
}
```

### Key Principles
- **Templates are immutable** — chamber templates never change. Run-time state lives in the run document only.
- **Enemy availability is data-driven** — `floorsAllowed` and `zonesAllowed` arrays control where enemies appear. No code change to add an enemy to a new zone.
- **Run state is isolated** — each run is its own document tree. Clean deletion on run end.
- **Groq gets the data object** — active chamber + floor/zone context passed directly as narrative context.

---

## 9. Enemy Roster by Zone

Tier colours match the sprite tier system from `05_Characters_and_Assets.md`. All names are placeholders.

| Enemy | Tier | Colour | Floors / Zones | Notes |
|---|---|---|---|---|
| Rat | 1 | Dust | Grounds, Underground, Underbelly, Deep | Ubiquitous. |
| Crow | 1 | Dust | Grounds (Garden only) | Flying type. |
| Garden Slug | 1 | Dust | Grounds, Underbelly | Slow. Applies NAUSEA. |
| Orc | 2 | Slate | Underground, Works | Brawler. Applies DREAD. |
| Rock Monster | 2 | Slate | Deep, Works | High DEF. Slow. |
| Large Slug | 2 | Slate | Underbelly, Quarters | Applies HEXED. |
| Wraith | 3 | Iron | Deep, Quarters, Montor's Domain | Applies HAUNTED on kill without correct item. |
| Kitchen Brute | 3 | Iron | Underground (Kitchen only) | Thermal resistance. |
| Sewer Fiend | 3 | Iron | Underbelly, Quarters | Gas-based attacks. |
| Vent Crawler | 3 | Iron | Veins | Ambush specialist. |
| Boiler Daemon | 4 | Crimson | Works, Montor's Domain | BURNING on hit. |
| Nightmare | 4 | Crimson | Quarters, Deep | Sleep-based attacks. |
| Montor's Guard | 5 | Void | Montor's Domain | Unique. Composition varies by Montor's Mood. |

---

## 10. Admin Tool (Montor's Console)

A separate web-based admin interface for managing and updating Firestore content without touching code. Access restricted to admin/designer.

### Core Features
- **Browse and edit** all Firestore documents — floors, zones, chamber templates, enemies, loot tables, effects
- **Default values store** — every balance-sensitive value has a stored default. One-click reset to default at any granularity (single value, enemy, zone, or full reset)
- **Balance monitoring** — passive logging of run outcomes fed into a simple dashboard:
  - Deaths per zone / chamber type
  - Average run depth reached
  - Most/least used items
  - Condition application rates
  - Enemy kill rates vs flee/death rates
- **Outcome analysis** — flag outliers automatically (e.g. if one chamber type has 3x the death rate of others, surface it)
- **Multiplayer difficulty scaling** — default values for enemy stats, spawn counts, and loot rates have multiplayer modifiers stored alongside single-player defaults. When player count > 1, modifiers apply automatically. Designer sets the scaling factor per value, not per enemy.

### Default Values Document Example
```json
{
  "id": "rat_defaults",
  "entityId": "rat",
  "defaults": {
    "hp": 8,
    "atk": 3,
    "def": 1,
    "agi": 4,
    "conditionChance": 0.15,
    "xpValue": 5
  },
  "multiplayerModifiers": {
    "2_players": { "hp": 1.2, "atk": 1.1 },
    "3_players": { "hp": 1.5, "atk": 1.25 },
    "4_players": { "hp": 1.8, "atk": 1.4 }
  }
}
```

### Build Notes
- Simple React web app, Firebase Auth for access control
- Reads/writes directly to Firestore
- Balance dashboard uses Firestore run log collection
- Build deferred — single player game ships first

---

## 11. Single Player First / Multiplayer Later

The base game is single player. Multiplayer is a later addition built on top of a stable core.

**Why single player first:**
- Core loop (combat, exploration, conditions, Montor) must be tight and balanced before adding sync complexity
- Easier to balance — one set of variables, not four
- Multiplayer introduces features that don't exist in single player — better designed once the base is understood

---

### Multiplayer Modes (two only — for simplicity)

**Mode 1: Coop vs AI Montor**
2–4 players in the dungeon together. Groq runs Montor as normal. Party mechanics layered on top of the single player experience. Likely the most common multiplayer mode.

**Mode 2: 1v1 — Human Montor vs Solo Player**
One player in the dungeon. One player as Montor via Montor's Console. Human Montor is always 1v1 — tracking a full party while operating the console would be unmanageable and unfun for the Montor player. Clean rule, solves complexity entirely.

There is no "human Montor vs full party" mode. Too complex to be enjoyable for the Montor player.

---

### Multiplayer Unlocks Multiplayer-Specific Features

Multiplayer is not the same game with more people. It unlocks mechanics that do not exist in single player:

| Feature | Mode | Notes |
|---|---|---|
| Dual keystone puzzles | Coop | Two switches in separate chambers pressed simultaneously to open stairwell |
| Loot sharing + Naughty Stat | Coop | Who gets the chest — and what happens if you're selfish |
| Montor's Console (player role) | 1v1 | Human Montor with limited dungeon information |
| Party UI — multiple characters in chamber | Coop | Visual and turn-order implications |
| Faction/allegiance divergence | Coop | Party members may have conflicting deity allegiances |
| Split party exploration | Coop | Advanced — deferred, may come much later |

---

### Player Persistence in Multiplayer

Characters carry their full persistent data into multiplayer runs unchanged:
- Level and max HP
- Soul conditions
- Heirlooms
- Banked gold (individual — not shared)

The run scales to the group via difficulty modifiers, not by resetting or adjusting characters. Each player's character is their own — persistence is individual, not session-based.

---

### Multiplayer Difficulty Scaling

When player count > 1, enemy stats and spawn counts apply multiplayer modifiers from the defaults store (see Section 10). Montor's AI behaviour also scales — he becomes more active at higher player counts.

| Players | Scaling approach |
|---|---|
| 1 | Baseline |
| 2 | Modest increase — enemy HP and atk modifiers |
| 3 | Medium increase |
| 4 | Full scaling — designed as a distinct challenge |

Exact modifier values set in True Admin and tunable without code deploy.

---

## 12. Open Questions

- [ ] Zone counts per floor — TBD per floor
- [ ] Does Great Hall need its own environmental mechanic distinct from Kitchen?
- [ ] Flying mob combat mechanics — height/flight rules
- [ ] Water breathing — item, blessing, or character trait?
- [ ] Torch system scope for Caverns / Darkness mechanic
- [ ] Can environmental effects be fully countered or only mitigated?
- [ ] Naughty Stat downstream effects and thresholds
- [ ] Admin tool build priority — before or after single player launch?
- [ ] Balance logging — what run events to log from day one?
- [ ] Tavern name

---

## 13. Montor's Console — Full Concept

Three distinct access tiers share the same underlying Firebase architecture but have different permissions, UI, and purpose.

---

### 13a. True Admin (owner/designer only)

Unrestricted access. The god-mode layer. Used for content creation, balance tuning, and data management. Never accessible to players.

**Capabilities:**
- Full read/write on all Firestore collections — floors, zones, chamber templates, enemies, loot tables, effects, conditions
- Default values management — every balance-sensitive value has a stored default. Reset at any granularity: single value, enemy, zone, full world reset
- Balance monitoring dashboard — run outcome logs surfaced as metrics:
  - Deaths per zone / chamber type
  - Average run depth reached
  - Most/least used items
  - Condition application rates
  - Enemy kill rates
- Outlier flagging — automatic alerts when a value is statistically anomalous (e.g. one chamber type has 3x the death rate of others)
- Multiplayer difficulty modifier management — scaling values per player count stored alongside single-player defaults

---

### 13b. Montor's Console (in-game — Montor role, multiplayer)

When a human player takes the Montor seat in multiplayer, the standard combat/exploration UI is replaced entirely with Montor's Console. This is not a spectator view — it is a control panel.

**What Montor sees (deliberately limited):**
Montor is omnipresent but not omniscient. He feels the dungeon, senses the players, knows outcomes — but does not watch fights unfold blow by blow. He has no god-mode map. He makes decisions on incomplete information, the same as the dungeon players.

| Montor sees | Montor does NOT see |
|---|---|
| Which chamber the party is in | Individual dice rolls |
| Chamber type (combat / rest / loot etc.) | Specific enemies in the room |
| Battle outcome (won / fled / player died) | Item usage details |
| Player basic stats (HP %, level, Soul condition) | Loot contents claimed |
| Current zone and floor | Party internal chat |
| Active conditions on players (slot only — Body/Mind/Soul) | Exact inventory |
| Run duration and depth reached | |

**What Montor can do (the levers):**

*Dungeon levers* — adjustments that take effect on the next relevant trigger:
- Loot quality weight slider (per zone)
- Enemy difficulty modifier (per zone)
- Trap density toggle
- Environmental effect on/off per zone

*Direct interventions* — immediate actions with cooldowns:
- Dispatch an Offer to the party
- Dispatch a Curse to a specific player
- Lock a door the party has not yet passed through
- Trigger a room event (from the zone's event pool)
- Apply a zone environmental effect immediately
- Send a message — appears to dungeon players as Montor's narration. They cannot tell if it is human or AI.

*Cannot do:*
- Spawn specific named enemies mid-room
- See or manipulate individual roll outcomes
- Access inventory or item details
- Override Soul conditions directly

This information asymmetry keeps the human Montor player genuinely engaged rather than just watching. He is pulling levers in partial darkness.

---

### 13c. Play Modes (multiplayer)

**Adversarial** — Montor actively tries to kill the party. Classic dungeon master vs players.

**Cooperative** — Montor shapes the run for entertainment, not destruction. Functions like a GM. More narrative, less punishing.

Party votes on mode before the run starts.

---

### 13d. AI Modes

| Mode | Description |
|---|---|
| **Full AI** | Groq drives Montor entirely. Default single-player and no-Montor-player mode. |
| **AI Assist** | Human Montor sees Groq suggestions based on available dungeon state data but decides what to action. |
| **Full Manual** | Human Montor only. No AI input. Pure asymmetric PvP dungeon master experience. |

In AI Assist mode, Groq only receives the same limited data Montor sees — it does not get roll data or inventory details either. Consistent with the design principle.

---

### 13e. Build Phases

| Phase | Scope | Dependency |
|---|---|---|
| **Phase 1** | True Admin — content and balance management | Single player build |
| **Phase 2** | Montor's Console UI — in-game Montor role | Multiplayer build |
| **Phase 3** | AI Assist mode — Groq in Player Console | Phase 2 complete |

Phases 2 and 3 deferred until multiplayer. Firebase architecture supports all three from day one — access is permission-scoped, not structurally separate.

---

## 14. Parked — Future Design Items

### 14a. Inventory Management
Not designed yet. Known to be complex. Needs its own doc when the time comes. Considerations will include:
- Carry limit / weight or slot-based
- Item stacking rules
- Heirloom flagging and persistence
- Loot sharing in multiplayer
- Quick-use vs equipped vs stored distinction

### 14b. In-Game Message Boards
Certain chambers contain a physical message board — a noticeboard, a scrawled wall, a chalkboard. In-world, diegetic communication between players and across runs.

**Rules:**
- One note per player per board — writing a new one replaces your old one
- Date-stamped
- Montor can also post (AI-generated or human Montor player)
- Notes persist briefly across runs (a few runs, then fade — TBD)
- No chat, no threads — just a single pinned note per person. Limited by design.

**Why it works:**
- Keeps communication in-world and flavourful
- Montor's notes are indistinguishable from player notes at a glance
- Cross-run notes create emergent storytelling ("someone died here")
- Genuinely funny in multiplayer when Montor is human

Not all chambers have a board — placement TBD per zone template.

---

## 15. Repo Housekeeping (Claude Code Actions)

Standard repo setup items for Claude Code to action when instructed:

| Item | Description |
|---|---|
| **MIT License** | Add `LICENSE` file to repo root. Requires owner name/org to complete. |
| **DPA / Legal data docs** | Data Protection Agreement and any GDPR-relevant documentation given user data (characters, run history, gold) is stored in Firebase. Standard templates to be added to repo. |
| **README** | Basic project README covering setup, Firebase config, and local dev instructions. |

> Owner name needed before MIT License can be generated. Confirm when ready.

---

## 16. Flee Mechanic

No flee option exists currently. Requires the chamber/door navigation layer to be built first — you need somewhere to flee *to*.

### Design — confirmed

**One flee option only.** Declare flee, roll d20 + AGI modifier, outcome determined by tier.

**4-tier outcome system:**

| Tier | Roll (no modifier) | Probability | Flee Result | HP Loss | Gold Loss | Item Risk |
|---|---|---|---|---|---|---|
| **Critical Success** | 17–20 | 20% | Clean exit | None | None | None |
| **Success** | 11–16 | 30% | Messy exit | 5–10% max HP | None | None |
| **Failure** | 5–10 | 30% | Bad exit | 15–25% max HP | 10% carried gold | 10% drop chance (non-heirloom) |
| **Critical Failure** | 1–4 | 20% | Flee fails — stuck | 25–35% max HP | 20% carried gold | 25% drop chance (non-heirloom) |

**AGI modifier effect on tier probabilities:**

| AGI Modifier | Crit Success % | Success % | Failure % | Crit Failure % |
|---|---|---|---|---|
| −2 | 10% | 30% | 30% | 30% |
| 0 | 20% | 30% | 30% | 20% |
| +2 | 30% | 30% | 30% | 10% |
| +4 | 40% | 30% | 25% | 5% |

**Rules:**
- Heirlooms never drop on flee — too punishing given cross-run persistence
- BLOODLUST condition prevents fleeing entirely (already documented in `07_Conditions_and_Persistence.md`)
- On Critical Failure — turn is wasted, combat continues
- You flee to the chamber you came from (previous chamber, not random)

**Stat impact:**
Fleeing impacts *something* — a bravery or reputation stat. Principle confirmed, details and balance TBD. Candidates:
- Per-run bravery stat (mechanical — affects attack rolls while rattled, recovers on kills)
- Persistent reputation stat (narrative — affects Montor Mood, faction pricing, Soul condition triggers)
- Or both operating on separate layers (same as Body/Mind/Soul)

**Montor's reaction:**
Fleeing is noted by Montor. Likely a Mood/narrative trigger. Exact effect TBD — could be contempt, amusement, or both depending on his current disposition.

**Run logging:**
Flee attempts and outcomes logged as combat events. High flee rates against a specific enemy are a balance signal.

> Implementation deferred until chamber navigation is built.
