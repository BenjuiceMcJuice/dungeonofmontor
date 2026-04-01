# Dungeon of Montor — 02: Game Mechanics
**Version:** 0.4 Draft
**Date:** March 2026
**Status:** Living document — balance values TBD

---

## 1. Core Stats

Every character and enemy has the following base stats:

| Stat | Abbreviation | Controls |
|---|---|---|
| Strength | STR | Melee attack rolls, damage |
| Defence | DEF | Damage reduction |
| Agility | AGI | Turn order, flee rolls, ranged |
| Luck | LCK | Loot quality, condition application modifier |

Stat modifier = `floor((STAT - 10) / 2)` — standard D&D style derivation.

---

## 2. The Universal 4-Tier Resolution System

**All d20 rolls in Dungeon of Montor use the same 4-tier outcome system.** This applies to attacks, flee attempts, trap checks, skill checks, lockpicking, NPC interactions — everything. Players learn one system and it applies everywhere.

### The Tiers

| Tier | Roll (no modifier) | Probability | Label |
|---|---|---|---|
| **1 — Critical Success** | Natural 20 only (or CRIT stat threshold) | 5% base | Best possible outcome — rare and significant |
| **2 — Success** | 11–19 | 45% | Clean outcome |
| **3 — Failure** | 5–10 | 30% | Partial / costly outcome |
| **4 — Critical Failure** | 1–4 | 20% | Worst outcome |

> Critical Success is intentionally rare. A natural 20 is an event, not a routine. The CRIT stat can lower the threshold by 1 per point (see Section 3).

### Modifier Effect
Add the relevant stat modifier to the d20 roll. The result determines which tier band it falls in. Higher modifier = more likely to land in upper tiers. It is simple arithmetic — no table needed.

Crit (tier 1) is governed entirely by the CRIT system, not by stat modifiers. Stat modifiers only affect the Success / Failure / Critical Failure bands.

### Design Principle
- Tiers replace binary pass/fail wherever degree of outcome matters
- Full misses and critical failures still exist but are less common than a pure binary system
- Reduces frustration on mobile where runs are shorter and every turn counts
- Montor can influence tier thresholds via Offers, Curses, and Dungeon Mood

---

## 3. Attack Resolution

Attacks use the 4-tier system with STR modifier.

### Attack Tiers

| Tier | Roll + STR | Probability | Result | Damage |
|---|---|---|---|---|
| **Critical Hit** | Natural 20 (or CRIT threshold) | 5% base | Legendary blow | Full damage × 1.5 + condition at 80% |
| **Hit** | 11–19 | 45% | Clean strike | Full damage + condition at 40% |
| **Glancing Blow** | 5–10 | 30% | Partial contact | Half damage + condition at 5% |
| **Miss** | 1–4 | 20% | No contact | None |

### The CRIT System — Two Levers

CRIT is split into two independent values. Both are tracked on the character and in the data model from day one.

**CRIT Chance** — how often a crit triggers
- Default: natural 20 only (5%)
- Increased by specific items (e.g. a Keen Edge weapon), blessings, or Montor Offers
- Each +1 to crit threshold adds ~5% chance (19–20 = 10%, 18–20 = 15% etc.)
- Stacking crit chance items is a valid and satisfying build path

**CRIT Damage** — how hard you hit when you do crit
- Default: 1.5× damage multiplier
- Increased by CRIT stat investment

| CRIT Stat | Crit Damage Multiplier |
|---|---|
| 0 (default) | 1.5× |
| 1 | 1.75× |
| 2 | 2× |
| 3 | 2.5× |
| 4 | 3× |

**The build:** High crit chance + high CRIT stat + condition-applying weapon = a crit-focused playstyle where crits land often, hit hard, and reliably apply conditions at 80%. Each piece amplifies the others. A deliberate build, not a default path.

**Data model fields required from day one:**
```json
{
  "critChanceThreshold": 20,
  "critDamageMultiplier": 1.5
}
```

**For the base game:** Natural 20 only, 1.5× damage, 80% condition on crit. Full crit build system is a later feature — items and CRIT stat investment unlock it progressively.

### Damage Calculation (on hit or glancing)
```
Damage = weapon die roll + STR modifier − floor(enemy DEF ÷ 2), minimum 1
Glancing blow = halve the result (minimum 1)
```

### Condition Application on Attack
When a weapon has a condition effect (e.g. BLEED, NAUSEA), the chance to apply it varies by hit tier:

| Tier | Condition Apply % (base) |
|---|---|
| Critical Hit | 80% |
| Hit | 40% |
| Glancing Blow | 5% |
| Miss | 0% |

**This base % can be modified by:**
- Items and equipment (e.g. a ring that increases condition application chance)
- Montor intervention (Offer/Curse that temporarily adjusts the %)
- A dedicated stat (TBD — placeholder for a future luck/affliction modifier)
- Dungeon Mood state

This means crits are exciting beyond just damage — they reliably apply conditions. Glancing blows almost never do. Players will feel the difference.

