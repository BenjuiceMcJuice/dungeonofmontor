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
| 2026-03-31 | Conditions system — 14 conditions, combat integration, enemy innate conditions | ✅ Done |
| 2026-03-31 | Item expansion — 30+ items, enchanted weapons, condition relics, Montor uniques | ✅ Done |
| 2026-03-31 | In-run levelling — XP thresholds, HP boost, stat pick UI | ✅ Done |
| 2026-03-31 | Balance pass — DEF/3, min damage 2, enemy stat reductions, boss 3x HP | ✅ Done |
| 2026-03-31 | Montor's Gifts spec — 6 gifts, treasures, sacrifices, boons, fusions (design only) | ✅ Done |
|            | **Architecture — Data-driven engine** | |
| 2026-04-01 | Phase 1-3: All game data extracted to 10 JSON files, engine files pure logic | ✅ Done |
|            | **Stage 1 — The Crawl (continued)** | |
| 2026-04-01 | Tabbed inventory UI (Weapons/Armour/Items) + unequip system | ✅ Done |
| 2026-04-01 | 9 relic passives wired (regen, hp_bonus, lck, crit, immunity, lifesteal, reflect, dodge, reroll) | ✅ Done |
| 2026-04-01 | Weapon type overhaul — daggers (double strike/AGI), maces (DEF ignore), shields (block/DEF) | ✅ Done |
| 2026-04-01 | Montor-themed item naming — personal collection + disdainful generic names | ✅ Done |
| 2026-04-01 | Trader variety — zone-appropriate random stock, merchants named as Montor's staff | ✅ Done |
| 2026-04-01 | New items: Dull Mace, shields (Bit of Wood, Pot Lid, Dinner Tray), Void Cleaver, Last Stand Brooch, Homebrew, Bath Bomb | ✅ Done |
| 2026-04-01 | Sprint backlog spec (docs/specs/11) | ✅ Done |
| 2026-04-01 | Junk & Gifts system spec (docs/specs/12) — junk piles, weight, PER/END/WIS/LCK/CHA activation | ✅ Done |
| 2026-04-01 | Montor AI conversations & mood system spec (docs/specs/13) | ✅ Done |
| 2026-04-01 | Dual body+mind conditions — all 14 conditions affect both slots | ✅ Done |
| 2026-04-01 | Tap-anywhere continue — all transition/continue screens | ✅ Done |
| 2026-04-01 | Combat log feedback — double strike, dodge, block, reflect, immunity messages | ✅ Done |
| 2026-04-01 | Level-up expanded — stat pick every level, 9 stats, info hints | ✅ Done |
| 2026-04-01 | StatPicker component — reusable, tap-to-inspect, confirm/back flow | ✅ Done |
| 2026-04-01 | Starting screen — stat allocation (10 pts) + pre-run merchant (50g) | ✅ Done |
| 2026-04-01 | First production deploy to main — wider testing | ✅ Done |
| 2026-04-01 | Full stat rebalance — VIT HP, DEF/2, AGI dodge, INT enchant dmg, LCK crits | ✅ Done |
| 2026-04-01 | Dual wield daggers — offhand attack, -2 accuracy, no crits | ✅ Done |
| 2026-04-01 | 9 level-ups (was 4), condition rates boosted, 3+ enemies per zone | ✅ Done |
| 2026-04-01 | Full 7-floor dungeon — 13 zones, 12 enemy types, 208 chambers | ✅ Done |
| 2026-04-01 | 7 new enemy sprites + 7 corpse sprites | ✅ Done |
| 2026-04-01 | 50+ Montor-themed items across 3 quality tiers (junk/enchanted/premium) | ✅ Done |
| 2026-04-01 | Condition icons (14 pixel sprites), combat HUD redesign | ✅ Done |
| 2026-04-01 | Equip-when-stunned, full-screen inventory, item detail panel | ✅ Done |
| 2026-04-01 | Weapon balance — daggers init+, swords accuracy+, maces AGI penalty | ✅ Done |
| 2026-04-01 | Equipment AGI penalties wired into combat stats (weapon + armour) | ✅ Done |
| 2026-04-01 | Font consistency (pixel for art, clean for UI) | ✅ Done |
| 2026-04-01 | Bug fixes — chamber clearing, chest exploit, buff durations, iOS zoom | ✅ Done |
| 2026-04-01 | Docs reorganised into dom-app/docs/ with INDEX.md | ✅ Done |
| 2026-04-01 | Design specs: build identity, gift system v0.2, Montor AI, junk/gifts | ✅ Done |
| 2026-04-01 | CHA merchant pricing — 5% per mod on buy/sell, all merchant UIs | ✅ Done |
| 2026-04-01 | New items: Magnifying Glass (double conditions), Gran's Lottery Ticket (d20 match → rare item), Adrenaline Shot | ✅ Done |
| 2026-04-01 | Condition log grammar — display names (Bleeding, Afraid) instead of raw IDs | ✅ Done |
| 2026-04-01 | FEAR rework — fight-or-flight (40% skip / 60% adrenaline crit), replaces death spiral | ✅ Done |
| 2026-04-01 | ADRENALINE + CRASH conditions — forceCrit mechanic, triggersOnExpiry chain | ✅ Done |
| 2026-04-01 | Turn skip UX — playerSkipped phase with 1.5s delay + red banner | ✅ Done |
| 2026-04-01 | Design: Gift endgame — Void Chamber restoration, terminals under junk piles | ✅ Done |
|            | **Next up** | |
|            | Junk piles — room interaction, search intensity, PER rolls, XP, terminals hidden underneath | ⬜ |
|            | Wire remaining passives — reflect_conditions, last_stand, see_enemy_hp_exact | ⬜ |
|            | Inventory weight — END governs capacity, encumbrance penalties | ⬜ |
|            | Montor's Gift system — find/break/apply at terminals/restore to Void Chamber | ⬜ |
|            | Room events — pollen, rain, grease fires, day/night (Garden) | ⬜ |

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
