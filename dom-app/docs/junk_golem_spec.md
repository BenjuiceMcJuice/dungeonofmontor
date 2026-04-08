# Junk Golem — Spec

> Your junk bag has a purpose: build a companion. A cobbled-together ally that fights, tanks, heals, or scouts alongside you. Named by you, upgraded as you go, mourned when it dies.

---

## 1. Core Concept

All junk collected during a run feeds into building and upgrading a **Junk Golem** — a combat ally that takes turns alongside you. The golem is the junk economy. No other junk trades exist. Junk weight penalties only apply to unspent junk (incentive to invest it into your golem).

**The loop:**
```
Search junk piles → collect junk → visit Junk Mechanic NPC → build/upgrade golem
→ golem fights alongside you → golem takes damage → repair at next Mechanic
→ search more junk → upgrade further → golem gets stronger as you go deeper
```

**Key design pillars:**
- The golem is YOUR creation — named, shaped by your choices, emotionally invested
- Building choices are permanent for the run — you commit to a golem identity
- The golem can die. Rebuilding costs junk. Losing it deep in a run hurts.
- Montor has opinions about your golem. Of course he does.

---

## 2. Golem Archetypes

When you first build your golem (spend 8 junk at the Mechanic), you choose a **chassis** that determines its role. The chassis sets base stats and unlocks different upgrade paths.

| Chassis | Role | Base Stats | Identity |
|---------|------|-----------|----------|
| **Scrapper** | DPS | HP 20, STR 10, DEF 6, AGI 10 | Bladed arms, aggressive. Deals damage. |
| **Bulwark** | Tank | HP 35, STR 6, DEF 12, AGI 6 | Thick plating, shield arm. Draws enemy aggro. |
| **Mender** | Healer | HP 15, STR 4, DEF 8, AGI 8 | Syringe arm, gentle. Heals you each turn. |
| **Tinker** | Utility | HP 20, STR 6, DEF 8, AGI 12 | Lens eye, nimble. Spots traps, reveals map, finds better loot. |

You pick the chassis once. It cannot be changed (this run). But upgrades let you hybrid — a Mender can get STR upgrades and become a battle medic, a Bulwark can get healing modules, etc.

---

## 3. Building the Golem

### First Build
- **Where:** Junk Mechanic NPC room (new room type, one per zone)
- **Cost:** 8 junk items
- **Flow:**
  1. Enter Mechanic room → NPC greeting ("Bring me junk, I'll build you a friend")
  2. If junk count >= 8 → "Build a Golem" button
  3. Name your golem (text input, same pattern as character naming)
  4. Choose chassis (Scrapper / Bulwark / Mender / Tinker) with stat preview
  5. Golem appears! Pixel sprite generated from chassis type + floor theme
  6. Golem joins your party — visible in the party bar alongside your character

### If you already have a golem
- Mechanic room becomes the **upgrade shop** instead (see Section 4)
- Also offers **repairs** if golem is damaged (see Section 6)

---

## 4. Upgrading the Golem

At each Junk Mechanic (one per zone), you can spend junk to upgrade your golem. Each upgrade costs junk and gives you a choice of what to improve.

### Upgrade Costs (escalating)
| Upgrade # | Cost |
|-----------|------|
| 1st | 4 junk |
| 2nd | 5 junk |
| 3rd | 6 junk |
| 4th | 7 junk |
| 5th+ | 8 junk |

### Upgrade Options

Each visit, you're offered 3 random upgrades from the pool (weighted by chassis — Scrappers see more STR options, Menders see more healing options, etc.):

**Stat Upgrades:**
| Upgrade | Effect | Notes |
|---------|--------|-------|
| Reinforce | +8 HP | Always available |
| Sharpen | +2 STR | Weighted toward Scrapper |
| Plate | +2 DEF | Weighted toward Bulwark |
| Oil Joints | +2 AGI | Weighted toward Tinker |
| Overclock | +1 STR, +1 AGI, -3 HP | Risk/reward |

