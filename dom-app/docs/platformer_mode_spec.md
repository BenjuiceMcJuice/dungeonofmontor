# Montor's Descent -- Platformer Mode Spec

> Design + technical spec for a side-scrolling, room-by-room platformer version of Dungeon of Montor.
> Written 2026-09-23. Status: **spec only -- nothing built yet.**
> Example room mockup (real sprites, annotated): [platformer_room_mockup.html](platformer_room_mockup.html) -- open in a browser.

---

## 1. The Pitch

Same dungeon. Same Montor. Same knight, same kitchen-knife arsenal, same rats and slugs and Crimson Orcs. But instead of tapping "Attack" and watching a d20 fall, **you run, jump, swing and dodge** through Montor's house one room at a time, seen side-on.

- **Montor's Crawl** = turn-based d20 roguelike (existing)
- **Montor's Tale** = AI-narrated text RPG (PoC)
- **Montor's Descent** = real-time side-view platformer (this spec)

It becomes a third tile in the Tavern. It is **not** a reskin with new rules -- the goal is that a player who knows the Crawl recognises every item, stat, condition, enemy and gift, and that the platformer runs on the **same data files and the same engine functions** wherever possible.

### Design pillars

1. **Same game, different hands.** Stats, items, conditions, gifts, loot, zones and enemies all come from the existing `src/data/*.json`. No forked content.
2. **The dice are still there -- you just can't see them roll.** Every hit, search and trap still resolves with d20 + modifier and the 4-tier system. Skill decides *whether* you connect; the dice decide *how well*.
3. **One room = one screen.** A chamber from the 4x4 zone grid becomes a single-screen side-view room. No scrolling camera within a room (optional small scroll for tall rooms later). Leaving through a door loads the neighbouring chamber -- classic Zelda-2 / Castlevania / Spelunky-room feel.
4. **Same pixel art.** The BBC Micro flat-colour sprite grids in `lib/sprites.js` are used as-is, at the same resolution, with the same tier colour swaps. New art is only added where movement needs it (walk/jump frames, tiles).
5. **Mobile first.** Must be playable on a phone with touch controls, same as the rest of the PWA.

---

## 2. What Carries Over (and How)

| System | Crawl (turn-based) | Descent (platformer) | Reuse |
|---|---|---|---|
| **Zone layout** | 4x4 maze of chambers (`generateMaze`, `generateZone`) | Same 4x4 maze. Each chamber = one room screen. Maze connections become doors (left/right) or shafts/ladders (up/down) | `lib/dungeon.js` direct |
| **Chamber types** | combat, rest, merchant, NPC, empty/junk, terminal, boss, stairwell | Same types, each mapped to a room template (see §5) | `generateChamberContent` direct |
| **Floors & zones** | 7 floors, 13 zones, themed | Same 7 floors / 13 zones; theme drives tileset + palette | `zones.json`, `themes.json` |
| **Stats** | 9 active stats, modifier = floor((stat-10)/2) | Same stats; each also drives a movement/feel property (§3) | `lib/classes.js` `getModifier`, `getMaxHp` |
| **d20 4-tier resolution** | Every attack/flee/search | Every attack that *physically connects*, every search, every trap dodge | `lib/dice.js` direct |
| **Weapons** | 6 classes, 4 tiers, ~64 weapons | Same weapons; class decides moveset (§4.2) | `items.json` direct |
| **Armour / slots** | 8 equip slots | Same 8 slots; weight affects jump (§3) | `items.json` direct |
| **Conditions** | 18 conditions + 10 reactions, tick per turn | Same conditions; tick on a 1-second "Montor tick" (§4.4) | `lib/conditions.js` direct |
| **Throwables & bombs** | Menu-used, fuse per turn | Physically thrown arcs; fuse in seconds | `items.json` + new physics |
| **Junk piles** | Tap pile, pick intensity, roll | Stand at pile, hold interact, pick intensity, roll | `lib/junkpiles.js` direct |
| **Terminal & gifts** | Found in pile, apply gifts to 5 slots | Same -- found in pile, same Gift UI overlay | `lib/gifts.js` + existing UI |
| **Enemies** | 12 archetypes x 5 tiers, 7 AI behaviours | Same archetypes/tiers/stats; AI re-expressed as movement (§6) | `lib/enemies.js` `generateEnemy` |
| **Loot** | d100 + LCK rarity | Same rolls; items drop as pickups that bounce out of enemies/chests | `lib/loot.js` direct |
| **Vendors** | Tailor + Peddler | Same shops, same CHA pricing; opened via menu overlay | existing merchant UI |
| **Levelling** | XP curve, 30 levels, StatPicker | Same curve and StatPicker (game pauses) | `progression.json`, `StatPicker.jsx` |
| **Safe room** | Between floors, tonics, Montor mood | Same -- a calm non-combat room with the same choices overlay | existing safe room UI |
| **Montor mood** | Tidiness / greed / taste | Same; tidiness now also counts what you *knock over* | `montor_mood_greed_spec.md` |
| **Flee** | AGI roll to leave combat | Removed as an action -- you flee by running out the door. Doors are **sealed** in combat rooms until cleared unless you pass an AGI check at the door (same 4-tier table for HP/gold loss) | `d20Flee` |
| **Permadeath / banked gifts** | Run ends, gifts survive | Same | `characterSave.js` |

