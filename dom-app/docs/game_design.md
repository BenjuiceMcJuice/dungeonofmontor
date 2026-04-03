# Dungeon of Montor -- Game Design

> Master game design document. Updated 2026-04-03.

---

## 1. Overview

Dungeon of Montor is a browser-based RPG PWA -- mobile or desktop, solo or multiplayer -- combining D&D-style tactical mechanics with AI-driven live narrative. The dungeon belongs to Montor — an eccentric, possessive enigma who filled his home with household items repurposed as weapons. Nobody knows what Montor is. He is never seen, never explained. Players descend 7 floors through his house, fighting with his kitchen knives and pruning shears, stealing his powers, and (eventually) confronting him at the bottom.

The game's visual identity is BBC Micro-style flat pixel art -- solid colour fills, black outlines, no gradients. All sprites are drawn as canvas grid arrays in code. No image files exist. Enemy power tier is communicated by colour alone (Dust/Slate/Iron/Crimson/Void).

**Current state (2026-04-03):** Solo dungeon crawl fully playable. 7 floors, 13 zones, 189 items, 12 enemy archetypes, 14 conditions, full d20 combat, junk pile searching, Montor's Gift system (Petal gift implemented with 16 effects), dual vendor system, in-run levelling.

---

## 2. Core Mechanics

### The d20 System

Every meaningful outcome is resolved with a d20 roll plus a stat modifier. The game uses a universal 4-tier resolution system for all rolls:

| Tier | Roll (base) | Probability | Label |
|---|---|---|---|
| Critical Success | Natural 20 (or crit threshold) | 5% base | Best possible outcome |
| Success | 11-19 | 45% | Clean outcome |
| Failure | 5-10 | 30% | Partial / costly outcome |
| Critical Failure | 1-4 | 20% | Worst outcome |

