# Dungeon of Montor — 09: Firestore Data Model
**Version:** 0.1 Draft
**Date:** March 2026
**Status:** Living document — MUST be updated as new fields are discovered during implementation

---

## Guiding Principles

1. **Content in Firestore, engine in code.** Floors, zones, enemies, items, loot tables = data. Maze generation, combat resolution, dice = code.
2. **Adding content = adding documents, not deploying code.** A new floor is Firestore writes, not a PR.
3. **This doc is the canonical reference.** If code disagrees with this doc, one of them is wrong — investigate and update.
4. **Mark new fields as they emerge.** When implementation reveals a needed attribute, add it here immediately with a `[added YYYY-MM-DD]` tag.

---

## Collection Map

```
/floors/{floorId}                         Content — floor definitions
  /zones/{zoneId}                         Content — zone definitions within floor

/enemyArchetypes/{archetypeId}            Content — base enemy definitions (not per-tier)
/items/{itemId}                           Content — all equippable/consumable/relic items
/lootTables/{tableId}                     Content — weighted drop tables per zone/enemy
/npcs/{npcId}                             Content — merchant and quest NPC definitions
/events/{eventId}                         Content — scripted events, Montor interventions
/zoneEffects/{effectId}                   Content — environmental mechanics
/chamberTemplates/{templateId}            Content — chamber type definitions with description pools
/defaultValues/{valueId}                  Balance — resettable reference values

/users/{uid}                              Auth — user accounts
/characters/{characterId}                 Player — persistent characters (Stage 2+)
/runs/{runId}                             Runtime — active run state
  /grid/{chamberId}                       Runtime — per-chamber state for current run

/balanceLog/{logId}                       Analytics — run outcome logging (future)
```

---

## 1. `/floors/{floorId}`

One doc per dungeon depth level. Hardcoded set — floors don't change between runs.

```javascript
{
  id: string,                   // e.g. "grounds", "underground", "underbelly"
  name: string,                 // e.g. "The Grounds"
  order: number,                // 0, -1, -2 etc. (descending = deeper)
  zones: [string],              // zone IDs in this floor, e.g. ["montors_garden"]
  narrativeHook: string,        // intro text when arriving at this floor
  groqPromptSeed: string,       // AI narration seed for this floor's tone
  transitionText: string,       // text shown during stairwell descent to this floor
  montorLine: string,           // scripted Montor speech on arrival (Stage 1, no AI)
  doorTheme: string,            // sprite theme key: "garden", "dungeon", "sewer", etc.
  bgGradient: string | null,    // CSS gradient or colour for floor background
}
```

**Example:** `/floors/grounds`
```json
{
  "id": "grounds",
  "name": "The Grounds",
  "order": 0,
  "zones": ["montors_garden"],
  "narrativeHook": "You leave the path behind. The garden walls rise around you, overgrown and alive.",
  "groqPromptSeed": "Narrate a wild overgrown castle garden at dusk. Crumbling stone, tangled hedgerows, strange flowers.",
  "transitionText": "You step through the gates. They close behind you.",
  "montorLine": "Welcome to my garden. Mind the flowers — they bite.",
  "doorTheme": "garden",
  "bgGradient": null
}
```

---

## 2. `/floors/{floorId}/zones/{zoneId}`

Sub-collection on floor. One doc per zone. Each zone = one 4x4 grid of 16 chambers.

```javascript
{
  id: string,                       // e.g. "montors_garden"
  name: string,                     // e.g. "Montor's Garden"
  floorId: string,                  // parent floor ID
  activeEffects: [string],          // zone effect IDs, e.g. ["DAY_NIGHT", "HIGH_POLLEN"]
  chamberTemplatePoolIds: [string], // exactly 16 chamber template IDs for this zone
  enemyArchetypeIds: [string],      // which enemy archetypes can appear here
  enemyTiers: [string],             // which tiers can spawn here, e.g. ["dust", "slate"]
  bossArchetypeId: string | null,   // archetype for zone boss (null if no boss)
  bossTier: string | null,          // tier for zone boss
  bossName: string | null,          // override name for the boss
  lootTableId: string,              // default loot table for this zone
  narrativeHook: string,            // zone-specific intro text
  groqPromptSeed: string,           // AI narration seed for this zone's flavour
  doorTheme: string,                // overrides floor doorTheme if set
  bgColour: string | null,          // zone-specific background colour override
  descriptions: [string],           // pool of general atmospheric descriptions
  connectingZones: [string],        // zone IDs reachable via connecting routes (later)
  lockedDoorTo: string | null,      // zone ID behind the locked door (later)
  stairwellLocked: boolean,         // is descent locked until boss cleared?
}
```

