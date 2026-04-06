# Junk Economy — Offload Rooms, Junk-Scaling Items, Weight

## Context
Junk is currently just sell-for-gold trash. This spec elevates junk into a meaningful resource that affects Montor's mood, enables build diversity, and creates interesting decisions about what to carry.

## Weight System (visible, no penalty yet)
- Every item has a `weight` field (0-3)
- Capacity = 10 + (END modifier x 3)
- Weight bar shown in inventory header (green/amber/red)
- Junk items count as 1 weight per stack
- **No encumbrance penalty yet** — just visibility. Penalty comes later when balanced.

## Junk Offload Rooms
Specific rooms on certain floors where you can dump junk for Montor's favour (not gold).

### Where
- One offload room per zone, placed like terminals (found in junk piles or specific chamber types)
- Themed as Montor's "tidying stations" — a shelf, a cupboard, a drawer
- Flavour: "You place the junk on the shelf. Something shifts behind the wall."

### Mechanics
- Dump any/all junk items (not treasures)
- Each item dumped: -1 disturbance (improves tidiness retroactively)
- Bulk dump option: "Put everything away"
- Montor reacts: whisper changes after dump ("He seems... grateful.")
- Can't retrieve dumped junk

### Montor Mood Impact
- Carrying lots of junk = Montor sees you as a hoarder (annoyance)
- Dumping junk = shows you respect his home (improves mood)
- **New mood factor:** junk carried count feeds into getMontorMood()
  - 0-5 junk: no impact
  - 6-10 junk: slight annoyance (-1 mood tier threshold)
  - 11+: strong annoyance (-2 mood tier threshold)

## Junk-Scaling Items & Relics
Items whose effects scale with how much junk you carry. Creates a "hoarder build" archetype.

### Planned Items
| Item | Rarity | Effect |
|---|---|---|
| Hoarder's Ring | uncommon | +0.5 DEF per junk item carried (rounded down) |
| Rat King's Crown | rare | +2% condition proc chance per 5 junk items |
| Bag of Holding | rare | +5 weight capacity, junk weighs 0 |
| Collector's Charm | uncommon | +1% crit chance per 3 junk items |
| Scrapyard Plate | rare | Armour DEF = number of junk items carried (replaces base DEF) |
| Junk Golem Totem | epic | Summon junk golem when junk count >= 15 (once per combat, 3 turns) |
| Montor's Dustpan | uncommon | Auto-offload 3 random junk at safe rooms, +1 tidiness |

### Implementation
- New `passiveEffect` types: `junk_def_bonus`, `junk_crit_bonus`, `junk_condition_bonus`, `junk_capacity`, `junk_weight_zero`
- Read `playerJunkBag.reduce(sum, j.count)` in combat.js passive calculations
- Add items to items.json with appropriate rarity/price

## Safe Room 3-Way Choice (implemented)
When reaching a safe room with non-angry Montor:

| Choice | What you get | Quality scales with mood |
|---|---|---|
| **Tonic** | Permanent +1 stat (you pick or Montor picks) | Happy: pick 2. Neutral: pick 1. Annoyed: Montor picks. |
| **Item** | A piece of equipment from Montor's collection | Happy: rare. Neutral: uncommon. Annoyed: common. |
| **Montor's Choice** | Blind — could be epic, could be junk | Happy: 40% epic, 30% rare. Neutral: 20% rare. Annoyed: 10% uncommon. |

## Rarity Price Curve (implemented)
Prices now scale steeply with rarity:
- Common: base price (already doubled from original)
- Uncommon: base price
- Rare: 1.5x
- Epic: 2x
- Legendary: 3x
- Heirloom: 4x

## Implementation Order
1. ✅ Weight display (visible, no penalty)
2. ✅ Safe room 3-way choice
3. ✅ Rarity price curve
4. Junk offload room type + UI
5. Junk count → mood impact
6. Junk-scaling items (data + combat wiring)
7. Weight encumbrance penalties (after balance testing)

## Future Considerations
- The Dump (Stage 2): pre-run hub where you trade junk for permanent unlocks
- Junk crafting: combine junk items into useful items
- Montor's Favourites: specific junk items Montor likes — extra mood boost for offloading them
