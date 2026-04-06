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
| 2026-04-02 | Weapon system overhaul — 5 classes, 4 tiers, ~60 weapons, stagger mechanic | ✅ Done |
| 2026-04-02 | Frost buff (brittle +50% dmg taken), Daze buff (guaranteed stun) | ✅ Done |
| 2026-04-02 | HP balance — VIT×5, HP per level 5-10, rest 35%, baseline 1HP regen | ✅ Done |
| 2026-04-02 | Unarmed combat — d4, 2x STR, -1 acc, +1 init | ✅ Done |
| 2026-04-02 | Combat UI timing — tap bleed-through fix, condition display pacing | ✅ Done |
| 2026-04-02 | Enemy adrenaline crits, 50/50 fight-or-flight | ✅ Done |
| 2026-04-02 | Loot table rebalance + weapon compendium doc | ✅ Done |
| 2026-04-02 | Junk piles — PER-based search, 3 pile sizes, XP, junk bag, terminal placement | ✅ Done |
| 2026-04-02 | Removed chest/trap/hidden room types — replaced with junk pile rooms | ✅ Done |
| 2026-04-02 | Junk search redesign — clean levels, inspect, PER/AGI saves, dice animation | ✅ Done |
| 2026-04-02 | Consumable junk — eat/drink risk/reward, PER inspection, LCK quality | ✅ Done |
| 2026-04-02 | 130+ items — tiered resist relics, stat tonics, AoE throwables, permanent stat boosts | ✅ Done |
| 2026-04-02 | Combat UI — Use Item/Throw actions, read-only Stats/Bag, condition stack display | ✅ Done |
| 2026-04-02 | Dungeon rework — every zone self-contained (terminal + boss + stairwell) | ✅ Done |
| 2026-04-02 | Terminals unlock stairwells (replaced keystones), tappable in room | ✅ Done |
| 2026-04-02 | Montor's treasures — 6 gift artefacts hidden in junk, one per floor | ✅ Done |
| 2026-04-02 | Void relics — Nudge (+1 d20), Chaos Marble (±2 all dice) | ✅ Done |
| 2026-04-02 | God mode — invincible + one-shot toggles for testing | ✅ Done |
| 2026-04-02 | Item + weapon compendium docs | ✅ Done |
| 2026-04-02 | Bidirectional zone doors — unlocked state persists, correct placement | ✅ Done |
| 2026-04-02 | Montor's Gifts appear as regular junk — no special announcements | ✅ Done |
| 2026-04-02 | Atmospheric stairwell hints — floor-specific flavour text | ✅ Done |
| 2026-04-02 | Floor-themed pixelated borders — 6 floor colours across all phases | ✅ Done |
| 2026-04-02 | Full-screen stats panel — overlay with green/red buff colouring, base values, active effects | ✅ Done |
| 2026-04-02 | Stats + Bag header always visible — consistent across doors, chamber, combat | ✅ Done |
| 2026-04-02 | Read-only combat inventory — equipped + carried items, no actions | ✅ Done |
| 2026-04-02 | Junk search ghost overlay bug fixed — untracked setTimeout cleaned up | ✅ Done |
| 2026-04-02 | Junk consumables wire stat buffs + conditions into game state | ✅ Done |
| 2026-04-02 | All interactions as full-screen overlays — merchant, NPC, chest, corpse, junk search | ✅ Done |
| 2026-04-02 | Junk search enemies trigger real combat — ambush = enemy first strike | ✅ Done |
| 2026-04-02 | Combat corpses append not overwrite — junk search combat preserves existing corpses | ✅ Done |
| 2026-04-02 | Balance: Thorough/Deep Clean risk+reward increased | ✅ Done |
| 2026-04-02 | Adrenaline rebalanced — +6 STR for 2 turns, crash: 50% skip, -3 STR | ✅ Done |
| 2026-04-02 | **Montor's Gift system fully implemented** — gifts.json, gifts.js, safe room multi-step overlay, 4 slots (body/mind/weapon/shield), all 16 petal effects wired | ✅ Done |
| 2026-04-03 | 11 bug fixes — ambush lock, FEAR flash, zone door black screen, equip bugs, render fallthrough recovery | ✅ Done |
| 2026-04-03 | Equipment expansion — 37+ items, 4 new slots (helmet/boots/amulet/rings), 2 set bonuses, inventory reorg | ✅ Done |
| 2026-04-03 | All 6 gift types wired — stone/bile/blood/ember/void added, 429 lines combat integration | ✅ Done |
| 2026-04-03 | NPC vendor split — Tailor (zone equipment + CHA premium) + Peddler (consumables) | ✅ Done |
| 2026-04-03 | Multiple conditions coexist, condition enhancer items, dual wield sword+dagger | ✅ Done |
| 2026-04-03 | Stats/combat polish — XP on victory, XP bar, END→regen, CHA→premium, How It Works guide | ✅ Done |
| 2026-04-03 | ErrorBoundary for iOS crash diagnosis, bugs.md tracker created | ✅ Done |
| 2026-04-03 | Docs consolidation — 27 fragmented files → 5 clean topic docs, Montor narrative rewrite | ✅ Done |
| 2026-04-04 | 7 healing gifts — Stoneskin Mend, Cauterise, Siphon, Quartz Resonance, Phoenix Spark | ✅ Done |
| 2026-04-04 | Weapon condition proc gifts — Seismic Strike (DAZE), Dread Touch (FEAR) | ✅ Done |
| 2026-04-04 | Gift proc reduction — weapon gift condition chance quartered if weapon already has a condition | ✅ Done |
| 2026-04-04 | Shield reflect balance — condition proc reduced from 100% to 15% | ✅ Done |
| 2026-04-04 | Domain floor crash fix — boss placement for final floor, safety fill for undefined chambers | ✅ Done |
| 2026-04-04 | WET/CHARGED/ADRENALINE condition icons + missing icon fallback (0x0 canvas) | ✅ Done |
| 2026-04-04 | Room UI overhaul — mottled pixel backgrounds per floor/chamber, walls as textured strips | ✅ Done |
| 2026-04-04 | Garden gate door sprites — iron bars, stone pillars, vines, open/closed states | ✅ Done |
| 2026-04-04 | Door themes per floor — unique colours for all 7 floor types | ✅ Done |
| 2026-04-04 | Hi-res junk pile sprites (scale 3, matching door pixel density) | ✅ Done |
| 2026-04-04 | Junk piles shrink as searched, keep corner position when others depleted | ✅ Done |
| 2026-04-04 | Corpse sprites bigger (scale 5), border/box removed | ✅ Done |
| 2026-04-04 | Direction labels + door labels removed — sprites speak for themselves | ✅ Done |
| 2026-04-04 | Terminal hint gated by PER >= 12 | ✅ Done |
| 2026-04-04 | Enemy flee/howl/heal visible in UI — 1.5s display with descriptive message | ✅ Done |
| 2026-04-06 | Full effects audit — 11 unwired gifts, throwable button, condition UI, Napalm, Acid Edge | ✅ Done |
| 2026-04-06 | Sepsis rebuffed (+4 flat), Acid Edge nerfed (50% proc, -1), item prices doubled | ✅ Done |
| 2026-04-06 | Combat log cleanup, enemy condition display, enemy stat colour (green/red) | ✅ Done |
| 2026-04-06 | Traps lethal, starter shop slimmed, loot balance (health potions halved) | ✅ Done |
| 2026-04-06 | Basic run persistence — localStorage + Firestore, resume on reload | ✅ Done |
|            | **Next up** | |
|            | Themed hi-res junk sprites for non-garden floors | ⬜ |
|            | Inventory weight — END governs capacity, encumbrance penalties | ⬜ |
|            | Room events — pollen, rain, grease fires, day/night (Garden) | ⬜ |
|            | Gift leveling (Hades-style) + mono-gift synergy bonuses | ⬜ |
|            | The Dump — pre-run junk trade hub for permanent unlocks | ⬜ |

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
