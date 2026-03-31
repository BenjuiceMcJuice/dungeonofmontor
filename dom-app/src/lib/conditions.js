// Conditions engine — apply, tick, remove, check
// Conditions are temporary effects on players and enemies during combat
// One per slot (body/mind) — new condition in same slot replaces old
// See docs/specs/09_Firestore_Data_Model.md §14a for full schema

import { roll } from './dice.js'
import { getModifier } from './classes.js'

// ============================================================
// CONDITION CATALOGUE
// ============================================================

var CONDITIONS = {
  // --- BODY ---
  BLEED: {
    id: 'BLEED', slot: 'body', name: 'Bleeding',
    turns: null, // lasts until cured or combat ends
    damagePerTurn: 1, // starts at 1, stacks add +1 each
    stackable: true, maxStacks: 5,
    description: 'Bleeding. Stacks — each hit adds +1 damage/turn.',
  },
  POISON: {
    id: 'POISON', slot: 'body', name: 'Poisoned',
    turns: 3, damagePerTurn: 2,
    statDrain: true, // each tick drains a different stat: STR → AGI → DEF
    statDrainValue: -1,
    description: 'Poisoned. 2 damage/turn + drains a stat each turn.',
  },
  BURN: {
    id: 'BURN', slot: 'body', name: 'Burning',
    turns: 1, damagePerTurn: 0,
    burstDamage: 5, // one big hit next turn
    aoe: true, // spreads to adjacent enemies/allies
    aoeDamage: 3,
    description: 'On fire. 5 burst damage next turn. Spreads to adjacent.',
  },
  FROST: {
    id: 'FROST', slot: 'body', name: 'Frozen',
    turns: 2,
    statModifier: { stat: 'agi', value: -3 },
    description: 'Sluggish. -3 AGI for 2 turns.',
  },
  NAUSEA: {
    id: 'NAUSEA', slot: 'body', name: 'Nauseous',
    turns: 2, skipChance: 0.3,
    description: 'Retching. 30% chance to skip action.',
  },
  SLUGGISH: {
    id: 'SLUGGISH', slot: 'body', name: 'Sluggish',
    turns: 2,
    statModifier: { stat: 'agi', value: -5 },
    skipFleeChance: 0.5,
    description: 'Heavy. -5 AGI, 50% chance can\'t flee.',
  },

  // --- MIND ---
  FEAR: {
    id: 'FEAR', slot: 'mind', name: 'Afraid',
    turns: 2,
    allRollsMod: -2,
    fleeIfLowHp: true, // flee if HP < 50%
    description: 'Terrified. -2 all rolls. Flee if HP low.',
  },
  FRENZY: {
    id: 'FRENZY', slot: 'mind', name: 'Frenzied',
    turns: 3,
    statModifier: { stat: 'str', value: 3 },
    defPenalty: -2,
    attacksRandom: true,
    description: '+3 STR, -2 DEF. Attacks random target.',
  },
  CHARM: {
    id: 'CHARM', slot: 'mind', name: 'Charmed',
    turns: 2, skipChance: 0.5,
    description: 'Enthralled. 50% chance to skip action.',
  },
  DAZE: {
    id: 'DAZE', slot: 'mind', name: 'Dazed',
    turns: 1, forceTier: 3,
    description: 'Stunned. Next attack is a glancing blow.',
  },
  BORED: {
    id: 'BORED', slot: 'mind', name: 'Bored',
    turns: 2, allRollsMod: -2,
    description: '-2 to all rolls. Montor is unimpressed.',
  },
  SAD: {
    id: 'SAD', slot: 'mind', name: 'Sad',
    turns: 2, blockItems: true,
    description: 'Can\'t use items. What\'s the point?',
  },
  BLIND: {
    id: 'BLIND', slot: 'mind', name: 'Blind',
    turns: 2, missChance: 0.5,
    description: '50% miss chance.',
  },
  BLOODLUST: {
    id: 'BLOODLUST', slot: 'mind', name: 'Bloodlust',
    turns: null, // lasts entire combat
    healPerKill: 3,
    damagePerNoKill: 3,
    canFlee: false,
    description: 'Kill to heal 3. No kill = lose 3. Can\'t flee.',
  },
}

// ============================================================
// APPLY / REMOVE
// ============================================================

