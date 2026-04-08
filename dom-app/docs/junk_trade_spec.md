# Junk Trade System — Spec

> Turn junk from dead weight into a meaningful in-run currency. Trade junk at safe rooms for weapon enchants, stat tonics, map reveals, and Montor's favour.

---

## 1. Overview

Junk piles are everywhere. Players search them, find random items, and most of it sits in the bag doing nothing. This spec adds **junk trading** at safe rooms — spend junk items to buy meaningful upgrades. Junk count (not weight or type) is the currency. Simple, fun, no inventory management tax.

The safe room becomes a proper hub: Montor's mood determines prices and availability, and the act of trading junk *improves* his mood (you're tidying up for him).

---

## 2. Trades Available

### Weapon Enchant
| | |
|---|---|
| **Cost** | 6 junk |
| **Effect** | Apply a condition proc to your equipped weapon for the rest of the run |
| **Options** | BURN (fire damage over time), POISON (stacking damage), BLEED (damage on movement), FROST (brittle, +50% damage taken) |
| **Rules** | One enchant per weapon at a time. Applying a new one replaces the old. Enchant has a base 25% proc chance per hit, boosted by INT modifier (+5% per point). |
| **Flavour** | Montor dips your weapon in something. "Hold still. This might sting. Well, not you. Them." |

### Stat Tonic
| | |
|---|---|
| **Cost** | 4 junk |
| **Effect** | Permanent +1 to a chosen stat for the rest of the run |
| **Options** | Player picks from: STR, DEF, AGI, VIT, INT, LCK, PER, END |
| **Rules** | No limit on how many tonics you can buy (if you have the junk). Each purchase is +1 to one stat. VIT tonic also grants +5 max HP immediately. |
| **Flavour** | "I found this in the plumbing. Drink it. It's probably fine." |

### Map Fragment
| | |
|---|---|
| **Cost** | 3 junk |
| **Effect** | Reveal chamber types for unvisited rooms in the current zone |
| **Reveal tiers** (based on PER): |
| PER < 10 | Reveal 4 random unvisited chambers (type + icon only, not enemies) |
| PER 10-13 | Reveal 6 chambers |
| PER 14+ | Reveal all unvisited chambers in the zone |
| **Rules** | One purchase per zone. Already-visited chambers are always visible. Revealed chambers show type icon (⚔ combat, ☠ boss, △ rest, ⚒ merchant, etc.) but not enemy details. |
| **Flavour** | "You want a map? Nobody's mapped this place. Here — I drew this on a napkin." |

**Map display**: The 4×4 grid is already generated with `row`, `col`, `type`, `icon`, `visited`, `doors` on each chamber. The map overlay shows:
- **Visited chambers**: full detail (type, icon, cleared state)
- **Revealed chambers** (from map fragment): type icon + door connections, dimmed/faded style
- **Unknown chambers**: blank/fog, just the grid square outline
- **Current position**: highlighted border or pulsing indicator
- **Door connections**: lines between connected chambers

The map is accessible from a small button in the room header (next to Stats/Bag), opening as a full-screen overlay matching the existing overlay pattern (dark background, tap to dismiss). Available at all times, not just after buying the fragment — but unvisited rooms are fogged unless revealed.

### Montor's Favour
| | |
|---|---|
| **Cost** | 8 junk |
| **Effect** | Improve Montor's mood by one tier |
| **Tiers** | angry → annoyed → neutral → happy |
| **Rules** | Can only buy once per safe room. Cannot go above happy. The mood improvement affects the current safe room's tonic/item reward (applied immediately before reward choice). |
| **Interaction** | This is essentially bribing Montor with his own junk. He knows it. He doesn't care. "Is that... my colander? I've been looking for that. Fine. I suppose you're not entirely awful." |
| **Why it matters** | Mood determines tonic quality (happy = 2 tonics, angry = nothing). A player who's been thorough-searching everything (angering Montor) can trade junk to buy back his goodwill. Creates a push-pull: search more = more junk but worse mood. Trade junk = better mood but fewer enchants/tonics available. |

