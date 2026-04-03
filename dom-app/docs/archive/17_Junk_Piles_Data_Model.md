# Junk Piles — Data Model Spec

> 2026-04-01 — Implementation spec for the junk pile search system
> Supersedes the junk pile sections of spec 12 (which remains valid for weight, gifts, NPCs, events)

---

## 1. Pile Object — Generated Per Chamber

Piles are stored on the chamber object, similar to corpses:

```js
chamber.junkPiles = [
  {
    id: "pile_0",               // unique within chamber
    size: "small",              // "small" | "medium" | "large"
    searched: 0,                // how many layers searched so far
    maxSearches: 1,             // 1 (small), 2 (medium), 3 (large)
    depleted: false,            // true when fully searched
    zoneId: "montors_garden",   // for themed junk names
    floorId: "grounds",         // for loot table lookups
    layers: [                   // pre-rolled content per layer
      {
        gold: 2,
        junk: "broken_gnome",   // junk item ID (or null)
        item: null,             // real item from loot table (or null)
        enemy: null,            // enemy archetype to spawn (or null)
        condition: null,        // condition applied to player (or null)
        terminal: false,        // true if this layer hides a terminal
        xp: 3,                 // XP awarded on successful search
      },
      // ... more layers for medium/large
    ],
    hasTerminal: false,         // quick-check: does ANY layer have a terminal?
  }
]
```

### Why Pre-Roll Layers

Contents are generated when the room is first entered, not on search. This means:
- The game knows if a terminal exists before the player searches (for map/hint purposes later)
- Loot is deterministic per chamber seed — no save-scumming
- PER roll determines *quality of discovery*, not *what exists*

---

## 2. Pile Sizes — Risk/Reward Tiers

| Size | Sprite | Max Layers | Pile Count Weight | Risk Profile |
|------|--------|------------|-------------------|-------------|
| **Small** | Tiny cluster (8x8 px) | 1 | 60% | Safe — junk and coins only |
| **Medium** | Wider pile (12x12 px) | 2 | 30% | Moderate — items, low enemy chance |
| **Large** | Tall heap (16x16 px) | 3 | 10% | Dangerous — best loot, enemies, conditions |

**Large piles are rare but rewarding.** A room with a large pile is an event.

---

## 3. Pile Generation — Per Chamber

### How Many Piles?

Roll when chamber is first entered (or generated). ALL chamber types can have piles.

| Chamber Type | Pile Count | Notes |
|-------------|-----------|-------|
| combat_standard | 0-2 | Appear after combat is cleared |
| combat_elite | 1-2 | Always at least 1 — elites guard good stuff |
| mini_boss | 1-2 | Same as elite |
| boss | 1 (guaranteed large) | Boss room has one big pile |
| merchant | 0-1 | Sometimes junk near the stall |
| quest_npc | 0-1 | |
| rest | 0-2 | Safe searching |
| trap | 0-1 | |
| loot / hidden | 0-1 | Chest is the main event, pile is bonus |
| event | 0-2 | |
| zone_door | 0 | Transition, no piles |
| keystone | 0-1 | |
| stairwell_entry | 0 | |
| stairwell_descent | 0 | |

### Generation Function

```js
function generateJunkPiles(chamber, zoneDef, floorId) {
  var config = PILE_COUNTS[chamber.type] // { min, max }
  var count = config.min + Math.floor(Math.random() * (config.max - config.min + 1))
  
  var piles = []
  for (var i = 0; i < count; i++) {
    var sizeRoll = Math.random()
    var size = sizeRoll < 0.6 ? 'small' : sizeRoll < 0.9 ? 'medium' : 'large'
    piles.push(createPile('pile_' + i, size, zoneDef, floorId))
  }
  return piles
}
```

---

## 4. Layer Content Generation

Each layer is pre-rolled with contents. PER roll determines how much the player *finds*.

### Layer Content Table

| Content | Small (Layer 1) | Medium (Layer 1) | Medium (Layer 2) | Large (Layer 1) | Large (Layer 2) | Large (Layer 3) |
|---------|----------------|-------------------|-------------------|-----------------|-----------------|-----------------|
| **Gold** | 1-3g | 2-5g | 3-8g | 2-5g | 5-10g | 8-15g |
| **Junk item** | 80% | 70% | 60% | 70% | 60% | 50% |
| **Real item** | 5% | 15% | 25% | 15% | 25% | 40% |
| **Enemy** | 0% | 5% | 15% | 10% | 20% | 30% |
| **Condition** | 0% | 10% | 15% | 10% | 15% | 25% |
| **Terminal** | 0% | low | low | low | medium | high |
| **XP base** | 3 | 5 | 8 | 5 | 10 | 15 |

### Terminal Placement

Terminals are placed during floor generation, not per-pile. Each zone gets exactly ONE terminal, hidden in a random pile (medium or large only, layer 2+). If the zone has no medium/large piles at all, the terminal is placed in the largest available pile's deepest layer.

