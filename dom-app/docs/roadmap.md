# Development Roadmap

> 5-stage plan from solo crawl to full multiplayer RPG with AI narrative.
> Updated 2026-04-04.

---

## Stage Overview

```
Stage 1 -- The Crawl         Solo dungeon crawl. Core mechanics.        CURRENT
Stage 2 -- The Tavern        Persistent characters. Pre-run hub.        Planned
Stage 3 -- The Network       Multiplayer co-op. Shared dungeons.        Planned
Stage 4 -- The Mind          AI Montor. Dynamic dialogue.               Planned
Stage 5 -- The Long Game     Meta-progression. Community. Seasons.      Planned
```

Each stage is a shippable, playable game. Each one builds on the last without rework.

---

## Stage 1 -- The Crawl (current)

**Goal:** A working solo dungeon loop you can actually play.

### What's built (as of 2026-04-04)

- Full d20 combat system with 4-tier resolution
- 5 weapon classes (dagger, sword, spear, mace, battle axe) + unarmed + shields + dual wield
- 4-tier weapon system (base, gifted, hardened, unique) with 64 weapons
- 8 equipment slots: weapon, offhand, armour, helmet, boots, ring, amulet, relic
- **243 total items** across all categories (64 weapons, 36 armour, 62 consumables, 55 relics, 15 amulets, 11 rings)
- **18 conditions** with multiple coexistence, BLEED stacking, FEAR fight-or-flight, DAZE stun, WET/CHARGED catalysts
- **6 condition reactions** -- SHATTER, INSTANT FREEZE, STEAM, SEPSIS, FRENZY, CATATONIC
- 12 enemy archetypes across 5 power tiers with **7 AI behaviours** (flee, howl, heal ally, eat corpse, sacrifice, slime coat, spawn)
- 7 dungeon floors with 13 zones, each a 4x4 grid of 16 chambers (208 chambers total)
- Junk pile searching: PER-based rolls, 3 search intensities, trap-loot link (trap = +25% item chance, gold x1.5), consumable junk usable in combat
- Terminals hidden in junk piles to unlock stairwells
- **All 6 Montor's Gift types fully wired** with combat effects across body/mind/weapon/shield (Petal, Stone, Bile, Blood, Ember, Void)
- Card-based gift picker at terminals ("Manage Gifts") with slot limits = gifts unlocked
- Gift stat boosts reversed on switch (no stacking exploit)
- Montor's treasures hidden as regular junk (one per floor)
- Dual vendor system: Tailors (zone-themed equipment + CHA-gated randomised premiums) + Peddlers (consumables/throwables)
- **Throwable system** -- single-target, multi-hit, AoE delivery types
- **5 timed bombs** with per-turn fuse countdown
- **9 dice-triggered relics** (Metronome, Gremlin Bell, Pressure Cooker, Big Red Button, Magic 8-Ball, Nuke, etc.)
- **14 variety weapons** (Mop/WET, Cattle Prod/CHARGED, Frying Pan, Cheese Grater, etc.) + 3 chaos weapons
- **Whacky consumables** (Banana Peel, Rubber Duck, Cat, Mirror, etc.)
- In-run levelling: **30 levels**, front-loaded XP curve (~3-5 levels per floor)
- Pre-run stat allocation (10 points) + starting merchant (50g)
- END stat = HP regen per room, CHA 12+ = premium vendor access
- BBC Micro-style pixel sprites for all enemies, player, conditions, doors, terminals, junk piles
- Floor-themed pixelated borders
- Full-screen stats panel with HP bar (green/yellow/red), active gifts display, condition resistance summary
- Safe rooms between floors with Gift activation
- ErrorBoundary component for crash diagnosis (iOS WebKit)
- Firebase Auth (email + Google sign-in)
- GitHub Pages deployment with auto-deploy from main

### What's remaining in Stage 1

| Task | Status |
|---|---|
| Wire remaining relic passives (reflect_conditions, last_stand, see_enemy_hp) | Backlog |
| Inventory UI redesign -- better layout, weight system, END governs capacity | Backlog |
| Room events -- pollen, rain, grease fires, day/night (Garden) | Backlog |
| Montor's Mood system -- tidiness tracking, safe room tonics, between-room whispers | Backlog |
| WIS stat wired for gift activation rolls | Backlog |
| Sprite polish -- junk pile sprites for all floors (Garden done), corpse sprites, player class variants | Backlog |
| Dungeon map UI improvements -- fog of war, PER-based reveal | Backlog |
| Firebase persistence -- save/load run state to Firestore | Backlog |
| Soul slot synergies -- 21 pairings for endgame depth | Backlog |
| Combat balance pass -- dual dagger bleed still OP, other builds need parity | Backlog |

---

## Stage 2 -- The Tavern (planned)

**Goal:** Persistent characters, pre-run hub, multi-class, meaningful progression.

### Key features

