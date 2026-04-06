# Dungeon of Montor -- Documentation Index

> All game documentation in one place. Updated 2026-04-06 (major session).

---

## Core Documents

| Document | Description |
|---|---|
| [Game Design](game_design.md) | Master design doc: mechanics, stats, combat, equipment, vendors, junk piles, dungeon structure |
| [Montor](montor.md) | The character: who he is, his Gifts, mood system, WIS relationship, AI personality |
| [Multiplayer](multiplayer.md) | Co-op vision, async play, PvP, Playable Montor, Firebase sync architecture |
| [Technical](technical.md) | Tech stack, file structure, data architecture, sprites, Firebase, code style |
| [Roadmap](roadmap.md) | 5-stage development plan: The Crawl > The Tavern > The Network > The Mind > The Long Game |

---

## Implementation Specs

| Document | Description |
|---|---|
| [Async Co-op Spec](async_coop_spec.md) | Detailed multiplayer implementation plan -- shared exploration, turn-gated combat, Firestore sync |
| [Montor Mood & Greed Spec](montor_mood_greed_spec.md) | Tidiness, greed, taste tracking -- safe room tonics, mood-aware whispers, dialogue |
| [Inventory Overhaul Spec](inventory_overhaul_spec.md) | Rarity display, weight/encumbrance, item comparison, tab cleanup, sort, quick actions |
| [Junk Economy Spec](junk_economy_spec.md) | Junk offload rooms, junk-scaling items, weight, safe room 3-way choice |

---

## Reference

| Document | Description |
|---|---|
| [Weapon Compendium](reference/weapon_compendium.md) | All 64 weapons + shields -- classes, tiers, stats, conditions, gift slots |
| [Item Compendium](reference/item_compendium.md) | All ~180 non-weapon items -- consumables, relics, armour, bombs, throwables, junk by floor |

---

## Guides

| Document | Description |
|---|---|
| [SDLC](guides/sdlc.md) | Git workflow, branch strategy, commit conventions, deploy process |

---

## Archive

Legacy design documents preserved for reference. Superseded by the consolidated docs above.

| Document | Notes |
|---|---|
| [archive/](archive/) | Original design specs, implementation notes, condition drafts, HTML viewers |

---

## Other Key Files

| File | Location | Description |
|---|---|---|
| CLAUDE.md | repo root | Claude Code guidance -- architecture, file structure, logging rules |
| DEVLOG.md | repo root | Milestone tracker -- read first in any session |
| README.md | repo root | GitHub page -- public game description |
| logs/*.md | repo root | Daily work logs -- granular session details |
| src/data/*.json | dom-app | All game content (items, enemies, zones, conditions, etc.) |