**Ability Modules** (one active ability at a time — new one replaces old):
| Module | Effect | Chassis affinity |
|--------|--------|-----------------|
| **Buzz Saw** | Double attack (2 hits, half damage each) | Scrapper |
| **Flame Jet** | Attack applies BURN (2 turns) | Scrapper |
| **Acid Spit** | Attack applies -1 DEF to target (stacks) | Scrapper |
| **Taunt Klaxon** | Forces all enemies to target golem for 2 turns | Bulwark |
| **Shield Wall** | Golem takes 50% of damage aimed at player for 2 turns | Bulwark |
| **Iron Skin** | Immune to conditions for 3 turns | Bulwark |
| **Patch Up** | Heal player 8 HP at end of golem's turn | Mender |
| **Cleanse Spray** | Remove one condition from player | Mender |
| **Emergency Jolt** | If player drops below 20% HP, auto-heal 15 HP (once per combat) | Mender |
| **Trap Sense** | Reveal trap rooms on the map + disarm traps | Tinker |
| **Loot Magnet** | +30% item drop chance from combat | Tinker |
| **Scout Ahead** | Reveal adjacent chamber types when entering a new room | Tinker |

**Passive Upgrades** (stack, no limit):
| Passive | Effect |
|---------|--------|
| **Thorns** | Enemies take 2 damage when they hit the golem |
| **Regen Coil** | Golem heals 1 HP per turn in combat |
| **Junk Armour** | +1 DEF per 3 junk in your bag (incentive to carry some) |
| **Lucky Find** | +1 to all player PER rolls (stacks) |

### Upgrade UI
Shown at the Junk Mechanic room as a full-screen overlay:

```
┌────────────────────────────────────┐
│  JUNK MECHANIC                     │
│  "What'll it be for [GolemName]?"  │
│                                    │
│  Junk: 12 │ Next upgrade: 5 junk  │
│                                    │
│  [GolemName] — Scrapper            │
│  HP: 28/28  STR: 12  DEF: 8       │
│  AGI: 10  Module: Flame Jet       │
│                                    │
│  Choose an upgrade:                │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Sharpen (+2 STR)            │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Taunt Klaxon (active)       │  │
│  │ Forces enemies to target    │  │
│  │ golem for 2 turns           │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Regen Coil (passive)        │  │
│  │ Golem heals 1 HP/turn       │  │
│  └──────────────────────────────┘  │
│                                    │
│  [Skip — save junk for later]      │
└────────────────────────────────────┘
```

Player can buy multiple upgrades in one visit (if they have enough junk). Each purchase refreshes the 3 options.

---

## 5. Golem in Combat

### Turn Order
Golem acts on its own turn in the initiative order (rolls initiative like any combatant, using its AGI modifier). Turn order becomes:

```
Initiative roll: player, golem, enemy1, enemy2, ...
Sorted highest first. Golem takes a full turn:
  1. Tick conditions (golem can get BURN, POISON, etc.)
  2. Choose action (AI-controlled, see below)
  3. Execute action
  4. Tick end-of-turn effects
```

### Golem AI (automatic — player doesn't control)
The golem acts based on its chassis and the combat state:

**Scrapper AI:**
1. If active module is ready → use it on lowest-HP enemy
2. Else → attack highest-threat enemy (highest STR)
3. Never flees

**Bulwark AI:**
1. If player HP < 40% and Shield Wall available → activate Shield Wall
2. If 2+ enemies alive and Taunt available → Taunt
3. Else → attack enemy targeting player
4. Never flees

**Mender AI:**
1. If player HP < 60% and Patch Up available → heal player
2. If player has a condition and Cleanse available → cleanse
3. Else → attack weakest enemy
4. Never flees

**Tinker AI:**
1. If Scout/Trap ability relevant → use it (pre-combat, passive)
2. In combat → attack lowest-HP enemy (finish off weak ones)
3. Never flees