### What does NOT carry over

- Initiative and turn order (replaced by real time).
- The combat log as the primary feedback (replaced by floating numbers + tier flashes; a mini log stays available in pause menu).
- "One Action per turn" -- replaced by cooldowns and animation lock.

---

## 3. Stats in a Platformer

Every stat keeps its Crawl meaning **and** gains a feel-based effect so builds still matter moment-to-moment.

| Stat | Crawl effect (kept) | Platformer feel |
|---|---|---|
| **STR** | +hit, +damage | Knockback dealt; can lift/throw heavier junk; heavy weapons swing faster above STR 14 |
| **DEF** | floor(DEF/2) damage reduction, shield block % | Less knockback taken; shorter hitstun |
| **AGI** | Initiative, double strike, dodge | Run speed (+3% per mod), attack speed, dodge-roll i-frames length. Initiative becomes **"first strike window"**: high AGI = enemies take longer to react when you enter a room |
| **INT** | Condition proc %, enchant damage | Same; also longer throwable aim preview arc |
| **LCK** | Crit threshold, loot rarity | Same (crits happen on the hidden d20) |
| **VIT** | Max HP = base + VIT x 5 | Same, unchanged |
| **PER** | Junk search roll | Same; also reveals hidden breakable walls/secret ledges and trap tiles within a radius |
| **END** | Regen per room, carry capacity | Same; plus **stamina bar** for dodge-roll/sprint. Over carry capacity = lower jump height and no double-jump |
| **CHA** | Merchant prices, premium stock | Same, unchanged |

Movement baseline (tunable): run 90 px/s, jump apex ~3 tiles, coyote time 100 ms, jump buffer 100 ms, variable jump height, one dodge-roll (stamina). **Double-jump** is not base -- it's granted by items (e.g. Montor's Wellies) or a Petal gift power, keeping the "gear defines you" feel.

---

## 4. Combat

### 4.1 Hidden-dice hit resolution

When a weapon hitbox overlaps an enemy hurtbox, the game calls the existing attack resolver:

```
tier = d20Attack(STR or AGI mod (daggers), weapon accuracy, conditions...)
```

| Tier | Platformer result |
|---|---|
| **Crit** | Big number, screen shake, hit-stop 80 ms, crit multiplier damage, 80% condition proc |
| **Hit** | Normal number, knockback, 40% proc |
| **Glancing** | Grey number, half damage, tiny knockback, 5% proc |
| **Miss** | "MISS" puff, no damage -- but the swing still visibly *touches*. Rolls this low should be rare in practice: see balance note |

**Balance note:** because the player already had to aim and time the hit, the platformer adds a flat **+4 "you actually connected" bonus** to attack rolls (tunable). Misses still exist (so AGI/STR/LCK matter) but a well-timed swing rarely whiffs. Enemies get the same treatment against the player: their contact/attack still rolls, and a *dodge* (roll through them) is a guaranteed avoid, separate from the AGI passive dodge chance.

Damage formula unchanged: `weapon die + STR mod - floor(enemy DEF / 2)`, min 1. Existing functions in `lib/combat.js` (`resolvePlayerAttack`, `resolveEnemyAttack`) should be called directly or split so the pure "roll + damage + condition" core is reusable without the turn-state wrapper.

### 4.2 Weapon class movesets

