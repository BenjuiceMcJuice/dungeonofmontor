# Stat Reference — Dungeon of Montor

> What each stat actually does in code right now. Updated 2026-04-01.

## Modifier Formula

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

## Combat Stats (active now)

### STR — Strength
| Impact | How | Per +1 mod |
|---|---|---|
| Attack roll | Added to d20 attack roll | +1 to hit |
| Damage | Added to weapon die roll | +1 damage per hit |
| **Where:** | `combat.js → resolvePlayerAttack` | Every attack, every turn |

### DEF — Defence
| Impact | How | Per +1 mod |
|---|---|---|
| Damage reduction | floor(DEF/3) subtracted from incoming damage | ~0.33 less damage per hit |
| Shield block | +2.5% block chance when shield equipped | +2.5% negate a hit |
| **Where:** | `combat.js → resolveEnemyAttack`, `calculateTierDamage` | Every hit taken |

### AGI — Agility
| Impact | How | Per +1 mod |
|---|---|---|
| Initiative | Added to d20 initiative roll | +1 to go first |
| Double strike | +5% chance for dagger bonus attack (base 20%) | +5% extra attack |
| **Where:** | `combat.js → createBattleState`, `resolvePlayerAttack` | Turn order + dagger builds |

### INT — Intellect
| Impact | How | Per +1 mod |
|---|---|---|
| Condition apply | +5% chance enchanted weapon applies condition | +5% to proc POISON/BLEED/etc. |
| **Where:** | `combat.js → resolvePlayerAttack`, `conditions.js → rollConditionApplication` | Enchanted weapon attacks |

### LCK — Luck
| Impact | How | Per +1 mod |
|---|---|---|
| Crit threshold | Lowers crit threshold (base 20) | Crit on 1 lower (e.g. 19+ instead of 20) |
| Loot rarity | Added to d100 rarity roll on drops | +1 to rarity roll |
| Gift sacrifice | Governs Montor's sacrifice severity (planned) | Milder sacrifices |
| **Where:** | `Game.jsx → critThreshold`, `loot.js → rollRarity` | Every attack + every drop |

---

## Exploration Stats (partially active)

### PER — Perception
| Impact | How | Per +1 mod |
|---|---|---|
| Junk search | Added to d20 search roll (planned) | +1 to find quality |
| Spot hidden | Reveal hidden rooms/traps (planned) | Better detection |
| **Where:** | Planned for junk pile system | Not yet wired |

### END — Endurance
| Impact | How | Per +1 mod |
|---|---|---|
| Carry capacity | Capacity = 10 + END mod (planned) | +1 item slot |
| **Where:** | Planned for weight system | Not yet wired |

### WIS — Wisdom
| Impact | How | Per +1 mod |
|---|---|---|
| Gift boon power | Strength of Montor's Gift boons (planned) | Stronger boons |
| Read Montor | UI hints about Montor's mood (planned, Stage 4) | Better mood hints |
| **Where:** | Planned for gift + AI systems | Not yet wired |

### CHA — Charisma
| Impact | How | Per +1 mod |
|---|---|---|
| Buy price | Reduced by CHA mod × 5% (planned, cap -20%) | -5% buy cost |
| Sell price | Increased by CHA mod × 10% (planned, cap +40%) | +10% sell value |
| AI conversation | Better response options (planned, Stage 4) | More dialogue choices |
| **Where:** | Planned for merchant + AI systems | Not yet wired |

---

## Inactive Stats (Stage 2+)

| Stat | Planned purpose |
|---|---|
| VIT | Max HP formula: baseHp + (VIT × 5) — formula exists but bypassed in Stage 1 |
| RES | Condition duration reduction |
| STH | Avoid encounters, surprise attack bonus |
| CUN | Trap disarm, faster searching, manipulation in conversations |
| WIL | Resist mind conditions (reduce duration/chance) |

---

## Build Comparison

Assuming 10 free points, all dumped into one stat:

| Build | Stat | From → To | Mod change | Combat impact |
|---|---|---|---|---|
| **STR dump** | STR 8→18 | -1 → +4 | +5 to every attack roll AND damage | Reliable, consistent |
| **AGI dump** | AGI 8→18 | -1 → +4 | +25% double strike (daggers), always go first | Needs daggers, high ceiling |
| **DEF dump** | DEF 8→18 | -1 → +4 | ~1.7 less damage per hit, +10% shield block | Slow but unkillable |
| **LCK dump** | LCK 10→20 | +0 → +5 | Crit on 15+ (30%), much better loot | Feast or famine |
| **INT dump** | INT 6→16 | -2 → +3 | +25% condition apply with enchanted weapons | Needs the right weapon |
| **Split** | STR 12, AGI 12, DEF 12 | all +1 | +1 dmg, +5% double strike, -0.33 dmg taken | Jack of all trades |

---

## Stat Stacking with Relics

| Relic | Effect | Stacks with |
|---|---|---|
| Montor's Thimble | Crit threshold -1 | LCK (both lower threshold) |
| Montor's Lucky Penny | +2 LCK for loot | LCK stat (combined rarity roll) |
| Montor's Dressing Gown | 15% dodge | AGI (both avoid damage) |
| Montor's Welcome Mat | Reflect 2 dmg | DEF (both punish attackers) |
| Montor's Mum's Wedding Ring | 10% lifesteal | STR (more damage = more healing) |
