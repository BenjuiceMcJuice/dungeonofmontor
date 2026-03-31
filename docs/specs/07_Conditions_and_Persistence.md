# Dungeon of Montor — 07: Conditions & Persistence
**Version:** 0.1 Draft  
**Date:** March 2026  
**Status:** Design reference — implementation deferred to later build stages

---

## 1. Overview

Conditions are temporary or permanent states applied to characters, allies, or enemies. They sit in one of three slots: **Body**, **Mind**, or **Soul**. Each entity can hold one condition per slot simultaneously.

Conditions are distinct from core stats (STR / DEF / AGI). They do not directly modify these values. They operate on a separate mechanical layer — probabilities, behaviours, relationships, loot weights, and narrative flags.

---

## 2. The Three Slots

### Body
Physical state. Mostly transient or gear-bound.  
Examples: bleeding, burning, fortified, sluggish.

### Mind
Mental / psychological state. Transient, cursed, or infectious.  
Examples: dread, frenzy, clarity, haunted.

### Soul
Permanent character identity. Branded — survives death and persists across runs.  
Cannot be removed by normal means. Applied via specific routes only (see Section 5).  
Only one Soul condition can be held at a time.

---

## 3. Duration Types

| Type | Behaviour |
|---|---|
| **Transient** | Lasts N turns, then expires automatically |
| **Persistent** | Lasts until actively removed (unequip item, cure, exit room) |
| **Branded** | Permanent. Survives death. Cross-run. Soul conditions only. |

---

## 4. Source Types

| Source | Description | Removable |
|---|---|---|
| **Gear-bound** | Active while item is equipped. Removed by unequipping. | ✓ |
| **Consumed** | One-shot application (potion, scroll, thrown item). Often stronger but temporary. | Wears off |
| **Blessing** | Applied by deity, shrine, or Montor. Cannot be unequipped. | Sometimes |
| **Curse** | Applied by enemy ability, Montor, or trap. Cannot be unequipped. | Rarely |
| **Infectious** | Spread by enemy hit or proximity. | Cure item |
| **Environmental** | Room-level. All entities present are affected. Removed on exit. | Exit room |
| **Soul — Passive** | Triggered automatically by player actions / run data. Negative conditions. | ✗ |
| **Soul — Egg** | Deliberate application via Montor's Egg mechanic. Positive / neutral conditions. | ✗ |

---

## 5. Soul Condition Application

Soul conditions are applied via two distinct routes, reflecting their nature:

### 5a. Passive / Punishing (happens to you)
Triggered automatically by run data, death patterns, and behaviour flags. The player does not choose these.

Examples:
- Die to the same enemy type 3 times → **CURSED BLOOD**
- Betray or abandon a partner → **FORSAKEN**
- Repeatedly refuse Montor's Offers → TBD condition

### 5b. Montor's Egg (deliberate pursuit — risky)
Egg Fragments are rare items scattered across runs. When enough fragments of a matching set are collected and combined, they form a **Montor's Egg**. Cracking the Egg applies a Soul condition.

- The outcome is **never guaranteed**. Montor's current Mood toward the character at the moment of cracking weights the result
- High Mood → better odds of a positive Soul condition
- Wrathful / Bored Montor → increased chance of a negative Soul condition, wrapped in the same egg
- Fragments hint at the possible outcome but Montor's disposition is the real variable
- This is intentional: Montor is not benevolent. The egg is his game, not the player's
- Fragments are character-specific — they do not transfer between characters

### 5c. NPC: The Therapist (future mechanic — placeholder)
A specialist NPC who can reshape existing Soul conditions. Not an application mechanic — a *modification* mechanic. Relevant once Morphs are implemented. Design deferred.

### 5d. Montor Direct (forced)
Montor can apply a Soul condition directly under specific narrative circumstances. This is rare and always story-significant.

---

## 6. Soul Condition Morphing

> **Status: Data model support only. Not implemented in early build stages.**

When a second Soul condition would be applied to a character who already holds one, a **collision** occurs rather than a replacement. The two conditions merge into a **Morph** — a third, distinct Soul condition that neither parent is.

### Morph Rules
- Each parent condition's mechanical effect is amplified in the Morph
- The Morph gains a new passive skill or ability unavailable to either parent
- The Morph replaces both parents — they are consumed
- Morphs cannot collide further (ceiling at one Morph)

### Collision Trigger Types
The source of the incoming condition determines how the collision is handled:

| Trigger | Behaviour |
|---|---|
| **Montor forces it** | Automatic. No player choice. |
| **Event-triggered** | Player receives a warning. Can sometimes refuse. |
| **Shrine / item** | Player knowingly initiates. Voluntary risk. |

### Example Morph (placeholder names)
- **DRUNKARD** + **CHEERFUL** → **[NAME TBD — "Life and Soul" territory]**
  - Inherits amplified effects of both parents
  - Gains new social / chaos-based passive skill

---

## 7. Data Model (Schema Reference)

Soul conditions require the following fields to support future Morph implementation without refactoring:

```json
{
  "id": "S1",
  "slot": "soul",
  "name": "NOTICED",
  "description": "...",
  "application_route": "egg | passive | montor_direct",
  "collision_behaviour": "forced | warned | voluntary",
  "morph_compatible_with": [],
  "morph_result_id": null,
  "depth_tier": 1,
  "max_tier": 3,
  "persists_across_runs": true,
  "removable": false,
  "mechanical_effects": [],
  "narrative_flags": []
}
```

