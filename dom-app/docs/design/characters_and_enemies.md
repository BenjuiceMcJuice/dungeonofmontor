# ⚔️ Dungeon of Montor
## 05 — Characters & Assets
*Enemy roster, player classes, power tiers, sprite system*
*v0.3 — March 2026*

---

## Power Tier System

Five tiers. Colour is the **only** visual indicator of power — same sprite form, different colour. No label, no number displayed in-game. Players learn the system through play.

Inspired by Breath of the Wild's colour-coding approach. Each tier name is literal to its colour.

| Tier | Name | Colour | Hex | Feel |
|---|---|---|---|---|
| 1 | **Dust** | Light grey | `#c8c8c8` | Throwaway. Cannon fodder. |
| 2 | **Slate** | Blue-grey | `#6a8fa8` | Organised. Starting to be a problem. |
| 3 | **Iron** | Dark steel | `#4a4e52` | Dangerous. Built for this. |
| 4 | **Crimson** | Deep blood red | `#6b1a1a` | Elite. Something has shaped this creature. |
| 5 | **Void** | Near-black | `#111111` | Singular. Named. The stuff of stories. |

> A Void-tier sprite is near-black on a black background. It's rendered on a slightly lighter pad (`#1e1e1e`) so it reads. The difficulty of reading it is intentional — Void enemies are not supposed to feel approachable.

---

## Enemy Archetypes

Five enemy types. Each has a distinct silhouette that reads clearly at small sizes — even at Dust tier resolution. The archetype defines mechanics. The AI names and flavours individual enemies based on the Campaign Brief.

The same mechanic type can feel completely different across campaigns: a Dust Orc in a mountain campaign is a "Thornback Grunt"; in a plague campaign it's a "Hollowed Marauder". Same sprite, same stats, different story.

---

### 🐀 Rat

**Form:** Small, hunched, front-on. Big rounded ears. Pointed snout. Plump body. Two front paws visible. Tail curling to one side.

**Silhouette read:** The smallest sprite in the set by a significant margin. Immediately readable as something rodent-like. At Void tier — a near-black rat the size of a cart — still unmistakably a rat.

**Mechanics:**
- Always appears with 2–4 additional Dust-tier rats
- Swarm mechanic: every living rat in combat gives +1 to all rat attack rolls
- Weak individually; dangerous in volume
- Low HP, low DEF, medium AGI

**Void-tier signature:** *Swarm Call* — 6 Dust rats enter combat immediately

| Tier | Name Pool |
|---|---|
| Dust | Scuttler, Ashrat, Gutter Fang, Plague Nibbler |
| Slate | Swarmcaller, Blight Gnawer, Ironteeth, Tunnelfiend |
| Iron | The Gnawing, Deeprat Elder, Plaguefather, Cavern Sovereign |
| Crimson | The Infestation, Broodmother, Dread Gnawer, Gnash the Ancient |
| Void | The First Rat, Plague King, That Which Gnaws the Roots |

---

### ⚔️ Orc

**Form:** Wide upright biped. Heavy brow ridge overhanging sunken eyes. Wide flat nose. Jutting lower jaw with upward tusks. Thick neck. Barrel chest. Muscular arms hanging at sides. Wide-planted legs.

**Silhouette read:** The classic frontline threat. Symmetrical, grounded, imposing. Immediately reads as melee fighter. Tusks and brow ridge are the key identifiers.

**Mechanics:**
- Melee only — no ranged attacks
- High STR, medium DEF, low AGI
- DEF scales sharply with tier
- Can be taunted or drawn out of position (CHA check)

**Void-tier signature:** *Warcry* — all allies gain +2 STR for 2 turns

| Tier | Name Pool |
|---|---|
| Dust | Ashback, Thorngrunt, Mudwalker, Dregskin |
| Slate | Ironjaw, Warback, Hearthbreaker, Stonefist |
| Iron | Blightcaller, Warcleave, Gravemantle, Ironhide |
| Crimson | Bloodchosen, Doomforged, Scarbound, Ashwarden |
| Void | The Unbroken, Gorgath the Scarred, Valdrek Ironborn |

