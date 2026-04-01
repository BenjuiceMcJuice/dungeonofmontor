# Dungeon of Montor

A roguelike dungeon crawler where you raid a hoarder's home.

**Play it:** [benjuicemcjuice.github.io/dungeonofmontor](https://benjuicemcjuice.github.io/dungeonofmontor/)

---

## The Idea

Montor is a sarcastic, possessive dungeon keeper who lives in a sprawling underground home stuffed floor-to-ceiling with his things. Old furniture, broken clocks, identical spoons, his mum's rolling pin. He's a hoarder, and this is his house.

You're a knight. You've broken in. He's not happy about it.

The dungeon isn't full of generic fantasy loot -- it's full of **Montor's stuff**. His fireplace poker (still hot, always hot). His mum's bread knife (she could silence a room). His favourite gnome (it's watching you). The mundane adventurer gear left behind by previous intruders? He calls them "Boring Sword" and "Dodgy Red Liquid" because he doesn't think much of outsiders.

## How It Works

### Build Your Knight
Before each run you get **10 stat points** and **50 gold** to build your fighter:
- Pump AGI, grab a dagger -- fast, double-strike build
- Pump STR, grab a mace -- heavy hits that punch through armour
- Pump DEF, grab a shield -- tank everything
- Spread it out, buy potions -- survive by adapting

### Explore the Dungeon
A 4x4 maze of rooms per zone. Navigate through doors, fight enemies, find merchants, loot chests, and search through Montor's junk. Two floors so far:
- **The Grounds** -- Montor's Garden. Rats and slugs. The Gardener sells you things behind Montor's back.
- **The Underground** -- Great Hall and Kitchen. Orcs show up. The Butler and the Cook are merchants.

### Combat
D20-based, turn-by-turn. Roll to attack, roll damage. Four tiers: crit, hit, glancing, miss.

**Weapon types matter:**
- **Daggers** (d4, fast) -- chance to strike twice, scales with AGI
- **Swords** (d6-d8, balanced) -- reliable, no gimmick
- **Maces** (d6-d10, heavy) -- ignore 50% of enemy DEF, slow
- **Shields** -- block chance that scales with DEF stat

**14 conditions** that affect both body and mind: BLEED stacks and triggers FEAR. FROST numbs your body (-AGI) and mind (-INT). BURN does burst damage and makes you skip turns from panic.

### Montor's Collection
The best items are Montor's personal belongings, each imbued with a fragment of his power (Gift Powers):
- **Montor's Pruning Shears** -- dagger, BLEED, Petal gift
- **Montor's Fireplace Poker** -- mace, BURN, Ember gift
- **Montor's Mum's Wedding Ring** -- 10% lifesteal, Blood+Void gifts
- **Montor's Dressing Gown** -- dodge chance, Void gift (somehow invisible)
- **Montor's Void Cleaver** -- d10 sword, FEAR, DEF ignore (he's noticed it's missing)

### Stats That Matter
9 allocatable stats, each with a purpose:
| Stat | What it does |
|---|---|
| STR | Attack and damage |
| DEF | Damage reduction, shield block |
| AGI | Initiative, dagger double-strike |
| INT | Condition application chance |
| LCK | Loot rarity |
| PER | Searching quality |
| END | Carry capacity |
| WIS | Montor's Gift power |
| CHA | Merchant prices |

---

## What's Built (Stage 1 -- The Crawl)

- Data-driven engine (10 JSON content files, pure logic engine)
- 2 floors, 3 zones, 48 chamber templates
- 40+ items with Montor-themed naming
- 14 dual body+mind conditions
- Weapon type system (dagger/sword/mace/shield)
- 9 relic passives wired (regen, lifesteal, dodge, block, crit, etc.)
- Tabbed inventory UI with equip/unequip
- Pre-run preparation (stat allocation + starter merchant)
- In-run levelling (4 levels, stat pick each)
- Merchants as Montor's household staff with varied stock
- Combat with narrative, dice rolling, conditions
- Multi-zone progression with bosses, keystones, zone doors

## What's Planned

- **Junk piles** -- search Montor's hoarded rubbish for XP, items, and hidden treasures
- **Inventory weight** -- END governs how much you can carry
- **Montor's Gifts** -- find his treasures in junk piles, sacrifice at safe rooms for permanent boons
- **Floor-themed items** -- Garden Shears, Kitchen Cleaver, etc.
- **Dice manipulation powers** -- reroll, bump, flip (Balatro-inspired)
- **AI conversations with Montor** -- freeform chat, per-run mood system, rewards for reading him
- **Multiplayer** -- friends join your party, async turns
- **The full dungeon** -- 7 floors from Garden to Montor's Domain

## Tech Stack

- React 18 + Vite + Tailwind v4
- Firebase Auth + Firestore
- Deployed on GitHub Pages
- Built with [Claude Code](https://claude.com/claude-code)

---

*"You're still here? Interesting."* -- Montor
