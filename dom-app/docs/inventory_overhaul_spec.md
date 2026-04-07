# Inventory Overhaul Spec

## Context
The current inventory is functional but basic. Before Stage 2 (persistent characters, cross-run items), the inventory needs to feel good. This is a UI/UX pass — no new game mechanics, just making what exists work better.

## What's Changing

### 1. Rarity Display
Items show their rarity visually everywhere they appear:

| Rarity | Colour | Border |
|---|---|---|
| common | white/default | none |
| uncommon | green | green border |
| rare | blue | blue border |
| epic | purple | purple border |
| legendary | gold | gold border |
| heirloom | crimson | crimson border + glow |

Applied to: inventory list items, item detail panel, equipped display, loot panels, merchant stock, combat item picker, junk bag.

### 2. Item Comparison
When viewing an unequipped item that could go in a slot you already have filled:
- Show "Currently equipped: [item name] → [stat comparison]"
- Green arrows for better stats, red for worse
- E.g. viewing a new sword: "Equipped: Rusty Dagger (d4, +1 acc) → This: Sword (d6)" with green arrow on damage

### 3. Better List View
Show key info inline without clicking:
- Weapons: damage die + condition icon
- Armour: DEF bonus
- Consumables: effect summary (e.g. "Heal 15", "BURN all")
- Relics: passive effect summary
- Rarity colour on item name

### 4. Sort Options
Top of each tab: sort toggle cycling through:
- Weapons: damage → rarity → name
- Wearables: DEF → rarity → name
- Consumables: type (heal/buff/throw) → rarity → name
- Relics: effect type → rarity → name
- Junk: sell value → name

### 5. Weight System (END-based)
Each item has a `weight` field (default 1 for small items, 2-3 for armour/weapons, 0 for rings/amulets).

**Capacity** = 10 + (END modifier × 3)

| Weight state | Effect |
|---|---|
| Under 75% | Normal |
| 75-100% | "Encumbered" — -1 AGI |
| Over 100% | Can't pick up more items (must drop/sell) |

Weight shown as a bar in inventory header. Junk counts toward weight.

### 6. Quick Actions
- **Tap to equip** — single tap equips (if valid), long-press for detail
- **Swipe to drop** — swipe left on an item to drop it (confirm prompt)
- **Bulk sell junk** — "Sell All Junk" button with gold total preview

### 7. Tab Cleanup
Reduce from 5 tabs to 4:

| Tab | Contents |
|---|---|
| **Gear** | Weapons + armour + shields (equippable combat items) |
| **Accessories** | Rings, amulets, relics (equippable passive items) |
| **Items** | All consumables (potions, throwables, buffs) + consumable junk |
| **Junk** | Non-consumable junk (sell-only) + treasures |

### 8. Equipped Summary Bar
Always visible at top of inventory (not per-tab):
- Weapon icon + name | Armour icon + DEF | Shield/offhand
- Weight bar: [|||||||----] 14/20
- Gold amount

### 9. Combat Inventory
During combat, inventory button shows a streamlined read-only view:
- Equipped gear summary
- Active conditions
- Item count badges (how many consumables/throwables available)
- No tabs, no scrolling through lists — just a glanceable status

## What's NOT Changing
- Equipment slots stay the same (weapon, offhand, armour, helmet, boots, amulet, 2 rings, 3 relics)
- Item data structure (items.json) stays the same except adding `weight` field
- Equip constraints (can't equip mid-combat unless enemies stunned)
- Junk bag as separate state from inventory

## Data Changes

### items.json — add weight field
```
Weights by type:
- weapon (light): 1
- weapon (heavy): 2
- armour: 2-3
- helmet: 1
- boots: 1
- shield: 2
- ring: 0
- amulet: 0
- relic: 0
- consumable: 0 (potions/bombs are light)
- junk items: 1 per stack
```

## Implementation Status

### Sprint 1: Rarity display ✅ DONE
- RARITY_COLOURS constant + rarityCol() helper
- Applied everywhere: inventory list, detail panel, equipped display, merchant stock, loot panels, corpse/chest loot, junk search results

### Sprint 2: Tab cleanup ✅ DONE
- 5 tabs: Worn (equipped) / Gear / Equip / Items / Junk
- Equipped items in dedicated Worn tab — no more stealing scroll space
- Old equipped sections disabled on Gear/Equip tabs

### Sprint 3: Sort + comparison ✅ DONE
- Sort toggle: Rarity / DMG / DEF / Name on Gear/Equip/Items tabs
- Item comparison: weapon vs weapon, armour by slot, shield vs shield
- Comparison vs empty slot ("No Helmet ▲ upgrade")
- Merchant upgrade/downgrade markers (green ▲ / red ▼)

### Sprint 4: Weight system ✅ PARTIALLY DONE
- Weight field on all 280 items (0-3 by type)
- END-based capacity: 10 + (END mod × 3)
- Weight bar in inventory header (green/amber/red)
- ❌ Encumbrance penalties NOT YET implemented (visible only, no gameplay effect)
- ❌ Can't-pick-up guard NOT YET implemented

### Sprint 5: Quick actions — REMAINING
- ❌ Tap to equip
- ❌ Bulk sell junk button
- Drop item (with confirm)

### Sprint 6: Combat inventory cleanup (1 hour)
- Streamlined read-only combat view
- Glanceable status, no tabs

## Files Affected
- `dom-app/src/pages/Game.jsx` — inventory panel rendering (major)
- `dom-app/src/data/items.json` — add weight fields
- `dom-app/src/lib/loot.js` — rarity display in merchant/loot panels
- Potentially extract to `dom-app/src/components/inventory/` — InventoryPanel, ItemCard, EquippedBar components
