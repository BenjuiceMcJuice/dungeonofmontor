# Balance Analysis — Dungeon of Montor

> Snapshot 2026-04-01. All numbers from current data/code.

---

## Player Starting Stats (current)

Base stats (before 10 free points):
- STR 8 (mod -1), DEF 8 (mod -1), AGI 8 (mod -1)
- INT 6 (mod -2), LCK 10 (mod +0)
- PER/END/WIS/CHA 6 (mod -2)

**maxHp: 45 (hardcoded)**

With a "balanced" 10-point allocation (STR+3, DEF+2, AGI+2, LCK+2, INT+1):
- STR 11 (mod +0), DEF 10 (mod +0), AGI 10 (mod +0), LCK 12 (mod +1), INT 7 (mod -1)

With a "STR dump" allocation (STR+10):
- STR 18 (mod +4), everything else at base

---

## Enemy Stats (actual, after tier multiplier × 0.8 dust, 0.9 slate)

### Garden — Dust tier (×0.8)

| Enemy | HP | STR (mod) | DEF (mod) | AGI (mod) | Die | XP |
|---|---|---|---|---|---|---|
| Dungeon Rat | 8 | 6 (-2) | 5 (-3) | 11 (+0) | d4 | 8 |
| Ashslug | 13 | 6 (-2) | 4 (-3) | 5 (-3) | d4 | 12 |

### Garden — Slate tier (×0.9, encounter level 3 / mini-boss)

| Enemy | HP | STR (mod) | DEF (mod) | AGI (mod) | Die | XP |
|---|---|---|---|---|---|---|
| Sewer Rat | 9 | 7 (-2) | 5 (-3) | 13 (+1) | d4 | 9 |
| Venomslug | 14 | 7 (-2) | 4 (-3) | 5 (-3) | d4 | 14 |

### Garden Boss — The Overgrowth (slate slug × 3x HP, +2 STR/DEF)

| HP | STR | DEF | Die | XP |
|---|---|---|---|---|
| 42 | 9 (-1) | 6 (-2) | d4 | 60 |

### Underground — Dust Orc (×0.8)

| Enemy | HP | STR (mod) | DEF (mod) | AGI (mod) | Die | XP |
|---|---|---|---|---|---|---|
| Orc Grunt | 28 | 13 (+1) | 11 (+0) | 6 (-2) | d8 | 24 |

### Underground — Slate Orc (×0.9)

| Enemy | HP | STR (mod) | DEF (mod) | AGI (mod) | Die | XP |
|---|---|---|---|---|---|---|
| Orc Brute | 32 | 14 (+2) | 13 (+1) | 7 (-2) | d8 | 27 |

---

## Damage Calculations

### Player → Enemy (balanced build, STR 11, Boring Sword d8)

**vs Dust Rat (DEF 5, reduction = floor(5/3) = 1):**
- Hit (d8 + 0 STR mod): avg 4.5 - 1 DEF = 3.5 dmg → **kills in 2-3 hits**
- Crit: avg 9 - 1 = 8 dmg → **one-shot**

**vs Dust Orc (DEF 11, reduction = floor(11/3) = 3):**
- Hit: avg 4.5 - 3 = 2 dmg (minimum 2) → **kills in 14 hits** 😬
- Crit: avg 9 - 3 = 6 dmg → kills in 5 hits

### Player → Enemy (STR dump, STR 18, Boring Sword d8)

**vs Dust Rat (DEF 5, reduction = 1):**
- Hit: avg 4.5 + 4 - 1 = 7.5 dmg → **one-shot**

**vs Dust Orc (DEF 11, reduction = 3):**
- Hit: avg 4.5 + 4 - 3 = 5.5 dmg → **kills in 5 hits** (much better!)

### Player → Enemy (balanced build, Dull Mace d6, 50% DEF ignore)

**vs Dust Orc (DEF 11, ignored to 6, reduction = floor(6/3) = 2):**
- Hit: avg 3.5 + 0 - 2 = 2 dmg (minimum 2) → still 14 hits

**The problem is clear: balanced build can barely damage orcs. STR dump is 3x more effective.**

### Enemy → Player

**Dust Rat → Player (DEF 10, no armour, reduction = floor(10/3) = 3):**
- Hit: d4 - 2 STR mod - 3 DEF = max 2 (minimum damage) → **barely scratches**

**Dust Rat → Player (DEF 8, no armour, reduction = floor(8/3) = 2):**
- Hit: d4 - 1 STR mod - 2 DEF = max 2 → **still barely scratches**

**Orc Grunt → Player (DEF 10, no armour, reduction = 3):**
- Hit: d8 + 1 STR mod - 3 DEF = avg 5.5 - 3 = 3.5 dmg → **12 hits to kill**

**Orc Grunt → Player (DEF 10, Clanky Armour +4 DEF = 14 total, reduction = 4):**
- Hit: d8 + 1 - 4 = avg 2.5 dmg (min 2) → **18+ hits to kill**

---

## XP Progression

