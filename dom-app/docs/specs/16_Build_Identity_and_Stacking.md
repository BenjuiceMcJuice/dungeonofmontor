# Build Identity — Condition Stacking, Proc Items, and Synergy

> Design spec — 2026-04-01
> The goal: every run should feel like a build, not just "hit things with STR"

---

## Core Idea

Items, gifts, and stats should stack to create **build identities**. Finding a BLEED dagger should make you think "I'm going BLEED build" and then every subsequent item/gift choice reinforces that. By mid-run you should feel like your character has a *style*.

---

## 1. Condition Build Identities

### BLEED Build
Stack bleeds, make them hurt more, make them apply faster.

| Layer | Source | Effect |
|---|---|---|
| Weapon | Montor's Pruning Shears | BLEED on hit |
| Offhand | Montor's Thorn Shield (new) | BLEED on being hit (they cut themselves on your shield) |
| Relic | Montor's Bandage Soaker (new) | BLEED damage +1 per stack |
| Gift (Body) | Blood gift | Lifesteal 5% — you heal from their bleeding |
| Gift (Mind) | Blood gift | FEAR immune + BLOODLUST below 25% |
| Gift (Fusion) | Blood body+mind | Kills heal 20%, BLEED stacks don't cap at 5 |
| Stat | AGI | Dual daggers = double BLEED application |

**The fantasy:** Death by a thousand cuts. They bleed out while you dance around them.

### BURN Build
Explosive damage, AoE, spread fire everywhere.

| Layer | Source | Effect |
|---|---|---|
| Weapon | Montor's Fireplace Poker | BURN on hit |
| Relic | Montor's Matchbook (new) | BURN lasts 1 extra turn |
| Relic | Montor's Oven Mitt (new) | BURN immunity for you + BURN damage +2 |
| Gift (Body) | Ember gift | +2 damage, 10% BURN on any hit |
| Gift (Mind) | Ember gift | +2 INT, conditions last 1 extra turn |
| Gift (Fusion) | Ember body+mind | Crits BURN all enemies (AoE) |
| Stat | INT | Better condition application chance |

