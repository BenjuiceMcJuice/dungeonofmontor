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

Each gift can be applied to 5 slots: **Body, Mind, Weapon, Shield, Item**. The effects align with the gift's core theme:

- **Petal** = Nature, healing, restoration
- **Stone** = Solid, heavy, blunt force, defence
- **Bile** = Toxic, weakening, POISON, stat drain
- **Blood** = Violence, BLEED, lifesteal, hunger
- **Ember** = Fire, BURN, raw damage, destruction
- **Void** = Chaos, dice manipulation, luck, reality-bending

### PETAL (Floor 0 — The Grounds)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Bloomheart** — regen 2 HP per chamber entered | 1 HP per chamber |
| **Mind** | **Pollen Sense** — searches always find something, +2 PER | +1 PER only |
| **Weapon** | **Lifethorn** — heal 2 HP on each hit | Heal 1 HP on hit |
| **Shield** | **Bark Shield** — blocking heals you 3 HP | Heals 1 HP on block |
| **Item** | **Bloom Ring** — cure all conditions on entering a rest room | Cure body conditions only |

### STONE (Floor -1 — The Underground)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Ironhide** — +3 DEF permanently | +1 DEF |
| **Mind** | **Earthmind** — can't be one-shot (survive at 1 HP once per combat) | Once per floor |
| **Weapon** | **Stonecrusher** — weapon gains +50% DEF ignore (blunt force) | +25% DEF ignore |
| **Shield** | **Wallguard** — +10% block chance, blocking DAZEs the attacker | +5% block only |
| **Item** | **Stoneguard Ring** — glancing blows deal 0 damage to you | 50% chance |

### BILE (Floor -2 — The Underbelly)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Venomblood** — POISON immune, 10% chance to POISON on any hit | Immune only |
| **Mind** | **Gutterwise** — enemies start combat at -1 all rolls | -1 first round only |
| **Weapon** | **Acidcoat** — weapon applies POISON on hit, POISON drains 2 stats per tick | POISON on hit only |
| **Shield** | **Toxin Buckler** — blocking POISONs the attacker | 50% chance |
| **Item** | **Rot Ring** — POISONED enemies also lose -1 DEF per tick | -1 DEF on first tick only |

### BLOOD (Floor -3 — The Quarters)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Bloodheart** — 5% lifesteal on all damage, BLEED you apply does +1 per stack | Lifesteal only |
| **Mind** | **Bloodthirst** — FEAR immune, BLOODLUST activates below 25% HP | FEAR immune only |
| **Weapon** | **Lifedrink** — weapon applies BLEED on hit, heals you 1 HP per BLEED stack on target | BLEED on hit only |
| **Shield** | **Thorn Guard** — blocking causes BLEED on the attacker | 50% chance |
| **Item** | **Heartstone Ring** — +10 max HP, kills heal 3 HP | +5 max HP only |

### EMBER (Floor -4 — The Works)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Fireheart** — +2 damage on all attacks, BURN immune | +1 damage only |
| **Mind** | **Forgemind** — +2 INT, all conditions you apply last 1 extra turn | +1 INT only |
| **Weapon** | **Flamecoat** — weapon applies BURN on hit, BURN burst damage +3 (8 total) | BURN on hit only |
| **Shield** | **Ember Buckler** — blocking reflects 3 fire damage back | 1 fire damage |
| **Item** | **Cinder Ring** — crits apply BURN to ALL enemies (AoE) | BURN on target only |

### VOID SHARD (Floor -5 — The Deep)

| Apply to | Effect | Partial version |
|---|---|---|
| **Body** | **Phase** — +1 all combat stats, +5 max HP | +5 max HP only |
| **Mind** | **Void Sight** — reroll one die per chamber (the dice power) | Reroll once per floor |
| **Weapon** | **Nullblade** — random condition on crit (any condition in the game) | 50% chance |
| **Shield** | **Void Buckler** — 5% chance blocking instant-kills the attacker | 2% chance |
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
| **Bloomheart** | Regen 2 HP/chamber | Regen 3 HP + cure one condition per chamber |
| **Ironhide** | +3 DEF | +5 DEF + immune to DAZE |
| **Venomblood** | POISON immune, 10% poison on hit | Poison heals you + YOUR attacks apply NAUSEA too |
| **Bloodheart** | 5% lifesteal, BLEED +1/stack | 10% lifesteal, BLEED +2/stack |
| **Fireheart** | +2 damage, BURN immune | +4 damage + all attacks apply BURN |
| **Phase** | +1 all stats, +5 HP | +2 all stats, +10 HP |
| **Pollen Sense** | Searches always find something, +2 PER | +4 PER + reveal all hidden rooms on floor |
| **Earthmind** | Survive at 1 HP once/combat | Survive at 1 HP once/combat + immune to all Mind conditions |
| **Gutterwise** | Enemies -1 all rolls | Enemies -2 all rolls + POISONED enemies drop double gold |
| **Bloodthirst** | FEAR immune, BLOODLUST below 25% | FEAR immune + BLOODLUST always active + kills heal 5 HP |
| **Forgemind** | +2 INT, conditions +1 turn | +4 INT, conditions +2 turns, crits deal x2.5 |
| **Void Sight** | Reroll one die/chamber | Reroll two dice/chamber + nat 1s auto-reroll |

The old boon is gone. The choice to replace is permanent. But the reward is a strictly better version of the new boon.

---

## 8. Cross-Slot Fusions (Body + Mind)

When you have BOTH a Body boon AND a Mind boon active simultaneously, a **fusion bonus** activates on top of both. This is free — no sacrifice, no roll. It's the reward for investing in both slots.

### Same-Gift Fusion (Body + Mind of the same gift)
The ultimate reward for committing to one gift. Both slots = a powerful bonus effect.

| Gift | Body + Mind fusion |
|---|---|
| **Petal** | **Full Bloom** — full heal + cure all conditions on entering any rest room |
| **Stone** | **Avalanche** — when hit below 25% HP, reflect 50% of damage back for 1 turn |
| **Bile** | **Pandemic** — all enemies start combat POISONED |
| **Blood** | **Crimson Feast** — kills heal 20% HP, BLEED stacks uncapped |
| **Ember** | **Inferno** — crits BURN all enemies (AoE), conditions can't be resisted |
| **Void** | **Reality Break** — 3 rerolls per chamber, nat 1s auto-reroll |

### Cross-Gift Fusion (Body + Mind of different gifts)
Interesting but less powerful than same-gift fusion. Some highlights:

| Body | Mind | Fusion bonus |
|---|---|---|
| Ironhide (Stone) | Forgemind (Ember) | Crits ignore DEF entirely |
| Bloodheart (Blood) | Gutterwise (Bile) | POISONED enemies that BLEED drop double gold |
| Fireheart (Ember) | Bloodthirst (Blood) | Fire kills heal double, BURN triggers lifesteal |
| Phase (Void) | Earthmind (Stone) | Dodging an attack also dodges any condition |
| Bloomheart (Petal) | Void Sight (Void) | Heal 1 HP per room revealed on map |
| Venomblood (Bile) | Pollen Sense (Petal) | Junk pile searches can't trigger ambushes |

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
| 2026-04-01 | v0.2 — 5-slot system (added Shield slot), effects aligned to gift themes, same-gift fusions redesigned, upgrade table updated |

---

*Montor's Gifts — v0.1 — March 2026*
*Living document — update as implementation reveals new fields.*
