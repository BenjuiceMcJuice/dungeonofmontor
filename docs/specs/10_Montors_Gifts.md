# Dungeon of Montor — 10: Montor's Gifts
**Version:** 0.1 Draft
**Date:** March 2026
**Status:** Living document — update as implementation reveals new fields

---

## 1. Overview

Each floor of the dungeon is saturated with one of Montor's Gifts — elemental essences that belong to him. Completing a floor lets you claim that floor's Gift. But these are **Montor's powers, not yours**. Taking them is an act of defiance. Montor doesn't give willingly — you're stealing from the dungeon itself.

**Activation** happens in the safe room between floors. Montor has full visibility here. He demands a sacrifice before you can attempt to harness his power. He chooses what you must give up — money, HP, max HP, or an item. You don't get to pick. Then you roll.

**The roll:**
- d20 + WIS modifier (wisdom helps you channel stolen power)
- LCK influences what sacrifice Montor demands (higher LCK = less painful demand)
- Montor always fights back — even on a good roll, there's a cost

**With AI (Stage 4):** Montor makes informed sacrifice demands based on what would hurt you most. Low on HP? He demands HP. Carrying a weapon you love? He wants that. AI reads your state and chooses the cruellest option.

**Rules:**
- One Gift per floor, claimed on completion (descend the stairwell)
- Gifts are carried until activated
- Activation only at safe rooms — Montor watches and demands his price
- Montor chooses the sacrifice (Stage 1: random. Stage 4: AI-driven)
- To activate: pay the sacrifice, choose where to apply (Body, Mind, Weapon, Item), roll d20 + WIS
- Higher LCK = lighter sacrifice demanded
- One active boon per slot: Body, Mind, Weapon enchantment, Item enchantment
- Applying a new boon to an occupied slot replaces the old one
- Failed activation (roll 1-4) = sacrifice paid AND Gift consumed for nothing. Montor is delighted.

---

## 2. The Gifts

Each Gift is stolen by finding and breaking one of Montor's prized possessions. The breaking is irreversible — the power is loose in the world. Montor can't put it back. He's furious.

### The Treasures

| Floor | Treasure | How you break it | Montor's reaction | Gift released |
|---|---|---|---|---|
| 0 — The Grounds | **Montor's Favourite Gnome** | Kick it. Its head pops off and rolls into the hedgerow. | "Gerald! ...I raised him from a pebble." | **Petal** |
| -1 — The Underground | **Montor's Gravy Boat** | Tip it over. The gravy never stops pouring. It seeps into the stone. | "That was grandmother's. She'll haunt YOU now." | **Stone** |
| -2 — The Underbelly | **Montor's Toilet Seat** | Slam the lid. It cracks clean in half. Something hisses from below. | "Do you have ANY idea how hard it is to get a plumber down here?" | **Bile** |
| -3 — The Quarters | **Montor's Music Box** | Wind it backwards. The melody inverts. It won't stop playing. | "That was the only thing that helped me sleep." | **Blood** |
| -4 — The Works | **Montor's Best Tongs** | Bend them. They snap. The furnace sighs. | "Those were CALIBRATED. Centuries of calibration. Gone." | **Ember** |
| -5 — The Deep | **Montor's Night Light** | Blow it out. The darkness rushes in and curls around your fingers. | Nothing. Just breathing. Closer than before. | **Void Shard** |
| -6 — Montor's Domain | No treasure — Montor himself | — | — | — |

Each treasure tells you something about Montor. He's not just a dark lord — he's a person with a favourite gnome and his grandmother's gravy boat and a night light he needs to sleep. Breaking his stuff is funny AND cruel. The breaking is the permanent moment.

### The Gifts

| Gift | Theme | Colour |
|---|---|---|
| **Petal** | Nature — pollen, thorns, vines, poison | Green |
| **Stone** | Earth — rock, water, weight, cold | Blue-grey |
| **Bile** | Decay — acid, gas, rot, disease | Sickly yellow |
| **Blood** | Flesh — life, pain, regeneration, hunger | Crimson |
| **Ember** | Fire — heat, metal, forge, destruction | Orange |
| **Void Shard** | Chaos — shadow, nothing, entropy | Black |

---

## 3. Activation

### Where
The safe room between floors — Montor's audience chamber. This is the only place Gifts can be activated. Montor has full visibility here.