**The fantasy:** Everything is on fire. Always. Including you (but you're immune).

### FROST Build
Control and shutdown. Nobody moves, nobody thinks.

| Layer | Source | Effect |
|---|---|---|
| Weapon | Montor's Ice Pick | FROST on hit |
| Shield | Montor's Frozen Lid (new) | Block chance + FROST on blocking |
| Relic | Montor's Draught Excluder (new) | FROST lasts 1 extra turn |
| Gift (Body) | Stone gift | +3 DEF — frozen enemies can't hurt a tank |
| Gift (Mind) | Stone gift | DAZE immune — you're the immovable one |
| Stat | DEF | Tank while they're frozen |

**The fantasy:** You freeze them, then hit them while they can't move. Slow, methodical, safe.

### POISON Build
Stat drain, weakening, inevitable death.

| Layer | Source | Effect |
|---|---|---|
| Weapon | Montor's Peeling Knife | POISON on hit |
| Offhand | Second Peeling Knife (dual wield) | Double POISON chance |
| Relic | Montor's Herb Garden (new) | POISON damage +1 per tick |
| Relic | Montor's Mouldy Cheese (new) | Enemies start with -1 DEF if POISONED |
| Gift (Body) | Bile gift | POISON immune, 10% poison on any hit |
| Gift (Mind) | Bile gift | Enemies start at -1 all rolls |
| Gift (Fusion) | Bile body+mind | All enemies start POISONED |
| Stat | INT | Better application, +damage with enchanted weapons |

**The fantasy:** They get weaker every turn. You barely need to hit them.

### FEAR Build
Psychological warfare. They're too scared to fight properly.

| Layer | Source | Effect |
|---|---|---|
| Weapon | Montor's Mum's Bread Knife | FEAR on hit |
| Relic | Montor's Scary Mask (new) | FEAR lasts 1 extra turn |
| Relic | Montor's Bell (new) | On entering combat, 20% chance all enemies start AFRAID |
| Gift (Body) | Blood gift | Lifesteal — they fear you because you feed on them |
| Gift (Mind) | Blood gift | FEAR immune + BLOODLUST |
| Stat | CHA | (Future) Intimidation — FEAR threshold lowered |

**The fantasy:** They see you and flinch. You haven't even drawn your weapon.

---

## 2. Floor-Specific Montor Items

Each floor drops unique items themed to that zone. Lower floors = stronger items. Once persistence exists, items from lower floors can appear on higher floors at reduced drop rate.

### The Grounds (Garden) — Petal themed
| Item | Type | Effect |
|---|---|---|
| Montor's Garden Hose | relic | Regen +1 per chamber, stacks with Garden Charm |
| Montor's Bee Smoker | consumable | DAZE all enemies for 1 turn |
| Montor's Thorn Shield | offhand | +2 DEF, BLEED on being hit (they cut themselves) |
| Montor's Compost Heap | relic | Dodgy consumables always succeed (END roll +5) |

### The Underground (Hall/Kitchen) — Stone themed
| Item | Type | Effect |
|---|---|---|
| Montor's Gravy Ladle | weapon (mace) | d6, 50% DEF ignore, heals 2 HP on kill |
| Montor's Oven Mitt | relic | BURN immunity + BURN damage +2 when you apply it |
| Montor's Silver Tray | offhand | +3 DEF, 20% block, reflects 1 damage |
| Montor's Recipe Book | relic | Consumables 50% more effective (heal × 1.5) |

### The Underbelly (Sewers/Cistern) — Bile themed
| Item | Type | Effect |
|---|---|---|
| Montor's Drain Rod | weapon (mace) | d8, 50% DEF ignore, NAUSEA on hit |
| Montor's Gas Mask | relic | NAUSEA + POISON immunity |
| Montor's Mouldy Cheese | relic | POISONED enemies also lose -1 DEF per tick |
| Montor's Sewer Map | relic | Reveal all chamber types on the floor (PER bypass) |

### The Quarters (Bedroom/Study) — Blood themed
| Item | Type | Effect |
|---|---|---|
| Montor's Bedpost | weapon (mace) | d10, slow, DAZE on hit, 50% DEF ignore |
| Montor's Scary Mask | relic | FEAR lasts 1 extra turn |
| Montor's Bell | relic | 20% chance all enemies start AFRAID on combat start |
| Montor's Diary | relic | +3 WIS (he wrote his secrets in it) |

### The Works (Forge/Workshop) — Ember themed
| Item | Type | Effect |
|---|---|---|
| Montor's Forge Hammer | weapon (mace) | d12 (!), slow, 50% DEF ignore, BURN on crit |
| Montor's Matchbook | relic | BURN lasts 1 extra turn on enemies |
| Montor's Bellows | consumable | BURN all enemies (like Bath Bomb but stronger — 12 dmg) |
| Montor's Blueprint | relic | Automaton enemies deal 50% damage to you |

### The Deep (Caverns/Chasm) — Void themed
| Item | Type | Effect |
|---|---|---|
| Montor's Stalactite | weapon (dagger) | d6, fast, double strike, BLEED + FEAR on crit |
| Montor's Lantern | relic | Negate day/night penalties, +2 PER in dark areas |
| Montor's Echo Stone | relic | Reroll one damage die per combat (proto dice-power) |
| Montor's Void Shard | relic | +2 to all stats, but -10 max HP |

### Montor's Domain (Throne Room) — Montor's personal collection
| Item | Type | Effect |
|---|---|---|
| Montor's Crown | relic | +1 all stats, enemies occasionally skip turns (5% chance — intimidation) |
| Montor's Throne Arm | weapon (mace) | d10, 50% DEF ignore, FEAR + DAZE on hit |
| Montor's Final Letter | relic | Read at safe room — reveals Montor's mood (AI system prep) |

---

## 3. Proc-on-Roll Items

Items that trigger effects on specific die rolls. Makes every roll exciting.

| Item | Proc trigger | Effect |
|---|---|---|
| Montor's Lucky Horseshoe (new) | Nat 7 on d20 | Heal 5 HP ("lucky seven") |
| Montor's Cursed Coin (new) | Nat 1 on d20 | Deal 3 damage to self, but +5 damage next hit |
| Montor's Double-Edged Razor (new) | Nat 20 on d20 | Apply ALL conditions from your equipped items (not just weapon) |
| Montor's Metronome (new) | Even damage roll | +2 damage. Odd = -1 damage. Rhythm matters. |
| Montor's Rigged Scales (new) | Any roll of 13 | Gain 13 gold. "Unlucky for some." |

---

## 4. Shields That Do Things

Shields shouldn't just block — they should be part of the build.

| Shield | DEF | Block% | Special |
|---|---|---|---|
| Bit of Wood | +2 | 15% | — (basic) |
| Montor's Pot Lid | +3 | 20% | — (existing) |
| Montor's Dinner Tray | +4 | 25% | — (existing) |
| Montor's Thorn Shield | +2 | 15% | BLEED enemy on block |
| Montor's Frozen Lid | +3 | 20% | FROST enemy on block |
| Montor's Mirror Shield | +2 | 15% | Reflect conditions back on block |
| Montor's Spiked Buckler | +1 | 10% | Reflect 3 damage on block |

**Shields as build enablers:** Thorn Shield + BLEED dagger = every interaction causes bleeding. Frozen Lid + Ice Pick = everything frozen.

---

## 5. Gift Body Slot — Condition Amplification

When a Gift is equipped in the Body slot, it should amplify the matching condition:

| Gift | Body slot amplification |
|---|---|
| Petal | Regen 2/chamber + BLEED you apply heals you for 1 per stack |
| Stone | +3 DEF + DAZE you apply lasts 1 extra turn |
| Bile | POISON immune + POISON you apply drains 2 stats per tick (not 1) |
| Blood | 5% lifesteal + BLEED you apply does +1 damage per stack |
| Ember | +2 damage + BURN you apply does +3 burst damage (8 total instead of 5) |
| Void | +5 HP + all conditions you apply last 1 extra turn |

This means: find a BLEED weapon → activate Blood gift in Body slot → your BLEED now does +1 per stack → combined with Bandage Soaker relic → BLEED does +2 per stack → deadly.

---

## 6. Buff Duration Item

| Item | Effect |
|---|---|
| Montor's Hourglass (new relic) | All stat buffs (Angry Juice, Thick Gloop, etc.) last 2 extra turns |
| Montor's Slow Clock (new relic) | All conditions YOU apply last 1 extra turn |
| Montor's Fast Clock (new relic) | All conditions applied TO you last 1 fewer turn (min 1) |

The Hourglass makes consumable buff builds viable — Angry Juice (+4 STR for 3 turns) becomes +4 STR for 5 turns.

---

## 7. Trickle-Up Loot

Once persistence exists (Stage 2):
- Items from floor N can appear on floor N-1 at 15% of original drop weight
- Items from floor N can appear on floor N-2 at 5% of original drop weight
- Finding a Deep item on the Garden floor is extremely rare but possible
- Creates "holy grail" moments — finding Montor's Forge Hammer in the Garden

For Stage 1 (current): each floor only drops its own items + the floor above (at reduced rate).

---

## Summary

The key insight: **every item should make you think about your build**. Not "this has higher stats" but "this synergises with what I already have." The player who finds a BLEED dagger and then finds a Thorn Shield should feel like the game is rewarding their build choice, not just giving them random stuff.