| Class | Moveset | Keeps its Crawl identity |
|---|---|---|
| **Dagger** | Very fast short jab, 3-hit combo, can attack mid-dodge | Double strike = chance of a free extra hit number; dual-wield = alternating hands, offhand hits at -2 no crit |
| **Sword** | Medium arc in front, 2-hit combo, down-stab in air | +accuracy |
| **Spear** | Long horizontal poke, pogo on down-attack | First strike -> longest reach, enemies get hit before they touch you |
| **Mace** | Slow overhead, hits slightly behind too | DEF ignore, stagger = DAZE (enemy stunned in place, stars) |
| **Battle Axe** | Slowest, huge 180-degree arc, moves you forward | Big dice, stagger |
| **Fists** | Fast 2-punch combo, short range, grab/throw small enemies | 2x STR bonus |

**Shields** (light weapons only): hold block button to raise shield. Block chance % still rolls -- a failed block roll means partial damage gets through. Montor shields that apply conditions on block still do so. Blocking drains stamina.

**Special items** that are turn-based by nature (Metronome "every 4th turn", Egg Timer, etc.) re-key to **"every 4th hit"** / **"per swing without a kill"**. A full mapping table lives in §9.

### 4.3 Throwables & bombs

- Throw button with aim arc preview (hold to aim on touch).
- **Single-target** -> projectile, hits first enemy.
- **Multi-hit** -> shrapnel burst on impact.
- **AoE** -> cloud/puddle zone that persists a few seconds (Gas Canister = poison cloud, Mop water = WET puddle).
- **Timed bombs**: fuse in seconds (fuse turns x 1.5s). Can be kicked. Can blow open cracked walls (secret rooms).
- Whacky consumables become physical: Banana Peel is a trip hazard on the floor, Rubber Duck squeaks and draws aggro, Cat runs off and attacks the nearest enemy.

### 4.4 Conditions in real time -- the "Montor tick"

A global **1.0 s tick** drives everything that was "per turn" in the Crawl:

- `tickConditions` runs every tick for the player and every enemy -- same function, same numbers.
- Durations measured in turns become ticks (e.g. BLEED 3 turns = 3 s).
- Regen relics, gift heals, bomb fuses, Metronome counters -> ticks or hits (see §9).

How each condition *feels*:

| Condition | Platformer effect |
|---|---|
| BLEED | Damage per tick, red drip particles; stacks -> 4+ triggers FEAR as before |
| POISON | Damage per tick + stat drain, green tint |
| BURN | Countdown then burst; spreads to adjacent flammable junk |
| FROST | Movement slowed 50%, then frozen solid for 1 tick; brittle (+50% damage taken) |
| WET | No direct effect; from water tiles, rain, Mop, sewer floors |
| CHARGED | No direct effect; from Cattle Prod, sparking wires, Automatons |
| NAUSEA | Controls occasionally "slip" (short input delay), accuracy penalty |
| SLUGGISH | Run/jump reduced |
| FEAR | Enemies: run away. Player: 50/50 -> controls briefly reversed OR ADRENALINE (next hit auto-crit) |
| DAZE | Stunned in place, stars |
| BLIND | Screen vignette darkens; enemies lose track of you |
| BLOODLUST | Can't leave via doors until room cleared, +damage |
| FRENZY | Auto-attacks, +damage, can hurt allies (co-op later) |
| CHARM | Enemy fights for you briefly |
| BORED / SAD | Existing stat penalties; SAD slows walk animation (flavour) |
| ADRENALINE / CRASH | Force crit next hit, then slowed + -3 STR |

**Reactions** (`checkConditionReactions`) fire exactly as in the Crawl, with bigger visuals: SHATTER = ice explosion, STEAM = screen-wide BLIND cloud, CONDUCTANCE = lightning jumps across every WET enemy standing in water. Room hazards (puddles, sparking wires, braziers) make reactions an environmental puzzle, not just a gear combo.

---

## 5. Rooms

### 5.1 Room format

- **Internal resolution:** 320 x 192 px (20 x 12 tiles of 16 px), integer-scaled to fit the screen, letterboxed. Portrait phones show the room top half with controls underneath; landscape is full-screen with overlay controls.
- **Tile layer:** solid, one-way platform, ladder, spikes, water, hazard (fire/wire/acid), breakable (cracked wall, crate), door.
- **Entity layer:** spawn points for enemies, junk piles, chests, NPCs, terminal, stairs.
- Rooms are built from **hand-authored templates** (small JSON tile arrays), picked by chamber type + which sides have exits, then decorated procedurally (junk pile placement, enemy spawns, hazards per floor theme). This keeps levels readable while still randomised per run.

New data file: `src/data/room-templates.json` -- `{ id, type, exits: ['L','R','U','D'], tiles: [...], spawns: [...], floors: [...] }`. Start with ~6 templates per chamber type for the Garden, grow per floor.

