# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Dungeon of Montor** is a browser-based RPG PWA — mobile or desktop, solo or multiplayer — combining D&D-style tactical mechanics (d20 dice, stats, combat, loot, progression) with AI-driven live narrative via Groq API. Every campaign tells a different story because an AI writes it in real time, guided by a player-written Campaign Brief.

## Tech Stack

- **React PWA** — mobile-first, installable, offline-capable
- **Firebase** — Auth (email + Google), Firestore (real-time multiplayer sync), Cloud Functions (turn enforcement, AI proxy), Cloud Messaging (async turn alerts)
- **Groq API** — AI narration (user-supplied key, stored in localStorage only)
- **Firebase Hosting** — CDN, PWA manifest
- **Sprites** — canvas grid arrays, no image files

## Repository

GitHub: `BenjuiceMcJuice/dungeonofmontor`

## Branches

- **`main`** — production. Only merged code lands here.
- **`dev`** — active development. All new work happens here.

**Never commit code directly to `main`.** All work goes through `dev`, tested, then merged.

## File Structure

```
docs/
  specs/                       Feature and data specs
  guides/                      SDLC, deployment, setup guides
  strategy/                    Vision, roadmap
logs/YYYY-MM-DD.md             Daily work logs
DEVLOG.md                      Milestone tracker (read first in any session)
CLAUDE.md                      Claude Code guidance (this file)
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
| `docs/specs/02_Game_Mechanics.md` | **CURRENT** | Full rules: stats, dice, combat, items, factions, deities, legacy |
| `docs/specs/03_Technical_Architecture.md` | **CURRENT** | Stack, Firebase data model, AI system, token mgmt, build phases |
| `docs/specs/04_UI_Specification.md` | **CURRENT** | Tab system, screen states, combat UX flow, design system |
| `docs/specs/05_Characters_and_Assets.md` | **CURRENT** | Enemy archetypes, player classes, power tiers, sprite spec |