Body and Mind conditions require synergy fields even if dormant:

```json
{
  "id": "B1",
  "slot": "body",
  "name": "BLEED",
  "duration_type": "transient",
  "duration_turns": 3,
  "source_types": ["weapon", "trap", "infectious"],
  "targets": ["enemy", "self"],
  "removable": true,
  "removal_method": "cure_item",
  "synergy_with": ["M2"],
  "synergy_effect_id": "SYN_B1_M2",
  "mechanical_effects": [],
  "downside": null
}
```

Synergy effects are defined separately so they can be toggled on/off without touching the condition definitions themselves.

---

## 8. Persistence Across Runs

| Element | Persists | Notes |
|---|---|---|
| Character level | ✓ | Core progression. Should feel rewarding even after death. |
| Max HP | ✓ | Grows with level. Dying repeatedly still means progress. |
| Soul condition | ✓ | Identity. Unchangeable by normal means. |
| Heirlooms | ✓ | Character-specific items. Design deferred to later stage. |
| Body conditions | ✗ | Physical state resets on run start. |
| Mind conditions | ✗ | Mental state resets on run start. |
| Standard gear / items | ✗ | Lost on death. |
| Gold / currency | Banked only | Unspent gold lost on run failure. Banked gold persists at a % loss (see Section 9). |

### Heirlooms (placeholder)
Specific items flagged as `heirloom: true` persist across runs. Each character class will have a defined heirloom list. Design and item list deferred to later build stage — field needs to exist in item data model from the start.

---

## 9. Gold Banking

Unspent gold is lost when a run fails. To preserve gold across runs, players must bank it at designated points during a run.

### Rules
- Banking is not always available — specific NPCs or locations only, not guaranteed every run
- A % fee is taken on deposit (rate TBD — flat or variable by NPC / faction allegiance)
- Banked gold persists indefinitely across runs
- Unspent gold carried at run failure is gone entirely

### Design intent
Creates genuine tension around spending vs. banking. A good run where you die at the last moment stings properly. Finding a banker NPC mid-run is a meaningful decision point.

### Open questions
- [ ] What % loss on banking? Flat rate or faction/NPC dependent?
- [ ] Where do bankers appear — fixed locations, random rooms, specific NPC types?
- [ ] Is there a maximum bank balance?
- [ ] Can Montor raid the bank under specific conditions? (Wrathful state, specific Soul conditions, etc.)

---

## 10. Conditions List Summary

Full interactive reference: `06_Sprite_Sheet.html` equivalent — see `conditions_table.html`

### Body (8)
| ID | Name | Duration | Key Effect |
|---|---|---|---|
| B1 | BLEED | Transient | Damage per turn, chance to extend |
| B2 | NAUSEA | Transient | % chance to skip action |
| B3 | IRONHIDE | Persistent (gear) | Reduce physical damage taken; -AGI |
| B4 | WITHERED | Persistent (curse) | Max HP reduced; healing impaired |
| B5 | BURNING | Transient | Damage per turn; spreads to adjacent |
| B6 | SLUGGISH | Transient | Movement halved; act-last chance |
| B7 | FORTIFIED | Persistent | Resistance to one damage type |
| B8 | MARKED | Persistent (curse) | Enemy type prioritises and tracks you |

### Mind (8)
| ID | Name | Duration | Key Effect |
|---|---|---|---|
| M1 | DREAD | Transient | % chance to skip offensive action |
| M2 | FRENZY | Transient | +% damage; attacks nearest regardless |
| M3 | LEADEN | Persistent (gear) | Immune to Mind condition replacement |
| M4 | BOREDOM | Transient | Enemy loses aggression; removed by damage |
| M5 | CLARITY | Persistent | +% skill checks; trap detection; Offer preview |
| M6 | HAUNTED | Persistent (curse) | Random negative effect once per room |
| M7 | BLOODLUST | Combat only | Kill to heal; no kill = HP loss; can't flee |
| M8 | HEXED | Persistent (curse) | One item's effect secretly inverted |

### Soul (6 base — Morphs TBD)
| ID | Name | Route | Key Effect |
|---|---|---|---|
| S1 | NOTICED | Egg / Montor | +Montor Mood; better Offers; harsher Curses |
| S2 | BLOODSWORN | Passive | Prey type marked; loot skew; spawn reduction |
| S3 | OATHBOUND | Egg / Shrine | Deity shrine free; faction pricing improved |
| S4 | CURSED BLOOD | Passive | Nemesis enemy type deals +% damage permanently |
| S5 | WANDERER | Passive | Trap detection; loot quality; Montor respect |
| S6 | FORSAKEN | Passive | Partner play locked; solo bonuses; Montor interest |

---

## 11. Open Questions

- [ ] How many Egg Fragments per Egg — fixed or variable per egg type?
- [ ] Exact Mood thresholds for egg outcome weighting — needs balance pass
- [ ] Therapist NPC mechanic — when to design
- [ ] Heirloom item list per character class — deferred
- [ ] Full Morph condition list — deferred
- [ ] Condition intensity tiers (1–5 scale) — deferred
- [ ] Gold banking % loss rate and banker NPC locations
- [ ] Can Montor raid the bank?