**Example:** `/floors/grounds/zones/montors_garden`
```json
{
  "id": "montors_garden",
  "name": "Montor's Garden",
  "floorId": "grounds",
  "activeEffects": ["DAY_NIGHT", "HIGH_POLLEN"],
  "chamberTemplatePoolIds": [
    "garden_entry", "garden_rest", "garden_combat_1", "garden_combat_2",
    "garden_combat_3", "garden_combat_4", "garden_combat_5", "garden_elite",
    "garden_mini_boss", "garden_merchant", "garden_quest_npc", "garden_trap",
    "garden_loot", "garden_event", "garden_hidden", "garden_descent"
  ],
  "enemyArchetypeIds": ["rat", "slug"],
  "enemyTiers": ["dust"],
  "bossArchetypeId": null,
  "bossTier": null,
  "bossName": null,
  "lootTableId": "garden_standard",
  "narrativeHook": "The garden is wild, overgrown, and strangely alive.",
  "groqPromptSeed": "A ruined castle garden. Sentient-seeming hedgerows. Flowers with teeth.",
  "doorTheme": "garden",
  "bgColour": null,
  "descriptions": [
    "Vines creep across broken flagstones.",
    "The hedgerows rustle without wind.",
    "Something watches from behind the topiary."
  ],
  "connectingZones": [],
  "lockedDoorTo": null,
  "stairwellLocked": false
}
```

---

## 3. `/chamberTemplates/{templateId}`

Global collection (not nested under zones — templates can be reused across zones).

```javascript
{
  id: string,                       // e.g. "garden_combat_1"
  type: string,                     // chamber type key — see Chamber Types below
  label: string,                    // display name, e.g. "Overgrown Path"
  icon: string,                     // map icon character, e.g. "⚔"
  isSafe: boolean,                  // no enemies, no traps
  isHidden: boolean,                // requires detection to find

  // Combat chambers
  enemyArchetypeIds: [string] | null,  // override zone roster for this chamber
  enemyCountMin: number | null,
  enemyCountMax: number | null,
  encounterLevel: number | null,    // difficulty scaling: 1=standard, 2=elite, 3=mini_boss

  // Loot chambers
  lootTableId: string | null,       // override zone loot table
  goldMin: number | null,           // gold range for loot/hidden chambers
  goldMax: number | null,

  // Rest chambers
  restHealPercent: number | null,   // e.g. 0.25 for 25% max HP

  // Trap chambers
  trapDamageMin: number | null,
  trapDamageMax: number | null,
  trapStat: string | null,          // stat used for resistance check, e.g. "agi"

  // NPC chambers
  npcId: string | null,             // reference to /npcs/{npcId}

  // Event chambers
  eventId: string | null,           // reference to /events/{eventId}

  // Merchant chambers
  merchantInventoryIds: [string] | null, // item IDs available to buy (overrides zone default)

  // Descriptions — pool of flavour text, one chosen randomly per run
  descriptions: [string],

  // Conditions
  activeCondition: string | null,   // e.g. "DAY" — chamber only active under this condition
}
```

**Chamber Types (enum):**
```
stairwell_entry, stairwell_descent,
combat_standard, combat_elite, mini_boss, boss,
rest, merchant, quest_npc, shrine,
trap, loot, hidden, event,
connecting_zone_entrance
```

**Example:** `/chamberTemplates/garden_combat_1`
```json
{
  "id": "garden_combat_1",
  "type": "combat_standard",
  "label": "Overgrown Path",
  "icon": "⚔",
  "isSafe": false,
  "isHidden": false,
  "enemyArchetypeIds": null,
  "enemyCountMin": 1,
  "enemyCountMax": 2,
  "encounterLevel": 1,
  "lootTableId": null,
  "goldMin": null,
  "goldMax": null,
  "restHealPercent": null,
  "trapDamageMin": null,
  "trapDamageMax": null,
  "trapStat": null,
  "npcId": null,
  "eventId": null,
  "merchantInventoryIds": null,
  "descriptions": [
    "Creatures stir in the undergrowth ahead.",
    "The path narrows. Something moves between the hedgerows.",
    "Roots twist across the flagstones. You hear scratching."
  ],
  "activeCondition": null
}
```

---

## 4. `/enemyArchetypes/{archetypeId}`

One doc per enemy type. Tiers are NOT separate docs — tier multipliers are applied at generation time by the engine.

**Canonical stat fields (from code, not spec 08):** `hp, str, agi, def, int, weaponDie, xp`

```javascript
{
  id: string,                       // e.g. "rat"
  name: string,                     // archetype display name, e.g. "Rat"
  spriteKey: string,                // key into sprites.js, e.g. "rat"

  // Base stats — Iron tier (1.0x) at Seasoned difficulty
  baseStats: {
    hp: number,
    str: number,
    agi: number,
    def: number,
    int: number,
  },
  weaponDie: number,                // damage die size, e.g. 4 for d4
  baseXp: number,                   // XP value at Iron tier

  // Name pools — per tier, array of possible names
  namePool: {
    dust: [string],
    slate: [string],
    iron: [string],
    crimson: [string],
    void: [string],
  },

  // Spawn rules
  floorsAllowed: [string],          // floor IDs where this can appear
  zonesAllowed: [string],           // zone IDs (empty = all zones on allowed floors)

  // Combat behaviour
  conditionsCanApply: [string],     // e.g. ["BLEED", "NAUSEA"]
  conditionChance: number,          // base % chance, e.g. 0.15
  immunities: [string],            // conditions this enemy is immune to
  specialAbility: {                 // void-tier signature ability (null for most)
    name: string,
    description: string,
    effect: string,                 // engine-parsed effect key
  } | null,

  // AI narration
  groqDescriptor: string,           // e.g. "scrawny, aggressive, travels in packs"

  // Behaviour hints (for future AI/console)
  attackPattern: string,            // "random" | "lowest_hp" | "highest_threat" (future)
  fleeThreshold: number | null,     // HP % below which enemy flees (null = never)
}
```

