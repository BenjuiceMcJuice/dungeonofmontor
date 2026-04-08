# Balance Tweak Log

Tracks balance changes made to Dungeon of Montor, with rationale and data behind each decision. Intended as a reference so we can see what was tried, what worked, and what to revisit.

---

## 2026-04-08 — "The Underground Wall" Rebalance

**Problem:** 43 run logs analysed from Firestore. 0% pass rate on Underground. Every run that reaches the Great Hall dies there. Orcs account for ~67% of underground deaths. Players never level past level 1. Fights are long minimum-damage grinds.

**Root cause:** The flat DEF formula `floor(DEF/2)` absorbed so much damage that both player and enemies dealt minimum damage (2) every hit, creating 15-20 hit slogs. Combined with overtuned orc stats and a high XP threshold, the Underground was a mathematical dead end.

**Data snapshot (43 runs):**
- 5 victories (all Garden), 38 defeats
- 30/38 deaths on Underground (29 in Great Hall, 1 in Kitchen)
- Top killer: Slate Orc in combat_standard rooms
- All underground deaths at level 1 (never levelled)
- Best underground run: 38 chambers, 1259 XP — still died to Great Hall boss

### Changes Made

| # | Change | Old Value | New Value | File(s) | Rationale |
|---|--------|-----------|-----------|---------|-----------|
| 1 | **DEF formula: flat → percentage** | `floor(DEF/2)` flat reduction | `min(DEF*2, 50)%` of damage, cap 50% | `combat.js:211` | Flat reduction flattened all damage to minimum at low levels. Percentage scales naturally — high hits still hurt, DEF never makes you invulnerable. |
| 2 | **Min damage: 2 → 1** | `max(afterTier - def, 2)` | `max(afterTier - def, 1)` | `combat.js:213` | Glancing blows (tier 3) should feel different from solid hits. Min 2 meant misses dealt same as hits. |
| 3 | **All player weapon dice +1 tier** | d4/d6/d8/d10/d12 | d6/d8/d10/d12/d12 | `items.json` (64 weapons) | Higher base damage so STR mod and weapon upgrades create noticeable power spikes. Enemy weaponDie unchanged. |
| 4 | **Orc stat nerf** | HP 35, STR 16, DEF 14 | HP 25, STR 13, DEF 12 | `enemies.json` | Orcs were mid-game stats appearing in zone 2. New stats still tougher than Garden enemies but survivable. |
| 5 | **Player base HP +5** | `20 + (VIT * 5)` = 60 base | `25 + (VIT * 5)` = 65 base | `classes.js`, `Game.jsx` (x2), `StatPicker.jsx`, `Preparation.jsx` | Small cushion to survive the early learning curve. |
| 6 | **XP threshold for level 2** | 50 XP | 30 XP | `progression.json` | Players should level up reliably in the Garden (3-4 kills). Arriving in Underground at level 2 with a stat pick makes a real difference. |
| 7 | **Great Hall pool 1: remove orcs** | rat/orc/hound (dust) | rat/hound (dust) | `zones.json` | First encounters in Underground should be rats and hounds, not orcs. Orcs appear from pool 2 onwards. |
| 8 | **Underground healing drops boosted** | Standard: weight 8, 35% drop; Elite: weight 6, 55% drop | Standard: weight 14, 40% drop; Elite: weight 10, 60% drop | `loot-tables.json` | ~4% effective healing drop rate was too low. Now ~8-10%. |
| 9 | **DEF tooltip updated** | "reduces incoming damage" | "reduces incoming damage by 2% per point (max 50%)" | `Preparation.jsx` | Tooltip should match the new formula. |

### Expected Impact (Math)

**Player (Lv1, d8 sword) → Slate Orc (DEF 11 = 22%):**
- Old: avg 3.5 + 0 mod - 6 flat = **2 dmg** → 16 hits to kill
- New: avg 4.5 + 0 mod × 0.78 = **3 dmg** → 8 hits to kill

**Slate Orc → Player (DEF 10 = 20%):**
- Old: avg 4.5 + 2 mod - 5 flat = **2 dmg** (minimum)
- New: avg 4.5 + 1.5 mod × 0.80 = **5 dmg** → ~13 hits solo

**With level 2 (+1 STR) and d10 weapon:**
- Player → Orc: avg 5.5 + 1 × 0.78 = **5 dmg** → 5 hits to kill

Fights should now last 5-8 turns instead of 15-20. Both sides deal real damage. Weapons and levels matter.

### Risks / Watch Items

- **Late-game DEF scaling**: percentage cap at 50% means tanks can never become invulnerable. Rock Golem (DEF 18) and Automaton (DEF 20) both hit the 50% cap — may need monitoring.
- **Mace defIgnore interaction**: maces already reduce effective DEF before the formula. With percentage DEF, defIgnore is multiplicative (reduces the DEF stat that feeds into the percentage). Should still work correctly but less impactful than before.
- **Null Crush gift**: uses `breakdown.defReduction` for bonus damage. With percentage DEF, defReduction is now a percentage of afterTier damage, not flat. The gift should still work but bonus damage scales with hit size rather than being constant.
- **Enemy damage increased**: percentage DEF is less protective than flat DEF/2 at low player DEF. Player takes more damage per hit but has +5 base HP and better healing drops to compensate.