### Gift Reroll (Future — not for this build)
| | |
|---|---|
| **Cost** | 10 junk |
| **Effect** | Re-pick your gift slot effect (keep the type, choose a different power from that gift's options) |
| **Rules** | Only available if you have at least one gift equipped. One reroll per safe room. |
| **Note** | Parking this for later — the gift system is complex enough already. |

---

## 3. Safe Room Flow (Updated)

Current flow: arrive → negotiate treasure (if found) → smash gift → reward choice (tonic/item/montor's choice) → doors

New flow adds a **trade step** before reward choice:

```
arrive
  → negotiate treasure (if any)
  → smash gift (if accepted)
  → JUNK TRADE (new step)
      Show junk count in bag
      Show available trades (greyed if can't afford)
      Player picks 0 or more trades
      Each trade deducts junk from bag
      Montor's Favour (if bought) updates mood immediately
  → reward choice (tonic/item/montor's choice — now affected by updated mood)
  → doors
```

### Trade UI

Full-screen overlay (matching existing safe room overlay style):

```
┌─────────────────────────────────┐
│  MONTOR'S TRADES                │
│  Junk in bag: 7                 │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ⚔ Weapon Enchant    6 junk│  │
│  │ Apply BURN/POISON/etc.    │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 💪 Stat Tonic       4 junk│  │
│  │ Permanent +1 stat         │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🗺 Map Fragment     3 junk│  │
│  │ Reveal this zone's rooms  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🎭 Montor's Favour  8 junk│  │
│  │ Improve mood one tier     │  │
│  └───────────────────────────┘  │
│                                 │
│  [Done — continue to rewards]   │
└─────────────────────────────────┘
```

- Cards are tappable. Greyed out if junk count < cost.
- Montor's Favour shows current mood → next mood preview.
- Map Fragment greyed after purchase (one per zone).
- Weapon Enchant opens a sub-picker: choose condition type.
- Stat Tonic opens a sub-picker: choose stat (reuse StatPicker pattern).
- Junk count updates live as trades are made.
- "Done" button advances to reward choice.
- If player has 0 junk, skip this step entirely (go straight to rewards).

---

## 4. Map Overlay

### When to show
- Small map icon button in the room header bar (alongside Stats and Bag buttons)
- Tapping opens full-screen overlay
- Available at all times (combat, doors, exploration)

### Grid rendering
The 4×4 grid uses the existing chamber data:

```javascript
zone.chambers[i] = {
  row, col,           // grid position
  type,               // combat_standard, rest, merchant, boss, etc.
  icon,               // ⚔, △, ⚒, ☠, etc.
  visited,            // has player been here
  cleared,            // combat/loot resolved
  revealed,           // map fragment purchased
  doors: { N, S, E, W }  // connections
}
```

**Visual states:**
| State | Appearance |
|---|---|
| Current position | Gold border, pulsing glow |
| Visited + cleared | Solid dark fill, white icon, green checkmark |
| Visited + not cleared | Solid dark fill, white icon (combat rooms glow red) |
| Revealed (map fragment) | Dim/faded fill, grey icon, dashed border |
| Unknown | Empty square, dark fog fill, no icon |

**Door connections:** thin lines between adjacent chambers where `doors.N/S/E/W` are true. Visited connections are solid, revealed are dashed, unknown are hidden.

**Style:** pixel-art feel, dark background (#0a0812), chamber squares ~60px with 4px gaps, fits comfortably on mobile. Current room has the zone's floor-themed border colour.

### Implementation
- New component: `MapOverlay.jsx`
- Props: `zone`, `currentChamberIdx`
- Reads `zone.chambers` array for all state
- Map fragment purchase sets `revealed: true` on target chambers
- No new state needed — reads existing chamber data

---

## 5. Junk Deduction Logic

When a trade is made:
1. Count total junk items: `playerJunkBag.reduce((sum, j) => sum + j.count, 0)`
2. If count >= cost, deduct by removing items from the END of the bag first (LIFO — most recent junk goes first)
3. If a junk stack has count > 1, reduce count. If count hits 0, remove the item.
4. Update `playerJunkBag` state

```javascript
function deductJunk(bag, cost) {
  var remaining = cost
  var newBag = bag.slice()
  while (remaining > 0 && newBag.length > 0) {
    var last = newBag[newBag.length - 1]
    if (last.count <= remaining) {
      remaining -= last.count
      newBag.pop()
    } else {
      last.count -= remaining
      remaining = 0
    }
  }
  return newBag
}
```

---

## 6. Weapon Enchant Details

### How it works
- Player picks a condition type (BURN, POISON, BLEED, FROST)
- The enchant is stored on the weapon item: `weapon.junkEnchant = { condition: 'BURN', procChance: 0.25 }`
- During combat, after a successful hit, check `weapon.junkEnchant.procChance` (+ INT modifier × 0.05)
- If proc fires, apply the condition to the target enemy
- Enchant persists for the rest of the run (survives floor transitions)
- Applying a new enchant replaces the old one

### Interaction with existing weapon conditions
- Some weapons already have innate condition procs (e.g. enchanted weapons from loot)
- Junk enchant stacks separately — a weapon can have both its innate proc AND a junk enchant
- They roll independently (both can fire on the same hit)

### Condition effects (reference)
| Condition | Effect |
|---|---|
| BURN | 2 fire damage per turn, 3 turns |
| POISON | 1 damage per turn, stacks (4 turns) |
| BLEED | 3 damage per turn, 2 turns |
| FROST | Brittle: +50% damage taken, 2 turns |

---

## 7. Integration with Montor's Mood

The junk trade system creates a strategic triangle:

```
Search piles (get junk) → angers Montor (worse mood)
Trade junk (spend junk) → can buy Montor's Favour (better mood)
Better mood → better safe room rewards (tonics, items)
```

**Player choices:**
- **Careful explorer**: search carefully (1 layer), keep mood high, get free tonics. Less junk for trades.
- **Hoarder**: deep clean everything, anger Montor, but stockpile junk. Buy enchants and tonics directly, then buy Favour to recover mood.
- **Balanced**: thorough search some piles, skip others. Moderate junk, moderate mood.

This makes the tidiness/greed system actually *matter* beyond flavour text.

---

## 8. Implementation Order

| Step | What | Files |
|------|------|-------|
| 1 | `deductJunk()` utility function | `lib/junk.js` or inline in Game.jsx |
| 2 | Junk trade UI overlay (safe room step) | `Game.jsx` — new safeRoomStep: 'trade' |
| 3 | Weapon enchant sub-picker + combat integration | `Game.jsx` + `combat.js` |
| 4 | Stat tonic sub-picker (reuse StatPicker) | `Game.jsx` |
| 5 | Montor's Favour — mood tier bump | `Game.jsx` |
| 6 | Map fragment — set revealed on chambers | `Game.jsx` |
| 7 | `MapOverlay.jsx` — 4×4 grid component | New component |
| 8 | Map button in room header | `Game.jsx` |

Steps 1-2 are the foundation. Steps 3-6 are the individual trades. Steps 7-8 are the map (can be done independently).

---

## 9. Out of Scope

- **The Dump** (pre-run junk trading for permanent unlocks) — separate feature, uses cross-run junk persistence
- **Gift Reroll** — parked for later
- **Junk type preferences** (Montor wants specific junk) — future mood expansion
- **Junk weight penalties** — weight bar is visible but no gameplay penalty yet
- **Junk-scaling items** (Hoarder's Ring, Bag of Holding) — from existing junk economy spec, separate feature