**Example:** `/enemyArchetypes/rat`
```json
{
  "id": "rat",
  "name": "Rat",
  "spriteKey": "rat",
  "baseStats": { "hp": 12, "str": 10, "agi": 14, "def": 8, "int": 6 },
  "weaponDie": 4,
  "baseXp": 10,
  "namePool": {
    "dust": ["Scuttler", "Ashrat", "Gutter Fang", "Plague Nibbler"],
    "slate": ["Swarmcaller", "Blight Gnawer", "Ironteeth", "Tunnelfiend"],
    "iron": ["The Gnawing", "Deeprat Elder", "Plaguefather", "Cavern Sovereign"],
    "crimson": ["The Infestation", "Broodmother", "Dread Gnawer", "Gnash the Ancient"],
    "void": ["The First Rat", "Plague King", "That Which Gnaws the Roots"]
  },
  "floorsAllowed": ["grounds", "underground", "underbelly", "deep"],
  "zonesAllowed": [],
  "conditionsCanApply": ["BLEED", "NAUSEA"],
  "conditionChance": 0.15,
  "immunities": [],
  "specialAbility": null,
  "groqDescriptor": "scrawny, aggressive, travels in packs",
  "attackPattern": "random",
  "fleeThreshold": null
}
```

---

## 5. `/items/{itemId}`

Every item in the game. Weapons, armour, consumables, relics.

```javascript
{
  id: string,                       // e.g. "longsword_common"
  name: string,                     // e.g. "Longsword"
  type: string,                     // "weapon" | "armour" | "consumable" | "relic"
  slot: string | null,              // "weapon" | "offhand" | "armour" | "relic" | null (consumables)
  rarity: string,                   // "common" | "uncommon" | "rare" | "epic" | "legendary" | "heirloom"
  isHeirloom: boolean,              // persists across runs, never drops on flee

  // Weapon fields
  damageDie: number | null,         // e.g. 8 for d8
  attackStat: string | null,        // "str" | "agi" | "int" — which stat modifies attack

  // Armour fields
  defBonus: number | null,          // added to DEF
  agiPenalty: number | null,        // subtracted from AGI (heavy armour tax)

  // Consumable fields
  effect: string | null,            // engine effect key: "heal", "rage", "flee_boost", etc.
  effectValue: number | null,       // magnitude: HP healed, turns buffed, etc.
  effectDuration: number | null,    // turns the effect lasts (null = instant)
  effectStat: string | null,        // stat affected, e.g. "str" for Rage Draught

  // Relic fields (passive effects while equipped)
  passiveEffect: string | null,     // engine effect key: "hp_bonus", "lck_bonus", etc.
  passiveValue: number | null,      // magnitude

  // Condition effects (weapon applies on hit)
  conditionOnHit: string | null,    // condition key, e.g. "BLEED"
  conditionChance: number | null,   // base chance (modified by attack tier)

  // Crit modifiers (Keen weapons etc.)
  critThresholdBonus: number | null, // lowers crit threshold by N (e.g. 1 → crits on 19+)
  critDamageBonus: number | null,    // added to crit multiplier

  // Commerce
  buyPrice: number,                 // merchant cost in gold
  sellPrice: number,                // gold received when selling

  // Display
  description: string,             // flavour text
  floorsAvailable: [string] | null, // floors where this can appear in loot/merchants (null = all)
}
```

**Stage 1 items:**

| id | name | type | rarity | key stats |
|---|---|---|---|---|
| `dagger_common` | Dagger | weapon | common | d4, str |
| `shortsword_common` | Shortsword | weapon | common | d6, str |
| `longsword_common` | Longsword | weapon | common | d8, str |
| `leather_common` | Leather Armour | armour | common | def+2, agi 0 |
| `chainmail_common` | Chainmail | armour | common | def+4, agi-1 |
| `health_potion` | Health Potion | consumable | common | heal 15 HP |
| `rage_draught` | Rage Draught | consumable | uncommon | +3 STR for 3 turns |
| `smoke_bomb` | Smoke Bomb | consumable | common | guaranteed flee |
| `ring_of_vitality` | Ring of Vitality | relic | uncommon | +5 max HP |
| `lucky_coin` | Lucky Coin | relic | uncommon | +2 LCK |

**Example:** `/items/longsword_common`
```json
{
  "id": "longsword_common",
  "name": "Longsword",
  "type": "weapon",
  "slot": "weapon",
  "rarity": "common",
  "isHeirloom": false,
  "damageDie": 8,
  "attackStat": "str",
  "defBonus": null,
  "agiPenalty": null,
  "effect": null,
  "effectValue": null,
  "effectDuration": null,
  "effectStat": null,
  "passiveEffect": null,
  "passiveValue": null,
  "conditionOnHit": null,
  "conditionChance": null,
  "critThresholdBonus": null,
  "critDamageBonus": null,
  "buyPrice": 25,
  "sellPrice": 10,
  "description": "A sturdy blade. Nothing fancy. Gets the job done.",
  "floorsAvailable": null
}
```

