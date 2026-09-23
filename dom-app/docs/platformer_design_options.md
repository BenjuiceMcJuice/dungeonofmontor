# Montor's Descent -- Design Options: Junk as the Game

> Companion to [platformer_mode_spec.md](platformer_mode_spec.md). That spec ports the Crawl faithfully. This doc asks a different question: **what if the platformer is its own thing, and the junk is the point?**
> Written 2026-09-23. Brainstorm, not a spec. Pick from it.

---

## 0. The shift

The v0.1 spec keeps every Crawl system and hides a d20 behind each sword swing. That's safe, but it makes a platformer that plays like a stats screen with a jump button.

Montor's house has one thing no other dungeon has: **it's full of his stuff.** Piles of it. In the Crawl you tap a pile and roll. In a platformer the junk can be *physical*: you can pick it up, stack it, throw it, burn it, wear it, build with it, and knock it over. That's where the fun is.

So the pitch changes to:

> **Montor's Descent is a physics-y puzzle platformer about a knight looting a hoarder's house, one room at a time, while the house's owner watches and gets increasingly annoyed.**

Keep from the main game: the 7 floors, the enemies and their sprites, the items and their silly names, the 6 Gifts, Montor's mood, permadeath with banked gifts. Loosen: dice, stats-as-numbers, turn economy, the "search roll" abstraction.

---

## 1. Junk as physical objects (the foundation everything else builds on)

Every named junk item in `junk.json` (Broken Gnome, Tangled Hose, Cracked Pot, Snapped Rake Handle, Bird Bath Fragment...) becomes an **object in the room** with a small set of properties:

| Property | Values | Example |
|---|---|---|
| **Weight** | light / medium / heavy | Seed packet / Cracked Pot / Bird Bath Fragment |
| **Shape** | small, long, flat, round | Gnome, Rake Handle, Plank, Football |
| **Material** | wood, metal, cloth, ceramic, organic | burns / conducts / soaks / shatters / rots |
| **Behaviour** | one verb | hose *stretches*, pot *holds*, ball *bounces*, mattress *cushions* |

Player verbs: **pick up, carry, drop, stack, throw, push, kick, break.** Weight limits how many you carry (END) and how far you throw (STR). That's the whole stat system a player needs to *feel* -- everything else can stay under the hood.

Rooms are then designed around **what's in them**, not what's rolled. A room with a Tangled Hose, two Cracked Pots and a wardrobe is a puzzle; the same room with a mattress and a shelf is a different one.

Everything below assumes this.

---

## 2. Directions to explore

Nine options. They aren't exclusive -- the recommendation at the end combines a few.

### A. Stack to reach -- "Hoarder's Tetris"

**Hook:** The exit, the chest, the terminal are *up there*. The junk is *down here*. Build a way up.

- Junk pieces have real shapes (2x1 plank, 1x1 pot, 3x1 hose that bends). Stack them; they wobble if unbalanced, and heavy-on-light collapses.
- Each room is a small "get from A to B" puzzle with several solutions. A precise stack, a thrown gnome to hit a switch, or just smash the wardrobe for a plank.
- **Montor twist:** Montor *hates* mess. Neat stacks that you leave behind raise tidiness; a room strewn with broken pots drops it. His mood changes what he offers you in the safe room (existing system).
- Borrows: junk names/pools per floor, tidiness, END weight.
- Risk: stacking physics on a phone can be fiddly. Snap-to-grid stacking (Baba Is You feel) is safer than free physics.

### B. Contraptions -- "Build the thing"

**Hook:** Every junk item is a *part*. Combine three parts at a Workbench to make a tool that solves the room.

- Recipes are discoverable and silly, in Montor's voice:
  - Rake Handle + Tangled Hose + Bucket = **Grapple Hook**
  - Bird Bath Fragment + Curtain Ring + Football = **Rolling Shield**
  - Cracked Pot + Strange Mushroom + Candle = **Spore Bomb** (POISON cloud)
  - Mattress + Two Planks = **Trampoline**