// Apply a condition to a combatant's statusEffects array
// One per slot — replaces existing condition in same slot
function applyCondition(statusEffects, conditionId, source) {
  var def = CONDITIONS[conditionId]
  if (!def) return statusEffects

  // BLEED stacks — increase damage instead of replacing
  if (def.stackable) {
    var existing = statusEffects.find(function(c) { return c.id === def.id })
    if (existing) {
      var maxStacks = def.maxStacks || 5
      var currentStacks = existing.stacks || 1
      if (currentStacks >= maxStacks) return statusEffects // capped
      return statusEffects.map(function(c) {
        if (c.id !== def.id) return c
        return Object.assign({}, c, {
          stacks: currentStacks + 1,
          damagePerTurn: (currentStacks + 1), // each stack = +1 damage/turn
          name: 'Bleeding x' + (currentStacks + 1),
        })
      })
    }
  }

  var condition = {
    id: def.id,
    slot: def.slot,
    name: def.name,
    source: source || 'unknown',
    turnsRemaining: def.turns,
    stacks: 1,
    // Copy all mechanical fields
    damagePerTurn: def.damagePerTurn || 0,
    burstDamage: def.burstDamage || 0,
    aoe: def.aoe || false,
    aoeDamage: def.aoeDamage || 0,
    statDrain: def.statDrain || false,
    statDrainValue: def.statDrainValue || 0,
    statDrainIndex: 0, // tracks which stat to drain next: 0=str, 1=agi, 2=def
    statModifier: def.statModifier ? Object.assign({}, def.statModifier) : null,
    skipChance: def.skipChance || 0,
    skipFleeChance: def.skipFleeChance || 0,
    forceTier: def.forceTier || null,
    missChance: def.missChance || 0,
    allRollsMod: def.allRollsMod || 0,
    attacksRandom: def.attacksRandom || false,
    fleeIfLowHp: def.fleeIfLowHp || false,
    blockItems: def.blockItems || false,
    canFlee: def.canFlee !== undefined ? def.canFlee : true,
    healPerKill: def.healPerKill || 0,
    damagePerNoKill: def.damagePerNoKill || 0,
    defPenalty: def.defPenalty || 0,
  }

  // Non-stackable: remove existing condition in same slot, add new one
  var filtered = statusEffects.filter(function(c) { return c.slot !== def.slot })
  return filtered.concat([condition])
}

// Remove a condition by ID
function removeCondition(statusEffects, conditionId) {
  return statusEffects.filter(function(c) { return c.id !== conditionId })
}

// Remove all conditions in a slot
function clearSlot(statusEffects, slot) {
  return statusEffects.filter(function(c) { return c.slot !== slot })
}

// Check if entity has a specific condition
function hasCondition(statusEffects, conditionId) {
  return statusEffects.some(function(c) { return c.id === conditionId })
}

// Get condition in a slot (or null)
function getConditionInSlot(statusEffects, slot) {
  return statusEffects.find(function(c) { return c.slot === slot }) || null
}

// ============================================================
// TICK — called at start of each combatant's turn
// ============================================================

// Returns { newEffects, damage, skipped, narrative }
// Returns { newEffects, damage, skipped, narrative, aoeDamage }
function tickConditions(statusEffects, currentHp, maxHp) {
  var damage = 0
  var skipped = false
  var narratives = []
  var newEffects = []
  var aoeDamage = 0

  for (var i = 0; i < statusEffects.length; i++) {
    var c = Object.assign({}, statusEffects[i])

    // BLEED — stacking DoT, lasts until cured
    if (c.damagePerTurn > 0 && !c.burstDamage) {
      damage += c.damagePerTurn
      narratives.push(c.name + ': ' + c.damagePerTurn + ' damage.')
    }

    // BURN — burst damage, one big hit, then gone. AoE to adjacent.
    if (c.burstDamage > 0) {
      damage += c.burstDamage
      narratives.push('BURN: ' + c.burstDamage + ' burst damage!')
      if (c.aoe) {
        aoeDamage = c.aoeDamage || 3
        narratives.push('Fire spreads! ' + aoeDamage + ' to adjacent.')
      }
    }

    // POISON — stat drain each tick (STR → AGI → DEF cycle)
    if (c.statDrain) {
      var drainStats = ['str', 'agi', 'def']
      var drainIdx = c.statDrainIndex || 0
      var drainStat = drainStats[drainIdx % drainStats.length]
      narratives.push('Poison drains ' + drainStat.toUpperCase() + '.')
      c.statDrainIndex = drainIdx + 1
      // The actual stat modification is applied via getConditionStatMod
      if (!c.drainedStats) c.drainedStats = {}
      c.drainedStats[drainStat] = (c.drainedStats[drainStat] || 0) + (c.statDrainValue || -1)
    }

    // Skip chance (NAUSEA, CHARM)
    if (c.skipChance > 0 && !skipped) {
      if (Math.random() < c.skipChance) {
        skipped = true
        narratives.push(c.name + ': turn skipped!')
      }
    }

    // FEAR: flee if HP < 50%
    if (c.fleeIfLowHp && currentHp < maxHp * 0.5) {
      narratives.push(c.name + ': paralysed with fear.')
      skipped = true
    }

    // Tick down duration (null = permanent until cured)
    if (c.turnsRemaining !== null) {
      c.turnsRemaining--
      if (c.turnsRemaining <= 0) {
        narratives.push(c.name + ' wears off.')
        continue // expired
      }
    }

    newEffects.push(c)
  }

  return {
    newEffects: newEffects,
    damage: damage,
    skipped: skipped,
    narrative: narratives.join(' '),
    aoeDamage: aoeDamage,
  }
}