**Example:** `/items/rage_draught`
```json
{
  "id": "rage_draught",
  "name": "Rage Draught",
  "type": "consumable",
  "slot": null,
  "rarity": "uncommon",
  "isHeirloom": false,
  "damageDie": null,
  "attackStat": null,
  "defBonus": null,
  "agiPenalty": null,
  "effect": "stat_buff",
  "effectValue": 3,
  "effectDuration": 3,
  "effectStat": "str",
  "passiveEffect": null,
  "passiveValue": null,
  "conditionOnHit": null,
  "conditionChance": null,
  "critThresholdBonus": null,
  "critDamageBonus": null,
  "buyPrice": 15,
  "sellPrice": 5,
  "description": "Thick, red, tastes of iron. Your muscles burn with fury.",
  "floorsAvailable": null
}
```

---

## 6. `/lootTables/{tableId}`

Defines what can drop in a zone, from an enemy, or from a specific chamber.

```javascript
{
  id: string,                       // e.g. "garden_standard"
  name: string,                     // e.g. "Garden Standard Loot"

  // Gold drop range (always drops gold in addition to possible items)
  goldMin: number,
  goldMax: number,

  // Item drops — weighted entries
  entries: [
    {
      itemId: string,               // reference to /items/{itemId}
      weight: number,               // relative weight (higher = more likely)
      minRarity: string,            // only drops if rarity roll meets this threshold
    }
  ],

  // Rarity thresholds — d100 + LCK modifier vs these bands
  // (Global default, can be overridden per table if needed)
  rarityBands: {
    common:    { min: 1,  max: 40 },
    uncommon:  { min: 41, max: 65 },
    rare:      { min: 66, max: 82 },
    epic:      { min: 83, max: 93 },
    legendary: { min: 94, max: 99 },
    heirloom:  { min: 100, max: 999 },
  } | null,                         // null = use global default bands

  // Drop chance — not every kill drops an item
  itemDropChance: number,           // 0.0–1.0, e.g. 0.3 = 30% chance of an item drop
}
```

**Example:** `/lootTables/garden_standard`
```json
{
  "id": "garden_standard",
  "name": "Garden Standard Loot",
  "goldMin": 2,
  "goldMax": 8,
  "entries": [
    { "itemId": "health_potion", "weight": 40, "minRarity": "common" },
    { "itemId": "dagger_common", "weight": 20, "minRarity": "common" },
    { "itemId": "smoke_bomb", "weight": 15, "minRarity": "common" },
    { "itemId": "leather_common", "weight": 10, "minRarity": "uncommon" },
    { "itemId": "lucky_coin", "weight": 5, "minRarity": "rare" },
    { "itemId": "ring_of_vitality", "weight": 5, "minRarity": "rare" },
    { "itemId": "rage_draught", "weight": 5, "minRarity": "uncommon" }
  ],
  "rarityBands": null,
  "itemDropChance": 0.3
}
```

---

## 7. `/npcs/{npcId}`

Merchant and quest NPCs. Referenced by chamber templates.

```javascript
{
  id: string,                       // e.g. "garden_merchant"
  name: string,                     // e.g. "Wandering Vendor"
  type: string,                     // "merchant" | "quest"

  // Display
  spriteKey: string | null,         // future: NPC sprites
  descriptions: [string],           // pool of intro text, one chosen randomly

  // Merchant fields
  inventoryItemIds: [string] | null, // item IDs this merchant sells
  priceMultiplier: number | null,    // multiplier on buyPrice (e.g. 1.5 = 50% markup)

  // Quest fields
  questDescription: string | null,  // what the NPC asks for
  questStat: string | null,         // stat check required (null = no check, auto-help)
  rewardGold: number | null,
  rewardItemId: string | null,      // item given as reward
  rewardXp: number | null,

  // AI narration
  groqDescriptor: string | null,    // e.g. "a hooded figure, speaks in riddles"
  dialoguePool: [string] | null,    // scripted dialogue lines (Stage 1, no AI)
}
```

**Example:** `/npcs/garden_merchant`
```json
{
  "id": "garden_merchant",
  "name": "Wandering Vendor",
  "type": "merchant",
  "spriteKey": null,
  "descriptions": [
    "A hooded figure sits cross-legged beside a threadbare mat of wares.",
    "A cloaked trader leans against a broken column. Goods spread on a blanket.",
    "Someone has set up shop between the hedgerows. They nod as you approach."
  ],
  "inventoryItemIds": ["health_potion", "rage_draught", "smoke_bomb"],
  "priceMultiplier": 1.0,
  "questDescription": null,
  "questStat": null,
  "rewardGold": null,
  "rewardItemId": null,
  "rewardXp": null,
  "groqDescriptor": "a hooded merchant, practical, few words, fair prices",
  "dialoguePool": ["What'll it be?", "Gold talks. Everything else walks.", "Buy or leave. Either way, quietly."]
}
```

---

## 8. `/events/{eventId}`

Scripted events, Montor interventions, narrative moments. Referenced by chamber templates or triggered by Montor.