---

### 🪨 Rock Monster

**Form:** Asymmetric — one shoulder deliberately higher than the other, giving a lurching quality. No visible neck; head sits directly on the body. Wide craggy face with two small recessed eyes. Cracks and fissures across the surface. Huge irregular arms. Short thick legs. Feels ancient and heavy.

**Silhouette read:** The asymmetry is the key identifier. Nothing else in the roster has that one-shoulder-raised quality. Immediately reads as something geological.

**Mechanics:**
- Slowest enemy in the roster — always acts last in initiative regardless of roll
- Immune to stagger, knockback, and fear effects
- Every hit ignores 3 DEF (the rock just pushes through)
- Cannot be poisoned
- Very high HP and DEF; low AGI

**Void-tier signature:** *Avalanche* — deals damage to all party members simultaneously

| Tier | Name Pool |
|---|---|
| Dust | Gravel Hulk, Stoneback, Quarry Crawler, Rubblefist |
| Slate | Ironstone, Boulderkin, Deeprock, Cragmaw |
| Iron | The Ancient Weight, Stonefather, Petrified Warden, Rockborn Elder |
| Crimson | The Unmoved, Gravel King, Stoneblight, The Crushing |
| Void | The First Stone, Primordial Mass, That Which Was Here Before |

---

### 🐌 Slug

**Form:** Side-on perspective (the only readable angle for a slug). Long tapered body — fat at the head end, narrowing to a tail. Two eyestalks at different heights for asymmetric life. Rippled underside / foot. Slight raised quality at the rear. Slime texture via shadow pixels along the body.

**Silhouette read:** Side-on is immediately distinctive — nothing else in the roster uses this angle. The eyestalks at different heights give it a character. At Void tier the near-black form is genuinely unpleasant.

**Mechanics:**
- Poison on every hit (target makes RES check TN 12 or loses 3 HP/turn)
- Leaves a **hazard trail** — any character moving to melee takes 2 damage
- Slow — medium initiative penalty
- Medium HP, low DEF, very low AGI

**Void-tier signature:** *Death Secretion* — poison bypasses RES entirely and stacks each round

| Tier | Name Pool |
|---|---|
| Dust | Ashslug, Mire Crawler, Blight Creep, Damp Horror |
| Slate | Venomtrail, Sludgeborn, Rot Creeper, Cave Seep |
| Iron | The Oozing, Plaguetrail, Corrosion, Black Slick |
| Crimson | The Consuming, Blight Sovereign, Venom Ancient, Rot King |
| Void | The Primordial Seep, That Which Corrodes All, The Old Wet |

---

### 👻 Wraith

**Form:** Front-on. Tall peaked hood — deliberately slightly off-centre for unease. The face is a pure black void — no features, no eyes, nothing. Tattered robes that widen then dissolve into ragged wisps at the base. Arms trail outward and dissolve before reaching a hand. No legs. Floats.

**Silhouette read:** The only enemy with no solid base — the dissolving bottom is the key identifier. The void face reads immediately as wrong. At any tier, this is the enemy that shouldn't exist.

**Mechanics:**
- Ignores 50% of DEF (passes through armour)
- Every third hit attacks WIL instead of HP
- Cannot be poisoned, cannot be set on fire
- Immune to fear effects (it *is* the fear)
- Medium HP (has no physical body to damage normally), low ATK, high WIL

**Void-tier signature:** *Hollow Scream* — one party member loses their next turn entirely

| Tier | Name Pool |
|---|---|
| Dust | Drifter, Pale Remnant, Hollow, Fade |
| Slate | Wandering Sorrow, Ashgast, Mournveil, Coldpresence |
| Iron | The Lingering, Souldrift, Voidtrace, Nightmantle |
| Crimson | The Unresolved, Mourning Crown, Wretchveil, Soulcage |
| Void | Erevath the Sleepless, The Widow's Echo, That Which Waits |

