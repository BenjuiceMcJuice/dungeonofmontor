# Junk Golem — Implementation Build Plan

> Full technical plan for adding a junk golem companion to DoM. Covers combat UI, NPC interaction, zone placement, sprites, and phased build order.

---

## 1. Visual Design: Golem in Combat

### Where it lives on screen

The combat screen layout is currently:

```
┌─────────────────────────────────┐
│ Stats  │  Room Header  │  Bag   │  ← header bar (fixed)
├─────────────────────────────────┤
│                                 │
│   [Enemy1]  [Enemy2]  [Enemy3]  │  ← enemy cards (flex wrap, centered)
│                                 │
│   ─── Combat Log (last 4) ───  │  ← log entries
│                                 │
│   ┌─── Turn Panel ───────────┐  │  ← player actions / enemy rolling
│   │  Your Turn / Enemy Turn  │  │
│   │  [Attack] [Item] [Flee]  │  │
│   └──────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│ [Knight sprite] Sir Bonk       │  ← party bar (fixed bottom)
│ ██████████░░░░ 45/65 HP        │
│ Sword  +3 DEF  Shield  12g    │
└─────────────────────────────────┘
```

**The golem goes in the party bar**, right side, mirroring the player:

```
├─────────────────────────────────────────┤
│ [Knight]  Sir Bonk        [Golem] Clank │
│ ████████░░ 45/65     ██████░░░ 18/28   │
│ Sword +3DEF 12g       Scrapper ⚔ Flame │
└─────────────────────────────────────────┘
```

### Party Bar Layout (Updated)

```jsx
<div className="shrink-0 bg-surface border-t border-border px-3 py-2">
  <div className="flex items-center gap-3">
    
    {/* Player section — left side (existing) */}
    <div className="flex-1 flex items-center gap-2">
      <PlayerSprite classKey="knight" scale={2} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm text-ink truncate">{character.name}</span>
          <span className="text-ink text-xs font-sans">{playerHp}/{character.maxHp}</span>
        </div>
        {/* HP bar */}
        <div className="w-full bg-bg rounded-full h-2 mt-1">
          <div className="rounded-full h-2 transition-all bg-green-500" style={{ width: hpPct }} />
        </div>
        {/* Equipment line */}
        <div className="flex gap-2 text-[10px] font-sans text-ink-dim mt-1">...</div>
      </div>
    </div>

    {/* Golem section — right side (NEW) */}
    {golem && !golem.destroyed && (
      <div className="flex-1 flex items-center gap-2 border-l border-border pl-3">
        <SpriteRenderer spriteKey={'golem_' + golem.chassis} tierKey="iron" scale={2} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm text-amber-400 truncate">{golem.name}</span>
            <span className="text-ink text-xs font-sans">{golem.hp}/{golem.maxHp}</span>
          </div>
          {/* HP bar — amber instead of green */}
          <div className="w-full bg-bg rounded-full h-2 mt-1">
            <div className="rounded-full h-2 transition-all bg-amber-500" style={{ width: golemHpPct }} />
          </div>
          {/* Chassis + module line */}
          <div className="flex gap-2 text-[10px] font-sans text-ink-dim mt-1">
            <span className="text-amber-400">{golem.chassis}</span>
            {golem.activeModule && <span>⚙ {golem.activeModule.name}</span>}
          </div>
          {/* Conditions */}
          <div className="flex gap-0.5 mt-0.5">
            {golem.statusEffects.map(c => <ConditionIcon conditionId={c.id} scale={2} />)}
          </div>
        </div>
      </div>
    )}
    
  </div>
</div>
```

