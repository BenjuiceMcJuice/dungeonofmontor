# BACKLOG — Dungeon of Montor

Everything outstanding, one row each. **Why it matters lives in `DEVLOG.md` and `logs/`;** this file
only says what is left and who can do it.

Follows [the Benjuicey Apps backlog standard](https://github.com/BenjuiceMcJuice/Benjuicey-apps/blob/main/docs/backlog-standard.md)
(`Benjuicey-apps/docs/backlog-standard.md`). IDs are never reused.

**Kinds:** Check (go and look, no code) · Bug (wrong now) · Decision (needs a human choice) ·
Feature · Chore. **State:** Ready or Blocked.

Currently on **Stage 1 — The Crawl**. DOM-B1 is the fork in the road: the 2026-04-09 playtest found
70B lands the proactivity rules but free-tier limits make stress testing impossible, while 8B is too
weak to execute them. Model quality mattered more than prompt cleverness.

---

## Open

| ID | Item | Kind | Who | State | Blocked on |
|---|---|---|---|---|---|
| DOM-B1 | Pick the model path — recommended: integrate Anthropic (Claude Haiku 4.5) | Decision | **Ben** | Ready | — |
| DOM-B2 | Tavern hub + Stage 2 persistent characters — foundation for both modes | Feature | Session | Ready | — |
| DOM-B3 | Wire The Crawl (roguelike) through Tavern | Feature | Session | Blocked | DOM-B2 |
| DOM-B4 | Narrative Mode phase 1 polish — chapter summaries, structured combat, item tables | Feature | Session | Blocked | DOM-B1 |
| DOM-B5 | Narrative Mode phase 2 — multiplayer with shared keys (the real scaling answer) | Feature | Session | Blocked | DOM-B4 |
| DOM-B6 | Enemy variety + boss abilities | Feature | Session | Ready | — |
| DOM-B7 | Floor-scaled enemy conditions — deeper is nastier | Feature | Session | Ready | — |
| DOM-B8 | Junk offload rooms + junk-scaling items (spec written) | Feature | Session | Ready | — |
| DOM-B9 | Inventory weight penalties — bar is visible, no penalty yet | Feature | Session | Ready | — |
| DOM-B10 | Themed hi-res junk sprites for non-garden floors | Feature | Session | Ready | — |
| DOM-B11 | Room events — pollen, rain, grease fires, day/night (Garden) | Feature | Session | Ready | — |
| DOM-B12 | Gift levelling (Hades-style) + mono-gift synergy bonuses | Feature | Session | Ready | — |
| DOM-B13 | The Dump — pre-run junk trade hub for permanent unlocks | Feature | Session | Ready | — |
