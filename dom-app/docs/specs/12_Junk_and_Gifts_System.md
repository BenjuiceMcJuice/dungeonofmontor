# Junk Piles, Hoarding, and Montor's Gifts

> Design spec — 2026-04-01
> Connects: room exploration, inventory weight, stat relevance, Montor's Gifts

---

## Core Concept

Montor is a hoarder. His dungeon is full of his stuff — junk, clutter, collections, broken things he can't throw away. Most rooms have one or more **rubbish piles** that the player can search. Searching is the primary exploration mechanic and the *only* way to find Montor's hidden treasures, which unlock his Gifts.

---

## 1. Junk Piles

### Placement
- Most chambers have 1-3 junk piles (randomised per room)
- Combat rooms: piles appear after clearing enemies (loot the battlefield AND search the junk)
- Safe rooms: piles are searchable immediately
- Boss rooms: 1 guaranteed pile with higher quality
- Some piles are obvious (icon on map), some are hidden (PER check to notice)

### Searching a Pile
Each pile is one interaction. Player taps "Search" and a roll determines the outcome:

**Roll: d20 + PER modifier**

| Roll | Outcome | XP |
|---|---|---|
| 1 (nat) | **Ambush** — something was living in there. Combat encounter (1-2 enemies from current floor) | 0 |
| 2-5 | **Nothing useful** — flavour text only. "A broken clock. Three identical spoons. A sock." | 2 |
| 6-10 | **Loose coins** — 1-5g | 3 |
| 11-14 | **Junk item** — a piece of named junk added to inventory (see §3) | 5 |
| 15-17 | **Useful item** — a consumable or common weapon/armour | 8 |
| 18-19 | **Good find** — an uncommon+ item from the floor's loot table | 12 |
| 20 (nat) | **Treasure** — a Montor's Treasure (see §4) OR a rare+ item | 15 |

### Search Intensity — Deep Clean / Tidy Up / Sweep Under the Carpet

Each junk pile can be searched at three intensity levels. Higher intensity = better rewards but more risk and time.

| Level | Name | Roll bonus | Risk | Time | Best for |
|---|---|---|---|---|---|
| Light | Sweep Under the Carpet | +0 | Low (ambush on nat 1 only) | Quick | Safe rooms, low HP |
| Medium | Tidy Up | +2 | Medium (ambush on 1-3) | Normal | Standard exploration |
| Deep | Deep Clean | +5 | High (ambush on 1-5, tougher enemies) | Slow | Treasure hunting, high PER builds |

**Deep Clean specifics:**
- +5 to PER roll — much better chance of finding treasures
- Ambush on 1-5 (25% chance) instead of just nat 1
- Ambush spawns encounter level +1 enemies (tougher than normal room)
- But: guaranteed 5 XP even on ambush
- And: treasure threshold lowered (18+ instead of nat 20)

**This makes PER + Deep Clean the treasure hunting build.** PER 14 (+2) with Deep Clean = effective roll bonus of +7. Treasure on 13+ natural. Very strong but very risky.

### XP for Searching
Every search grants XP regardless of outcome (except ambush). This promotes exploring and rummaging. A thorough player who searches everything levels faster than one who rushes to the boss.

### Montor's Commentary
Montor comments on your searching:
- *"That's my collection of identical spoons. There are forty-seven. I've counted."*
- *"You're going through my things. How would you like it if I went through yours?"*
- *"That's not treasure. That's a broken clock. I was going to fix it."*
- *"Three adventurers have died in that pile. Be careful what you dig for."*
- When carrying treasure: *"You have something of mine. I can feel it."*

---

## 2. Inventory Weight System

### Weight
Every item has a `weight` field:

| Item type | Weight |
|---|---|
| Junk | 1 |
| Consumable | 1 |
| Relic | 1 |
| Dagger | 1 |
| Sword | 2 |
| Mace / Warhammer | 3 |
| Shield | 2 |
| Leather armour | 2 |
| Chainmail / plate | 4 |
| Montor's Treasure | 2 (they're awkward to carry) |

### Carry Capacity
`capacity = 10 + END modifier`

- END 8 (mod -1) → 9 slots
- END 10 (mod 0) → 10 slots
- END 12 (mod +1) → 11 slots
- END 14 (mod +2) → 12 slots

Equipped items don't count toward weight (they're worn, not carried).