Stat modifiers shift results between tiers. The crit threshold can be lowered by LCK and specific items (e.g. Montor's Thimble).

### Modifier Formula

`modifier = floor((stat - 10) / 2)`

| Stat value | Modifier |
|---|---|
| 6 | -2 |
| 8 | -1 |
| 10 | +0 |
| 12 | +1 |
| 14 | +2 |
| 16 | +3 |
| 18 | +4 |

---

## 3. Stats

### Combat Stats (active now)

| Stat | Abbr | What it does | Per +1 modifier |
|---|---|---|---|
| Strength | STR | Added to d20 attack roll AND weapon damage roll | +1 to hit, +1 damage |
| Defence | DEF | floor(DEF/3) subtracted from incoming damage; +2.5% shield block chance | ~0.33 less damage taken per hit |
| Agility | AGI | Added to d20 initiative roll; +5% double strike chance (daggers); dodge chance | +1 init, +5% bonus attack |
| Intellect | INT | +5% condition application chance with enchanted weapons; bonus enchant damage | +5% proc chance |
| Luck | LCK | Lowers crit threshold (base 20); added to d100 loot rarity roll | Crit on 1 lower, +1 rarity |
| Vitality | VIT | Max HP = baseHp + (VIT x 5) | +5 max HP |

### Exploration Stats (partially active)

| Stat | Abbr | What it does | Status |
|---|---|---|---|
| Perception | PER | Added to d20 junk search roll; spot hidden rooms/traps | Active for junk search |
| Endurance | END | Carry capacity = 10 + END mod | Planned |

### Relationship Stats (planned)

| Stat | Abbr | What it does | Status |
|---|---|---|---|
| Wisdom | WIS | Gift boon power on activation; UI hints about Montor's mood | Planned (Stage 4) |
| Charisma | CHA | Reduces buy prices by mod x 5% (cap -20%); increases sell prices by mod x 10% (cap +40%) | Active for merchants |

### Inactive Stats (Stage 2+)

| Stat | Planned purpose |
|---|---|
| RES | Condition duration reduction |
| STH | Avoid encounters, surprise attack bonus |
| CUN | Trap disarm, faster searching, manipulation in conversations |
| WIL | Resist mind conditions (reduce duration/chance) |

---

## 4. Combat

### Attack Resolution

Attacks use the 4-tier system with STR modifier (or AGI for daggers).

| Tier | Result | Damage | Condition apply % |
|---|---|---|---|
| Critical Hit | Legendary blow | Full damage x crit multiplier | 80% |
| Hit | Clean strike | Full damage | 40% |
| Glancing Blow | Partial contact | Half damage | 5% |
| Miss | No contact | None | 0% |

**Damage formula:** `weapon die roll + STR modifier - floor(enemy DEF / 2)`, minimum 1. Glancing blows halve the result.

**Crit system:** Default threshold is natural 20 (5%). LCK lowers the threshold by 1 per modifier point. Crit damage multiplier is 1.5x by default, increased by items.

### Initiative

`d20 + AGI modifier` at combat start. Highest goes first. Ties broken by raw AGI.

### Turn Actions

**One Action:** Attack, Use Item, Throw Item, Flee (AGI check).

**One Bonus Action:** Switch equipped weapon (planned).

### Weapon Classes

| Class | Hand | Base Die | Identity | Can Use Shield? |
|---|---|---|---|---|
| Dagger | Light | d4 | Speed: double strike, +initiative, dual wield | Yes |
| Sword | Light | d6 | Balance: +accuracy, reliable damage | Yes |
| Spear | Light | d6 | First strike: high initiative bonus | Yes |
| Mace | Heavy | d6 | Armour piercing: DEF ignore, stagger | No |
| Battle Axe | Heavy | d10 | Raw power: big dice, stagger | No |
| Fists | Light | d4 | Unarmed: -1 accuracy, 2x STR bonus, +1 init | Yes |

**Weapon tiers:**
1. **Base** (Common) -- starter shop, no frills
2. **Montor's Gifted** (Uncommon/Rare) -- condition on hit, has giftPower slot for Gift upgrades
3. **Montor's Hardened** (Rare/Epic) -- best raw stats, no giftPower slot
4. **Unique** (Legendary) -- rule-breaking special effects

**Stagger:** Heavy weapons have a stagger chance (15-50%). On hit, chance to apply DAZE (guaranteed stun) to the target.

### Shields

Light weapon users can equip a shield in the offhand. Shields provide DEF bonus and a block chance percentage. Some Montor shields apply conditions on block (BLEED, BURN, DAZE). Heavy weapon users cannot equip shields.

### Dual Wielding

Two daggers can be dual-wielded. The offhand dagger gets a bonus attack at -2 accuracy with no crit chance. Combined with AGI-based double strike, dagger builds can get multiple attacks per turn.

---

## 5. Conditions

14 conditions are implemented, each affecting a body slot, mind slot, or both:

**Body conditions:** BLEED (stacking damage per turn), POISON (damage + stat drain), BURN (burst damage after countdown), FROST (skip turn + 50% extra damage taken -- brittle), NAUSEA (reduced accuracy).

**Mind conditions:** FEAR (50/50 fight-or-flight: skip turn OR adrenaline crit), DAZE (guaranteed skip turn -- proper stun), BLIND (reduced accuracy, can't search), BLOODLUST (can't flee, +damage).

**Special conditions:** ADRENALINE (force crit on next attack, then CRASH), CRASH (50% skip, -3 STR), REGEN (heal per turn).

**BLEED stacking:** BLEED damage increases with each stack. Multiple BLEED sources (weapon + shield + relic) create a viable "death by a thousand cuts" build.

**Condition builds:** The game supports deliberate build identities: BLEED (lifesteal + stacking), BURN (AoE + burst), FROST (control + brittle), POISON (stat drain + inevitability), FEAR (psychological warfare).

---

## 6. Equipment System

### Equipment Slots

| Slot | Type | Examples |
|---|---|---|
| Weapon | weapon | Daggers, swords, spears, maces, axes |
| Offhand | offhand | Shields (light weapons only), second dagger |
| Armour | armour | Tatty Leather, Clanky Armour, Montor's Dressing Gown |
| Helmet | helmet | Leather Cap, Montor's Colander, Montor's Saucepan |
| Boots | boots | Worn Boots, Montor's Wellies, Montor's Slippers |
| Ring | ring | Montor's Curtain Ring, Montor's Washer |
| Amulet | amulet | Montor's Dog Tag, Montor's Mum's Locket |
| Relic | relic | Montor's Signet Ring, Montor's Lucky Penny (utility + passive effects) |

### Item Naming

All items are household objects from Montor's collection. Weapons are kitchen implements, garden tools, and household fixtures. Armour is clothing and furniture. The naming reinforces that the dungeon is someone's home -- you're fighting with his stuff.

Generic items have disdainful names (Dodgy Red Liquid, Clanky Armour, Tatty Leather). Montor's personal items are named after him or his family (Montor's Mum's Bread Knife, Montor's Gran's Lottery Ticket).

### Relics

Relics provide passive effects while equipped. Currently 16+ utility relics wired with effects including: regen per chamber, HP bonus, LCK bonus, crit threshold reduction, condition immunity, lifesteal, damage reflection, dodge chance, die reroll, double condition application, and more.

**Condition resistance relics:** 20 single-condition resist relics + 6 combo resistance relics provide tiered protection (25%, 50%, 75%, full immunity) against specific conditions.

---

## 7. Vendor System

Two vendor types appear in the dungeon:

### Tailor (Merchant rooms)
- Named as Montor's staff (zone-specific merchant names)
- Sells **equipment**: helmets, boots, armour, rings, amulets
- Has zone-specific staple stock + one premium item
- Premium items require high CHA to access
- Player can both buy and sell (TRADE)

### Peddler (NPC rooms)
- Roaming vendor
- Sells **consumables and weapons**: potions, throwables, weapons, shields
- Stock drawn from zone loot tables
- Buy only (no selling to peddlers)

### CHA Pricing
- Buy prices reduced by CHA modifier x 5% (cap -20%)
- Sell prices increased by CHA modifier x 10% (cap +40%)
- Premium items at Tailors gated behind CHA check

---

## 8. Junk Piles and Searching

Montor is a hoarder. Most chambers have 1-3 junk piles that can be searched. Searching is the primary exploration mechanic and the only way to find Montor's hidden treasures (which unlock Gifts) and terminals (which unlock stairwells).

### Search Mechanic

**Roll: d20 + PER modifier** per pile layer. Each pile has 1-3 layers depending on size (small/medium/large).

| Roll | Outcome |
|---|---|
| 1 (nat) | Ambush -- enemies spawn, they get first strike |
| 2-5 | Nothing useful (flavour text, minor XP) |
| 6-10 | Loose coins |
| 11-14 | Junk item (named junk for the junk bag) |
| 15-17 | Useful item (consumable or common gear) |
| 18-19 | Good find (uncommon+ item from floor loot table) |
| 20 (nat) | Treasure -- Montor's Treasure or rare+ item |

### Search Intensity

| Level | Name | Roll Bonus | Ambush Range | Best for |
|---|---|---|---|---|
| Light | Quick Rummage | +0 | Nat 1 only | Low HP, safe rooms |
| Medium | Thorough Search | +2 | 1-3 | Standard exploration |
| Deep | Deep Clean | +5 | 1-5 | Treasure hunting, high PER builds |

### Consumable Junk

Some junk items found in piles are consumable (eat/drink). Each has a risk/reward profile -- the item might heal, buff, poison, or do nothing. PER helps inspect items before consuming. LCK affects quality.

### Terminal Discovery

One terminal is hidden per zone, always inside a medium or large junk pile. Finding and activating the terminal unlocks the stairwell to the next floor. You must search piles to progress.

---

## 9. Dungeon Structure

### 7 Floors

The dungeon descends through Montor's home:

| Floor | Name | Theme | Gift | Enemy Tiers |
|---|---|---|---|---|
| 0 | The Grounds | Front garden | Petal | Dust |
| -1 | The Underground | Reception rooms | Stone | Dust + Slate |
| -2 | The Underbelly | Sewers, waste | Bile | Slate + Iron |
| -3 | The Quarters | Private rooms | Blood | Iron + Crimson |
| -4 | The Works | Forge, workshop | Ember | Crimson |
| -5 | The Deep | Caves, secrets | Void Shard | Crimson + Void |
| -6 | Montor's Domain | Throne room | None | Void |

### 13 Zones

Each floor has 1-2 zones. Each zone is a self-contained 4x4 grid of 16 chambers containing: combat rooms, rest rooms, a merchant, an NPC, junk-filled empty rooms, a terminal, a boss, and a stairwell.

### Zone Progression

1. Explore chambers, search junk piles, fight enemies
2. Find the terminal (hidden in a junk pile) to unlock the stairwell
3. Defeat the zone boss
4. Descend to the next floor via the stairwell
5. Enter the safe room between floors

### Zone Doors

Some floors have two zones connected by locked doors. Doors unlock bidirectionally and their state persists.

### 12 Enemy Archetypes

| Archetype | Role |
|---|---|
| Rat | Swarm, weak, fast |
| Slug | Slow, poisonous |
| Orc | Brute melee, high STR/DEF |
| Rock Monster | Tank, massive DEF, hits hard |
| Wraith | Ignores armour, INT-based |
| Spider | Fast, venomous, fragile |
| Mimic | Ambush predator, high HP |
| Bat | Very fast, very fragile |
| Hound | Balanced, pack fighter |
| Automaton | Mechanical, highest DEF |
| Shade | Shadow caster, INT-based |
| Moth | Swarm, weakest, fast |

Enemies are tier-coloured at spawn. A Crimson Orc is visually identical to a Dust Orc but with a different colour and scaled stats.

### Power Tiers

| Tier | Name | Colour | Stat Multiplier |
|---|---|---|---|
| 1 | Dust | Light grey (#c8c8c8) | 0.8x |
| 2 | Slate | Blue-grey (#6a8fa8) | 0.9x |
| 3 | Iron | Dark steel (#4a4e52) | 1.0x |
| 4 | Crimson | Deep blood red (#6b1a1a) | 1.15x |
| 5 | Void | Near-black (#111111) | 1.3x |

---

## 10. In-Run Levelling

Characters gain XP from combat and junk searching. Up to 9 level-ups per run.

On level up:
- Max HP increases (5-10 HP, class-dependent)
- Choose one stat to increase from 9 available combat/exploration stats
- StatPicker UI with tap-to-inspect info hints

---

## 11. Loot System

Post-combat loot uses: `d100 + LCK modifier` vs rarity bands.

| Roll | Rarity |
|---|---|
| 1-40 | Common |
| 41-65 | Uncommon |
| 66-82 | Rare |
| 83-93 | Epic |
| 94-99 | Legendary |
| 100+ | Heirloom |

Loot tables are zone-specific. Each zone has weighted item pools appropriate to its floor theme and difficulty.

---

## 12. Flee System

Flee uses the 4-tier system with AGI modifier:

| Tier | Result | HP Loss | Gold Loss |
|---|---|---|---|
| Crit Success | Clean exit | None | None |
| Success | Messy exit | 5-10% max HP | None |
| Failure | Bad exit | 15-25% max HP | 10% gold |
| Crit Failure | Flee fails, turn wasted | 25-35% max HP | 20% gold |

BLOODLUST condition prevents fleeing entirely.

---

*Game Design -- v1.0 -- April 2026*