**Key visual choices:**
- Golem name in **amber** (#d4a017 / text-amber-400) — distinct from player (white) and enemies (red)
- HP bar in **amber** — not green (that's the player's colour)
- Separated by a `border-l` divider
- Same scale (2) as player sprite — they're peers, not enemies
- Condition icons use same `ConditionIcon` component
- When golem is destroyed: section disappears (or shows greyed "[GolemName] — destroyed" text)

### Golem's Turn in Combat

When it's the golem's turn, the turn panel shows:

```
┌────────────────────────────────────┐
│  ⚙ Clank's Turn                   │
│                                    │
│  Clank attacks Orc Brute...        │
│  [Auto-rolling dice animation]     │
│                                    │
│  OR                                │
│                                    │
│  Clank activates Flame Jet!        │
│  [Ability animation]               │
│                                    │
│  OR                                │
│                                    │
│  Clank patches you up. +8 HP       │
│  [Healing animation]               │
└────────────────────────────────────┘
```

**Styling:** Same as enemy turn panel but with **amber** accent instead of red:
- Border: `border-amber-400/30`
- Background: `bg-amber-400/5`
- Header: `text-amber-400 text-xs font-sans uppercase tracking-wide "Ally Turn"`
- Name: `text-amber-400 text-lg font-display`
- Action text: `text-ink text-sm italic`

**The golem's turn is fully automatic** — no player input. The AI picks the action (based on chassis logic from the spec), the dice roll animates (using `CombatRoller` with `colour="amber"` and `autoRoll={true}`), and the result displays. Same timing as enemy turns (~1.5-2s total).

### Enemy Targeting Golem

When an enemy targets the golem instead of the player:
- Combat log: `"Orc Brute attacks Clank!"` (amber text, not red)
- Damage applied to `golem.hp` instead of `playerHp`
- Golem death: `"Clank collapses into a heap of junk!"` (red text)

### Golem Death in Combat

When golem HP hits 0:
- Flash golem section in party bar red, then fade to grey
- Combat log message: `"[GolemName] is destroyed!"` in red
- Golem section shows: `text-ink-faint text-xs italic "[GolemName] — destroyed"`
- Golem removed from turn order
- Combat continues (player is alone now)

---

## 2. Junk Mechanic NPC — Room & Interaction

### Zone Placement

New room type: `junk_mechanic` — one per zone, safe room.

**Conversion of existing empty slots in zones.json:**

| Zone | Slot to convert | Current label | New label |
|------|----------------|---------------|-----------|
| montors_garden | "Stone Pedestal" (empty, safe) | Stone Pedestal | Junk Workshop |
| great_hall | "Weapon Rack" (empty, safe) | Weapon Rack | Scrap Corner |
| kitchen | "Dripping Alcove" (empty, safe) | *(check zones.json)* | Pipe Works |
| sewers | *(empty safe slot)* | | Drain Workshop |
| cistern | *(empty safe slot)* | | Tank Room |
| bedroom | *(empty safe slot)* | | Wardrobe Workshop |
| study | *(empty safe slot)* | | Desk Workshop |
| forge | *(empty safe slot)* | | Anvil Station |
| workshop | *(empty safe slot)* | | Tinker's Bench |
| caverns | *(empty safe slot)* | | Crystal Workshop |
| chasm | *(empty safe slot)* | | Bone Workshop |
| throne_room | *(empty safe slot)* | | Final Workshop |

Icon: `⚙` (gear)

### NPC Names (per floor theme)

| Floor | Name | Personality |
|-------|------|-------------|
| Grounds | **Cogs** | Cheerful, sees beauty in junk. "Every bit of rubbish has potential!" |
| Underground | **Sprocket** | Grumpy but skilled. "Don't touch anything. Actually, give me that." |
| Underbelly | **Drip** | Nervous, works in wet conditions. "Quick, before it rusts!" |
| Quarters | **Stitch** | Refined, makes elegant golems. "One must maintain standards." |
| Works | **Anvil** | Loud, enthusiastic. "NOW we're BUILDING!" |
| Deep | **Shard** | Quiet, ancient. "The stones remember how to be useful." |
| Domain | **Echo** | Mysterious, works with void materials. "This junk... it hums." |

### Interaction Flow

**Entering the room:**
- NPC sprite displayed (same pattern as merchant NPCs)
- NPC name in gold pixel font
- "TAP TO BUILD" or "TAP TO UPGRADE" label
- Greeting text in italic

**Tap → Full-screen overlay opens (matching merchant overlay pattern):**

```
┌────────────────────────────────────────┐
│  Cogs                          [Leave] │
│  "Montor's head of recycling"          │
│  Junk: 12                              │
├────────────────────────────────────────┤
│                                        │
│  [BUILD / UPGRADE / REPAIR content]    │
│                                        │
└────────────────────────────────────────┘
```

**Three possible states when opening:**

#### State A: No golem yet (first build)
```
  "Bring me junk, I'll build you a friend."
  
  Cost: 8 junk
  
  ┌─ Name your companion ─────────────┐
  │  [___________________________]     │
  └────────────────────────────────────┘
  
  Choose a chassis:
  
  ┌────────────────────────────────────┐
  │ ⚔ SCRAPPER         HP 20 STR 10  │
  │ Bladed arms. Attacks hard.        │
  │ DEF 6  AGI 10                     │
  └────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ 🛡 BULWARK          HP 35 STR 6   │
  │ Thick plating. Draws fire.        │
  │ DEF 12  AGI 6                     │
  └────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ 💚 MENDER           HP 15 STR 4   │
  │ Heals you each turn.              │
  │ DEF 8  AGI 8                      │
  └────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ 🔍 TINKER           HP 20 STR 6   │
  │ Scouts ahead. Finds better loot.  │
  │ DEF 8  AGI 12                     │
  └────────────────────────────────────┘
  
  [Not enough junk — need 8]  (if < 8 junk)
```

**Flow:**
1. Enter name (text input, same as character naming)
2. Tap chassis card → confirm overlay "Build [Name] as a Scrapper? (8 junk)"
3. Confirm → deduct junk, create golem, show celebration: "[Name] whirs to life!"
4. Golem appears in party bar immediately

#### State B: Has golem, alive (upgrade)
```
  "What'll it be for Clank?"
  
  Junk: 12 │ Next upgrade: 5 junk
  
  ┌─ Clank ─ Scrapper ────────────────┐
  │ HP: 28/28  STR: 12  DEF: 8       │
  │ AGI: 10  Module: Flame Jet       │
  │ Passives: Regen Coil, Thorns     │
  └────────────────────────────────────┘
  
  Choose an upgrade:
  
  ┌────────────────────────────────────┐
  │ Sharpen (+2 STR)              STAT │
  │ More damage per hit.              │
  └────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ Taunt Klaxon                MODULE │
  │ Forces enemies to target Clank    │
  │ for 2 turns. Replaces: Flame Jet  │
  └────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ Regen Coil              PASSIVE   │
  │ Clank heals 1 HP per turn.       │
  │ (Stacks with existing)            │
  └────────────────────────────────────┘
  
  ┌────────────────────────────────────┐
  │ 🔧 REPAIR — Full HP (2 junk)     │
  └────────────────────────────────────┘
  
  [Skip — save junk for later]
```

**Flow:**
1. See current golem stats + 3 random upgrade options
2. Tap upgrade → deduct junk, apply upgrade, refresh options (can buy multiple)
3. Repair button always visible if HP < max
4. "Skip" to leave without upgrading

#### State C: Golem destroyed (rebuild)
```
  "Clank... oh no. Bring me the pieces."
  
  Cost: 4 junk (rebuild)
  
  ┌─ Clank ─ Scrapper ────────────────┐
  │ DESTROYED                          │
  │ Base stats: HP 20 STR 10 DEF 6   │
  │ All upgrades lost.                │
  └────────────────────────────────────┘
  
  [Rebuild Clank (4 junk)]
  
  [Not enough junk — need 4]  (if < 4 junk)
```

**Flow:**
1. Tap rebuild → deduct 4 junk, reset golem to base chassis stats, clear upgrades
2. Golem is alive again with base stats
3. Can immediately upgrade (if junk remains)

### Styling Reference

Match the existing merchant overlay exactly:
- Background: `repeating-conic-gradient(${floorBorderColor}18 0% 25%, transparent 0% 50%)` with `backgroundSize: '8px 8px'`
- Backdrop: `bg-bg/90`
- Header: `flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80`
- NPC name: `font-display text-lg text-amber-400` (amber for mechanic, gold for merchants)
- Leave button: `text-sm text-ink-dim border border-border px-3 py-1 rounded`
- Cards: `p-4 rounded-lg border border-border-hl bg-surface` — tappable ones get `cursor-pointer hover:border-amber-400/40`
- Stat labels: `text-[10px] font-sans text-ink-dim`
- Cost labels: `text-amber-400 text-sm font-sans`

---

## 3. Combat Engine Integration

### New Combat Phases

Add to existing phases:
```javascript
'golemWindup'    // Golem preparing (shows what it's about to do)
'golemRolling'   // Golem rolling dice (CombatRoller animating)
```

### Turn Order Changes

**Current:** `sortByInitiative([player, ...enemies])` → alternating turns

**New:** `sortByInitiative([player, golem, ...enemies])` → golem gets its own slot

```javascript
// In buildInitiativeOrder() or equivalent
var combatants = []
combatants.push({ id: 'player', type: 'player', agi: playerAgi })
if (golem && !golem.destroyed && golem.hp > 0) {
  combatants.push({ id: 'golem', type: 'golem', agi: golem.agi })
}
enemies.forEach(function(e) {
  if (!e.isDown) combatants.push({ id: e.id, type: 'enemy', agi: e.stats.agi })
})
// Roll d20 + AGI mod for each, sort descending
```

### Golem AI Resolution

When it's the golem's turn, the AI picks an action based on chassis + combat state:

```javascript
function resolveGolemTurn(golem, battle, playerHp, playerMaxHp) {
  var action = null
  var mod = golem.activeModule

  if (golem.chassis === 'mender') {
    // Heal priority
    if (playerHp < playerMaxHp * 0.6 && mod && mod.effect === 'heal_player' && mod.currentCooldown === 0) {
      action = { type: 'module', target: 'player', module: mod }
    } else if (hasCondition(playerHp) && mod && mod.effect === 'cleanse' && mod.currentCooldown === 0) {
      action = { type: 'module', target: 'player', module: mod }
    } else {
      action = { type: 'attack', target: pickWeakestEnemy(battle) }
    }
  } else if (golem.chassis === 'bulwark') {
    // Tank priority
    if (playerHp < playerMaxHp * 0.4 && mod && mod.effect === 'shield_wall' && mod.currentCooldown === 0) {
      action = { type: 'module', target: 'player', module: mod }
    } else if (livingEnemyCount(battle) >= 2 && mod && mod.effect === 'taunt' && mod.currentCooldown === 0) {
      action = { type: 'module', target: 'self', module: mod }
    } else {
      action = { type: 'attack', target: pickEnemyTargetingPlayer(battle) }
    }
  } else if (golem.chassis === 'scrapper') {
    // DPS priority
    if (mod && mod.currentCooldown === 0) {
      action = { type: 'module', target: pickLowestHpEnemy(battle), module: mod }
    } else {
      action = { type: 'attack', target: pickHighestThreatEnemy(battle) }
    }
  } else {
    // Tinker — utility + chip damage
    action = { type: 'attack', target: pickLowestHpEnemy(battle) }
  }
  
  return action
}
```

### Damage Resolution

Golem attacks use the same `calculateTierDamage()` function:
```javascript
var roll = d20Attack(golemStrMod, 20) // no crit threshold reduction for golem
var dmgRoll = rollDamage(golem.weaponDie, golemStrMod)
var breakdown = calculateTierDamage(dmgRoll.roll, golemStrMod, roll.tier, enemyDef, 2.0)
```

### Enemy Targeting Logic

Modify the existing enemy attack resolution:
```javascript
function pickEnemyTarget(enemy, golem, playerHp, playerMaxHp) {
  // Taunt overrides everything
  if (golem && golem.hp > 0 && golem.taunting) return 'golem'
  
  // Shield Wall — golem intercepts 50% of player-targeted attacks
  // (handled after target selection, not here)
  
  // Default split
  if (!golem || golem.destroyed || golem.hp <= 0) return 'player'
  
  // Low golem HP — enemies ignore it
  if (golem.hp < golem.maxHp * 0.2) return Math.random() < 0.9 ? 'player' : 'golem'
  
  // Player stunned/feared — target golem
  if (playerStunned || playerFeared) return 'golem'
  
  // Normal: 70% player, 30% golem
  return Math.random() < 0.7 ? 'player' : 'golem'
}
```

### Condition Ticking

Golem conditions tick at the start of its turn, same as player/enemies:
```javascript
// In the golem turn phase, before action:
var condResult = tickTurnStart(battle, 'golem')
// Apply BURN damage, POISON damage, check STUN (skip turn), etc.
```

---

## 4. Golem Sprites

### Sprite Structure

Each chassis gets a sprite in `sprites.js`. Grid format matches existing enemies:

```javascript
SPRITES.golem_scrapper = {
  cols: 14, rows: 16,
  grid: [
    // Angular body, blade arms, aggressive stance
    // C = chassis colour, S = shadow, K = outline
    // ... 16 rows of 14 values ...
  ]
}
SPRITES.golem_bulwark = { cols: 16, rows: 16, grid: [...] }  // wider, shield arm
SPRITES.golem_mender = { cols: 12, rows: 16, grid: [...] }   // slimmer
SPRITES.golem_tinker = { cols: 12, rows: 14, grid: [...] }   // smaller, antenna
```

### Colour Scheme

Golem tier colour is based on the floor it was built on. But simpler approach for v1: use a fixed "junk" colour palette:

```javascript
TIERS.junk = { hex: '#b87333', shadow: '#8b5a2b' }  // copper/rust brown
```

This gives all golems a distinctive warm brown/copper look that reads as "made of junk" regardless of floor. Future: floor-themed variants.

### Corpse Sprite

When destroyed, show a collapsed version (same pattern as enemy corpses):
```javascript
SPRITES.golem_scrapper_corpse = { cols: 14, rows: 8, grid: [...] }  // flattened heap
```

### NPC Sprite (Junk Mechanic)

Each floor's mechanic gets a sprite. Reuse the existing NPC sprite pattern:
- Scale 4 (matching Keith the Groundskeeper, Peddler)
- Hunched figure, goggles, tool belt, surrounded by junk
- Warm amber/brown tones

---

## 5. Data Changes

### zones.json — Add mechanic room to each zone

Convert one `empty` safe slot per zone to `junk_mechanic`:
```json
{ "type": "junk_mechanic", "label": "Junk Workshop", "safe": true, "icon": "⚙" }
```

### items.json — Add golem consumables

```json
"scrap_patch": {
  "id": "scrap_patch", "name": "Scrap Patch", "type": "consumable",
  "subtype": "golem_heal", "effect": "heal_golem", "effectValue": 10,
  "rarity": "common", "buyPrice": 12, "sellPrice": 5,
  "description": "Hammered tin. Stops the leaking.", "weight": 1
},
"rust_remover": {
  "id": "rust_remover", "name": "Rust Remover", "type": "consumable",
  "subtype": "golem_heal", "effect": "heal_golem_cleanse", "effectValue": 20,
  "rarity": "uncommon", "buyPrice": 28, "sellPrice": 11,
  "description": "Clears conditions and patches up your junk friend.", "weight": 1
},
"spare_parts_kit": {
  "id": "spare_parts_kit", "name": "Spare Parts Kit", "type": "consumable",
  "subtype": "golem_heal", "effect": "heal_golem_full", "effectValue": 999,
  "rarity": "rare", "buyPrice": 60, "sellPrice": 24,
  "description": "A bag of gears, springs, and hope.", "weight": 2
},
"overclock_juice": {
  "id": "overclock_juice", "name": "Overclock Juice", "type": "consumable",
  "subtype": "golem_buff", "effect": "buff_golem_str", "effectValue": 3, "duration": 3,
  "rarity": "uncommon", "buyPrice": 24, "sellPrice": 10,
  "description": "Pour it in. Stand back.", "weight": 1
},
"insulation_tape": {
  "id": "insulation_tape", "name": "Insulation Tape", "type": "consumable",
  "subtype": "golem_buff", "effect": "golem_condition_immune", "duration": 3,
  "rarity": "uncommon", "buyPrice": 20, "sellPrice": 8,
  "description": "Wrapping junk in tape solves everything.", "weight": 1
},
"emergency_rebuild": {
  "id": "emergency_rebuild", "name": "Emergency Rebuild Kit", "type": "consumable",
  "subtype": "golem_rebuild", "effect": "rebuild_golem",
  "rarity": "rare", "buyPrice": 80, "sellPrice": 32,
  "description": "If your friend falls apart, this puts them back together. Badly.", "weight": 3
}
```

### loot-tables.json — Add golem items to drops

Add to underground+ loot tables:
```json
{ "itemId": "scrap_patch", "weight": 6, "minRarity": "common" },
{ "itemId": "rust_remover", "weight": 3, "minRarity": "uncommon" },
{ "itemId": "overclock_juice", "weight": 3, "minRarity": "uncommon" }
```

Rare items (spare_parts_kit, emergency_rebuild) appear in elite/boss loot and merchant stock only.

### runSave.js — Add golem to save payload

```javascript
function buildSavePayload(state, charId) {
  return {
    ...existing,
    golem: state.golem || null,  // full golem state object
  }
}
```

### montor-dialogue.json — Add golem reactions

```json
"golem_reactions": {
  "first_build": "You made... a THING. Out of MY belongings. I suppose I should be flattered. I'm not.",
  "upgrade": "You're making it BIGGER? In MY house?",
  "death": "...good.",
  "rebuild": "It's back. Of course it's back.",
  "naming": "You NAMED it? You named a pile of rubbish?"
}
```

---

## 6. Implementation Phases

### Phase 1: Golem Data + State (foundation)
**Goal:** Golem exists in game state, persists across rooms, appears in party bar.

| Task | File | Size |
|------|------|------|
| Add `golem` state to Game.jsx | Game.jsx | S |
| Add golem to `buildSavePayload` | runSave.js | S |
| Add golem to saved run restore logic | Game.jsx | S |
| Create golem party bar section (static display only) | Game.jsx | M |
| Create 1 golem sprite (scrapper) | sprites.js | M |
| Add `SpriteRenderer` support for golem sprites | sprites.js | S |

**Test:** Hardcode a golem object, verify it appears in party bar with HP/name/stats. Save and reload — golem persists.

### Phase 2: Junk Mechanic NPC + Build Flow
**Goal:** Player can build a golem at the Junk Mechanic room.

| Task | File | Size |
|------|------|------|
| Add `junk_mechanic` room type handling | Game.jsx | M |
| Add mechanic room to 1-2 zone templates | zones.json | S |
| Create Junk Mechanic NPC sprite | sprites.js | M |
| Build UI: name input + chassis selection | Game.jsx | M |
| Junk deduction logic | Game.jsx | S |
| Golem creation from chassis selection | Game.jsx | S |
| Mechanic NPC greeting/personality text | Game.jsx | S |

**Test:** Enter mechanic room, build a golem, see it appear in party bar. Leave room, re-enter — mechanic shows upgrade state.

### Phase 3: Golem in Combat (the big one)
**Goal:** Golem takes turns, attacks enemies, can be targeted and killed.

| Task | File | Size |
|------|------|------|
| Add golem to initiative order | combat.js or Game.jsx | M |
| Add `golemWindup` and `golemRolling` combat phases | Game.jsx | M |
| Golem AI — action selection per chassis | Game.jsx (new function) | L |
| Golem attack resolution (reuse calculateTierDamage) | combat.js | M |
| Enemy target selection — split player/golem | combat.js | M |
| Golem taking damage — HP reduction, condition application | Game.jsx | M |
| Golem death in combat — remove from turn order, UI update | Game.jsx | M |
| Golem turn UI rendering (amber turn panel, auto-roll) | Game.jsx | M |
| Combat log messages for golem actions | Game.jsx | S |
| Golem conditions tick on its turn | combat.js | S |

**Test:** Enter combat with golem. Golem takes turns, attacks enemies, enemies sometimes target golem. Golem can die. Combat still works without golem.

### Phase 4: Upgrade System
**Goal:** Spend junk at mechanic to upgrade golem stats and abilities.

| Task | File | Size |
|------|------|------|
| Upgrade cost scaling logic | Game.jsx | S |
| Random upgrade option generation (weighted by chassis) | Game.jsx | M |
| Stat upgrade application (+HP, +STR, +DEF, +AGI) | Game.jsx | S |
| Active module system — equip/replace | Game.jsx | M |
| Module effects in combat (Flame Jet, Taunt, Patch Up, etc.) | Game.jsx + combat.js | L |
| Passive upgrade system (Thorns, Regen Coil, etc.) | Game.jsx + combat.js | M |
| Upgrade UI in mechanic overlay | Game.jsx | M |
| Module cooldown tracking per combat | Game.jsx | S |

**Test:** Upgrade golem, see stats change. Module abilities fire in combat. Passives apply.

### Phase 5: Repair + Rebuild + Golem Items
**Goal:** Golem can be repaired, rebuilt after death, healed with items.

| Task | File | Size |
|------|------|------|
| Repair flow at mechanic (2 junk → full HP) | Game.jsx | S |
| Rebuild flow at mechanic (4 junk → base stats) | Game.jsx | S |
| Add golem consumable items to items.json | items.json | S |
| Add golem items to loot tables | loot-tables.json | S |
| "Use Item" in combat — golem heal/buff items | Game.jsx | M |
| Emergency Rebuild item (rebuild without mechanic) | Game.jsx | S |
| Add golem items to merchant stock | zones.json / Game.jsx | S |

**Test:** Golem takes damage, repair at mechanic. Golem dies, rebuild. Use Scrap Patch in combat.

### Phase 6: Polish + Remaining Sprites + Balance
**Goal:** All 4 chassis sprites, NPC sprites, Montor reactions, balance pass.

| Task | File | Size |
|------|------|------|
| Create bulwark, mender, tinker sprites | sprites.js | M |
| Create golem corpse sprites (4) | sprites.js | M |
| Create floor-specific mechanic NPC sprites | sprites.js | M |
| Add mechanic rooms to ALL zone templates | zones.json | S |
| Montor dialogue reactions | montor-dialogue.json | S |
| Junk weight penalty implementation | Game.jsx | S |
| Balance pass — golem stats vs enemy scaling per floor | enemies.json / data | M |
| Tinker passive abilities (scout, loot magnet) | Game.jsx | M |

**Test:** Full playthrough with each chassis type. Balance feels right. Sprites look good.

---

## 7. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Combat turn flow gets complex with 3+ actor types | Golem uses same phase pattern as enemies — no new architecture, just a new phase colour |
| Golem AI picks bad targets | Start simple (attack lowest HP), iterate based on playtesting |
| Golem too strong / trivialises combat | Base damage = 60% of player. Low HP pool. No self-healing (unless Mender chassis) |
| Golem too weak / not worth building | Upgrade system lets it scale. Even base chassis provides meaningful DPS/tank/heal |
| Save payload too large with golem state | Golem state is ~20 fields max. Negligible vs existing payload |
| Performance with extra combat participant | One extra turn per round. Existing enemy tick handles 3+ enemies fine. No concern |

---

## 8. What This Replaces

All other junk trade ideas are **scrapped** in favour of the golem system:
- ~~Weapon enchant trades~~ → Scrapper golem with Flame Jet / Acid Spit does this
- ~~Stat tonic trades~~ → Upgrade golem stats instead
- ~~Map fragment trades~~ → Tinker golem has Scout Ahead passive
- ~~Montor's Favour trades~~ → Mood stays tidiness-based (separate system)

The previous `junk_trade_spec.md` is superseded by this spec. Junk has one purpose: **build and feed your golem.**
