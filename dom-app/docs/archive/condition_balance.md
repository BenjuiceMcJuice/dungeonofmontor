# Condition Balance Comparison

> Updated 2026-04-01. All values from conditions.json.

## Overview

| Condition | Slot | Duration | Damage | Stat penalty | Action penalty | Special |
|---|---|---|---|---|---|---|
| **BLEED** | body | Permanent | 1-5/turn (stacks) | — | — | Triggers FEAR at 3 stacks |
| **POISON** | body | 3 turns | 2/turn | -1 STR→AGI→DEF cycle, -2 INT | — | Stat drain escalates |
| **BURN** | body | 1 turn | 5 burst + 3 AoE | — | 30% skip | One big hit then gone |
| **FROST** | body | 2 turns | 0 | -3 AGI, -3 DEF, -2 INT | — | No damage, pure debuff |
| **NAUSEA** | body | 2 turns | 0 | -1 all rolls | 30% skip | Annoying but not deadly |
| **SLUGGISH** | body | 2 turns | 0 | -5 AGI | 50% can't flee, blocks items | Shuts down options |
| **FEAR** | mind | 2 turns | 0 | -2 all rolls | Paralysed if HP < 50% | Can be triggered by BLEED |
| **FRENZY** | mind | 3 turns | 0 | +3 STR, -2 DEF | Random target | Double-edged — more damage but vulnerable |
| **CHARM** | mind | 2 turns | 0 | -2 DEF | 50% skip | Strongest skip chance |
| **DAZE** | mind | 1 turn | 0 | -2 AGI | Glancing blows only | Short but devastating |
| **BORED** | mind | 2 turns | 0 | -2 all rolls | 10% skip | FEAR-lite |
| **SAD** | mind | 2 turns | 0 | -1 regen | Blocks items | Soft denial |
| **BLIND** | mind | 2 turns | 0 | -1 DEF | 50% miss chance | Strongest accuracy penalty |
| **BLOODLUST** | mind | Permanent | 3/turn if no kill | — | Can't flee | High risk/reward |

---

## Ranked by Impact on Enemies (when YOU apply them)

### Tier 1 — Fight-changing
| Condition | Why | Total impact over duration |
|---|---|---|
| **BLEED x5** | 5 dmg/turn, permanent, triggers FEAR at 3 | 15-30+ damage over fight + FEAR |
| **BURN** | 5 burst + 3 AoE in one turn | 8 damage instant (11 if adjacent enemies) |
| **CHARM** | 50% skip + -2 DEF for 2 turns | ~1 lost turn + take more damage |

### Tier 2 — Very strong
| Condition | Why | Total impact over duration |
|---|---|---|
| **POISON** | 6 damage + 3 stat drains + -2 INT over 3 turns | Damage + weakening compound |
| **FROST** | -3 DEF + -3 AGI + -2 INT for 2 turns | ~4-6 extra damage from DEF loss |
| **DAZE** | Glancing blows only for 1 turn | Halves their damage output for a turn |
| **FEAR** | -2 all rolls for 2 turns | Reduces hit chance AND damage |

### Tier 3 — Useful
| Condition | Why | Total impact over duration |
|---|---|---|
| **NAUSEA** | 30% skip + -1 rolls for 2 turns | ~0.6 lost turns + weaker hits |
| **BLIND** | 50% miss for 2 turns | ~1 lost turn equivalent |
| **BORED** | -2 rolls for 2 turns | FEAR without the paralysis |

### Tier 4 — Situational
| Condition | Why | Total impact over duration |
|---|---|---|
| **SLUGGISH** | -5 AGI for 2 turns | AGI penalty barely matters (fixed turn order) |
| **SAD** | Blocks items for 2 turns | Enemies don't use items anyway |
| **FRENZY** | +3 STR, -2 DEF, random target | Actually buffs their damage (bad to apply!) |

---

## Ranked by Impact on Player (when ENEMIES apply them)

### Tier 1 — Dangerous
| Condition | Why | How to counter |
|---|---|---|
| **BLEED x3+** | Stacking damage + triggers FEAR | Chalky Tablet, Mum's Bandage (immunity) |
| **POISON** | 2 dmg + stat drain escalates | Chalky Tablet, Herb Pouch (immunity) |
| **CHARM** | 50% skip = lose half your turns | Nasty Sniff |
| **FEAR** | -2 all rolls + paralysed below 50% HP | Nasty Sniff, Nightlight (immunity) |