### Over-encumbered
If total weight > capacity:
- -1 AGI per excess weight (you're slow)
- Can't flee from combat
- Montor: *"You can barely walk. This is wonderful."*

### The Tension
- Junk weighs 1 each — harmless individually but adds up
- Some relics reward carrying junk (see §3)
- Montor's Treasures weigh 2 — carrying one to a safe room costs capacity
- Player must decide: carry junk for bonuses? Drop it for speed? Which junk to keep?

---

## 3. Junk Items

Named, flavoured items that are technically worthless but:
- Grant XP when found (searching reward)
- Can be sold to merchants for 1-2g
- Some relics/powers give bonuses based on junk count in inventory
- Add personality to the dungeon

### Example Junk Items (per zone)

**Garden:**
- Broken Garden Gnome, Rusty Trowel, Dried Flower Arrangement, Empty Seed Packet, Cracked Watering Can, Tangled Hose, Faded Plant Label, Snapped Rake Handle, Mouldy Pot, Bird Bath Fragment

**Great Hall:**
- Chipped Goblet, Moth-Eaten Tapestry Scrap, Bent Candelabra, Cracked Coat of Arms, Dusty Quill, Empty Ink Pot, Torn Proclamation, Broken Chair Leg, Tarnished Buckle, Single Boot

**Kitchen:**
- Burnt Ladle, Cracked Plate, Eggshell Collection, Stale Bread Crust, Greasy Pan, Chipped Mug, Soggy Recipe Card, Rusty Tin Opener, Melted Spatula, Single Chopstick

### Junk-Hoarding Relics

| Relic | Effect | Description |
|---|---|---|
| Montor's Binbag | +1 carry capacity per 5 junk items carried | "Stretchy. Smells. Holds everything." |
| Montor's Catalogue | +1 STR per 3 junk items in inventory | "He numbered everything. So should you." |
| Montor's Mum's Handbag | Junk items weigh 0 | "Bottomless. She kept everything in here." |
| Montor's Price Tag Gun | Junk sells for 5g instead of 1-2g at merchants | "Everything has value. Montor said so." |

**The hoarder build:** High END + PER + junk relics = you search everything, carry everything, and get stronger from it. You become Montor.

### Dodgy Consumables (found in junk piles)

Food and drink found in Montor's dungeon. Questionable freshness. END and VIT influence whether they help or hurt.

**Mechanic:** When consumed, roll d20 + END modifier.
- 12+: **Benefit** — heal or stat buff
- 6-11: **Nothing** — "Tastes awful. Does nothing."
- 2-5: **Mild harm** — lose 3-5 HP or 1-turn debuff
- 1 (nat): **Severe harm** — NAUSEA condition + 5 HP loss

Higher END = better stomach = more likely to benefit. Makes END useful beyond carry capacity.

**Garden dodgy consumables:**
| Item | Benefit (12+) | Harm (2-5) |
|---|---|---|
| Suspicious Berries | Heal 8 HP | -3 HP, NAUSEA |
| Montor's Garden Salad | +2 AGI for 3 turns | -2 AGI for 2 turns |
| Muddy Water | Heal 5 HP, cure body | SLUGGISH for 2 turns |
| Old Birdseed | +1 PER for 3 turns | "Just tastes like nothing" |
| Compost Tea | Heal 10 HP | NAUSEA for 2 turns |

**Great Hall dodgy consumables:**
| Item | Benefit (12+) | Harm (2-5) |
|---|---|---|
| Stale Banquet Wine | +2 STR, -1 DEF for 3 turns | DAZE for 1 turn |
| Dusty Cheese | Heal 6 HP | -4 HP |
| Old Feast Leftovers | Heal 12 HP | NAUSEA + -5 HP |
| Candle Wax Snack | +2 DEF for 3 turns | "Waxy but harmless" |
| Ink Pot Dregs | +2 INT for 3 turns | BLIND for 1 turn |

**Kitchen dodgy consumables:**
| Item | Benefit (12+) | Harm (2-5) |
|---|---|---|
| Mystery Stew | Heal 15 HP | POISON for 2 turns |
| Rat Jerky | Heal 5 HP (always works, even on fail — it's just jerky) | — |
| The Cook's Special | +3 to random stat for 3 turns | -2 to random stat for 2 turns |
| Out-of-Date Pie | Heal 10 HP + cure body | NAUSEA + SLUGGISH |
| Spice Jar Dregs | +1 all rolls for 2 turns | BURN for 1 turn (it's spicy) |

**Rat Jerky is the safe option** — always heals 5 HP regardless of roll. Low reward, no risk. The safe player's choice.

---

## 3b. Chamber Events (floor-appropriate environmental effects)

Random events that affect the room when you enter. Not every room has one — maybe 30% chance. They create atmosphere and mechanical variety.

### Event Mechanic
On entering a non-combat chamber, 30% chance of a room event. Events can be positive, negative, or neutral. Some are stat-dependent (PER to notice, WIS to benefit, END to resist).

### Garden Events
| Event | Effect | Stat check |
|---|---|---|
| High Pollen Count | -1 all rolls this chamber. "Your eyes water. Everything's fuzzy." | END 12+ resists |
| Morning Dew | Heal 3 HP. "The air is fresh. You breathe deeply." | — |
| Overgrown Path | Movement costs: must clear brambles. Lose 2 HP or PER check to find clear route | PER 12+ avoids |
| Butterfly Swarm | +1 LCK this chamber. "They settle on your shoulders. Feels... lucky." | — |
| Sudden Rain | All enemies in next combat have -2 AGI. "Everything's slippery." | — |
| Montor's Sprinklers | Heal 5 HP but -2 AGI this chamber. "Cold. Very cold." | — |
| Night Falls | Visibility reduced. Hidden items easier to miss (-2 PER). But enemies can't see you either (+2 AGI first turn of combat) | — |
| Sunrise | +1 all rolls this chamber. "Light streams through the canopy." | — |

### Great Hall Events
| Event | Effect | Stat check |
|---|---|---|
| Echoing Footsteps | Next combat: enemies get a free first strike. "They heard you coming." | AGI 12+ = you're quiet enough |
| Dusty Air | -1 PER this chamber. Searching is harder. "Can barely see." | — |
| Grand Echo | Montor whisper guaranteed. "The acoustics are perfect." | WIS 12+ = you understand a hint |
| Collapsed Section | Room has fewer searchable piles (1 instead of 2-3) | — |
| Ancient Fireplace | Rest opportunity: heal 10% HP. "Still warm somehow." | — |
| Draught | All BURN conditions extinguished (player and enemies). "A cold wind." | — |
| Cobweb Curtain | First enemy in next combat starts with BLIND. "It walked through the webs." | — |

### Kitchen Events
| Event | Effect | Stat check |
|---|---|---|
| Steam Vents | BURN risk: 3 damage unless AGI check. "The pipes hiss." | AGI 12+ dodges |
| Grease Fire | All enemies in next combat start with BURN. "The kitchen's on fire. Again." | — |
| Horrible Smell | -2 CHA this chamber (merchants charge more). "Something died in the pantry." | END 12+ resists |
| Rat Feast | Extra junk pile in this room (rats were hoarding too). "They've been busy." | — |
| Hot Oven | Rest opportunity: heal 10% + cure FROST. "Stand near the oven. Thaw out." | — |
| Slippery Floor | -3 AGI in next combat. "Grease everywhere." | — |
| The Cook's Radio | +1 all rolls this chamber. "Somehow there's music. It helps." | — |

### Day/Night Cycle (Garden only)
The Garden is outdoors — it has weather and time of day. Underground floors are always dark.

Cycle shifts every 8 chambers entered in the Garden:
- **Day (chambers 1-8):** Normal. Bright. Standard visibility. Slugs are stronger in daylight (+2 STR — they're garden creatures, this is their turf).
- **Dusk (chambers 9-12):** -1 PER. Shadows lengthen. Slugs normal. Rats gain +1 AGI (they come out at dusk).
- **Night (chambers 13-16+):** -2 PER. Slugs are weaker (-2 STR, -2 DEF — they retreat at night). Rats gain +2 AGI. Hidden items harder to find.

**The trade-off:** Rush the Garden in daytime = fight tougher slugs but see better. Take your time = slugs weaken but searching is harder and rats are faster.

---

## 4. Montor's Gifts (Discovery via Junk Piles)

### Hidden Treasures
Each floor has one hidden **Montor's Treasure** — a personal object Montor values. These are NOT in loot tables. They can ONLY be found by:
- Rolling nat 20 on a junk pile search
- Or rolling 18+ with high PER modifier (18 + PER mod 2+ = 20 threshold)

The treasures (from existing spec):
| Floor | Treasure | Junk appearance |
|---|---|---|
| Grounds | Montor's Favourite Gnome | "A ceramic gnome. It's watching you." |
| Underground (Great Hall) | Montor's Gravy Boat | "A cracked gravy boat. Surprisingly warm." |
| Underground (Kitchen) | Montor's Toilet Seat | "Why is this in the kitchen? Don't ask." |
| Underbelly (future) | Montor's Music Box | "Plays a tune you almost recognise." |
| Quarters (future) | Montor's Best Tongs | "For special occasions. He misses them." |
| Deep (future) | Montor's Night Light | "The only light he trusts." |

### The Discovery Problem
When you find a treasure, **it's not obvious what it is**. It appears in your inventory as junk. The description is cryptic. There's no "THIS IS A GIFT COMPONENT" label.

Clues that it's special:
- It weighs 2 (heavier than normal junk)
- The description is slightly unusual (personal, not just broken stuff)
- Montor whispers change when you're carrying one: *"You have something of mine. I can smell it."*
- It can't be sold to merchants (they refuse: "I don't want that. Take it away.")
- Experienced players learn to recognise them

### Activation at Safe Rooms
When the player enters a safe room (rest chamber) while carrying a treasure:

1. **Montor appears** (narrative event, not literal) — he's angry, possessive, but also... impressed you found it
2. **He demands a sacrifice** — something from you in exchange
   - Sacrifice severity governed by LCK: high LCK = mild sacrifice, low LCK = harsh
   - Mild: lose some gold, lose some HP, temporary stat debuff
   - Harsh: lose an equipped item, lose max HP permanently, lose a relic
3. **You choose: accept or refuse**
   - Accept: lose sacrifice + treasure, gain a **Gift** (permanent boon)
   - Refuse: keep the treasure (it's still just junk weight in your bag), try again at next safe room
4. **WIS governs gift power** — higher WIS = stronger boon

### Gift Boons — Equippable Body/Mind Powers

Gifts are equippable powers in two slots: **Body** and **Mind**. Like equipment but for your soul.

**Flow:**
1. Find a treasure → activate at safe room → receive a Gift boon
2. Gift goes into Body or Mind slot (your choice)
3. You can swap/change gifts at any safe room or when descending a floor
4. At the start of subsequent runs (Stage 2+), you choose which discovered gifts to equip

**Body Gift effects (physical powers):**
| Gift | Body effect |
|---|---|
| Petal | Regen 2 HP per chamber |
| Stone | +3 DEF permanently |
| Bile | POISON immunity + 10% chance to poison on any hit |
| Blood | Lifesteal 5% on all damage |
| Ember | +2 damage, attacks can BURN (10% chance) |
| Void | +5 max HP, +1 all combat stats |

**Mind Gift effects (mental powers):**
| Gift | Mind effect |
|---|---|
| Petal | +2 PER, junk searches always find something |
| Stone | DAZE immunity + can't be knocked below 1 HP once per combat |
| Bile | Enemies start combat with -1 all rolls (your stench) |
| Blood | FEAR immunity + BLOODLUST when below 25% HP (auto) |
| Ember | +2 INT, conditions last 1 extra turn on enemies |
| Void | Reroll one die per chamber (the dice power!) |

**The Void Mind gift is the Balatro moment** — one reroll per chamber. That's the dice manipulation power you wanted, earned by finding Montor's deepest treasure.

**Swapping at floor transitions:**
When you descend to a new floor, you get the option to swap your equipped gifts before continuing. This lets you adapt your build as the dungeon changes.

### Key Design Principles
- **Gifts are earned through exploration, not combat** — the fighter who rushes to the boss misses them
- **The discovery is organic** — you find a weird gnome in a junk pile, carry it confused, then Montor explains at a safe room
- **First-time players will miss them** — and that's fine. Discovery is part of the game
- **Veterans will hunt for them** — high PER builds searching every pile
- **The sacrifice creates drama** — "I found the gnome, but Montor wants my Fireplace Poker in exchange. Is the gift worth it?"

---

## 5. Stat Relevance Summary

This system activates previously dead stats:

| Stat | Role in junk system |
|---|---|
| PER | Search quality — better rolls on junk piles, spot hidden piles |
| END | Carry capacity — more junk/treasures before encumbered |
| LCK | Sacrifice severity — kinder Montor when accepting gifts |
| WIS | Gift power — stronger boons from treasures |
| CUN | (Future) Trap avoidance in piles, faster searching |
| CHA | (Future) Better sell prices for junk |

Combined with the weapon overhaul (STR/AGI/DEF), this means **10 of 14 stats now have a purpose**.

---

## 6. Merchants as Montor's Staff

Merchants aren't random vendors — they're Montor's household staff, sneaking his things out the back door.

### Merchant Personalities

| Zone | Name | Role | Flavour |
|---|---|---|---|
| Garden | The Gardener | Nervous, apologetic | "Don't tell him I sold the shears. He counts them." |
| Great Hall | The Butler | Prim, professional | "Master Montor won't notice one less goblet. Probably." |
| Kitchen | The Cook | Grumpy, practical | "Take it. Less washing up for me." |
| Underground (general) | The Ratcatcher | Shifty, deals in odd things | "Found this in a wall. Don't ask which wall." |

### Stock Logic
- **Always:** Health potions, basic consumables (the "legitimate" stock)
- **Usually:** Common weapons/armour ("surplus" from Montor's stores)
- **Sometimes:** Montor's named items (staff don't realise what they are)
- **Rarely:** A Montor's Treasure item priced at 1-3g (the merchant thinks it's junk — the player might too)

When a treasure appears in a shop:
- Priced very low (1-3g) — the merchant doesn't know what it is
- No special highlighting — it looks like any other cheap item
- Montor whispers if you buy it: *"Did you just... buy my gnome? From MY gardener?"*

### Merchant Buy/Sell Dialogue
- Buying: *"Pleasure doing business. Don't mention this to the master."*
- Selling junk to them: *"I suppose I can put it back before he notices."*
- Trying to sell a treasure: *"I'm not touching that. He'd know."*
- No gold: *"Come back when you've got coin. I'm not running a charity."*

### CHA-Based Pricing
Charisma modifier adjusts buy and sell prices at all merchants:

- **Buy price** = base price × (1 - CHA_mod × 0.05) — capped at 20% discount
- **Sell price** = base price × (1 + CHA_mod × 0.1) — capped at 40% bonus

| CHA mod | Buy adjustment | Sell adjustment |
|---|---|---|
| -2 | +10% markup | -20% less |
| 0 | Normal | Normal |
| +2 | -10% discount | +20% more |
| +4 | -20% discount | +40% more |

A CHA build turns junk hoarding into a gold machine — buy cheap, sell Montor's rubbish back to his own staff at a premium.

### Data
Add to zones.json per zone:
- `merchantName`: display name
- `merchantRole`: flavour role  
- `merchantLines`: array of dialogue strings for buy/sell/browse
- `treasureChance`: probability of a treasure appearing in stock (e.g. 0.05 = 5%)

---

## 7. Junk-as-Currency NPCs

Special NPCs (not merchants) who accept junk as payment. Found in rest rooms or special chambers.

### The Collector
Montor's Mum. Or her ghost. Or a portrait that moves. She values junk because it reminds her of home.

| Junk cost | Reward |
|---|---|
| 5 junk | Dodgy Red Liquid (health potion) |
| 10 junk | Montor's Garden Charm (regen relic) |
| 15 junk | Random Montor weapon (uncommon+) |
| 25 junk | Random Montor relic (rare+) |
| 50 junk | Montor's Mum's Blessing (unique — +1 all stats for run) |

### The Bin Man
A chamber entity in the Underbelly. Takes junk off your hands in bulk.

| Junk cost | Reward |
|---|---|
| 3 junk | 10 gold |
| 10 junk | 50 gold + random consumable |
| 20 junk | 100 gold + heal to full |

### Design Notes
- Junk becomes a secondary currency alongside gold
- Gold buys from merchants (Montor's staff). Junk buys from special NPCs.
- This makes the hoarder build viable: collect junk → trade for powerful items
- END stat matters: can you carry enough junk to reach 50?
- The 50-junk reward (Mum's Blessing) is an endgame goal — you'd need to search almost every pile across multiple floors

---

## 8. Implementation Order

1. **Add weight field to all items** in items.json
2. **Add carry capacity to Game.jsx** (UI: show weight/capacity in inventory)
3. **Add junk pile interaction** to chamber content generation
4. **Create junk item pool** per zone in JSON
5. **Add search mechanic** (d20 + PER roll, outcome table)
6. **Add Montor's Treasures** to junk pile nat-20 results
7. **Build safe room gift activation** (sacrifice + boon)
8. **Add junk-hoarding relics** to items.json + loot tables
9. **Wire encumbrance** (AGI penalty when overweight)
10. **Add Montor whispers** for carrying treasures

Steps 1-5 are Stage 1. Steps 6-10 can land later but the system is designed for them.