### Golem Damage Formula
Same as player/enemy: `d(weaponDie) + STR modifier`, reduced by target DEF percentage.
- Golem weaponDie = 6 (base), upgradeable via Sharpen (doesn't change die, just STR)
- Uses the same `calculateTierDamage` function
- Golem rolls d20 for attack tier like everyone else

### Enemy Targeting
Enemies choose targets based on:
- **Default:** 70% chance to target player, 30% chance to target golem
- **If golem has Taunt active:** 100% target golem for duration
- **If golem HP < 20%:** enemies deprioritise it (10% chance)
- **If player is stunned/feared:** enemies always target golem

### Golem Taking Damage
- Golem has its own HP pool, reduced by incoming damage (same formula as player)
- Golem can receive conditions (BURN, POISON, BLEED, FROST, STUN, etc.)
- Golem DEF reduces damage via same percentage formula as everything else
- Conditions tick on golem's turn start, same as player/enemy

---

## 6. Golem Death & Repair

### Death
- When golem HP hits 0, it's **destroyed**
- Combat log: "[GolemName] collapses into a heap of junk."
- Golem is removed from combat immediately (no corpse, no loot — it's YOUR junk)
- The golem's chassis type, name, and upgrade history are preserved in state
- Flag: `golem.destroyed = true`

### Rebuild at Junk Mechanic
- If your golem is destroyed, the Mechanic offers to rebuild it
- **Rebuild cost:** 4 junk (half of initial build cost)
- Rebuilt golem has **base chassis stats** (all upgrades lost)
- Name is preserved
- You can immediately spend more junk to re-upgrade
- Narrative: "I can patch [GolemName] back together. Won't be pretty. Was it ever?"

### Repair (not destroyed, just damaged)
- If golem is alive but HP < max, Mechanic offers repair
- **Repair cost:** 2 junk = full HP restore
- Also clears any conditions on the golem

---

## 7. Golem Items (Consumables)

New consumable items that heal or buff the golem, found in loot/shops:

| Item | Effect | Rarity | Price |
|------|--------|--------|-------|
| **Scrap Patch** | Heal golem 10 HP | Common | 12 gold |
| **Rust Remover** | Heal golem 20 HP + clear conditions | Uncommon | 28 gold |
| **Spare Parts Kit** | Heal golem to full HP | Rare | 60 gold |
| **Overclock Juice** | Golem gets +3 STR for 3 turns | Uncommon | 24 gold |
| **Insulation Tape** | Golem immune to conditions for 3 turns | Uncommon | 20 gold |
| **Emergency Rebuild** | If golem is destroyed, rebuild with base stats (no Mechanic needed) | Rare | 80 gold |

These appear in loot tables and merchant stock. Players who invest in a golem build want to find these — creates loot relevance.

### Using golem items in combat
- Added to the existing "Use Item" action in combat
- Items targeting the golem are labelled "[GolemName]" in the item list
- Can only use golem items if golem is alive (except Emergency Rebuild)

---

## 8. Junk Weight Penalty

Unspent junk has weight. This creates pressure to invest in your golem rather than hoarding.

**Current weight system:** `capacity = 10 + (END modifier × 3)`. Each junk item = 1 weight.

**New penalty when over capacity:**
| Overweight % | Penalty |
|-------------|---------|
| 100-119% | -1 AGI modifier (slower initiative, less dodge) |
| 120-139% | -2 AGI modifier |
| 140%+ | -2 AGI, -1 STR modifier |

This is ONLY from junk. Equipment weight doesn't count toward the penalty (or counts separately at a much higher threshold).

Light touch — you feel it but it's not crippling. The real incentive is: spend junk on your golem, it fights for you AND you get lighter.

---

## 9. Junk Mechanic NPC

### Room type
- New chamber template: `junk_mechanic`
- Safe room (no combat)
- One per zone (alongside merchant, rest, quest_npc)
- Icon: ⚙ (gear symbol)

### NPC identity
- **Name:** Cogs (or floor-specific names: "Cogs" in Garden, "Sprocket" underground, etc.)
- **Visual:** Pixel sprite — small hunched figure surrounded by junk, goggles, tool belt
- **Personality:** Enthusiastic about junk. Sees beauty in garbage. Polar opposite of Montor.
- **Greeting (no golem):** "You've got junk? I've got ideas. Let's build something wonderful."
- **Greeting (has golem):** "Ah, [GolemName]! Looking a bit rough. What shall we do?"
- **Greeting (golem destroyed):** "[GolemName]... oh no. Bring me the pieces. I can fix this."

### Montor's reaction
Montor doesn't approve of golems. They're made of HIS junk. But he's grudgingly impressed.
- **On first build:** "You made... a THING. Out of MY belongings. I suppose I should be flattered. I'm not."
- **On upgrade:** "You're making it BIGGER? In MY house?"
- **On golem death:** "...good."
- **On rebuild:** "It's back. Of course it's back."

---

## 10. Golem State (Data Model)

```javascript
// Stored in game state (alongside playerInventory, giftSlots, etc.)
golem: {
  name: "Clank",
  chassis: "scrapper",       // scrapper | bulwark | mender | tinker
  destroyed: false,
  
  // Stats (modified by upgrades)
  hp: 28,
  maxHp: 28,
  str: 12,
  def: 8,
  agi: 10,
  weaponDie: 6,
  
  // Active module (one at a time, null if none)
  activeModule: {
    id: "flame_jet",
    name: "Flame Jet",
    effect: "attack_burn",
    cooldown: 3,            // turns between uses
    currentCooldown: 0,     // 0 = ready
  },
  
  // Passive upgrades (array, stacks)
  passives: [
    { id: "regen_coil", name: "Regen Coil", effect: "regen", value: 1 },
    { id: "thorns", name: "Thorns", effect: "thorns", value: 2 },
  ],
  
  // Combat state (transient, not saved)
  statusEffects: [],        // same format as player/enemy conditions
  
  // Upgrade tracking
  upgradeCount: 3,          // total upgrades purchased (for cost scaling)
  
  // Display
  floorBuilt: "grounds",    // affects sprite theme
}
```

### Run Save Integration
Add `golem` to `buildSavePayload()` in `runSave.js`. Golem state persists across room transitions (same as inventory, gifts, etc.). Combat state (statusEffects, currentCooldown) resets between combats.

### Battle State Integration
Add golem as a combatant in `BattleState`:
```javascript
battle.allies = [
  {
    id: 'golem',
    name: golem.name,
    type: 'golem',
    stats: { str, def, agi },
    currentHp: golem.hp,
    maxHp: golem.maxHp,
    weaponDie: golem.weaponDie,
    statusEffects: [],
    activeModule: golem.activeModule,
    passives: golem.passives,
  }
]
```

---

## 11. Golem Sprite

BBC Micro style pixel art, same as all other sprites:
- Drawn as canvas grid arrays (no image files)
- Scale 4 (matching NPC sprites)
- **Chassis visual identity:**
  - Scrapper: angular, blade arms, red accents
  - Bulwark: wide, shield arm, heavy plate, grey/blue
  - Mender: slim, syringe/wrench arm, green accents
  - Tinker: small, lens eye, antenna, amber accents
- **Floor theming:** built from that floor's junk palette
  - Garden: flower pots, rake arms, green-brown
  - Underground: bricks, chains, grey-rust
  - Underbelly: pipes, valves, wet green
  - Quarters: curtain fabric, mirror shards, faded purple
  - Works: gears, tongs, orange-metal
  - Deep: bone, stone, crystal blue
- **Upgrade visual:** gets bulkier/more detailed as upgradeCount increases. Base = simple 8×10 sprite. Upgraded = 10×12 with extra details.

---

## 12. Implementation Order

| Step | What | Complexity |
|------|------|-----------|
| 1 | Golem data model + state in Game.jsx | Small |
| 2 | Junk Mechanic NPC room type + build UI | Medium |
| 3 | Chassis selection + naming flow | Small |
| 4 | Golem in combat — turn order, AI, targeting | Large |
| 5 | Upgrade system — stat upgrades + modules | Medium |
| 6 | Golem death + rebuild flow | Small |
| 7 | Golem consumable items (Scrap Patch etc.) | Small |
| 8 | Junk weight penalty | Small |
| 9 | Golem sprites (4 chassis × floor themes) | Medium |
| 10 | Montor dialogue reactions | Small |
| 11 | Add golem to run save payload | Small |
| 12 | Balance pass — golem stats vs enemy scaling | Medium |

**Critical path:** Steps 1-4 get a working golem in combat. Everything else layers on top.

---

## 13. Balance Considerations

- **Golem shouldn't be OP:** it's a helper, not a second player. Base damage should be ~60% of player damage. 
- **Golem HP is finite:** no passive regen unless upgraded. Creates tension — protect your golem or lose it.
- **Junk scarcity:** average 5-10 junk per zone. Build costs 8, upgrades 4-8. You can't max everything — choose wisely.
- **Enemy scaling:** deeper floors should have enemies that challenge golem builds (AoE attacks that hit both player and golem, conditions that affect allies).
- **No golem in boss fights?** No — golem IS there for boss fights. That's the payoff for investing all that junk. But bosses should have abilities that threaten the golem specifically.

---

## 14. Scrapped Ideas (for reference)

These were considered and explicitly dropped in favour of the golem system:
- ~~Weapon enchant trades~~ — golem IS the junk investment
- ~~Stat tonic trades~~ — upgrades give stats to the golem instead
- ~~Map fragment trades~~ — Tinker golem reveals map as a passive ability
- ~~Montor's Favour trades~~ — mood system stays separate (tidiness-based)
- ~~The Dump (pre-run junk hub)~~ — future feature, separate from in-run golem