```javascript
{
  id: string,                       // e.g. "garden_montor_taunt"
  name: string,                     // e.g. "Montor's Welcome"
  type: string,                     // "montor" | "narrative" | "trap_event" | "lore"
  triggerType: string,              // "chamber_entry" | "floor_arrival" | "montor_dispatched" | "threshold"

  // Display
  descriptions: [string],           // pool of text, one chosen randomly

  // Choices (if interactive)
  choices: [
    {
      label: string,                // button text
      stat: string | null,          // stat check required (null = auto-succeed)
      outcomes: {
        success: { text: string, goldChange: number, hpChange: number, itemId: string | null, conditionApply: string | null },
        failure: { text: string, goldChange: number, hpChange: number, conditionApply: string | null },
      }
    }
  ] | null,                         // null = no choices, just text + continue

  // Montor-specific
  moodRequirement: string | null,   // only triggers if Montor mood matches
  cooldownEncounters: number | null, // min encounters between repeated triggers

  // AI narration
  groqPromptSeed: string | null,
}
```

**Example:** `/events/garden_montor_taunt`
```json
{
  "id": "garden_montor_taunt",
  "name": "Montor's Welcome",
  "type": "montor",
  "triggerType": "floor_arrival",
  "descriptions": [
    "A voice echoes from below: \"Welcome to my garden. Mind the flowers — they bite.\"",
    "The air thickens. A whisper: \"You've found the entrance. So have many others. They're still here, in a sense.\"",
    "Silence. Then, from everywhere at once: \"I've been expecting you. Take your time. I have forever.\""
  ],
  "choices": null,
  "moodRequirement": null,
  "cooldownEncounters": null,
  "groqPromptSeed": "Montor welcomes a new adventurer to his garden. Tone: amused menace, not hostile."
}
```

---

## 9. `/zoneEffects/{effectId}`

Environmental effects active within a zone. Applied to all chambers in the zone.

```javascript
{
  id: string,                       // e.g. "DAY_NIGHT"
  name: string,                     // e.g. "Day/Night Cycle"
  description: string,              // player-facing description of the effect

  // Mechanical impact
  mechanicType: string,             // "stat_modifier" | "spawn_modifier" | "regen_block" | "passive_damage" | "visibility" | "condition_risk"
  mechanicDetail: {
    stat: string | null,            // affected stat
    value: number | null,           // modifier amount
    chance: number | null,          // probability per turn/chamber (for condition_risk, passive_damage)
    conditionApply: string | null,  // condition applied
    blockEffect: string | null,     // what it blocks (e.g. "hp_regen" for NO_REGEN)
  },

  // Visual indicator
  visualOverlay: string | null,     // CSS class or effect key: "smog", "heat_shimmer", "darkness"
  iconEmoji: string | null,         // status bar indicator

  // Can it be countered?
  counterItemId: string | null,     // item that negates this effect
  counterCondition: string | null,  // condition that negates (e.g. water_breathing)
  canBeFullyCountered: boolean,     // false = only mitigated, not removed
}
```

**Example:** `/zoneEffects/NO_REGEN`
```json
{
  "id": "NO_REGEN",
  "name": "Cursed Air",
  "description": "The air here rejects healing. HP regeneration from items and rest is disabled.",
  "mechanicType": "regen_block",
  "mechanicDetail": {
    "stat": null,
    "value": null,
    "chance": null,
    "conditionApply": null,
    "blockEffect": "hp_regen"
  },
  "visualOverlay": null,
  "iconEmoji": "🚫",
  "counterItemId": null,
  "counterCondition": null,
  "canBeFullyCountered": false
}
```

---

## 10. `/defaultValues/{valueId}`

Resettable balance reference values. Every tunable number lives here. Montor's Console (True Admin) can reset to these.

```javascript
{
  id: string,                       // e.g. "tier_multipliers"
  category: string,                 // "combat" | "economy" | "spawning" | "difficulty" | "loot"
  description: string,              // what these values control

  values: { ... },                  // shape varies by category — see examples

  // Multiplayer scaling (applied on top of base values)
  multiplayerModifiers: {
    "2_players": { ... },
    "3_players": { ... },
    "4_players": { ... },
  } | null,
}
```

**Example:** `/defaultValues/tier_multipliers`
```json
{
  "id": "tier_multipliers",
  "category": "combat",
  "description": "Stat multipliers per enemy power tier. Applied to base archetype stats at generation time.",
  "values": {
    "dust": 0.8,
    "slate": 0.9,
    "iron": 1.0,
    "crimson": 1.15,
    "void": 1.3
  },
  "multiplayerModifiers": null
}
```

**Example:** `/defaultValues/difficulty_multipliers`
```json
{
  "id": "difficulty_multipliers",
  "category": "difficulty",
  "description": "Overall stat multiplier by game difficulty setting.",
  "values": {
    "novice": 0.9,
    "seasoned": 1.0,
    "veteran": 1.1,
    "legendary": 1.2
  },
  "multiplayerModifiers": null
}
```

**Example:** `/defaultValues/rarity_bands`
```json
{
  "id": "rarity_bands",
  "category": "loot",
  "description": "d100 + LCK modifier thresholds for item rarity. Global default — loot tables can override.",
  "values": {
    "common":    { "min": 1,   "max": 40 },
    "uncommon":  { "min": 41,  "max": 65 },
    "rare":      { "min": 66,  "max": 82 },
    "epic":      { "min": 83,  "max": 93 },
    "legendary": { "min": 94,  "max": 99 },
    "heirloom":  { "min": 100, "max": 999 }
  },
  "multiplayerModifiers": null
}
```