### Garden Zone (16 chambers)
Typical rooms: ~6 combat, 1 elite, 1 mini-boss, 1 boss = 9 combat encounters

| Encounter | Enemies | XP per |
|---|---|---|
| Standard (×4) | 1 dust rat/slug | 8-12 |
| Standard (×2) | 1-2 dust rats/slugs | 16-24 |
| Elite (×1) | 1-2 dust enemies | 16-24 |
| Mini-boss (×1) | 1 slate enemy | 9-14 |
| Boss (×1) | The Overgrowth | 60 |

**Total Garden XP: ~130-170 XP**

### Level-up thresholds:
| Level | XP | Earned by... |
|---|---|---|
| 1 | 50 | After ~5 standard fights (mid-Garden) |
| 2 | 120 | Near end of Garden or early Underground |
| 3 | 250 | Mid-Underground |
| 4 | 400 | Late Underground (if you clear everything) |

**The gap: Level 1→2 takes ~70 XP more. Level 2→3 takes 130 more. Level 3→4 takes 150 more.**

Underground enemies give more XP (24-27 per orc) but you fight 2-3 at once, so per-encounter XP jumps to 50-80. You probably hit level 3 mid-Underground and level 4 near the end if you clear every room.

---

## Problems Identified

### 1. STR is too dominant
A balanced build does minimum damage (2) to orcs. A STR dump does 5-6. That's 3x more effective. No other stat comes close to this impact.

**Fix options:**
- A) Raise minimum damage from 2 to 3 → balanced builds still chip away
- B) Change DEF formula to floor(DEF/4) → less punishing for low-STR builds
- C) Give other stats combat damage: INT adds +1 per mod to enchanted weapons, AGI adds +1 per mod to daggers

### 2. DEF is nearly invisible
floor(DEF/3) means you need 3 DEF to reduce 1 damage. Investing 6 stat points (DEF 8→14, mod -1→+2) changes reduction by... nothing directly (it's the raw DEF value, not the mod). Going from DEF 8 to DEF 14 changes reduction from 2 to 4. That's 2 less damage per hit.

**Fix:** Change to floor(DEF/2). Now DEF 8=4 reduction, DEF 14=7 reduction. Investing 6 points saves 3 damage per hit — actually meaningful.

### 3. Armour is too powerful relative to stats
Clanky Armour (+4 DEF) gives more reduction than 6 stat points in DEF. Buying armour matters more than building DEF.

**This is actually fine** — it means the starting shop choice matters. But DEF stat should still feel worth investing in alongside armour.

### 4. Early game feels fine, mid-game spikes hard
Garden dust enemies are appropriately easy. But the jump to Underground orcs (28 HP, DEF 11, d8 weapon, STR +1) is massive. A balanced knight deals 2 damage per hit to them.

**Fix:** Add a mid-tier zone between Garden and Great Hall, or lower early Underground enemy stats.

### 5. Level 1 comes too fast, level 4 might not come at all
50 XP = about 5 fights. That's 3-4 rooms in. Very early — barely feels earned.
400 XP might require clearing almost every room on both floors. Tight.

---

## Proposed Rebalance

### Stats
- **DEF formula**: floor(DEF/3) → floor(DEF/2) — makes DEF investment meaningful
- **Minimum damage**: 2 → 3 — balanced builds can chip through armour
- **AGI**: add +1 dodge% per mod for ALL builds (not just with Shadow Cloak)
- **INT**: add +1 damage per mod when using enchanted weapons

### Base Stats
- STR 10 (mod +0) — everyone can hit, points make you good not functional
- DEF 10 (mod +0) — same
- AGI 10 (mod +0) — same
- LCK 10 (mod +0) — already done
- INT 8 (mod -1) — niche stat, starts slightly weaker
- PER/END/WIS/CHA 6 (mod -2) — exploration stats, invest if you want them
- Free points: 8 (reduced from 10, since bases are higher)

### HP
- Activate VIT formula: maxHp = 25 + (VIT × 3)
- Base VIT = 8: 25 + 24 = 49 HP (similar to current 45)
- VIT allocatable: invest 4 points (VIT 12) = 25 + 36 = 61 HP
- Add VIT to allocatable stats list

### XP Thresholds
| Level | Current | Proposed | Reasoning |
|---|---|---|---|
| 1 | 50 | 60 | Slightly later — after 6-7 fights, feels more earned |
| 2 | 120 | 140 | End of Garden / start of Underground |
| 3 | 250 | 240 | Mid-Underground — slightly easier to reach |
| 4 | 400 | 360 | Late Underground — achievable if thorough |

### Enemy Tuning
No changes needed — the stat/formula fixes above solve the damage problem against high-DEF enemies.

### Level-up Rewards
| Level | Current | Proposed |
|---|---|---|
| 1 | +5 HP, stat pick | +3 HP, stat pick |
| 2 | stat pick | +3 HP, stat pick |
| 3 | +5 HP, stat pick | +3 HP, stat pick |
| 4 | stat pick | +5 HP, stat pick |

Every level gives HP AND stat pick. HP gains smaller but consistent. Level 4 is the big one.