- **Persistent characters** -- stats, XP, inventory, and gear saved to Firestore between runs
- **Character creation** -- name, class selection, stat distribution
- **The Tavern** -- pre-run hub screen with character sheet, run setup, run history
- **Multi-class** -- add Ranger, Mage, Rogue (4 classes total, then expand to 10)
- **Levelling across runs** -- XP thresholds, ability unlocks every 5 levels
- **The Dump** -- pre-run junk trade hub where junk collected in runs becomes a meta-currency for permanent unlocks: gift option unlocks, gift power levels, starting gear, stat seeds
- **Death modes** -- Standard (respawn) vs Ironman (permadeath) per character
- **Stash system** -- store items between runs

### The Dump (junk meta-currency)

Junk collected during runs persists and can be traded at The Dump before a new run. This incentivises junk looting and creates a roguelike meta-progression loop:

| Unlock type | Cost (junk) | Effect |
|---|---|---|
| Gift option unlocks | Medium | New gift slot options available |
| Gift power levels | High | Stronger base effects on gifts |
| Starting gear | Low-Medium | Better equipment on run start |
| Stat seeds | High | Small permanent stat bonuses |

---

## Stage 3 -- The Network (planned)

**Goal:** Multiplayer co-op, shared dungeons, the social loop.

### Key features

- **Campaign system** -- named campaigns with multiple runs, shareable Campaign Code
- **Party of up to 4** -- shared dungeon, turn-based combat with interleaved turns
- **Async play** -- take turns hours apart, push notifications when it's your turn
- **Real-time Firestore sync** -- all players subscribe to campaign doc via `onSnapshot`
- **Turn enforcement** -- `currentTurnUid` on campaign doc, Cloud Function validation
- **Spectator feed** -- other players watch your turn happen live
- **Cross-level party mechanics** -- Morale Aura, Lucky Charm, healing across party
- **All 10 classes** -- Knight, Ranger, Mage, Rogue, Cleric, Berserker, Orc Warchief, Bard, Druid, Paladin
- **PvP options** -- 1v1 character duels, competitive dungeon racing
- **Playable Montor** -- one player controls the dungeon (asymmetric gameplay)

### Firebase multiplayer backbone

- All meaningful game writes go through Cloud Functions (no direct client writes)
- Inventory locking during combat via `inBattle` flag
- Firestore security rules enforce turn order
- FCM push notifications for async turn alerts
- Turn timeout with auto-skip (24h default)

---

## Stage 4 -- The Mind (planned)

**Goal:** AI Montor via Groq, dynamic dialogue, dungeon personality.

### Key features

- **AI narration** -- all encounter descriptions, combat narration, scene-setting via Groq API
- **Campaign Brief** -- player-written text injected into every AI call, shapes the entire narrative
- **Montor conversations** -- freeform AI dialogue at speaking tubes, mirrors, safe rooms
- **Per-run mood** -- 8 hidden moods (Nostalgic, Paranoid, Bored, Proud, Lonely, Vengeful, Playful, Melancholy)
- **Conversation scoring** -- AI scores responses 1-10 based on mood alignment, triggering rewards or punishments
- **The Story Page** -- live chronicle of the campaign written as prose, shareable via link
- **Montor's Offers and Curses** -- at mood extremes, Montor intervenes mechanically
- **Basic Crawler mode** -- game still works fully without a Groq key (static text fallback)

### Token management

- Compressed context per AI call (brief + mood + party summary + relevant state)
- Token budget per trigger type: crit narration ~60 tokens, run_end summary ~500 tokens
- Estimated ~16k-18k tokens per run -- within Groq free tier

---

## Stage 5 -- The Long Game (planned)

**Goal:** Meta-progression, cross-campaign depth, community features.

### Key features

- **Factions** -- persistent faction standing across campaigns, faction merchants, faction-exclusive gear
- **Deities** -- devotion tracking, tier effects (Faithful > Devoted > Exalted > Avatar), Divine Intervention
- **Legacy system** -- Legacy Characters preserved read-only on death, Veteran Embuing (transfer skills/relics to new characters)
- **Character arc** -- phase display (Wanderer > Known > Established > Legend)
- **Seasonal content** -- rotating dungeon themes, limited-time events
- **Achievement/title system** -- earned through play, visible to other players
- **Community features** -- shared Story Pages, character profiles

---

## Rough Timeline

*Assuming solo developer, part-time.*

| Stage | Estimated Time |
|---|---|
| Stage 1 -- The Crawl | 4-6 weeks (mostly complete) |
| Stage 2 -- The Tavern | 3-4 weeks |
| Stage 3 -- The Network | 4-5 weeks |
| Stage 4 -- The Mind | 3-4 weeks |
| Stage 5 -- The Long Game | 5-8 weeks |
| **Total** | **~20-27 weeks** |

Stage 3 (multiplayer) is the most technically risky. Stage 4 (AI) is the most unknown in terms of prompt tuning. Stage 5 is the most feature-heavy but least architecturally complex.

---

## Success Questions

| Stage | Does it pass? |
|---|---|
| 1 | Does the core loop feel fun? Would you play another run? |
| 2 | Does your character feel like *yours*? Do you care about levelling? |
| 3 | Is playing with a friend better than playing alone? |
| 4 | Does the AI make it feel alive? Does the dungeon have a personality? |
| 5 | Do you feel the weight of your character's history? Does it feel like a legend? |

---

*Roadmap -- v1.1 -- April 2026*
