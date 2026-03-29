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
|            | Firebase — Firestore DB (europe-west2) + web app config | ⬜ |
|            | **Stage 1 — The Crawl** | |
|            | Sprint 1 — Firebase Auth + routing + design system | ⬜ |
|            | Sprint 2 — Sprites + dice library + DiceRoller component | ⬜ |
|            | Sprint 3 — Combat engine + Cloud Function + enemy AI | ⬜ |
|            | Sprint 4 — Items + loot + basic inventory | ⬜ |
|            | Sprint 5 — Encounter deck + run loop (8 encounters + boss) | ⬜ |
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
