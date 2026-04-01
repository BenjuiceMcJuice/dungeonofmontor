# Sprint Backlog — Dungeon of Montor

> Captured 2026-04-01. Mix of quick fixes, data work, engine tweaks, and design decisions.
> Prioritised roughly by dependency order, not importance.

---

## 1. Quick Fixes (code only)

### 1a. Unequip items
Put equipped weapons, armour, or relics back into bag. Currently you can only equip, not unequip.
- Add "Unequip" button on equipped items in inventory panel
- Weapon/armour: move to bag, slot becomes empty (bare fists / no armour)
- Relics: move individual relic back to bag, free up the slot

### 1b. Wire up relic passive effects
No relic passives actually work yet. Items have `passiveEffect` fields but Game.jsx never reads them.

**Phase 1 — simple passives:**
- `regen_per_chamber` (Trickle Charm, Surge Charm) — heal X HP on entering a new chamber
- `hp_bonus` (Ring of Vitality) — +5 max HP while equipped
- `lck_bonus` (Lucky Coin) — +2 LCK for loot rolls
- `crit_bonus` (Keen Edge Ring) — crit on 19+ instead of 20
- `see_enemy_hp_exact` (Montor's Monocle) — show exact HP numbers on enemy cards

**Phase 2 — combat passives (need combat.js changes):**
- `lifesteal` (Vampiric Ring) — heal 10% of damage dealt
- `damage_reflect` (Spiked Plate) — reflect 1 damage to attackers
- `dodge_chance` (Shadow Cloak) — 15% chance to avoid hit entirely
- `condition_immunity` (Clotting Amulet, Antivenom, Courage Stone) — block specific conditions
- `reroll_ones` (Loaded Dice) — reroll 1s on damage dice
- `reflect_conditions` (Mirror Shard) — 25% reflect conditions back at attacker
- `lottery` (Montor's Lottery Ticket) — jackpot on matching die roll

---

## 2. Trader System Improvements

### 2a. Sell items to traders
- When at a merchant, show player inventory with "Sell" buttons
- Sell price = item's `sellPrice` field (already defined in items.json)
- Gold added to player total
- Item removed from inventory
- Maybe: "Sell All" for consumables, confirm prompt for rare+ items

### 2b. Trader inventory variety
Current: every merchant sells [health_potion, rage_draught, smoke_bomb]. Boring.
- Health potions always available (high weight)
- Random selection of 4-6 items from the floor's loot pool
- Zone-appropriate weighting (Kitchen trader sells more consumables, Great Hall sells weapons)
- Prices use `buyPrice` from items.json
- Consider: merchant "personality" — some are greedy (markup), some are generous (discount)
- Data approach: add `merchantPool` to each zone definition in zones.json

---

## 3. New Items

### 3a. Last Stand Ring (relic)
DEF increases as HP drops. Rewards aggressive play and makes DEF builds more interesting.
- `passiveEffect: 'last_stand'`
- Formula: `+1 DEF per 20% HP missing` (so at 20% HP = +4 DEF)
- Rarity: rare
- Flavour: "The ring tightens as you weaken. It won't let you fall."

### 3b. Floor-themed items
Items that *belong* in the zone — things you'd literally find there. Adds flavour and makes each floor feel distinct.

**Montor's Garden:**
- Garden Shears (weapon, d4, chance to apply BLEED) — "Rusty but sharp. Still cuts."
- Thorn Shield (offhand, +2 DEF, reflects 1 dmg) — "Woven from living brambles."
- Petal Salve (consumable, heal 10 + cure body) — "Crushed petals. Surprisingly effective."
- Gardener's Gloves (relic, immunity to BLEED) — "Thick leather, thorn-proof."

**The Great Hall:**
- Ceremonial Sword (weapon, d8, +1 CHA... eventually) — "Ornate but functional."
- Banquet Plate (armour, +3 DEF, -1 AGI) — "A serving tray. Works in a pinch."
- Stale Bread (consumable, heal 5, very common) — "Hard enough to break teeth. Yours or theirs."
- Lord's Signet (relic, merchants charge 20% less) — "They recognise the crest."

**The Kitchen:**
- Kitchen Cleaver (weapon, d6, +2 dmg vs slugs) — "Heavy. Greasy. Effective."
- Cook's Apron (armour, +1 DEF, immunity to BURN) — "Fireproof. Mostly."
- Mystery Stew (consumable, random effect: heal/buff/debuff) — "Don't ask what's in it."
- Rat Jerky (consumable, heal 3, extremely common) — "It's... protein."
- Spice Pouch (relic, +1 to all consumable heal values) — "Everything tastes better."

### 3c. Trickle-up loot
Items from earlier floors can appear on later floors at reduced drop weight.
- When generating loot for floor N, include floor N-1 items at ~30% of their original weight
- Floor N-2 items at ~10% weight
- Makes earlier items feel less "wasted" — they're still around, just rarer
- Implementation: loot table generation reads all previous floor tables and merges with reduced weights

### 3d. Out-of-depth mobs
Rare chance (~5%) of an enemy from a deeper floor appearing on the current floor.
- Tougher than anything else on this floor (uses deeper floor's tier range)
- Guaranteed item drop from the deeper floor's chest table on kill
- Montor whisper on spawn: "Oh, this one wandered up. How unfortunate... for you."
- Implementation: in encounter generation, 5% chance to swap one enemy for a deeper-floor enemy

---

## 4. Weapon System Overhaul

### 4a. Weapon types with distinct identities
Currently all weapons are just "die size goes up." Inspired by Skyrim's weapon feel differences.

| Type | Die | Speed | Special | Key stat |
|---|---|---|---|---|
| Dagger | d4 | Fast | Double strike chance (% based on AGI mod) | AGI |
| Shortsword | d6 | Normal | Balanced, no penalty | STR |
| Longsword | d8 | Normal | Reliable workhorse | STR |
| Mace | d8 | Slow | Ignores 50% of target DEF | STR |
| Warhammer | d10 | Slow | Ignores 50% DEF, -2 AGI penalty | STR |
| Shield (offhand) | — | — | +DEF, % block chance (negate hit) | DEF |
| Dual wield | Main + off | — | Two attacks per turn, -2 accuracy each | AGI + STR |

**Speed mechanic:**
- Fast weapons: chance for bonus attack (scales with AGI modifier)
- Normal weapons: one attack, no modifier
- Slow weapons: AGI penalty to initiative

**This makes AGI matter** — a dagger/dual-wield build wants AGI, a mace build wants STR, a shield build wants DEF. Suddenly all three combat stats have a build path.

### 4b. Weapon subtypes in data
Add `weaponType` field to items.json:
```json
{
  "weaponType": "dagger",
  "speed": "fast",
  "doubleStrikeBase": 0.2,
  "defIgnore": 0
}
```
Engine reads `weaponType` to determine combat behaviour. All existing weapons get tagged.

### 4c. Enchanted weapon variants per type
Each weapon type should have condition-enchanted versions:
- Venomfang Dagger (POISON) — already exists
- Frost Edge Sword (FROST) — already exists
- Ember Mace (BURN, ignores DEF) — already exists but needs DEF ignore
- Dread Warhammer (FEAR, ignores DEF) — new
- Thorn Dagger (BLEED, double strike) — new

---

## 5. Character Building

### 5a. Starting kit choice + stat allocation
Instead of handing out longsword + chainmail with fixed stats, the player gets a **pre-run preparation screen** with two parts:

**Part 1 — Stat allocation:**
- Knight gets base stats (lower than current — e.g. all 5s or a small base spread)
- Player receives X free stat points to distribute (e.g. 30 points across STR/AGI/DEF/INT/LCK)
- Only the 5 combat-relevant stats are allocatable in Stage 1 (STR, AGI, DEF, INT, LCK)
- Other stats (VIT, END, WIS, PER, etc.) remain at base — unlocked for allocation in Stage 2+
- UI: simple +/- buttons per stat, shows what each stat does, total points remaining
- This is the "what kind of fighter am I?" decision

**Part 2 — Starting gold + merchant:**
- Starting gold: ~50g
- Pre-run merchant with full starter inventory
- Forces meaningful trade-off: heavy armour + dagger? Light armour + mace? All potions?
- This decision combines with stat choice to create a build identity

**The two parts together create the build:**
- High AGI + Dagger = fast striker (double strikes)
- High STR + Mace = heavy hitter (DEF penetration)
- High DEF + Shield + Chainmail = tank
- Balanced + Longsword = generalist
- High LCK + cheap gear + potions = loot gambler

**Starter merchant inventory:**
- Dagger (8g), Shortsword (15g), Longsword (25g), Mace (20g), Warhammer (40g)
- Leather Armour (12g), Chainmail (30g)
- Wooden Shield (10g) — new item, +2 DEF
- Health Potion (10g), Smoke Bomb (12g), Rage Draught (18g)

At 50g you can afford:
- Longsword (25) + Leather (12) + Potion (10) = 47g — balanced
- Warhammer (40) + Potion (10) = 50g — glass cannon
- Dagger (8) + Chainmail (30) + Potion (10) = 48g — tanky rogue
- Shortsword (15) + Shield (10) + Chainmail (30) = 55g — nope, need to compromise

### 5b. Stat relevance audit
Currently only STR has clear turn-by-turn payoff. Each stat needs a reason to invest:

| Stat | Current use | Proposed addition |
|---|---|---|
| STR | Attack + damage mod | Unchanged — core combat stat |
| AGI | Initiative only | Double strike chance, dual wield accuracy, dodge contribution |
| DEF | Passive damage reduction | Shield block chance, Last Stand synergy |
| INT | Condition application % | Unchanged — enchantment stat |
| LCK | Loot rarity roll | Unchanged — loot stat |
| WIS | Nothing | Montor's Gift power (Stage 1.5), trap detection |
| VIT | Formula exists, not active | Activate HP formula in Stage 2 |
| END | Formula exists, not active | Stamina / actions per turn (Stage 2+) |
| PER | Nothing | Reveal hidden chambers, spot traps, see enemy stats |
| RES | Nothing | Condition duration reduction |
| CHA | Nothing | Merchant prices, NPC quest rewards |
| STH | Nothing | Avoid encounters, surprise attack bonus |
| CUN | Nothing | Trap disarm, puzzle solutions |
| WIL | Nothing | Resist mind conditions (reduce duration/chance) |

Not all need to be active in Stage 1 — but AGI, DEF, PER, and RES could be wired now alongside the weapon overhaul.

---

## 6. Montor's Gifts — Effect Design

Spec exists in `docs/specs/10_Montors_Gifts.md` but boon effects are not yet defined.
Needs a design pass to decide what each Gift + Slot combination actually does.
Deferred until the gift system is built — but should be done before implementation.

---

## 7. Dice Manipulation Powers (Balatro-inspired)

A design space for Mind powers / WIS unlocks that let you manipulate dice *after* seeing the roll.
These are powerful because they give the player agency over the RNG — the feeling of "cheating fate."

**Possible powers (one per chamber / per floor / per run limits):**
- **Reroll** — reroll one attack or damage die, once per chamber
- **Bump** — add +2 to a roll after seeing it, once per chamber
- **Flip** — turn a miss into a glancing blow, once per floor
- **Force** — force a natural 20 on your next attack, once per run
- **Hold** — "bank" a good roll to use later (like Yahtzee)
- **Mirror** — copy the last enemy's attack roll as your own

**Design notes:**
- WIS stat governs how many dice powers you can hold / how often they recharge
- Could be unlocked via Montor's Gifts (Mind slot boons)
- UI: small dice icon that glows when a power is available, tap to activate before/after a roll
- Scarcity is key — if you can reroll everything, it's not interesting. One reroll per chamber = meaningful choice.
- Consider: some powers activate automatically (passive) vs manually triggered (active)

---

## Priority Order (suggested)

1. **Unequip items** — trivial fix, improves feel immediately
2. **Wire relic passives (phase 1)** — makes existing items actually work
3. **Sell to traders** — gives gold a purpose
4. **Trader variety** — data change, makes merchants interesting
5. **Weapon type overhaul** — biggest gameplay impact, makes stats matter
6. **Starting kit** — needs weapon types done first
7. **Floor-themed items** — data work, adds flavour
8. **Last Stand ring** — single new item
9. **Trickle-up loot** — loot table logic
10. **Out-of-depth mobs** — encounter engine tweak
11. **Wire relic passives (phase 2)** — combat.js changes
12. **Stat relevance** — ongoing, tied to weapon overhaul
13. **Montor's Gifts effects** — design then build
