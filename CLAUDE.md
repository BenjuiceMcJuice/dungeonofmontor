# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Dungeon of Montor** is a browser-based RPG PWA — mobile or desktop, solo or multiplayer — combining D&D-style tactical mechanics (d20 dice, stats, combat, loot, progression) with AI-driven live narrative via Groq API. Every campaign tells a different story because an AI writes it in real time, guided by a player-written Campaign Brief.

## Tech Stack

- **React PWA** — mobile-first, installable, offline-capable
- **Firebase** — Auth (email + Google), Firestore (real-time multiplayer sync), Cloud Functions (turn enforcement, AI proxy), Cloud Messaging (async turn alerts)
- **Groq API** — AI narration (user-supplied key, stored in localStorage only)
- **GitHub Pages** — hosting (auto-deploy from `main` via GitHub Actions)
- **Sprites** — canvas grid arrays, no image files

## Repository

GitHub: `BenjuiceMcJuice/dungeonofmontor`

## Branches

- **`main`** — production. Only merged code lands here.
- **`dev`** — active development. All new work happens here.

**Never commit code directly to `main`.** All work goes through `dev`, tested, then merged.

## File Structure

```
dom-app/                         The active React app (Vite + Tailwind v4)
  src/
    App.jsx                      Root component, tab routing
    main.jsx                     Entry point
    components/
      Nav.jsx                    Bottom tab nav (5 tabs)
  public/
    manifest.json                PWA manifest
docs/
  specs/                         Game mechanics, tech architecture, UI spec, sprites, conditions, dungeon architecture
  guides/                        SDLC, build plan
  strategy/                      Vision, roadmap
logs/YYYY-MM-DD.md               Daily work logs
DEVLOG.md                        Milestone tracker (read first in any session)
CLAUDE.md                        Claude Code guidance (this file)
.github/workflows/deploy.yml     GitHub Pages deploy pipeline
```

## Dev Log

Two-tier logging system:

**`DEVLOG.md`** — milestone tracker. One entry per completed step/feature. Read this at the start of a new session.

**`logs/YYYY-MM-DD.md`** — daily work log. Granular: what was built, files changed, key decisions.

Rules:
- Update today's log file **as you go** — after each meaningful change, not at the end of the session
- Create the log file at the start of the day's work if it doesn't exist yet
- Only update `DEVLOG.md` when a milestone is complete
- At the start of any new session, read `DEVLOG.md` first, then the most recent log file

## Documentation Index

| File | Status | Purpose |
|---|---|---|
| `DEVLOG.md` | **CURRENT** | Milestone tracker — read first in any session |
| `docs/guides/sdlc.md` | **CURRENT** | Dev → test → deploy workflow |
| `docs/strategy/01_Game_Vision.md` | **CURRENT** | Product pitch, audience, design pillars, Montor lore |
| `docs/specs/02_Game_Mechanics.md` | **CURRENT** | Full rules: stats, dice, combat, items, factions, deities, legacy, dungeon mood, Montor offers/curses |
| `docs/specs/03_Technical_Architecture.md` | **CURRENT** | Stack, Firebase data model, AI system, token mgmt, build phases |
| `docs/specs/04_UI_Specification.md` | **CURRENT** | Tab system, screen states, combat UX flow, Montor event state, design system |
| `docs/specs/05_Characters_and_Assets.md` | **CURRENT** | Enemy archetypes, player classes, power tiers, sprite spec |
| `docs/specs/06_Sprite_Sheet.html` | **CURRENT** | All 5 enemy sprite grids as renderable HTML — extract into sprites.js |
| `docs/specs/07_Conditions_and_Persistence.md` | **CURRENT** | Body/Mind/Soul condition slots, duration types, synergies, soul morphing, persistence across runs, gold banking |
| `docs/specs/08_Dungeon_Architecture.md` | **CURRENT** | 10 dungeon floors, room types, environmental mechanics, navigation, Montor's Zone |
| `docs/specs/09_Firestore_Data_Model.md` | **CURRENT** | Complete Firestore schemas for all content collections — living doc, update as fields emerge |
| `docs/specs/10_Montors_Gifts.md` | **CURRENT** | Gift system — one per floor, activate at safe rooms, Body/Mind/Weapon/Item application, WIS rolls |
| `docs/specs/11_Sprint_Backlog.md` | **CURRENT** | Prioritised backlog — weapon overhaul, starting kit, floor items, junk, dice powers, stat relevance |
| `docs/specs/12_Junk_and_Gifts_System.md` | **CURRENT** | Junk piles, hoarding, weight/END, PER searching, gift discovery, merchants as staff, CHA pricing |
| `docs/specs/13_Montor_AI_Conversations.md` | **CURRENT** | AI conversations with Montor, per-run mood system, WIS/CHA/CUN social checks, Stage 4 |
| `docs/specs/conditions_table.html` | **CURRENT** | Interactive HTML reference for all 22 conditions (Body 8, Mind 8, Soul 6) — like sprite sheet but for conditions |
| `docs/guides/06_Build_Plan.md` | **CURRENT** | 5-stage build plan with sprint breakdown (The Crawl → The Long Game) |
