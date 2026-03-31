# DEVLOG — Dungeon of Montor

Milestone tracker. Updated when a step is complete, not after every file change.
Granular daily work is in `logs/YYYY-MM-DD.md`.

---

## Milestones

| Date       | Milestone                          | Status |
|------------|------------------------------------|--------|
| 2026-03-29 | Repo scaffolded, SDLC in place     | ✅ Done |
| 2026-03-29 | Infra — GitHub Pages live, Firebase project created | ✅ Done |
| 2026-03-29 | React scaffold + app shell (5-tab nav, design system) | ✅ Done |
| 2026-03-29 | Design docs v0.3 incorporated (incl. Dungeon Mood, Build Plan, Sprite Sheet) | ✅ Done |
| 2026-03-29 | Firebase — Firestore DB (europe-west2) + Auth enabled | ✅ Done |
|            | **Stage 1 — The Crawl** | |
| 2026-03-29 | Sprint 1 — Firebase Auth + routing + Knight generation | ✅ Done |
| 2026-03-29 | Sprint 2 — Sprites + dice library + DiceRoller component | ✅ Done |
| 2026-03-29 | Sprint 3 — Combat engine (multiplayer-ready) | ✅ Done |
| 2026-03-29 | Combat UX overhaul + narrative + iOS fixes | ✅ Done |
| 2026-03-29 | Knight sprite + party bar + encounter algorithm | ✅ Done |
| 2026-03-29 | First production deploy to GitHub Pages | ✅ Done |
| 2026-03-30 | Design docs v0.4 — Conditions spec, Dungeon Architecture, visual layout | ✅ Done |
| 2026-03-31 | 4x4 dungeon grid — Montor's Garden zone with maze navigation | ✅ Done |
| 2026-03-31 | Dev → main merge + deploy (grid, 4-tier combat, landing v3) | ✅ Done |
| 2026-03-31 | Architecture review — data model audit, Firebase migration plan | ✅ Done |
|            | **Architecture — Data-driven engine** | |
|            | Write complete Firestore schemas for all content collections | ⬜ |
|            | Seed Firebase with Garden data (floors, zones, enemies, items) | ⬜ |
|            | Refactor engine to read content from Firestore, not hardcoded JS | ⬜ |
|            | **Stage 1 — The Crawl (continued)** | |
| 2026-03-31 | Sprint 4 — Items, loot tables, inventory, consumables in combat | ✅ Done |
| 2026-03-31 | Sprint 5 — Multi-floor progression, keystone, boss, zone doors, safe room, Floor -1 | ✅ Done |
|            | Sprint 6 — Polish + feel (narration strings, HP bars, damage) | ⬜ |

---

## Build Stages

See `docs/guides/06_Build_Plan.md` for full detail on all 5 stages.

```
Stage 1 — The Crawl         Solo. Knight only. Playable dungeon loop.
Stage 2 — The Tavern        Persistent character. Multi-class. Levelling. Pre-game hub.
Stage 3 — The Party         Multiplayer. Friends join. Async turns.
Stage 4 — Montor Awakens    AI narrative layer. Mood system. Offers and Curses.
Stage 5 — The Long Game     Factions, deities, legacy, embuing.
```

Each stage is a shippable, playable game. Currently working on **Stage 1**.