**Example:** `/defaultValues/stat_floors`
```json
{
  "id": "stat_floors",
  "category": "combat",
  "description": "Minimum stat values after tier/difficulty multipliers. Prevents stats from becoming meaningless.",
  "values": {
    "combat_stat_min": 4,
    "hp_min": 6
  },
  "multiplayerModifiers": null
}
```

---

## 11. `/runs/{runId}`

Active run state. One doc per active run. Deleted or archived on run end.

```javascript
{
  id: string,                       // auto-generated
  userId: string,                   // auth UID
  status: string,                   // "active" | "victory" | "defeat" | "abandoned"
  startedAt: timestamp,
  endedAt: timestamp | null,

  // Character snapshot (Stage 1: generated fresh, Stage 2+: copied from /characters)
  character: {
    name: string,
    class: string,
    level: number,
    stats: { str, agi, def, ... },
    maxHp: number,
    currentHp: number,
    equipped: { weapon, offhand, armour, relics },
    inventory: [Item],
    gold: number,
  },

  // Dungeon position
  currentFloorId: string,
  currentZoneId: string,
  currentChamberIndex: number,
  previousChamberIndex: number | null,
  chambersCleared: number,
  chambersVisited: number,

  // Zone grid (16 chambers — runtime state)
  grid: [
    {
      id: number,                   // 0-15
      templateId: string,           // reference to /chamberTemplates
      type: string,                 // chamber type key
      label: string,
      doors: { N: boolean, S: boolean, E: boolean, W: boolean },
      visited: boolean,
      cleared: boolean,
      revealed: boolean,            // fog of war
      breadcrumbed: boolean,        // stale loaf mechanic
      lootClaimed: boolean,
      corpses: [                    // post-combat lootable corpses
        { enemyName: string, archetypeKey: string, tierKey: string, gold: number, itemId: string | null, looted: boolean }
      ] | null,
    }
  ],

  // Combat (active battle, null when out of combat)
  battleState: BattleState | null,
  inBattle: boolean,

  // Run stats
  totalXp: number,
  totalGold: number,
  enemiesDefeated: number,
  floorsCompleted: [string],        // floor IDs completed this run

  // Montor state — the levers
  montorState: {
    mood: string,                   // "neutral" | "amused" | "bored" | "wrathful" | etc.
    lootQualityMod: number,         // -2 to +2 slider
    enemyDifficultyMod: number,     // -2 to +2 slider
    pendingOffer: {                 // dispatched by Montor, shown at next safe moment
      text: string,
      condition: string,
      reward: string,
    } | null,
    pendingCurse: {
      text: string,
      effect: string,
      duration: string,
    } | null,
    lockedDoors: [number],          // chamber indices Montor has locked
    message: string | null,         // displayed as narration — player can't tell who wrote it
    fleeCount: number,              // how many times player has fled this run
    interventionCooldown: number,   // chambers until Montor can intervene again

    // Behaviour tracking — Montor observes you
    greed: number,                  // 0–100. Tracks looting behaviour. Default 50 (neutral).
                                    // Single player: looting is normal, no penalty. Score drifts up naturally.
                                    // Leaving loot behind is *unusual* — Montor notices and may reward restraint:
                                    //   better chest contents later, a grudging compliment, a surprise gift.
                                    // This is a REWARD for not looting, not a punishment for looting.
                                    // Multiplayer: who loots what is visible to Montor and feeds party dynamics.
                                    //   Montor may comment on who's greedy vs who shares. Social pressure, not mechanical penalty.
    corpsesSearched: number,        // total corpses opened this run
    corpsesIgnored: number,         // corpses walked past without opening
    goldLeftBehind: number,         // gold available but not taken
    itemsLeftBehind: number,        // items available but not taken
  },

  // Active conditions (Body/Mind slots — one per slot max)
  activeConditions: {
    body: Condition | null,
    mind: Condition | null,
    soul: Condition | null,         // Soul conditions persist across runs (Stage 2+)
  },

  // Active boons from Montor's Gifts (one per slot, persist across runs in Stage 2+)
  activeBoons: {
    body: Boon | null,
    mind: Boon | null,
    weapon: Boon | null,
    item: Boon | null,
  },
  activeFusion: string | null,      // fusion bonus ID if Body + Mind boons synergise

  // Carried gifts (not yet activated — lost on run end)
  carriedGifts: [string],           // e.g. ["petal", "stone"]

  // In-run level (XP thresholds reached this run)
  runLevel: number,                 // 0 = base, increments on XP thresholds
  statPicks: { [stat]: number },    // stat increases chosen at level-up, e.g. { str: 1, wis: 1 }
},
}
```

---

## 14a. Condition Schema

Conditions are temporary negative effects applied during combat, by traps, or by Montor. One per slot (Body/Mind/Soul). Applied to players and enemies.