### Flow
1. Select a Gift from your carried gifts
2. **Montor demands a sacrifice** (you don't choose — he does)
3. Accept or refuse. If you refuse, keep the Gift for later.
4. If accepted: pay the sacrifice, choose where to apply (Body, Mind, Weapon, Item)
5. Roll d20 + WIS modifier

### Montor's Sacrifice Demands

Montor picks what hurts. Stage 1: random from the table below, weighted by LCK (higher LCK = lighter demands more often). Stage 4: AI reads your state and picks the cruelest option.

| Sacrifice | What you lose | Weight (how often demanded) |
|---|---|---|
| **Gold** | 30-50% of carried gold | Common |
| **HP** | 20-30% of current HP | Common |
| **Max HP** | Lose 5 max HP permanently (this run) | Uncommon |
| **Weapon downgrade** | Weapon damage die drops one tier (d8→d6) | Uncommon |
| **Item consumed** | Montor picks a random item from your inventory — it's destroyed | Rare |
| **Stat sacrifice** | -1 to a random stat permanently (this run) | Rare |

**LCK modifier effect on sacrifice severity:**

| LCK mod | Effect |
|---|---|
| -2 or below | Always gets Uncommon/Rare sacrifices |
| -1 to +1 | Standard weighting |
| +2 to +3 | Skews toward Common (gold/HP) |
| +4+ | Mostly gold, rarely anything worse |

**Montor's mood (Stage 4):** When AI is active, Montor's current mood modifies the demand. Amused Montor might ask for something light. Wrathful Montor demands max HP or your best item.

### Roll Outcome (d20 + WIS)

| Tier | Roll | Result |
|---|---|---|
| **Critical** | Natural 20 | Full power + bonus effect |
| **Success** | 11+ | Full power |
| **Partial** | 5-10 | Weakened version (roughly half effectiveness) |
| **Fail** | 1-4 | Sacrifice paid AND Gift consumed for nothing. Montor is delighted. |

Higher WIS = better boons = less risk of wasting a Gift. WIS is the "shrine stat."
Higher LCK = lighter sacrifice demanded. LCK is the "mercy stat."

### Refusing the Sacrifice
You can always say no. The Gift stays in your inventory. Try again at the next safe room — Montor may demand something different next time (re-rolled). But the deeper you go, the harder Montor pushes.

---

## 3a. Future: Dice-Triggered Effects

> **Status: Design concept — not for Stage 1 implementation.**

Some boon effects could trigger on specific dice patterns rather than (or in addition to) every hit:

- Natural 1 or natural 20 triggers a special effect
- Rolling triples (three 3s, three 6s) in a combat triggers a burst
- Consecutive crits trigger an escalating bonus

This creates memorable moments tied to dice luck. Design details TBD — noted here for future reference.

---

## 4. Gift Effects by Application

### PETAL (Floor 0 — The Grounds)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Thornhide** — attackers take 2 damage when they hit you | 1 damage |
| **Mind** | **Pollen Sense** — see trap rooms before entering them | See traps but not type |
| **Weapon** | **Venomcoat** — weapon applies POISON on hit | 5% chance only |
| **Item** | **Bloom Ring** — heal 1 HP per chamber entered | Heal 1 HP every 2 chambers |

### STONE (Floor -1 — The Underground)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Ironhide** — reduce all damage taken by 2 | Reduce by 1 |
| **Mind** | **Earthmind** — immune to DAZE and FEAR | Immune to DAZE only |
| **Weapon** | **Frostbite** — weapon applies FROST on hit (-3 AGI) | -1 AGI |
| **Item** | **Stoneguard Ring** — glancing blows deal 0 damage to you | 50% chance |

### BILE (Floor -2 — The Underbelly)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Venomblood** — immune to POISON/NAUSEA, poison heals you | Immune only, no heal |
| **Mind** | **Gutterwise** — merchants 50% off, loot tables roll twice | 25% off only |
| **Weapon** | **Acidcoat** — weapon applies BLEED on hit (ignores armour) | BLEED but doesn't ignore armour |
| **Item** | **Rot Ring** — enemies start combat with -1 STR | -1 STR 50% chance |

### BLOOD (Floor -3 — The Quarters)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Regenerate** — heal 2 HP per chamber entered | 1 HP |
| **Mind** | **Bloodthirst** — killing an enemy heals 3 HP | Heals 1 HP |
| **Weapon** | **Lifedrink** — weapon heals you for 25% of damage dealt | 10% |
| **Item** | **Heartstone Ring** — +10 max HP | +5 max HP |

### EMBER (Floor -4 — The Works)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Fireheart** — immune to BURN/FROST, +2 damage on all attacks | Immune only, no damage bonus |
| **Mind** | **Forgemind** — crits deal x2.5 instead of x2 | x2.25 |
| **Weapon** | **Flamecoat** — weapon applies BURN on hit | 5% chance only |
| **Item** | **Cinder Ring** — enemies take 1 fire damage per turn | Every other turn |

### VOID SHARD (Floor -5 — The Deep)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Phase** — 25% chance to dodge any attack completely | 10% chance |
| **Mind** | **Void Sight** — see all rooms on map, immune to BLIND | Immune to BLIND only |
| **Weapon** | **Nullblade** — weapon ignores DEF entirely | Ignores half DEF |
| **Item** | **Void Ring** — on death, revive once at 25% HP | Revive at 10% HP |

---

## 5. Critical Roll Bonuses

When the WIS roll is a natural 20, the boon is at full power PLUS a bonus:

| Gift | Crit bonus (any application) |
|---|---|
| Petal | Also grants NAUSEA immunity |
| Stone | Also +2 DEF permanently |
| Bile | Also enemies have -1 to all rolls in first round |
| Blood | Also +5 max HP |
| Ember | Also first attack each combat is guaranteed Hit tier (minimum) |
| Void Shard | Also immune to Montor's curses for rest of run |

---

## 6. Slot Rules & Persistence

- **One boon per slot** — Body, Mind, Weapon enchantment, Item enchantment
- Applying a new boon to an occupied slot **replaces** the old one — the old boon is gone forever
- **Activated boons persist across runs** — they're permanent character progression
- Unactivated Gifts (carried but not applied) are lost on run end
- You can carry multiple unactivated Gifts — no limit
- You can activate gifts at any safe room, not just the floor you found it on
- Each floor's Gift can only be claimed once per run (complete the floor again next run for another)

### Persistence rules
- **Activated boons** = permanent. Survive death. Part of your character identity.
- **Unactivated Gifts** = run-scoped. Use them or lose them.
- **Weapon enchantments** persist on the character, not the weapon. If you lose the weapon, the enchantment applies to your next equipped weapon. It's YOUR power now, not the weapon's.
- **Item enchantments** persist even though the original item was consumed. The effect is on you.

### Why this matters
Gifts are the primary reason to go deeper. Reaching Floor -5 and stealing Void Shard is a permanent upgrade to your character. Over multiple runs, your character becomes a collection of stolen powers — each one a story of sacrifice and defiance.

Replacing a boon is agonising: do you trade Ironhide (trusty, reliable) for Phase (powerful but unreliable 25% dodge)? The old one is gone forever. This is a character-defining decision.

### Stage 1 note
In Stage 1, characters are ephemeral (fresh each run). Gifts still activate and work for the current run but don't persist. Persistence kicks in with Stage 2 (persistent characters).

---

## 7. Replacing & Upgrading

### Applying to an empty slot
You get the base version of the boon.

### Applying to an occupied slot
The old boon is **replaced** by the new one — but because the slot was already empowered, you get the **stronger version** of the new boon.

| Boon | Base (empty slot) | Upgraded (replacing an existing boon) |
|---|---|---|
| **Thornhide** | Reflect 2 damage | Reflect 3 + attackers get POISON |
| **Ironhide** | Reduce damage by 2 | Reduce by 3 + immune to DAZE |
| **Venomblood** | Immune to POISON, poison heals | Poison heals double + YOUR attacks apply NAUSEA |
| **Regenerate** | Heal 2 HP per chamber | Heal 3 HP + revive once at 1 HP |
| **Fireheart** | Immune to BURN/FROST, +2 damage | +4 damage + all attacks apply BURN |
| **Phase** | 25% dodge | 35% dodge + dodged attacks damage attacker |
| **Pollen Sense** | See trap rooms before entering | See traps + see hidden rooms |
| **Earthmind** | Immune to DAZE and FEAR | Immune to all Mind conditions |
| **Gutterwise** | Merchants 50% off, loot rolls twice | Merchants 75% off, loot rolls three times |
| **Bloodthirst** | Kills heal 3 HP | Kills heal 5 HP + crits heal 3 HP |
| **Forgemind** | Crits deal x2.5 | Crits deal x3 + first attack each combat guaranteed Hit |
| **Void Sight** | See all rooms on map, immune to BLIND | See everything + immune to all visibility effects + enemies visible through fog |

The old boon is gone. The choice to replace is permanent. But the reward is a strictly better version of the new boon.

---

## 8. Cross-Slot Fusions (Body + Mind)

When you have BOTH a Body boon AND a Mind boon active simultaneously, a **fusion bonus** activates on top of both. This is free — no sacrifice, no roll. It's the reward for investing in both slots.

| Body boon | Mind boon | Fusion bonus |
|---|---|---|
| Thornhide | Pollen Sense | Traps also trigger on enemies in the room |
| Thornhide | Earthmind | Reflected damage ignores DEF |
| Thornhide | Bloodthirst | Reflected damage counts as a "kill" for healing if it finishes an enemy |
| Ironhide | Earthmind | Also reflect 1 damage on all hits |
| Ironhide | Forgemind | Damage reduction applies AFTER crit multiplier (crits still hurt, but less) |
| Venomblood | Gutterwise | Poisoned enemies drop double gold |
| Venomblood | Bloodthirst | Poison heals grant +1 STR for that combat |
| Regenerate | Pollen Sense | Chamber healing doubled in safe rooms |
| Regenerate | Void Sight | Heal 1 HP per room REVEALED on the map (not just entered) |
| Fireheart | Forgemind | Crits apply BURN + BURN damage is doubled |
| Fireheart | Bloodthirst | Fire kills heal double |
| Phase | Void Sight | Dodged attacks damage the attacker for 3 HP |
| Phase | Earthmind | Dodging an attack also dodges any condition it would apply |

Not every combination has a unique fusion. Unlisted pairs still benefit from having both boons — they just don't get an extra bonus.

### Fusion rules
- **Automatic** — activates as soon as both slots are filled, no action needed
- **Updates when a boon changes** — replace Body boon, fusion recalculates with new pairing
- **Persists across runs** alongside the boons themselves (Stage 2+)
- **Upgraded boons fuse the same way** — the fusion table doesn't distinguish base vs upgraded

---

## 8. Floor Structure (aligned to Gifts)

| Floor | Name | Theme as home | Gift | Enemy tiers | Zones |
|---|---|---|---|---|---|
| 0 | The Grounds | Front garden | Petal | Dust | Montor's Garden |
| -1 | The Underground | Reception rooms | Stone | Dust + Slate | Great Hall, Kitchen |
| -2 | The Underbelly | Sewers, waste | Bile | Slate + Iron | Trash Level, Sewers |
| -3 | The Quarters | Private rooms | Blood | Iron + Crimson | Boudoir, Bathing House |
| -4 | The Works | Forge, workshop | Ember | Crimson | Boiler Room, Furnace |
| -5 | The Deep | Caves, secrets | Void Shard | Crimson + Void | Caverns, Fissures |
| -6 | Montor's Domain | Throne room | None | Void | Montor's Zone |

The dungeon descends through Montor's home:
```
Garden (outside — nature, life)
  → Great Hall & Kitchen (where he receives guests)
  → Sewers & Trash (what he hides beneath)
  → Bedroom & Bathroom (his private spaces)
  → Forge & Furnace (where he builds)
  → Caves (what's buried deepest)
  → His Throne (where he sits, watching)
```

---

## 9. WIS and INT — Stats Unlocked by This System

| Stat | Role in Gift system |
|---|---|
| **WIS** | Determines boon power tier on activation roll. Higher WIS = better boons, less risk. The "shrine stat." |
| **INT** | Determines condition application chance when weapon enchantments (POISON, FROST, BURN, BLEED) try to apply on hit. Higher INT = debuffs land more reliably. The "enchantment stat." |

Both become worth investing in during in-run levelling, alongside STR/DEF/AGI.

---

## Appendix: Change Log

| Date | Change |
|---|---|
| 2026-03-31 | v0.1 — initial Gift system design |

---

*Montor's Gifts — v0.1 — March 2026*
*Living document — update as implementation reveals new fields.*