### Tier 2 — Painful
| Condition | Why | How to counter |
|---|---|---|
| **BURN** | 5 burst damage + 30% skip | Chalky Tablet (but only 1 turn so fast) |
| **BLIND** | 50% miss = half your attacks wasted | Nasty Sniff |
| **DAZE** | Glancing blows only = halved damage | Nasty Sniff (but only 1 turn) |
| **NAUSEA** | 30% skip + -1 rolls | Chalky Tablet |

### Tier 3 — Annoying
| Condition | Why | How to counter |
|---|---|---|
| **FROST** | -3 DEF (take more damage) + -3 AGI + -2 INT | Chalky Tablet |
| **SLUGGISH** | Can't flee, can't use items | Chalky Tablet |
| **SAD** | Can't use items | Nasty Sniff |
| **BORED** | -2 all rolls | Nasty Sniff |

---

## Balance Issues Found

### 1. SLUGGISH is near-useless on enemies
-5 AGI doesn't affect fixed turn order. Enemies don't flee or use items. Only the AGI dodge calculation matters (player-only). **On enemies, SLUGGISH does almost nothing.**

**Fix option:** Add -2 STR to SLUGGISH (too sluggish to hit hard).

### 2. SAD is near-useless on enemies
Enemies don't use items or regen. Blocking items and -1 regen only matters for players.

**Fix option:** Add -2 STR to SAD (too sad to fight properly). Or give SAD a damage penalty.

### 3. FRENZY is a buff on enemies
+3 STR, -2 DEF, random targeting. If there's only one player, random targeting doesn't matter. So enemies with FRENZY just hit harder and take slightly more damage. **Net positive for the enemy.**

**Fix option:** This is fine — FRENZY is meant to be double-edged. But it should probably not be applied BY enemies TO enemies.

### 4. BLEED is the strongest condition overall
Permanent, stacking, triggers FEAR. Over a long fight BLEED x5 does more total damage than any other condition. The only counter is Mum's Bandage (immunity) or Chalky Tablet (cure).

**This is fine** — it's meant to be the "patient killer." But the build spec rewards it further with Blood gift (+1 per stack). Could become overpowered with full Blood build.

### 5. FROST is balanced now
With -3 DEF added, FROST has clear value: you deal more damage to frozen enemies. The -3 AGI is weaker (fixed turn order) but -3 DEF + -2 INT is solid. Good control condition.

### 6. BURN is high burst but short
5 + 3 AoE in one turn is a lot, but it's gone after that. Good for clearing weak enemies (rats/moths), less impactful on bosses. The 30% skip adds value. **Well balanced.**

### 7. Cure availability is good
- Chalky Tablet cures body (BLEED, POISON, BURN, FROST, NAUSEA, SLUGGISH)
- Nasty Sniff cures mind (FEAR, CHARM, DAZE, BLIND, BORED, SAD)
- Montor's Marvellous Medicine has random cure chance
- 3 immunity relics cover the most common conditions (BLEED, POISON, FEAR)

---

## Condition Source Summary (who applies what)

| Enemy | Condition | Chance | Floor appears |
|---|---|---|---|
| Rat | BLEED | 1.0 | 1 (Garden) |
| Slug | NAUSEA | 1.0 | 1 (Garden) |
| Moth | POISON | 0.5 | 1 (Garden) |
| Orc | FEAR | 0.5 | 2 (Underground) |
| Rock | DAZE | 1.0 | 2 (Underground) |
| Wraith | BLIND | 0.7 | 2 (Underground) |
| Spider | POISON | 1.0 | 3 (Underbelly) |
| Mimic | FEAR | 0.6 | 4 (Quarters) |
| Bat | BLIND | 0.5 | 3 (Underbelly) |
| Hound | BLEED | 0.8 | 2 (Underground) |
| Automaton | DAZE | 0.9 | 5 (Works) |
| Shade | SAD | 0.7 | 4 (Quarters) |

### Missing conditions — no enemy applies:
- BURN (player-only via Fireplace Poker / Ember gift)
- FROST (player-only via Ice Pick)
- CHARM (not applied by anyone)
- SLUGGISH (not applied by anyone)
- FRENZY (not applied by anyone)
- BORED (not applied by anyone — Montor event only?)
- BLOODLUST (gift trigger only)

**5 conditions are player-only weapons. 7 are enemy threats. CHARM, SLUGGISH, FRENZY, BORED are unused by enemies — could be assigned to deeper floor enemies.**
