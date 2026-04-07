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
function applyCondition(statusEffects, conditionId, source, options) {
  var def = CONDITIONS[conditionId]
  if (!def) return statusEffects

  // BLEED stacks — increase damage instead of replacing
  if (def.stackable) {
    var existing = statusEffects.find(function(c) { return c.id === def.id })
    if (existing) {
      var maxStacks = (options && options.maxStacksBonus) ? (def.maxStacks || 5) + options.maxStacksBonus : (def.maxStacks || 5)
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
          // Flag for callers to detect and log
          newEffects._bleedTriggeredFear = true
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
    forceCrit: def.forceCrit || false,
    triggersOnExpiry: def.triggersOnExpiry || null,
    missChance: def.missChance || 0,
    allRollsMod: def.allRollsMod || 0,
    attacksRandom: def.attacksRandom || false,
    fleeIfLowHp: def.fleeIfLowHp || false,
    blockItems: def.blockItems || false,
    canFlee: def.canFlee !== undefined ? def.canFlee : true,
    healPerKill: def.healPerKill || 0,
    damagePerNoKill: def.damagePerNoKill || 0,
    strPenalty: def.strPenalty || 0,
    defPenalty: def.defPenalty || 0,
    intPenalty: def.intPenalty || 0,
    regenPenalty: def.regenPenalty || 0,
    triggerFear: def.triggerFear || 0,
    damageTakenMultiplier: def.damageTakenMultiplier || 1,
  }

  // Re-applying the SAME condition refreshes it, preserving accumulated state
  // DIFFERENT conditions coexist — no slot replacement (you can be poisoned AND burning)
  var existing = statusEffects.find(function(c) { return c.id === def.id })
  if (existing) {
    // Keep accumulated stat drain progress
    if (existing.drainedStats) condition.drainedStats = Object.assign({}, existing.drainedStats)
    if (existing.statDrainIndex) condition.statDrainIndex = existing.statDrainIndex
    // Replace same condition (refresh duration)
    var filtered = statusEffects.filter(function(c) { return c.id !== def.id })
    return filtered.concat([condition])
  }
  // New condition — add alongside existing ones
  return statusEffects.concat([condition])
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
// Condition tick priority — consistent display order
var TICK_PRIORITY = { BLEED: 1, POISON: 2, BURN: 3, FROST: 4, WET: 5, CHARGED: 6, NAUSEA: 7, SLUGGISH: 8, ADRENALINE: 9, ADRENALINE_CRASH: 10, BLOODLUST: 11, FEAR: 12, DAZE: 13, CHARM: 14, BLIND: 15, FRENZY: 16, BORED: 17, SAD: 18 }

function tickConditions(statusEffects, currentHp, maxHp) {
  var damage = 0
  var skipped = false
  var narratives = []
  var newEffects = []
  var aoeDamage = 0

  // Sort by priority so conditions always tick in consistent order
  var sorted = statusEffects.slice().sort(function(a, b) {
    return (TICK_PRIORITY[a.id] || 50) - (TICK_PRIORITY[b.id] || 50)
  })

  // SEPSIS check: if both BLEED and POISON active, 30% chance for nasty bonus damage
  var hasBleed = sorted.some(function(c) { return c.id === 'BLEED' })
  var hasPoison = sorted.some(function(c) { return c.id === 'POISON' })
  var sepsisProc = hasBleed && hasPoison && Math.random() < 0.30
  var sepsisBonusDamage = 0
  if (sepsisProc) {
    // Flat 4 bonus damage on top of doubled DoT — makes SEPSIS feel dangerous
    sepsisBonusDamage = 4
    damage += sepsisBonusDamage
    narratives.push('SEPSIS! Poison in the bloodstream — ' + sepsisBonusDamage + ' sepsis damage + DoT doubles!')
  }

  for (var i = 0; i < sorted.length; i++) {
    var c = Object.assign({}, sorted[i])

    // BLEED — stacking DoT, lasts until cured
    if (c.damagePerTurn > 0 && !c.burstDamage) {
      var dotDmg = sepsisProc ? c.damagePerTurn * 2 : c.damagePerTurn
      damage += dotDmg
      narratives.push(c.name + ': ' + dotDmg + ' damage.' + (sepsisProc ? ' (SEPSIS)' : ''))
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

    // Skip chance (NAUSEA, CHARM, BURN, BORED)
    if (c.skipChance > 0 && !skipped) {
      if (Math.random() < c.skipChance) {
        skipped = true
        var skipReasons = {
          'Burning': 'Flailing in panic — turn lost!',
          'Dazed': 'Stunned — seeing stars — turn lost!',
          'Nauseous': 'Retching — turn lost!',
          'Charmed': 'Staring dreamily into nothing — turn lost!',
          'Bored': 'Yawning mid-fight — turn lost!',
          'Crash': 'Adrenaline crash — body gave out!',
        }
        narratives.push(skipReasons[c.name] || c.name + ' — turn lost!')
      }
    }

    // FEAR: fight-or-flight if HP < 50%
    if (c.fleeIfLowHp && currentHp < maxHp * 0.5 && !skipped) {
      if (Math.random() < 0.5) {
        // Flight — paralysed
        narratives.push('Paralysed with fear — turn lost!')
        skipped = true
      } else {
        // Fight — adrenaline surge, apply ADRENALINE condition
        narratives.push('ADRENALINE! Fear triggers fight response — +6 STR!')
        var adrenalineDef = CONDITIONS['ADRENALINE']
        if (adrenalineDef) {
          // Remove existing body condition to make room, then add ADRENALINE
          newEffects = newEffects.filter(function(e) { return e.slot !== 'body' })
          newEffects.push(applyCondition([], 'ADRENALINE', 'fear_response')[0])
        }
      }
    }

    // Tick down duration (null = permanent until cured)
    if (c.turnsRemaining !== null) {
      c.turnsRemaining--
      if (c.turnsRemaining <= 0) {
        narratives.push(c.name + ' wears off.')
        // Trigger follow-up condition on expiry (e.g. ADRENALINE → CRASH)
        if (c.triggersOnExpiry && CONDITIONS[c.triggersOnExpiry]) {
          var followUp = applyCondition([], c.triggersOnExpiry, 'expiry')[0]
          if (followUp) {
            // Don't add yet — collect and add after loop to avoid slot conflicts
            newEffects = newEffects.filter(function(e) { return e.slot !== followUp.slot })
            newEffects.push(followUp)
            narratives.push(followUp.name + ' kicks in.')
          }
        }
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
    if (stat === 'str' && c.strPenalty) mod += c.strPenalty
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

// Check if next attack is forced to crit (ADRENALINE)
function hasForceCrit(statusEffects) {
  for (var i = 0; i < statusEffects.length; i++) {
    if (statusEffects[i].forceCrit) return true
  }
  return false
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

// Get damage taken multiplier (FROST brittle effect)
function getDamageTakenMultiplier(statusEffects) {
  var mul = 1
  for (var i = 0; i < statusEffects.length; i++) {
    if (statusEffects[i].damageTakenMultiplier && statusEffects[i].damageTakenMultiplier > 1) {
      mul = Math.max(mul, statusEffects[i].damageTakenMultiplier)
    }
  }
  return mul
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
// CONDITION REACTIONS — triggered when two conditions coexist
// ============================================================

var REACTIONS = [
  { a: 'FROST', b: 'BURN',   name: 'SHATTER',        damage: 10, removeBoth: true,  applyEffect: { defPenalty: true, defPenaltyValue: -99, turns: 2 }, narrative: 'SHATTER! Frozen enemy cracks from the heat — DEF destroyed!' },
  { a: 'WET',   b: 'FROST',  name: 'INSTANT FREEZE',  damage: 5,  removeBoth: true,  applyCondition: 'DAZE', applyTurns: 2, applyEffect: { defPenalty: true, defPenaltyValue: -3, turns: 2 }, narrative: 'INSTANT FREEZE! Soaked enemy freezes solid — brittle and stunned!' },
  { a: 'WET',   b: 'BURN',   name: 'STEAM',           damage: 0,  removeBoth: true,  applyConditionAll: 'BLIND', narrative: 'STEAM! Fire meets water — blinding cloud fills the chamber!' },
  { a: 'WET',   b: 'CHARGED', name: 'CONDUCTANCE',    damage: 8,  removeBoth: true,  applyConditionAll: 'DAZE', narrative: 'CONDUCTANCE! Water conducts the charge — 8 AoE damage + all enemies stunned!' },
  // SEPSIS is handled per-tick in tickConditions, not as a reaction here
  { a: 'FEAR',  b: 'BLEED',  name: 'FRENZY',          damage: 0,  removeBoth: true,  applyCondition: 'FRENZY', narrative: 'FRENZY! Bleeding and terrified — enemy goes berserk!', requireSource: { a: 'FEAR', notSource: 'bleed_panic' } },
  { a: 'DAZE',  b: 'FEAR',   name: 'CATATONIC',       damage: 0,  removeBoth: true,  applyCondition: 'DAZE', applyTurns: 2, narrative: 'CATATONIC! Mind shuts down completely!' },
  { a: 'POISON', b: 'NAUSEA', name: 'DYSENTERY',      damage: 3,  removeBoth: true,  applyCondition: 'NAUSEA', applyTurns: 3, narrative: 'DYSENTERY! Poison and nausea combine — the body gives up!' },
  { a: 'POISON', b: 'FEAR',   name: 'DELIRIUM',       damage: 0,  removeBoth: true,  applyCondition: 'FRENZY', narrative: 'DELIRIUM! Poisoned mind snaps — hallucinating and swinging wild!' },
  { a: 'POISON', b: 'FROST',  name: 'NECROSIS',       damage: 5,  removeBoth: true,  applyEffect: { defPenalty: true, defPenaltyValue: -2, turns: 99 }, narrative: 'NECROSIS! Frozen poison eats tissue — permanent damage!' },
]

// Check for reactions after a condition is applied
// Returns { reaction, narrative, damage, newEffects, aoeCondition } or null
function checkConditionReactions(statusEffects) {
  for (var ri = 0; ri < REACTIONS.length; ri++) {
    var r = REACTIONS[ri]
    var hasA = statusEffects.some(function(c) { return c.id === r.a })
    var hasB = statusEffects.some(function(c) { return c.id === r.b })
    if (hasA && hasB) {
      // Source check — some reactions only fire if condition came from specific source
      if (r.requireSource) {
        var sourceCondition = statusEffects.find(function(c) { return c.id === r.requireSource.a })
        if (sourceCondition && sourceCondition.source === r.requireSource.notSource) continue
      }
      // Proc chance — some reactions only trigger X% of the time
      if (r.procChance && Math.random() > r.procChance) continue

      var result = { reaction: r.name, narrative: r.narrative, damage: r.damage || 0, aoeCondition: null }

      // Remove source conditions if specified
      if (r.removeBoth) {
        statusEffects = statusEffects.filter(function(c) { return c.id !== r.a && c.id !== r.b })
      }

      // Apply a new condition to this entity
      if (r.applyCondition) {
        statusEffects = applyCondition(statusEffects, r.applyCondition, 'reaction')
        // Override duration if specified
        if (r.applyTurns) {
          var applied = statusEffects.find(function(c) { return c.id === r.applyCondition })
          if (applied) applied.turnsRemaining = r.applyTurns
        }
      }

      // Apply DEF penalty
      if (r.applyEffect && r.applyEffect.defPenalty) {
        // Store as a temporary condition-like effect
        statusEffects = applyCondition(statusEffects, 'SLUGGISH', 'reaction')
        var sluggish = statusEffects.find(function(c) { return c.id === 'SLUGGISH' && c.source === 'reaction' })
        if (sluggish) {
          sluggish.turnsRemaining = r.applyEffect.turns
          sluggish.defPenalty = r.applyEffect.defPenaltyValue
          sluggish.name = 'Shattered'
        }
      }

      // SEPSIS: flag for per-tick double (handled in tickConditions, not here)
      if (r.doubleDot) {
        result.sepsisActive = true
      }

      // AoE condition to apply to ALL enemies (caller must handle)
      if (r.applyConditionAll) {
        result.aoeCondition = r.applyConditionAll
      }

      result.newEffects = statusEffects
      return result
    }
  }
  return null
}

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
  hasForceCrit,
  getMissChance,
  areItemsBlocked,
  isFleeBlocked,
  mustAttackRandom,
  getDamageTakenMultiplier,
  getBloodlustEffect,
  rollConditionApplication,
  getEnemyCondition,
  checkConditionReactions,
}