```javascript
// Condition — stored on run.activeConditions and on BattleState.players/enemies
{
  id: string,                       // e.g. "BLEED", "POISON", "FEAR"
  slot: string,                     // "body" | "mind" | "soul"
  name: string,                     // display name
  source: string,                   // "weapon" | "enemy" | "trap" | "zone" | "montor" | "boon"
  turnsRemaining: number | null,    // null = persistent until cured/run end

  // Mechanical effects (one or more)
  damagePerTurn: number | null,     // HP lost each turn (BLEED=2, POISON=3, BURN=4)
  statModifier: {                   // temporary stat changes while active
    stat: string,                   // e.g. "agi", "str", "def"
    value: number,                  // e.g. -3 for FROST AGI penalty
  } | null,
  skipChance: number | null,        // 0.0-1.0 chance to skip action (NAUSEA=0.3, CHARM=0.5)
  forceTier: number | null,         // force next attack to this tier (DAZE: tier 3 = glancing)
  missChance: number | null,        // 0.0-1.0 extra miss chance (BLIND=0.5)
  canFlee: boolean,                 // false for BLOODLUST
  healPerKill: number | null,       // BLOODLUST: heal on kill
  damagePerNoKill: number | null,   // BLOODLUST: damage if turn passes without killing
}
```

### Condition Catalogue (Stage 1 — Body + Mind)

**Body conditions:**

| ID | Name | Turns | Effect | Applied by |
|---|---|---|---|---|
| BLEED | Bleeding | 3 | 2 damage/turn | Weapons, traps |
| POISON | Poisoned | 2 | 3 damage/turn, -1 STR | Slugs, poison weapons |
| BURN | Burning | 1 | 4 damage next turn | Fire weapons, Boiler Room |
| FROST | Frozen | 2 | -3 AGI | Ice weapons, Deep zone |
| NAUSEA | Nauseous | 2 | 30% skip action | Slugs, gas traps |
| SLUGGISH | Sluggish | 2 | Act last, 50% can't flee | Heavy hits |

**Mind conditions:**

| ID | Name | Turns | Effect | Applied by |
|---|---|---|---|---|
| FEAR | Afraid | 2 | -2 all rolls, flee if HP<50% | Boss auras, Wraith |
| FRENZY | Frenzied | 3 | +3 STR, -2 DEF, attacks random target | Rage Draught, orc warcry |
| CHARM | Charmed | 2 | 50% skip action each turn | Future: charm weapons, Montor |
| DAZE | Dazed | 1 | Next attack forced to glancing (tier 3) | Stun weapons, big hits |
| BORED | Bored | 2 | -2 all rolls | Montor only |
| SAD | Sad | 2 | Can't use items | Montor, ally death |
| BLIND | Blind | 2 | 50% miss chance | Darkness zone, flash traps |
| BLOODLUST | Bloodlust | Combat | Kill=heal 3, no kill=lose 3, can't flee | Rare weapons, Montor |

---

## 14b. Boon Schema

Boons are permanent positive effects from Montor's Gifts. One per slot (Body, Mind, Weapon, Item). Persist across runs in Stage 2+.

```javascript
// Boon — stored on run.activeBoons and character doc (Stage 2+)
{
  id: string,                       // e.g. "thornhide", "ironhide_upgraded"
  slot: string,                     // "body" | "mind" | "weapon" | "item"
  name: string,                     // display name
  giftSource: string,               // which gift created it: "petal", "stone", etc.
  upgraded: boolean,                // true if applied to an already-filled slot

  // Effects vary per boon — see 10_Montors_Gifts.md for full table
  effects: {
    damageReflect: number | null,   // damage reflected to attackers
    damageReduction: number | null, // flat damage reduction
    healPerChamber: number | null,  // HP healed per chamber entered
    statBonus: { stat: string, value: number } | null,
    conditionImmunity: [string],    // condition IDs this boon makes you immune to
    conditionOnHit: string | null,  // condition applied on YOUR attacks
    critMultiplier: number | null,  // override crit multiplier
    dodgeChance: number | null,     // % chance to dodge attacks
    lootBonus: number | null,       // extra loot table rolls
    merchantDiscount: number | null, // 0.0-1.0 discount
    healPerKill: number | null,     // HP healed on enemy kill
    reviveOnce: boolean,            // survive lethal hit once per combat
    // ... extend as new boons are designed
  },
}
```

---

## 14c. Gift Schema

Gifts are carried items found by breaking Montor's treasures on each floor.

```javascript
// Gift — stored on run.carriedGifts (simple ID string)
// Full gift data is in code/Firestore content, not on the run doc
{
  id: string,                       // "petal" | "stone" | "bile" | "blood" | "ember" | "void_shard"
  name: string,                     // "Petal" | "Stone" | etc.
  floorId: string,                  // floor it came from
  treasureName: string,             // "Montor's Favourite Gnome" etc.
  colour: string,                   // hex colour for UI
  bodyBoon: string,                 // boon ID when applied to Body
  mindBoon: string,                 // boon ID when applied to Mind
  weaponBoon: string,               // boon ID when applied to Weapon
  itemBoon: string,                 // boon ID when applied to Item
}
```

---

## 14d. In-Run Levelling Schema

```javascript
// Stored on run doc
{
  runLevel: number,                 // current in-run level (0 = base)
  totalXp: number,                  // XP accumulated this run
  statPicks: {                      // stats increased via level-up choices
    str: number,
    def: number,
    agi: number,
    wis: number,
    int: number,
  },
}

// XP thresholds (stored in /defaultValues for tuning)
{
  id: "xp_thresholds",
  category: "progression",
  values: {
    levels: [
      { xp: 50,  reward: "hp", hpGain: 5 },
      { xp: 120, reward: "stat_pick" },
      { xp: 250, reward: "hp_and_stat", hpGain: 5 },
      { xp: 400, reward: "stat_pick_and_boon_upgrade" },
    ]
  }
}
```

