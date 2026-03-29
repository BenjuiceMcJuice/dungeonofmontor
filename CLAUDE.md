# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Dungeon of Montor** — project details TBC.

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