### 5.2 Moving between rooms

The existing 4x4 maze gives each chamber up to four exits:

- **Left / Right** -> doors on the side walls (the existing `DoorSprite` art, drawn as a side-view door).
- **Up** -> ladder or ledge climb to a hatch in the ceiling.
- **Down** -> a drop hole / trapdoor in the floor.

The **map** (existing `DungeonMap.jsx`) stays available from the pause menu, showing visited rooms exactly as in the Crawl. Rooms remember state (enemies dead, piles searched, chests open) using the same chamber state the Crawl already tracks.

### 5.3 Chamber type -> room

| Chamber | Platformer room |
|---|---|
| **Combat** | Enemies spawn on entry; doors seal (AGI check to force one open). Loot bounces out on clear |
| **Empty / junk** | Junk piles on platforms, some hard to reach; hazards; occasional ambush from a pile nat-1 |
| **Rest** | No enemies; interact with bed/chair to regen (same rules as Crawl rest) |
| **Merchant (Tailor)** | Shopkeeper sprite (`npc_tailor_grounds`), talk -> existing trade UI |
| **NPC (Peddler)** | `npc_peddler_grounds`, same peddler UI |
| **Terminal** | Terminal sits in a pile like the Crawl; once found, the gift overlay opens |
| **Boss** | Larger arena room (may scroll 2 screens wide); boss uses the Crawl boss stats (3x HP) plus a pattern set |
| **Stairwell** | `stairs_down` sprite; locked until terminal activated + boss defeated, same as Crawl |

### 5.4 Junk piles

Walk up, hold interact -> choose intensity (Quick Rummage / Thorough / Deep Clean). The game rolls `d20 + PER + intensity bonus` with the existing table. Visually the knight digs, junk flies out, items pop onto the floor. Traps fire as a physical hazard (spring blade, falling pot) that you can **dodge-roll** to avoid -- a successful dodge = the Crawl's "dodged trap, no damage", still keeping the trap-loot bonus. Nat 1 ambush = enemy bursts out of the pile.

Junk you pick up has **weight** (existing junk weights) -- carrying a lot visibly slows and lowers jumps, which finally gives the planned weight penalties a real bite.

---

## 6. Enemies

Enemies use `generateEnemy(archetype, tier)` unchanged for stats. Each archetype gets a movement pattern; the existing 7 AI behaviours are kept as special moves.

| Archetype | Movement | Crawl AI behaviour -> platformer |
|---|---|---|
| Rat | Scurries along floors, fast, jumps small gaps | **Flee** (runs out a door, drops Dropped Bag), **Eat Corpse**, **Spawn** (more rats from walls) |
| Slug | Slow crawl, walls and ceilings | **Slime Coat** (shiny, DEF up), leaves POISON trail tile |
| Orc | Walks, winds up a charge | **Howl** (buffs allies, visible shout ring) |
| Rock Monster | Slow, heavy, ground-pound shockwave | Tank; immune to knockback |
| Wraith | Floats, passes through platforms | Ignores armour; **Heal Ally** |
| Spider | Hangs from ceiling on thread, drops down | **Spawn** (spiderlings), venom |
| Mimic | Disguised as chest/junk pile until you get close | Ambush predator |
| Bat | Hangs, then swoops in sine arcs | Very fast, fragile |
| Hound | Runs and leaps, packs of 2-3 | **Howl**, **Eat Corpse** |
| Automaton | Patrols a platform, fires bolts | Highest DEF; **Sacrifice** (walks up and explodes), CHARGED |
| Shade | Teleports between shadows | INT caster; **Heal Ally** |
| Moth | Swarms towards light, erratic | **Sacrifice** (dust burst) |

- **Tier colours unchanged** -- a Crimson Orc is the Orc grid painted `#6b1a1a`, exactly as now.
- **Contact damage**: touching an enemy = that enemy's attack roll vs you (so DEF/dodge still matter), then 1 s invulnerability.
- **Corpses**: existing `corpse_*` sprites stay on the floor after death (and can be eaten by Rats/Hounds as in the Crawl).

### Bosses

Each zone boss = archetype + boss multipliers (existing `generateBoss`) + a 3-phase pattern (e.g. Garden boss: charge -> summon -> enraged charge). Boss patterns are the main new design content per zone.

---

## 7. Sprites & Art

**Reuse everything.** The sprite grids in `lib/sprites.js` are already pixel-perfect side-on-ish figures at 14-24 px tall, which is exactly platformer scale on a 16 px tile grid.