---

## Sprite Technical Spec

All sprites are stored as 2D grid arrays in `sprites.js`. No image files anywhere.

| Enemy | Grid Size | Perspective |
|---|---|---|
| Rat | 16 × 14 | Front-on |
| Orc | 18 × 24 | Front-on |
| Rock Monster | 20 × 22 | Front-on |
| Slug | 22 × 12 | Side-on |
| Wraith | 16 × 24 | Front-on |

Each cell value: `null` (transparent) · `K` (black outline) · `C` (tier colour) · `S` (shadow — 50% darker version of tier colour)

Rendered via canvas at configurable pixel size. Display size = grid dimensions × PX × scale. `image-rendering: pixelated` prevents blurring at any scale.

---

## Player Classes

Ten classes. Characters are named by players at creation. Identity accumulates through play — scars, titles, faction standing, deity epithets.

A Level 30 Ranger who has survived twelve campaigns might be called:
*"Elara Dusk — the Blade-kissed, Oathbreaker, Devoted of Morrigan"*
None of that is chosen. All of it is earned.

| Class | Base HP | HP/Level | Playstyle | Specialist Role |
|---|---|---|---|---|
| Knight | 30 | +8 | Tanky frontliner | Protect the party |
| Ranger | 25 | +6 | Mobile skirmisher | Ranged + flanking |
| Mage | 18 | +4 | Glass cannon | Devastating spells |
| Rogue | 22 | +5 | Crits and tricks | Backstab + stealth |
| Cleric | 27 | +6 | Healer / support | Sustain + revive |
| Berserker | 32 | +9 | High-risk brawler | Pure aggression |
| Orc Warchief | 40 | +14 | HP specialist | Enormous health pool |
| Bard | 22 | +5 | Manipulator | Buffs + AI narrative |
| Druid | 28 | +7 | Adaptable | Nature + healing |
| Paladin | 35 | +9 | Tank/support hybrid | Holy damage + protect |

### Character Accumulation Over Career

| Permanent Record | How Earned |
|---|---|
| Scars | Near-death experiences — permanent stat penalty, AI-named |
| Titles | Named kills, campaign completions, notable moments |
| Faction Standing | Choices and actions across all campaigns |
| Deity Devotion | Consistent play aligned with deity domain |
| Legacy Embues | Received from veteran characters |
| Chronicle entries | Story Page entries from all completed campaigns |

---

## Naming Philosophy

**Enemies** are named by the AI from the Campaign Brief. The archetype provides mechanics. The name provides identity. A Crimson-tier Rock Monster in a political intrigue campaign feels completely different from the same stat block in a plague horror campaign — same sprite, different weight.

**Player characters** are named at creation and accumulate identity through play. The AI refers to them by name, title, and scar in narration. At high levels, the AI knows their history and treats them accordingly.

**The world has no canon.** Every Campaign Brief creates its own world. The same sprite can be a mine guardian, a cursed noble, a god's leftover thought. The AI makes it coherent within each campaign's logic.

---

*Characters & Assets — v0.3 — March 2026*

---

## Montor — The MacGuffin

Montor is the reason the dungeon exists. It is never mechanically defined — its nature is determined by the Campaign Brief. It may be:

- The final boss at the deepest level
- A title passed between creatures across generations
- Something already dead whose influence remains
- A place, a curse, or something that used to be human
- Watching

Montor is never casually referenced by the AI. When it appears in narration it carries weight. It is the thing that named this place. Players are guests.

If a Campaign Brief explicitly defines Montor, the AI uses that definition consistently. If the Brief is silent on it, the AI keeps Montor ambiguous — present as atmosphere rather than fact.

There is no Montor sprite. It is never fully seen.

---

*Characters & Assets — v0.3 — March 2026*