---

## 12. `/users/{uid}`

Simple auth doc. No game state — that lives on characters and runs.

```javascript
{
  uid: string,
  displayName: string,
  email: string,
  createdAt: timestamp,
  settings: {
    groqKeyStored: boolean,         // flag only — key itself in localStorage
    briefNarration: boolean,        // halve AI output token limits
    soundEnabled: boolean,
  },
}
```

---

## 13. `/characters/{characterId}`

Persistent character (Stage 2+). In Stage 1, character is ephemeral — generated at run start, not persisted.

Full schema already defined in `03_Technical_Architecture.md` §4. Not duplicated here — that doc is canonical for character shape.

---

## 14. `/runLog/{logId}`

Lightweight run outcome log for balance analytics. One doc written per completed run (victory or defeat). Not used for gameplay — purely for tracking patterns and spotting balance issues via Montor's Console.

```javascript
{
  id: string,                       // auto-generated
  userId: string,                   // auth UID
  timestamp: timestamp,             // when the run ended

  // Outcome
  outcome: string,                  // "victory" | "defeat"
  floorReached: string,             // floor ID where run ended
  zoneReached: string,              // zone ID where run ended

  // Run stats
  chambersCleared: number,
  chambersVisited: number,
  totalXp: number,
  totalGold: number,
  runDurationMs: number | null,     // wall clock time (future)

  // Character snapshot (what they had)
  characterClass: string,           // "knight"
  characterLevel: number,
  characterMaxHp: number,

  // Combat stats
  enemiesDefeated: number,
  enemiesFled: number,
  timesHealed: number,              // potions used
  itemsUsed: number,                // total consumables used
  itemsFound: number,               // items looted/bought during run
  damageDealt: number,              // total damage dealt across all combats
  damageTaken: number,              // total damage taken across all combats
  critsLanded: number,              // player crit count
  critsReceived: number,            // enemy crit count on player

  // Looting behaviour
  greedScore: number,               // 0–100 at run end
  corpsesSearched: number,
  corpsesIgnored: number,
  goldLeftBehind: number,
  itemsLeftBehind: number,

  // Death context (defeat only)
  killedBy: string | null,          // enemy archetype that landed the killing blow
  killedByTier: string | null,      // tier of the killing enemy
  killedInChamber: string | null,   // chamber type where player died
}
```

**Example:** `/runLog/abc123`
```json
{
  "id": "abc123",
  "userId": "user_xyz",
  "timestamp": "2026-03-31T14:30:00Z",
  "outcome": "defeat",
  "floorReached": "grounds",
  "zoneReached": "montors_garden",
  "chambersCleared": 7,
  "chambersVisited": 9,
  "totalXp": 145,
  "totalGold": 32,
  "runDurationMs": null,
  "characterClass": "knight",
  "characterLevel": 1,
  "characterMaxHp": 35,
  "enemiesDefeated": 5,
  "enemiesFled": 1,
  "timesHealed": 2,
  "itemsUsed": 3,
  "itemsFound": 4,
  "damageDealt": 87,
  "damageTaken": 62,
  "critsLanded": 1,
  "critsReceived": 0,
  "killedBy": "slug",
  "killedByTier": "dust",
  "killedInChamber": "combat_elite"
}
```

---

## Appendix A: Tier Multiplier System

Enemy stat generation: `finalStat = max(statFloor, round(baseStat × tierMul × difficultyMul))`

| Tier | Multiplier | Feel |
|---|---|---|
| Dust | 0.8 | Cannon fodder |
| Slate | 0.9 | Starting to be a problem |
| Iron | 1.0 | Baseline dangerous |
| Crimson | 1.15 | Elite |
| Void | 1.3 | Singular, named |

| Difficulty | Multiplier |
|---|---|
| Novice | 0.9 |
| Seasoned | 1.0 |
| Veteran | 1.1 |
| Legendary | 1.2 |

---

## Appendix B: Spec vs Code Conflict Resolution

| Field | Spec (08) | Code (enemies.js) | Resolution |
|---|---|---|---|
| Enemy combat stats | `hp, atk, def, agi` | `hp, str, agi, def, int` | **Code wins** — richer model, already working |
| Enemy names/tier | Separate docs per tier | Archetype + tier multiplier | **Code wins** — one doc per archetype, names pooled |
| Stat minimum floor | 8 (spec) | 4 (code) | **4 for now** — allows weak Dust mobs. Revisit after playtesting. Stored in `/defaultValues/stat_floors` so tunable. |
| Boss | "required for stairwell" | Single global Void orc | **Needs work** — each zone should define its own boss via `bossArchetypeId` + `bossTier` on zone doc |
| Sprite reference | `spriteId` (spec) | `archetypeKey` (code) | **Renamed to `spriteKey`** in this doc. Maps to sprites.js key. |

---

## Appendix C: Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-03-31 | v0.1 created | Initial data model audit — all collections defined |

---

*Firestore Data Model — v0.1 — March 2026*
*Living document — update as implementation reveals new fields.*