**Terminals are ALWAYS revealed when their layer is searched**, regardless of PER roll. Even on a bad roll, you uncover it. The PER roll only affects the other loot in that layer.

---

## 5. The Search Mechanic

### PER Roll

```
Search roll = d20 + PER modifier
```

| Roll | Discovery Quality | Effect |
|------|-------------------|--------|
| 1 (nat) | **Fumble** | Ambush if enemy exists in layer, condition always applies. Junk/gold at half. XP: 0 |
| 2-7 | **Poor** | Junk only. Gold at half. No real items found even if layer has one. XP: base × 0.5 |
| 8-13 | **Decent** | Full gold. Junk found. Real item found if present (50% chance). XP: base |
| 14-18 | **Good** | Full gold. Junk found. Real item found if present (100%). Enemies spotted first (you choose to fight or retreat). XP: base × 1.5 |
| 19-20 | **Excellent** | Full gold + bonus. Junk found. Real item guaranteed. Enemies avoided entirely. Conditions avoided. XP: base × 2 |

### Key Principles

- **You always get something** — even a poor roll gives junk and some gold
- **High PER avoids danger** — good rolls let you spot enemies before they ambush, avoid conditions
- **XP scales with quality** — incentivises PER investment
- **Nat 1 is the only truly bad outcome** — and even then you get half the gold/junk

### Enemy Encounters From Piles

When a layer contains an enemy and the search triggers it:
- **Nat 1 / Poor roll (2-7)**: Ambush — enemy gets a free first strike, then normal combat
- **Decent roll (8-13)**: Normal combat — you stumble into it
- **Good roll (14-18)**: You spot it — choose to fight (normal combat) or back away (lose access to rest of pile)
- **Excellent roll (19+)**: Avoided entirely — enemy disperses, you get the loot

Enemy type comes from the zone's encounter pool (level 1 for small/medium piles, level 2 for large).

### Condition Hazards From Piles

When a layer has a condition hazard:
- **Nat 1 / Poor roll**: Condition applied (NAUSEA from dust, POISON from spores, etc.)
- **Decent roll**: 50% chance condition applies
- **Good+ roll**: Avoided

Zone-themed conditions:
- Garden: POISON (spores), NAUSEA (pollen)
- Underground: BLIND (dust), DAZE (loose rocks)
- Underbelly: POISON (mould), SLUGGISH (slime)

---

## 6. Junk Items — Zone-Themed Stackable Tat

### Data Structure

New JSON file: `src/data/junk.json`

```json
{
  "junkPools": {
    "montors_garden": [
      { "id": "broken_gnome",     "name": "Broken Gnome",       "sellPrice": 1 },
      { "id": "rusty_trowel",     "name": "Rusty Trowel",       "sellPrice": 1 },
      { "id": "dried_flowers",    "name": "Dried Flowers",      "sellPrice": 1 },
      { "id": "empty_seed_packet","name": "Empty Seed Packet",  "sellPrice": 1 },
      { "id": "cracked_pot",      "name": "Cracked Pot",        "sellPrice": 2 },
      { "id": "tangled_hose",     "name": "Tangled Hose",       "sellPrice": 1 },
      { "id": "faded_label",      "name": "Faded Plant Label",  "sellPrice": 1 },
      { "id": "snapped_rake",     "name": "Snapped Rake Handle","sellPrice": 1 },
      { "id": "worm",             "name": "Worm",               "sellPrice": 1 },
      { "id": "bird_bath_chunk",  "name": "Bird Bath Fragment", "sellPrice": 2 }
    ],
    "montors_cellar": [
      { "id": "loose_brick",      "name": "Loose Brick",        "sellPrice": 1 },
      { "id": "rusty_chain",      "name": "Rusty Chain",        "sellPrice": 2 },
      { "id": "rat_droppings",    "name": "Rat Droppings",      "sellPrice": 1 },
      { "id": "damp_rag",         "name": "Damp Rag",           "sellPrice": 1 },
      { "id": "bent_nail",        "name": "Bent Nail",          "sellPrice": 1 },
      { "id": "mouldy_sock",      "name": "Mouldy Sock",       "sellPrice": 1 },
      { "id": "cracked_bottle",   "name": "Cracked Bottle",     "sellPrice": 1 },
      { "id": "cobweb_ball",      "name": "Ball of Cobwebs",    "sellPrice": 1 },
      { "id": "broken_lantern",   "name": "Broken Lantern",     "sellPrice": 2 },
      { "id": "single_boot",      "name": "Single Boot",        "sellPrice": 1 }
    ]
  }
}
```

### Inventory Storage

Junk is stored separately from regular items — in a `junkBag` array on the player:

```js
character.junkBag = [
  { id: "broken_gnome", name: "Broken Gnome", count: 3 },
  { id: "rusty_trowel", name: "Rusty Trowel", count: 1 },
]
```