| Asset | Status | Work needed |
|---|---|---|
| 12 enemy grids + tier colours | Exists | Horizontal flip for facing; 1-2 extra frames per archetype for walk/attack (can start with a 2-frame "bob" by shifting rows) |
| 12 corpse grids | Exists | None |
| Knight (player) | Exists (single pose) | Add frames: idle, run (4), jump, fall, attack (per weapon class, 2-3), hurt, dodge-roll, climb. Same palette, same grid style |
| Equipped gear on knight | Not drawn | Phase 3+: overlay small grids for helmet/weapon so the Colander hat actually shows |
| Doors, stairs, chest, shrine, trap, NPCs, safe room | Exists | Side-view variants for doors (existing are front-on) |
| Junk piles (Garden x6) | Exists | Reuse directly; other floors are already in the backlog |
| Condition icons (18) | Exists | Reused in HUD + above enemy heads |
| **Tiles** | New | 16 px tile grids per floor theme (ground, wall, platform, ladder, water, hazard, background), same K/C/S grid format so the tile palette swaps per floor via `themes.json` |
| Weapon swing effects | New | Simple arc/slash grids per class |

**Rule:** new art is written in the same grid format (`K`/`C`/`S`/null) and drawn by the same `drawSprite` routine so it stays BBC-Micro flat and colour-swappable. Pre-render each sprite+tier+facing to an offscreen canvas once, then blit -- no per-frame grid painting.

---

## 8. Controls & UI

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / A-D | Stick / D-pad | Left virtual pad |
| Jump | Space / W / Up | A | Right button **A** |
| Attack | J / X | X | Right button **B** |
| Dodge-roll | K / Shift | B | Swipe on right side or button |
| Block (shield) | L | RB | Hold **B** + back |
| Throw / use item | I | Y | Quick-slot button (last used item) |
| Interact (search, talk, door) | E / Down | Down | Contextual button pops up |
| Pause / inventory / map | Esc / Tab | Start | Top-right icon |

- **HUD:** HP bar, stamina bar, gold, quick-slot item, active condition icons, floor/zone name. Montor whispers appear as a short text toast (existing whisper system).
- **Overlays** (game pauses): inventory, equipment, StatPicker, merchant, terminal/gifts, safe room, map. These **reuse the existing React components** -- the platformer only owns the canvas.
- Accessibility: option to slow game speed (0.75x) and an "assist" toggle for extra i-frames. Assist does not change dice.

---

## 9. Turn-Based Item Mapping

Items whose effects reference turns get re-keyed. Proposed defaults:

| Crawl wording | Platformer wording |
|---|---|
| "per turn" (conditions, regen during combat) | per Montor tick (1 s) |
| "per chamber" (regen relics, END regen) | per room entered (unchanged) |
| "every Nth turn" (Metronome) | every Nth hit that connects |
| "after a turn with no kill" (Egg Timer) | per swing since last kill |
| "skip turn" (FROST, DAZE, FEAR) | stunned for 1 tick |
| "fuse N turns" (bombs) | fuse N x 1.5 s |
| "initiative bonus" (spears, daggers) | first-strike window + reach/attack speed |
| "dice match" relics (Big Red Button, Gremlin Bell) | unchanged -- still on the hidden d20 |

These overrides live in a small `platformer` block per item (optional) inside `items.json`, e.g. `"platformer": { "trigger": "every_n_hits", "n": 4 }`, falling back to the automatic mapping above. No item is removed.

---

## 10. Technical Architecture

### 10.1 Where it lives

```
dom-app/src/
  pages/
    Descent.jsx                   Page: mounts canvas + overlays, owns run state
  platformer/
    engine.js                     Fixed-timestep loop (60 Hz update, rAF render), pause/resume
    input.js                      Keyboard, gamepad, touch -> unified action state
    physics.js                    AABB tile collision, gravity, one-way platforms, ladders
    camera.js                     Room fit/scale, screen shake, room transitions
    room.js                       Build room from template + chamber content; room state
    player.js                     Knight controller, moveset per weapon class, stamina
    enemyAI.js                    Movement patterns + mapping of Crawl AI behaviours
    rtCombat.js                   Hitbox overlap -> calls dice/combat/conditions (pure)
    montorTick.js                 1 s tick: conditions, regen, fuses
    projectiles.js                Throwables, bombs, enemy bolts
    render.js                     Tile + sprite blitting, particles, floating numbers
    spriteCache.js                Pre-renders SPRITES (tier x facing x frame) to offscreen canvases
    anims.js                      Frame definitions for knight + enemies
  components/platformer/
    TouchControls.jsx             On-screen pad + buttons
    DescentHud.jsx                HP/stamina/conditions/quick slot
  data/
    room-templates.json           Hand-authored room layouts
    tiles.json                    Tile grids per floor theme
```