- Tools are consumable or break after N uses, so you're always scavenging for the next one.
- Deeper floors have fancier parts (Quarters: gramophone horn, lampshade; Works: gears, bellows).
- **Montor twist:** some recipes are *his*. Build one and he comments: "That's my gravy boat. On a stick." Build enough of his things and he starts hiding parts from you.
- Borrows: the Junk Golem spec's build-a-thing fantasy, but per room rather than per run. The Golem itself could be the *ultimate* contraption on Floor -4.
- Risk: recipe discovery needs good hinting or it turns into wiki-gaming. Show silhouettes of "things you could make with what's in this room".

### C. Junk as ammo and armour -- "Wear the house"

**Hook:** No weapon slot. You fight with *whatever you're holding.*

- Pick up a Rusty Trowel: short fast poke. Snapped Rake Handle: long slow swing. Cracked Pot: one throw, shatters, small AoE. Tangled Hose: whip, pulls enemies to you. Broken Gnome: heavy throw, big knockback, and he comes back to you like a boomerang because Montor loves him.
- Items **degrade** as you use them (the pot breaks first throw; the trowel lasts a room). You're always improvising.
- Wear junk too: colander = helmet (this is already an item!), pot lid = shield, dressing gown = armour. Visible on the knight.
- **Montor twist:** using his *personal* items (the Mum's Bread Knife tier) as weapons enrages him; enemies get a tier boost while he's cross, but treasure drops improve because he's careless when angry.
- Borrows: the item compendium wholesale -- 240 household items already have names and stats.
- Risk: losing the "build" identity of the Crawl. Mitigate with a small backpack (3 slots) so a favourite item can be kept.

### D. Cleaning -- "Reverse hoarding"

**Hook:** The room isn't done when the enemies are dead. It's done when it's *tidy*.

- Each room has a tidiness bar. Put junk in the right bin (wood / metal / organic / "Montor's things"), and the bar fills. Reach the threshold and the door unlocks, or a hidden thing is revealed under the last pile.
- Sorting is the puzzle: which bin does a Bird Bath Fragment go in? (Ceramic. Wrong bin = a small penalty, Montor tuts.)
- Enemies **un-tidy**: rats drag junk out of bins, slugs slime the floor, moths eat the cloth pile.
- **Montor twist:** the cleaner you leave the house, the *nicer* he gets -- and the nicer he gets, the more he wants you to *stay*. Very tidy runs unlock a different, creepier ending route. Very messy runs make him hostile but honest.
- Borrows: tidiness score, mood, safe-room tonics.
- Risk: can feel like chores. Keep rooms small and bins few. Make throwing junk into a bin from across the room satisfying (arc, clang, points).

### E. Rummage-as-minigame -- "Dig"

**Hook:** Keep junk *piles* as the central object, but digging is a physical act, not a roll.

- A pile is a **layered heap** you dig through by hitting it. Each swing knocks off a layer; objects fall out and scatter. Some layers are load-bearing: knock the wrong one and the heap collapses on you (the trap), or something inside wakes up (Mimic, the ambush).
- PER = you can *see* silhouettes inside the pile before digging. Careful vs Deep search becomes "tap the edge" vs "wade in".
- Big piles are terrain: climb them, tunnel through them, set fire to them (BURN spreads through organic junk, clears the pile fast but destroys the loot inside).
- **Montor twist:** the terminal is *literally* buried, and Montor's junk mound gets rebuilt if you leave the room -- he tidies it back on top.
- Borrows: junk piles, three intensities, trap-loot link, terminal-under-junk. Closest to the existing game.
- Risk: least novel. Best as a *component* of A/B/D than a whole game.

### F. Rube Goldberg rooms -- "Chain reaction"

**Hook:** Each room is a machine that's *almost* working. Fix one thing and watch it go.

- Rooms contain fixed contraptions: a bellows, a see-saw, a pulley, a candle, a dangling chandelier. Junk is what's missing: the see-saw needs a weight, the pulley needs a rope (hose), the candle needs fuel.
- Solving it does something dramatic: drops the chandelier on the Orc, floods the room (WET everyone), opens a wall.
- Fights become "set up the trap, lure the enemy in". Direct combat is possible but weak.
- **Montor twist:** these are Montor's own home security systems. Some still work against *you*. Reading the room (PER) shows what's wired to what.
- Borrows: the elemental reaction system (WET+CHARGED, FROST+BURN...) becomes environmental and visible. This is the Crawl's best system used properly.
- Risk: hand-authored rooms, no procgen. Fine for a curated 40-room version; not fine for "infinite runs". Could be the *boss/terminal room* format only.

### G. Memory of the house -- "What was this?"

**Hook:** The junk tells a story. Assemble it to unlock the floor.

- Each floor scatters pieces of one object across its rooms: gnome's head, gnome's body, gnome's hat... Bring them to the plinth and Gerald is whole again.
- Whole objects trigger Montor **memories**: a short scene, a mood shift, a Gift. The 6 Treasures in `montor.md` (Gnome, Gravy Boat, Toilet Seat, Music Box, Tongs, Night Light) are exactly this -- they'd become *collectathon* items you rebuild rather than find.
- Carrying a big fragile piece across a room full of bats is the challenge. Drop it and it cracks; three cracks and it's junk.
- **Montor twist:** he narrates the memories. Which pieces you find first changes the order of the story. This is where Groq/Claude narration fits a platformer.
- Borrows: the 6 Treasures/Gifts, Montor AI voice, mood.
- Risk: escort-quest feel. Keep fragile carries short and let you set the piece down to fight.

### H. Weight and the knight -- "Greed"

**Hook:** You can carry as much as you want. The house will punish you for it.

- No inventory limit. Every item you pick up is visibly *on you*: a bigger and bigger sack. Heavier = slower, lower jumps, louder footsteps (enemies wake), floors creak and *collapse* under you (drop to the room below, which is the maze's down exit anyway).
- Every room asks: is this worth carrying? Do I go back for the gravy boat?
- The safe room between floors is where you cash out. Anything you're still holding at the bottom is your score.
- **Montor twist:** greed is one of his mood pillars already. He *watches* the sack grow. Past a threshold he starts sending things to take it off you (rats that steal, a Mimic that eats sacks).
- Borrows: END carry capacity, greed score, junk sell prices, the Dump (pre-run junk hub).
- Risk: on its own it's a scoring layer, not a game. Combine with anything above.

### I. Two knights, one pile -- "Co-op junk"

**Hook:** Same room, two players (local first, Firestore later). Junk needs two people.

- Heavy items are two-person carries. See-saws need one on each end. One holds the ladder, one climbs.
- Junk can be *thrown to* the other player across a gap.
- Montor pits you against each other: "Whoever brings me the gnome gets the gift."
- Borrows: Stage 3 multiplayer vision, async co-op spec.
- Risk: multiplayer platforming needs real-time sync. Local same-screen (two on one phone is bad; desktop or a TV is fine) first.

---

## 3. Side-by-side

| | Novelty | Fun on a phone | Reuses existing content | Procgen-friendly | Build cost |
|---|---|---|---|---|---|
| A Stack to reach | ●●● | ●● (snap-grid) | ●● | ●●● | medium |
| B Contraptions | ●●● | ●●● | ●●● (items) | ●● | medium |
| C Wear the house | ●● | ●●● | ●●● (items) | ●●● | low-medium |
| D Cleaning | ●●● | ●● | ●●● (mood) | ●●● | low |
| E Dig | ● | ●●● | ●●● (piles) | ●●● | low |
| F Chain reaction | ●●● | ●● | ●● (reactions) | ● | high |
| G Memory | ●● | ●●● | ●●● (gifts, AI) | ●● | medium |
| H Greed | ●● | ●●● | ●●● (mood) | ●●● | low |
| I Co-op | ●●● | ● | ●● | ●● | very high |

---

## 4. Recommended combination: "Wear it, dig it, tidy it"

Take **C + E + D** as the core loop, with **H** as the scoring layer and **G** as the floor-level goal. **B** and **F** come later for boss/terminal rooms.

**The room loop:**

1. **Enter.** Room is a mess: piles, loose junk, enemies asleep in it. Montor mutters.
2. **Grab.** Pick up whatever's nearest -- a trowel, a pot -- and fight with it. It breaks. Grab something else. (C)
3. **Dig.** Hit a pile to spill it. Watch for silhouettes. Something inside might be a treasure piece, a better weapon, a trap, or a Mimic. (E)
4. **Tidy or trash.** Throw junk into bins to raise tidiness and unlock the tidy exit. Or leave the mess and take the messy exit, which Montor guards worse but he'll remember. (D)
5. **Carry.** Anything you keep goes in the sack. The sack slows you. Floors creak. (H)
6. **Assemble.** Treasure pieces go on the floor's plinth. Whole treasure = Gift + a Montor memory. (G)

**Why this set:** every item in the existing compendium gets a physical use (C), every pile stays meaningful (E), Montor's mood becomes something you *do* rather than a number (D + H), and the 6 Gifts become a goal you can see (G). Stats collapse to three you can feel: **STR** (throw, swing, carry), **AGI** (speed, jump), **PER** (see inside piles, see traps). Everything else can remain as hidden modifiers or be dropped for this mode.

**What we lose vs the v0.1 spec:** the d20, initiative, most of the 18 conditions as *mechanics* (keep 6 as room effects: BLEED, POISON, BURN, FROST, WET, CHARGED), the equipment slot grid. That's the point.

---

## 5. Example room under the new rules -- "The Potting Shed, again"

Same room as the mockup, different game:

- The **big mound** on the right has Gerald's *hat* poking out (PER shows it). Digging it drops a Cracked Pot (throwable), a Tangled Hose (whip), and wakes a rat that runs off with the hat. Chase it.
- The **heap on the plank** is mostly organic. Burn it with a candle from the chest and it clears in seconds -- but the Faded Plant Label inside (a memory fragment) burns too. Montor: "That was the last one. Of course it was."
- The **puddle** plus the **Tangled Hose** stretched between two nails = a tripwire that dumps the Slug in the water. WET slug + the sparking wire behind the ladder = fried slug.
- The **bins**: wood, metal, "Montor's". The Broken Gnome's arm goes in the last one. Fill them and the sealed door opens *and* the chest unlocks. Or ignore them, kick the sack of junk down the drop hole and follow it.
- The **sack**: you leave with a colander on your head, a rake handle, the gnome's hat, four pots. The plank below creaks. It goes.

---

## 6. Prototype order

| Step | Build | Question it answers |
|---|---|---|
| 1 | One room, pick up / throw / swing any junk object, it breaks (C) | Is improvised junk combat fun for 60 seconds? |
| 2 | Add one diggable pile with silhouettes and one trap layer (E) | Does digging beat tapping? |
| 3 | Add three bins and a tidy exit / messy exit (D) | Does anyone tidy voluntarily? |
| 4 | Add the sack and creaking floors (H) | Does weight create decisions? |
| 5 | Add one treasure in 3 pieces across 3 rooms + plinth + a Montor line (G) | Does the floor have a goal? |
| 6 | Decide on B (contraptions) and F (chain-reaction bosses) | Is there a deeper layer, or is the loop enough? |

Each step is playable before the next. Stop at any step where it isn't fun.

---

## 7. Open questions

1. **Grid or physics?** Snap-to-grid objects (safer, puzzle-y) vs free 2D physics (juicier, harder to control on touch). Proposal: grid for stacking, free arcs for throwing.
2. **How much Crawl stays?** Full stat sheet hidden underneath, or a 3-stat mode with its own character progression?
3. **Shared banked gifts** between Crawl and Descent, or does Descent bank *treasures* instead?
4. **Montor's voice** -- fixed lines per event (cheap, reliable) or AI-generated reactions to what you did with his stuff (the memory mechanic in G really wants this)?
5. **Room authoring** -- how many hand-made room templates before procedural decoration is enough? Guess: ~10 per floor.

---

*Design Options -- v0.1 -- September 2026*