Stackable by ID. Displayed in a "Junk" tab in inventory alongside Weapons/Armour/Items.

---

## 7. Terminals

### Data Structure

Terminal data lives on the zone definition. One terminal per zone, placed into a junk pile during generation.

```json
// In zones.json, per zone:
"terminal": {
  "name": "Mossy Shrine",
  "description": "A stone plinth buried under dead leaves. Vines grip the edges. Something hums inside.",
  "theme": "garden"
}
```

### Terminal Object (on pile layer)

When a pile layer has `terminal: true`, searching that layer reveals:

```js
{
  terminal: true,
  terminalData: {
    name: "Mossy Shrine",
    description: "...",
    theme: "garden",
    zoneId: "montors_garden",
    activated: false,   // becomes true after a Gift is applied here
  }
}
```

### Terminal Interaction

When revealed, the terminal stays in the room as a separate interactable (like a corpse or NPC). Player can:
- **Inspect**: see name + description + theme
- **Apply Gift** (if carrying an extracted power): choose Body/Mind/Weapon/Clothing
- **Leave**: terminal persists in room for backtracking

If the player has no extracted powers yet, inspecting says something like: *"It hums faintly. You have nothing to offer it."*

### Terminal Placement Rules

1. Exactly one terminal per zone
2. Only placed in medium or large piles (layer 2+)
3. Always revealed on search regardless of PER roll
4. If no medium/large piles exist in the zone (unlikely), placed in the deepest layer of the largest pile available
5. Terminal's chamber is flagged: `chamber.hasTerminal = true` (for future map hints)

---

## 8. Pile Sprite Data

For the renderer, each pile size maps to a sprite:

```json
{
  "pileSprites": {
    "small":  { "width": 8,  "height": 6,  "label": "Scraps" },
    "medium": { "width": 12, "height": 10, "label": "Heap" },
    "large":  { "width": 16, "height": 14, "label": "Mound" }
  }
}
```

Zone tinting: Garden = green-brown, Underground = grey-brown, etc. Same pixel art style as existing sprites.

Pile states:
- **Unsearched**: full sprite, tappable
- **Partially searched**: smaller sprite (medium → small appearance, large → medium appearance)
- **Depleted**: gone (or tiny scattered pixels if we want a "searched" indicator)

---

## 9. XP Summary

| Source | XP |
|--------|-----|
| Small pile (1 search) | 3-6 (base 3, ×2 on excellent) |
| Medium pile (2 searches) | 5-8 per layer (10-16 total) |
| Large pile (3 searches) | 5-15 per layer (20-45 total) |
| Enemy from pile (defeated) | Normal combat XP |

A thorough searcher who hits every pile gains significant XP over a rusher. This is intentional — **exploration is a valid levelling strategy**.

---

## 10. State Flow Summary

```
Enter chamber
  → (if combat: fight first)
  → generateJunkPiles() → chamber.junkPiles = [...]
  → Render pile sprites alongside doors

Tap pile
  → Show pile info: "A small heap of garden debris" + [Search] button

Tap Search
  → Roll d20 + PER mod
  → Resolve layer contents against roll quality
  → Award gold, junk, items, XP
  → Trigger enemy/condition if applicable
  → pile.searched++
  → If pile.searched >= pile.maxSearches → pile.depleted = true
  → If layer had terminal → reveal terminal interactable in room
  → Update pile sprite (shrink or remove)

Tap revealed terminal
  → Show terminal info
  → [Apply Gift] if player has extracted power
  → Otherwise: "It hums faintly. You have nothing to offer it."
```

---

## 11. Files To Create/Modify

| File | Action |
|------|--------|
| `src/data/junk.json` | **NEW** — junk item pools per zone |
| `src/data/zones.json` | Add terminal definitions per zone, pile count config |
| `src/lib/junkpiles.js` | **NEW** — generation + search resolution logic |
| `src/lib/dungeon.js` | Call `generateJunkPiles()` in chamber content generation |
| `src/pages/Game.jsx` | Pile interaction UI, search flow, terminal interaction |
| `src/components/JunkPileSprite.jsx` | **NEW** — pile sprite renderer (3 sizes) |
| `src/components/ChamberView.jsx` | Show pile sprites + search UI in room view |
| `src/data/loot-tables.json` | No changes — reuses existing floor loot tables for real items |

---

## 12. Implementation Order

1. Create `junk.json` with Garden + Underground junk pools
2. Create `junkpiles.js` — pile generation + layer generation + search resolution
3. Wire pile generation into `dungeon.js` chamber creation
4. Add pile sprites (3 sizes) to sprite system
5. Add pile UI to Game.jsx room view (tappable, search flow, results)
6. Add junkBag to player state + Junk tab in inventory
7. Add terminal placement logic
8. Add terminal interaction UI
9. Wire XP from searches into existing XP system
