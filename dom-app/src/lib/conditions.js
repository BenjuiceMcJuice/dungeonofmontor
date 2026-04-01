// Conditions engine — apply, tick, remove, check
// Data loaded from JSON — see src/data/conditions.json for definitions

import { roll } from './dice.js'
import { getModifier } from './classes.js'
import conditionData from '../data/conditions.json'

var CONDITIONS = conditionData.conditions

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
      var newEffects = statusEffects.map(function(c) {
        if (c.id !== def.id) return c
        return Object.assign({}, c, {
          stacks: currentStacks + 1,
          damagePerTurn: (currentStacks + 1), // each stack = +1 damage/turn
          name: 'Bleeding x' + (currentStacks + 1),
        })
      })
      // Trigger FEAR at stack threshold (e.g. 3+ stacks of BLEED) — only once
      if (def.triggerFear && (currentStacks + 1) >= def.triggerFear) {
        var hasFear = newEffects.some(function(c) { return c.id === 'FEAR' })
        var hadFearFromBleed = newEffects.some(function(c) { return c.id === 'FEAR' && c.source === 'bleed_panic' }) ||
          statusEffects.some(function(c) { return c.bleedFearTriggered })
        if (!hasFear && !hadFearFromBleed) {
          newEffects = applyCondition(newEffects, 'FEAR', 'bleed_panic')
          // Mark BLEED as having triggered fear so it doesn't re-trigger
          newEffects = newEffects.map(function(c) {
            if (c.id === def.id) return Object.assign({}, c, { bleedFearTriggered: true })
            return c
          })
        }
      }
      return newEffects
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
    intPenalty: def.intPenalty || 0,
    regenPenalty: def.regenPenalty || 0,
    triggerFear: def.triggerFear || 0,
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
    if (stat === 'int' && c.intPenalty) mod += c.intPenalty
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
  if (attackTier === 1) basePct = 0.90      // crit — almost guaranteed
  else if (attackTier === 2) basePct = 0.50  // hit — coin flip
  else if (attackTier === 3) basePct = 0.20  // glancing — still possible
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

var ENEMY_CONDITIONS = conditionData.enemyConditions

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
