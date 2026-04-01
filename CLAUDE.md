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

## Documentation

All docs live in `dom-app/docs/`. See [dom-app/docs/INDEX.md](dom-app/docs/INDEX.md) for the full index.

| Category | Key docs |
|---|---|
| **Vision** | Game Vision, Build Plan (5-stage roadmap) |
| **Design** | Game Mechanics, Dungeon Architecture, Montor's Gifts, Junk & Gifts, Build Identity, Montor AI |
| **Technical** | Architecture, UI Spec, Firestore Data Model |
| **Implementation** | Sprint Backlog, Stat Reference, Balance Analysis |
| **Guides** | SDLC (git workflow, deploy) |
| **Archive** | Conditions v0.1 draft, sprite/conditions HTML viewers |

Legacy docs in `docs/` (root) are the originals — `dom-app/docs/` has the reorganised, current versions.