---

## 4. Flee Resolution

Flee uses the 4-tier system with AGI modifier. One option only — declare flee, roll, accept outcome.

| Tier | Roll + AGI | Result | HP Loss | Gold Loss | Item Risk |
|---|---|---|---|---|---|
| **Crit Success** | 17–20 | Clean exit | None | None | None |
| **Success** | 11–16 | Messy exit | 5–10% max HP | None | None |
| **Failure** | 5–10 | Bad exit | 15–25% max HP | 10% carried gold | 10% drop chance |
| **Crit Failure** | 1–4 | Flee fails | 25–35% max HP | 20% carried gold | 25% drop chance |

**Rules:**
- Heirlooms never drop on flee
- BLOODLUST condition prevents fleeing entirely
- On Crit Failure — turn wasted, combat continues
- You flee to the chamber you entered from
- Fleeing impacts a bravery/reputation stat (details TBD — see `08_Dungeon_Architecture.md`)
- Montor notes all flee attempts — Mood trigger TBD

---

## 5. Skill Checks

All skill checks use the 4-tier system with the relevant stat modifier. Outcomes are check-specific but follow the same tier logic — tier 1 is always best, tier 4 is always worst.

### Example Checks

| Situation | Stat | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|---|
| Detect hidden chamber | AGI | Found + safe entry | Found | Found but trap triggers | Not found |
| Pick a lock | AGI | Opened silently | Opened | Opened, noise made | Lockpick breaks, locked |
| Persuade NPC | LCK | Discount + info | Normal price | No deal | Hostile |
| Resist trap | DEF | No effect | Half effect | Full effect | Full effect + condition |
| Identify item | — (TBD stat) | Full info | Partial info | No info | False info |

Exact TN values and outcomes per check type to be defined per feature build.

---

## 6. Turn Order

Initiative at combat start: `d20 + AGI modifier`, highest goes first. Ties broken by raw AGI, then coin flip (d2).

### On Your Turn

**One Action:**
- Attack (STR — melee, AGI — ranged)
- Use item
- Flee (AGI check — 4-tier)
- Interact with chamber object

**One Bonus Action (optional):**
- Use a class ability (if not on cooldown)
- Switch equipped weapon

---

## 7. Levelling

Characters gain XP from combat and events. Level persists across runs.

| Level | XP Required | Notes |
|---|---|---|
| 1 | 0 | Start here |
| 2 | 100 | |
| 3 | 250 | |
| 4 | 500 | |
| 5 | 900 | Soul conditions unlock (see `07_Conditions_and_Persistence.md`) |
| 6–10 | TBD | |

On level up:
- Max HP increases (class-dependent rate)
- Stat point to allocate
- Ability unlock every 5 levels

XP table to be fully defined during balance pass.

---

## 8. Conditions

Full conditions reference in `07_Conditions_and_Persistence.md`.

**Summary:** Every entity has three condition slots — Body, Mind, Soul. One condition per slot. Conditions do not directly modify STR/DEF/AGI. They operate on probability, behaviour, relationships, and narrative layers.

Condition application during combat is governed by the attack tier table in Section 3.

---

## 9. Loot

Loot quality determined by: `d100 + LCK modifier` vs rarity table. Higher roll = better rarity tier.

| Roll | Rarity |
|---|---|
| 1–40 | Common |
| 41–65 | Uncommon |
| 66–82 | Rare |
| 83–93 | Epic |
| 94–99 | Legendary |
| 100+ | Heirloom (character-specific, persists across runs) |

Loot tables are zone-specific and defined in Firestore (see `08_Dungeon_Architecture.md`).

---

## 10. Items

Full inventory system design deferred (see `08_Dungeon_Architecture.md` Section 14). Principles confirmed:

- **Equipped** — active while worn/held, effect continuous
- **Consumed** — one-shot use, often stronger but temporary
- **Heirloom** — flagged, persists across runs, never drops on flee

Items can modify:
- Condition application % (increase or decrease)
- Tier thresholds (shift bands up or down)
- Loot quality rolls
- Stat values directly (temporary or persistent)

---

## 11. Montor's Influence on Mechanics

Montor can affect the mechanical layer directly via Offers and Curses:

- Shift condition application % up or down
- Modify tier thresholds temporarily
- Alter loot table weights
- Apply conditions directly (bypassing combat)
- Affect flee outcomes

All Montor mechanical effects are data-driven (see `08_Dungeon_Architecture.md`) and tunable without code changes.

---

## 12. Open Questions

- [ ] Full XP table — values TBD during balance pass
- [ ] Bravery / reputation stat — per-run vs persistent vs both
- [ ] Exact flee stat impact — what it modifies and by how much
- [ ] Condition application modifier stat — dedicated stat or use LCK?
- [ ] Damage multiplier on Critical Hit — 1.5x or flat bonus?
- [ ] Ranged attack system — AGI modifier, range mechanics TBD
- [ ] Full skill check outcome table per check type
- [ ] Inventory slot count and weight/carry system