// ============================================================
// COMBAT MODIFIERS — read active conditions for roll adjustments
// ============================================================

// Get total modifier to all rolls from conditions
function getAllRollsMod(statusEffects) {
  var mod = 0
  for (var i = 0; i < statusEffects.length; i++) {
    if (statusEffects[i].allRollsMod) mod += statusEffects[i].allRollsMod
  }
  return mod
}

// Get total stat modifier from conditions for a specific stat
function getConditionStatMod(statusEffects, stat) {
  var mod = 0
  for (var i = 0; i < statusEffects.length; i++) {
    var c = statusEffects[i]
    if (c.statModifier && c.statModifier.stat === stat) mod += c.statModifier.value
    if (stat === 'def' && c.defPenalty) mod += c.defPenalty
    // Poison accumulated stat drain
    if (c.drainedStats && c.drainedStats[stat]) mod += c.drainedStats[stat]
  }
  return mod
}

// Check if next attack is forced to a specific tier
function getForcedTier(statusEffects) {
  for (var i = 0; i < statusEffects.length; i++) {
    if (statusEffects[i].forceTier) return statusEffects[i].forceTier
  }
  return null
}

// Get extra miss chance from conditions
function getMissChance(statusEffects) {
  var chance = 0
  for (var i = 0; i < statusEffects.length; i++) {
    if (statusEffects[i].missChance) chance = Math.max(chance, statusEffects[i].missChance)
  }
  return chance
}

// Check if items are blocked
function areItemsBlocked(statusEffects) {
  return statusEffects.some(function(c) { return c.blockItems })
}

// Check if flee is blocked
function isFleeBlocked(statusEffects) {
  return statusEffects.some(function(c) { return c.canFlee === false })
}

// Check if attacks must target randomly
function mustAttackRandom(statusEffects) {
  return statusEffects.some(function(c) { return c.attacksRandom })
}

// BLOODLUST: heal on kill, damage on no-kill
function getBloodlustEffect(statusEffects) {
  var c = statusEffects.find(function(c) { return c.id === 'BLOODLUST' })
  if (!c) return null
  return { healPerKill: c.healPerKill, damagePerNoKill: c.damagePerNoKill }
}

// ============================================================
// CONDITION APPLICATION — chance to apply on attack
// ============================================================

// Roll to see if a condition applies on hit
// Base chance from attack tier, modified by INT
function rollConditionApplication(attackTier, intStat, conditionChance) {
  var basePct = 0
  if (attackTier === 1) basePct = 0.80      // crit
  else if (attackTier === 2) basePct = 0.40  // hit
  else if (attackTier === 3) basePct = 0.05  // glancing
  else return false                          // miss

  // INT modifier adds to the percentage
  var intMod = intStat ? getModifier(intStat) : 0
  var finalPct = basePct + (intMod * 0.05)   // each +1 INT mod = +5% chance

  // Additional condition-specific chance modifier
  if (conditionChance) finalPct *= conditionChance

  return Math.random() < Math.min(finalPct, 0.95) // cap at 95%
}

// ============================================================
// ENEMY INNATE CONDITIONS
// ============================================================

// Which conditions each enemy archetype can apply
var ENEMY_CONDITIONS = {
  rat:    { conditionId: 'BLEED',  chance: 1.0 },   // rats cause bleeding
  slug:   { conditionId: 'NAUSEA', chance: 1.0 },   // slugs cause nausea
  orc:    { conditionId: 'FEAR',   chance: 0.5 },    // orcs can intimidate (50% base)
  rock:   { conditionId: 'DAZE',   chance: 1.0 },    // rocks stun you
  wraith: { conditionId: 'BLIND',  chance: 0.7 },    // wraiths blind you
}

function getEnemyCondition(archetypeKey) {
  return ENEMY_CONDITIONS[archetypeKey] || null
}

// ============================================================
// EXPORTS
// ============================================================

export {
  CONDITIONS,
  ENEMY_CONDITIONS,
  applyCondition,
  removeCondition,
  clearSlot,
  hasCondition,
  getConditionInSlot,
  tickConditions,
  getAllRollsMod,
  getConditionStatMod,
  getForcedTier,
  getMissChance,
  areItemsBlocked,
  isFleeBlocked,
  mustAttackRandom,
  getBloodlustEffect,
  rollConditionApplication,
  getEnemyCondition,
}