### 10.2 Principles

- **Plain canvas 2D, no game engine dependency.** The game is small; a ~2k-line custom loop matches the existing "sprites are data" ethos and keeps the PWA bundle tiny. (Revisit only if performance fails on mid-range phones.)
- **React owns menus, the engine owns the frame.** The loop never triggers React re-renders per frame; it posts coarse events (HP changed, level up, open merchant) to the page via callbacks.
- **Engine logic stays pure and shared.** `rtCombat.js` is a thin adapter: it converts "hitbox overlap" into the same calls the Crawl makes (`d20Attack`, `rollDamage`, `applyDefence`, `rollConditionApplication`, `applyCondition`, `checkConditionReactions`). Where `lib/combat.js` functions are tangled with turn state, **extract** the pure core into shared helpers used by both modes rather than copying.
- **ES5 style** (`var`, `function(){}`) to match the codebase.
- **Save:** separate localStorage key (`dom_descent_run_v1`) following `runSave.js`; save on room entry. Character, banked gifts and Tavern hub are shared with the Crawl (Stage 2 spec).
- **Performance budget:** 60 fps on a mid-range phone; <= ~40 active entities per room; sprite cache avoids per-frame grid drawing.

### 10.3 Tavern integration

New tile in `Tavern.jsx` beside Montor's Crawl and Montor's Tale:

> **Montor's Descent** -- *Run, jump and swing through Montor's house.* Side-scrolling platformer -- same dungeon, same loot, your reflexes. **(WORK IN PROGRESS)**

New `descent` screen route in `App.jsx`.

---

## 11. Build Plan

| Phase | Goal | Done when |
|---|---|---|
| **P0 -- Feel prototype** | One hard-coded Garden room. Knight runs/jumps/attacks with a sword. One Dust Rat. Hidden d20 hit tiers with floating numbers. Keyboard + touch | It's fun to hit a rat for 60 seconds |
| **P1 -- One zone** | Garden zone: 4x4 maze -> rooms from templates, doors/ladders/drops, room state memory, map overlay, combat/empty/rest rooms, 3-4 Garden archetypes, loot pickups, HP/death | Can clear the Garden rooms and die properly |
| **P2 -- Full systems** | Junk piles + intensity + traps, terminal + gifts overlay, merchant/peddler, inventory/equip overlays, all weapon class movesets, shields, throwables/bombs, conditions + reactions on Montor tick, levelling + StatPicker, Garden boss, stairwell | A complete Floor 0 run with the same decisions as the Crawl |
| **P3 -- Whole dungeon** | All 7 floors / 13 zones: tilesets, templates, remaining archetypes' AI, bosses per zone, safe rooms between floors, Montor mood + whispers, item turn-mapping pass | Full run top to bottom |
| **P4 -- Polish** | Knight gear overlays, particles, audio (if ever), gamepad polish, balance pass, Tavern tile goes live | Shippable to main |
| Later | Co-op (two knights same room) via the async/co-op Firestore work -- out of scope for this spec | -- |

---

## 12. Open Questions

1. **Portrait vs landscape** -- lock landscape for Descent, or support portrait with controls under the room? (Proposal: support both, recommend landscape.)
2. **Connection bonus size** -- is +4 to hit on a physical connect the right amount, or should misses be removed entirely for the player and kept only as glancing blows?
3. **Doors sealing in combat rooms** -- good tension, or frustrating? Alternative: open doors, but leaving a live fight costs the Crawl flee penalty.
4. **Knight animation frames** -- hand-draw in grid format (consistent) vs. procedurally squash/shift the existing grid (fast). Proposal: procedural for P0, hand-drawn by P2.
5. **Room size** -- fixed 20x12 single screens everywhere, or allow 2-screen rooms for bosses and "large" chambers?
6. **Shared character** -- can a Stage 2 character move between Crawl and Descent runs (shared banked gifts), or does each mode keep its own roster?
7. **Montor's voice** -- keep text whispers only, or add AI-driven taunts (Groq/Haiku) triggered by deaths and big crits? Nice-to-have, not core.

---

*Platformer Mode Spec -- v0.1 -- September 2026*
