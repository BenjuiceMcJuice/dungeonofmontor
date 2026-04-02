# Dungeon of Montor — Documentation Index

> All game documentation in one place. Updated 2026-04-01.

---

## Vision & Strategy
*What the game is and where it's going.*

| Document | Description |
|---|---|
| [Game Vision](vision/game_vision.md) | Product pitch, core fantasy, target audience, design pillars, Montor's philosophy |
| [Build Plan](vision/build_plan.md) | 5-stage development roadmap (The Crawl → The Long Game), sprint breakdown |

---

## Game Design
*How the game works — mechanics, systems, content.*

| Document | Description |
|---|---|
| [Game Mechanics](design/game_mechanics.md) | Core rules: 14 stats, 4-tier resolution, attack/damage formulas, conditions |
| [Characters & Enemies](design/characters_and_enemies.md) | 12 enemy archetypes, 5-tier power system, 10 player classes, sprite specs |
| [Dungeon Architecture](design/dungeon_architecture.md) | 7 floors, zones, chamber templates, floor themes, environmental effects |
| [Montor's Gifts](design/montors_gifts.md) | 6 gifts, 5-slot application (Body/Mind/Weapon/Shield/Item), sacrifices, fusions |
| [Junk & Gifts System](design/junk_and_gifts.md) | Junk piles, search intensity, dodgy consumables, room events, day/night, weight, junk-as-currency |
| [Montor AI Conversations](design/montor_ai.md) | Per-run mood system, AI conversations, WIS/CHA/CUN social checks (Stage 4) |
| [Build Identity & Stacking](design/build_identity.md) | 5 condition builds (BLEED/BURN/FROST/POISON/FEAR), proc items, shield mechanics, gift amplification |

---

## Technical
*How the game is built — architecture, data, UI.*

| Document | Description |
|---|---|
| [Architecture](technical/architecture.md) | Tech stack, React/Firebase/Groq, project structure, multiplayer design |
| [UI Specification](technical/ui_spec.md) | Tab-based UI, View states, screen layouts, interaction flows |
| [Firestore Data Model](technical/firestore_data_model.md) | Canonical schemas for all content collections, runtime data |

---

## Implementation
*Current state — what's built, what's balanced, what's next.*

| Document | Description |
|---|---|
| [Sprint Backlog](implementation/sprint_backlog.md) | Prioritised todo list: fixes, features, design work |
| [Stat Reference](implementation/stat_reference.md) | What each stat does in code RIGHT NOW, with code locations |
| [Balance Analysis](implementation/balance_analysis.md) | Damage calculations, XP progression, build comparisons, proposed fixes |
| [Weapon Compendium](reference/weapon_compendium.md) | All 47 weapons + 8 shields — classes, tiers, stats, conditions, gifts |

---

## Guides
*How to work on this project.*

| Document | Description |
|---|---|
| [SDLC](guides/sdlc.md) | Git workflow, branch strategy, commit conventions, deploy process |

---

## Archive
*Outdated or superseded documents kept for reference.*

| Document | Status | Notes |
|---|---|---|
| [Conditions v0.1 Draft](archive/07_conditions_v01_draft.md) | Superseded | Original 3-slot condition system. Now replaced by dual body+mind in conditions.json |
| [Sprite Sheet](archive/sprite_sheet.html) | Reference | HTML sprite grid viewer — still useful for original 5 enemies |
| [Conditions Table](archive/conditions_table.html) | Reference | Interactive HTML condition reference — may need updating |

---

## Other Key Files

| File | Location | Description |
|---|---|---|
| CLAUDE.md | repo root | Claude Code guidance — architecture, file structure, logging rules |
| DEVLOG.md | repo root | Milestone tracker — read first in any session |
| README.md | repo root | GitHub page — public game description |
| logs/*.md | repo root | Daily work logs — granular session details |
| src/data/*.json | dom-app | All game content (items, enemies, zones, conditions, etc.) |
