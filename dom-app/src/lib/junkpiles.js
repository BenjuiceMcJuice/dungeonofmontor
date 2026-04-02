// Junk Pile generation, inspect, clean-level search, PER/AGI saves
// Data loaded from JSON — see src/data/junk.json

import { roll, rollWithMod } from './dice.js'
import { getModifier } from './classes.js'
import { rollDrop, getFloorLootPrefix } from './loot.js'
import junkData from '../data/junk.json'

var JUNK_POOLS = junkData.junkPools
var CONDITION_HAZARDS = junkData.conditionHazards
var PILE_DESCRIPTIONS = junkData.pileDescriptions

// ============================================================
// PILE COUNTS PER CHAMBER TYPE
// ============================================================

var PILE_COUNTS = {
  combat_standard: { min: 1, max: 3 },
  combat_elite:    { min: 1, max: 3 },
  mini_boss:       { min: 1, max: 2 },
  boss:            { min: 1, max: 1, forceSize: 3 },
  merchant:        { min: 1, max: 2 },
  quest_npc:       { min: 1, max: 2 },
  rest:            { min: 1, max: 2 },
  event:           { min: 1, max: 3 },
  zone_door:       { min: 0, max: 1 },
  keystone:        { min: 1, max: 2 },
  stairwell_entry: { min: 0, max: 1 },
  stairwell_descent: { min: 0, max: 0 },
  empty:           { min: 2, max: 3 },
}

// ============================================================
// RISK LEVELS — hidden until inspected
// ============================================================

var RISK_WEIGHTS = [
  { risk: 1, weight: 25 },
  { risk: 2, weight: 30 },
  { risk: 3, weight: 25 },
  { risk: 4, weight: 15 },
  { risk: 5, weight: 5 },
]

function rollRiskLevel() {
  var total = 0
  for (var i = 0; i < RISK_WEIGHTS.length; i++) total += RISK_WEIGHTS[i].weight
  var r = Math.random() * total
  var cum = 0
  for (var j = 0; j < RISK_WEIGHTS.length; j++) {
    cum += RISK_WEIGHTS[j].weight
    if (r <= cum) return RISK_WEIGHTS[j].risk
  }
  return 3
}

// Inspect hints — accuracy depends on PER roll
var RISK_HINTS = {
  1: { accurate: 'Seems quiet',           vague: 'Hard to tell' },
  2: { accurate: 'Probably fine',          vague: 'Maybe fine?' },
  3: { accurate: 'Something stirs inside', vague: 'Could go either way' },
  4: { accurate: 'Definitely not empty',   vague: 'Got a bad feeling' },
  5: { accurate: 'This will hurt',         vague: 'No idea' },
}

// ============================================================
// CLEAN LEVELS — player chooses how many layers to clean at once
// ============================================================

// Clean level 1/2/3 — must have enough layers remaining
// Reward design: 3× Careful must give LESS total than 1× Deep.
// Per-layer value: Careful=0.3, Thorough=0.85/layer, Deep=1.5/layer
// So 3× Careful = 0.9 total, 1× Deep = 4.5 total. Deep is 5× better but 10× riskier.
var CLEAN_CONFIG = {
  1: {
    label: 'Careful Clean',
    description: 'One layer. Slow and steady.',
    layersCost: 1,
    goldMul: 0.3,
    itemChance: 0.05,
    lootTable: 'standard',
    enemyMul: 0.1,
    conditionMul: 0.1,
    xpMul: 0.3,
    terminalReveal: false,
  },
  2: {
    label: 'Thorough Search',
    description: 'Two layers at once. Some noise.',
    layersCost: 2,
    goldMul: 1.7,
    itemChance: 0.25,
    lootTable: 'elite',
    enemyMul: 1.0,
    conditionMul: 1.0,
    xpMul: 1.7,
    terminalReveal: false,
  },
  3: {
    label: 'Deep Clean',
    description: 'Everything. All at once.',
    layersCost: 3,
    goldMul: 4.5,
    itemChance: 0.50,
    lootTable: 'chest',
    enemyMul: 2.5,
    conditionMul: 2.0,
    xpMul: 4.5,
    terminalReveal: true,
  },
}

// ============================================================
// BASE TABLES — scale with risk level
// ============================================================

function getBaseGold(riskLevel) {
  var ranges = [
    { min: 1, max: 3 },
    { min: 2, max: 5 },
    { min: 3, max: 8 },
    { min: 5, max: 12 },
    { min: 8, max: 18 },
  ]
  var r = ranges[Math.min(riskLevel - 1, ranges.length - 1)]
  return r.min + Math.floor(Math.random() * (r.max - r.min + 1))
}

function getBaseEnemyChance(riskLevel) {
  return [0.0, 0.05, 0.15, 0.30, 0.50][Math.min(riskLevel - 1, 4)]
}

function getBaseConditionChance(riskLevel) {
  return [0.0, 0.05, 0.10, 0.20, 0.35][Math.min(riskLevel - 1, 4)]
}

function getBaseXp(riskLevel) {
  return [3, 5, 8, 12, 18][Math.min(riskLevel - 1, 4)]
}

// ============================================================
// PILE GENERATION
// ============================================================

function generateJunkPiles(chamber, floorId) {
  var config = PILE_COUNTS[chamber.type] || PILE_COUNTS['empty']
  var count = config.min + Math.floor(Math.random() * (config.max - config.min + 1))

  var piles = []
  for (var i = 0; i < count; i++) {
    var size
    if (config.forceSize) {
      size = config.forceSize
    } else {
      var sizeRoll = Math.random()
      size = sizeRoll < 0.6 ? 1 : sizeRoll < 0.9 ? 2 : 3
    }
    piles.push(createPile('pile_' + i, size, floorId))
  }
  return piles
}

function createPile(id, size, floorId) {
  var riskLevel = rollRiskLevel()
  var desc = PILE_DESCRIPTIONS[floorId] || PILE_DESCRIPTIONS['grounds']
  var sizeKey = size === 3 ? 'large' : size === 2 ? 'medium' : 'small'

  return {
    id: id,
    size: size,             // 1, 2, or 3 layers
    layersRemaining: size,  // decremented as layers are cleaned
    depleted: false,
    floorId: floorId,
    riskLevel: riskLevel,
    inspected: false,
    inspectHint: null,
    hasTerminal: false,
    terminalRevealed: false,
    description: desc[sizeKey] || 'A pile of junk',
  }
}

// ============================================================
// TERMINAL PLACEMENT
// ============================================================

function placeTerminal(chambers) {
  var candidates = []
  for (var ci = 0; ci < chambers.length; ci++) {
    var ch = chambers[ci]
    if (!ch.junkPiles) continue
    for (var pi = 0; pi < ch.junkPiles.length; pi++) {
      var pile = ch.junkPiles[pi]
      if (pile.size >= 2) {
        candidates.push({ chamberIdx: ci, pileIdx: pi })
      }
    }
  }

  if (candidates.length === 0) {
    for (var fi = 0; fi < chambers.length; fi++) {
      if (chambers[fi].junkPiles && chambers[fi].junkPiles.length > 0) {
        candidates.push({ chamberIdx: fi, pileIdx: 0 })
        break
      }
    }
  }

  if (candidates.length === 0) return

  var pick = candidates[Math.floor(Math.random() * candidates.length)]
  var pile = chambers[pick.chamberIdx].junkPiles[pick.pileIdx]
  pile.hasTerminal = true
  chambers[pick.chamberIdx].hasTerminal = true
}

// ============================================================
// INSPECT — free action, reveals risk hint
// ============================================================

function inspectPile(pile, perStat) {
  if (pile.inspected) return pile.inspectHint

  var perMod = perStat ? getModifier(perStat) : 0
  var inspectRoll = roll(20) + perMod
  var risk = pile.riskLevel
  var hints = RISK_HINTS[risk] || RISK_HINTS[3]
  var hint

  if (inspectRoll <= 5) {
    // Very low PER — can be MISLEADING (shows wrong risk hint)
    var fakeRisk = Math.max(1, Math.min(5, risk + (Math.random() < 0.5 ? 2 : -2)))
    var fakeHints = RISK_HINTS[fakeRisk] || RISK_HINTS[3]
    hint = fakeHints.accurate  // looks accurate but is wrong
  } else if (inspectRoll <= 9) {
    hint = hints.vague
  } else if (inspectRoll <= 13) {
    hint = hints.accurate
  } else if (inspectRoll <= 17) {
    hint = hints.accurate
    // High PER — add risk number hint
    hint = hint + ' (Risk ' + risk + '/5)'
  } else {
    // Very high PER — exact info
    hint = hints.accurate + ' (Risk ' + risk + '/5)'
    // Terminal sensing
    if (pile.hasTerminal) {
      hint = hint + ' — something hums beneath...'
    }
  }

  pile.inspected = true
  pile.inspectHint = hint
  return hint
}

// ============================================================
// GET AVAILABLE CLEAN LEVELS for a pile
// ============================================================

function getAvailableCleanLevels(pile) {
  var levels = []
  if (pile.layersRemaining >= 1) levels.push(1)
  if (pile.layersRemaining >= 2) levels.push(2)
  if (pile.layersRemaining >= 3) levels.push(3)
  return levels
}

// ============================================================
// SEARCH RESOLUTION
// ============================================================

// Resolve a search at given clean level
// Returns { quality, roll, natRoll, cleanLevel, gold, junk, item,
//           dangerTriggered, dangerType, dangerDetail, perSaveRoll, agiSaveRoll,
//           perSaved, agiSaved, enemy, condition, terminal, xp, narrative }
function resolveSearch(pile, perStat, agiStat, lckStat, cleanLevel) {
  if (pile.depleted || pile.layersRemaining <= 0) return null

  var config = CLEAN_CONFIG[cleanLevel] || CLEAN_CONFIG[1]
  if (pile.layersRemaining < config.layersCost) return null

  var risk = pile.riskLevel
  var floorId = pile.floorId

  // === MAIN SEARCH ROLL ===
  var perMod = perStat ? getModifier(perStat) : 0
  var searchRoll = rollWithMod(20, perMod)
  var natRoll = searchRoll.roll
  var total = searchRoll.total

  var quality
  if (natRoll === 1) quality = 'fumble'
  else if (total <= 7) quality = 'poor'
  else if (total <= 13) quality = 'decent'
  else if (total <= 18) quality = 'good'
  else quality = 'excellent'

  var result = {
    quality: quality,
    roll: total,
    natRoll: natRoll,
    cleanLevel: cleanLevel,
    cleanLabel: config.label,
    gold: 0,
    junk: null,
    item: null,
    // Danger
    dangerTriggered: false,
    dangerType: null,     // 'enemy' | 'condition'
    dangerDetail: null,   // enemy type or condition ID
    perSaveRoll: null,
    agiSaveRoll: null,
    perSaved: false,
    agiSaved: false,
    enemy: null,          // null | 'ambush' | 'normal' | 'spotted'
    condition: null,      // condition ID or null
    // Other
    terminal: false,
    xp: 0,
    narrative: [],
    pileId: pile.id,
  }

  // === GOLD ===
  var baseGold = getBaseGold(risk)
  result.gold = Math.max(1, Math.round(baseGold * config.goldMul))
  if (quality === 'fumble' || quality === 'poor') result.gold = Math.max(1, Math.floor(result.gold * 0.5))
  if (quality === 'excellent') result.gold = Math.round(result.gold * 1.5)

  // === JUNK ITEM ===
  // LCK affects whether you find consumable vs useless junk
  // Higher LCK = more likely to find consumable (useful) junk
  var floorPool = JUNK_POOLS[floorId] || JUNK_POOLS['grounds']
  var useless = floorPool.useless || []
  var consumable = floorPool.consumable || []
  var lckMod = lckStat ? getModifier(lckStat) : 0
  // Base 30% chance of consumable, +5% per LCK mod
  var consumableChance = Math.min(0.7, Math.max(0.1, 0.30 + lckMod * 0.05))
  if (consumable.length > 0 && Math.random() < consumableChance) {
    var picked = consumable[Math.floor(Math.random() * consumable.length)]
    result.junk = Object.assign({}, picked, { consumable: true })
  } else if (useless.length > 0) {
    result.junk = Object.assign({}, useless[Math.floor(Math.random() * useless.length)], { consumable: false })
  } else {
    result.junk = null
  }

  // === REAL ITEM ===
  var prefix = getFloorLootPrefix(floorId)
  var tableId = prefix + '_' + config.lootTable
  if (Math.random() < config.itemChance) {
    if (quality === 'fumble' || quality === 'poor') {
      result.narrative.push('You missed something buried deeper...')
    } else if (quality === 'decent') {
      if (Math.random() < 0.5) result.item = rollDrop(tableId, 10)
      else result.narrative.push('Something glints but slips away...')
    } else {
      result.item = rollDrop(tableId, 10)
    }
  }

  // === DANGER: ENEMY ===
  var enemyChance = getBaseEnemyChance(risk) * config.enemyMul
  if (enemyChance > 0 && Math.random() < enemyChance) {
    result.dangerTriggered = true
    result.dangerType = 'enemy'

    // PER save — can you spot it before it gets you?
    var perSave = rollWithMod(20, perMod)
    result.perSaveRoll = perSave.total

    if (perSave.total >= 15) {
      // Spotted it — player chooses fight or flee
      result.perSaved = true
      result.enemy = 'spotted'
      result.narrative.push('You spot something lurking — back away or fight?')
    } else if (perSave.total >= 10) {
      // Heard it — normal combat (no ambush)
      result.enemy = 'normal'
      result.narrative.push('Something bursts from the pile!')
    } else {
      // Ambush — enemy gets free first strike
      result.enemy = 'ambush'
      result.narrative.push('AMBUSH! Something lunges from the junk!')
    }
  }

  // === DANGER: CONDITION/TRAP ===
  var condChance = getBaseConditionChance(risk) * config.conditionMul
  if (!result.dangerTriggered && condChance > 0 && Math.random() < condChance) {
    var condPool = CONDITION_HAZARDS[floorId] || ['NAUSEA']
    var condId = condPool[Math.floor(Math.random() * condPool.length)]
    result.dangerTriggered = true
    result.dangerType = 'condition'
    result.dangerDetail = condId

    // AGI save — can you dodge the hazard?
    var agiMod = agiStat ? getModifier(agiStat) : 0
    var agiSave = rollWithMod(20, agiMod)
    result.agiSaveRoll = agiSave.total

    if (agiSave.total >= 13) {
      // Dodged it
      result.agiSaved = true
      result.narrative.push('Trap! But you dodge it — ' + condId + ' avoided!')
    } else {
      // Hit by it
      result.condition = condId
      result.narrative.push('TRAP! ' + condId + '!')
    }
  }

  // === TERMINAL ===
  // Only revealed by clean level 3 (deep clean) that fully depletes the pile
  if (pile.hasTerminal && !pile.terminalRevealed && config.terminalReveal) {
    // Check this clean would deplete the pile
    if (pile.layersRemaining - config.layersCost <= 0) {
      result.terminal = true
      pile.terminalRevealed = true
      result.narrative.push('Beneath everything... a terminal hums faintly.')
    }
  }

  // === XP ===
  var baseXp = getBaseXp(risk)
  var xpQualMul = { fumble: 0.25, poor: 0.5, decent: 1, good: 1.5, excellent: 2 }
  result.xp = Math.max(1, Math.round(baseXp * config.xpMul * (xpQualMul[quality] || 1)))

  // === QUALITY NARRATIVE ===
  var qualityText = {
    fumble: 'Fumble!',
    poor: 'Slim pickings.',
    decent: 'Found something.',
    good: 'Nice haul!',
    excellent: 'Jackpot!',
  }
  result.narrative.unshift(qualityText[quality] || '')

  return result
}

// Apply search — consume layers, mark depleted
function applySearch(pile, cleanLevel) {
  var config = CLEAN_CONFIG[cleanLevel] || CLEAN_CONFIG[1]
  pile.layersRemaining = Math.max(0, pile.layersRemaining - config.layersCost)
  if (pile.layersRemaining <= 0) {
    pile.depleted = true
  }
}

// ============================================================
// JUNK CONSUME — risk/reward based on consumeRisk + LCK
// ============================================================

var CONSUME_RISK_TABLE = junkData.consumeRiskTable

// Inspect a consumable junk item — PER determines how much you learn
function inspectJunkItem(junkItem, perStat) {
  if (!junkItem.consumable || !junkItem.consumeRisk) return '???'

  var perMod = perStat ? getModifier(perStat) : 0
  var inspectRoll = roll(20) + perMod
  var risk = junkItem.consumeRisk
  var riskInfo = CONSUME_RISK_TABLE[String(risk)]

  if (inspectRoll <= 5) {
    // Very low — no clue
    return '???'
  } else if (inspectRoll <= 9) {
    // Vague
    var vague = ['Looks dodgy', 'Might be useful', 'Risky', 'Who knows']
    return vague[Math.floor(Math.random() * vague.length)]
  } else if (inspectRoll <= 13) {
    // Directional
    return riskInfo ? riskInfo.label : 'Unknown risk'
  } else if (inspectRoll <= 17) {
    // Good — risk label + likely outcome
    var likely = (riskInfo && riskInfo.goodChance >= 0.5) ? 'Likely helpful' : 'Likely harmful'
    return likely + ' (' + (riskInfo ? riskInfo.label : '???') + ')'
  } else {
    // Exact — show what it does
    var goodText = junkItem.good ? junkItem.good.text : '?'
    var badText = junkItem.bad ? junkItem.bad.text : '?'
    return 'Good: ' + goodText + ' / Bad: ' + badText
  }
}

// Consume a junk item — returns { success, effect }
// LCK nudges the good/bad chance in your favour
function consumeJunk(junkItem, lckStat) {
  if (!junkItem.consumable || !junkItem.consumeRisk) return null

  var risk = junkItem.consumeRisk
  var riskInfo = CONSUME_RISK_TABLE[String(risk)]
  var baseGoodChance = riskInfo ? riskInfo.goodChance : 0.5

  // LCK modifier adjusts chance: +3% per LCK mod
  var lckMod = lckStat ? getModifier(lckStat) : 0
  var goodChance = Math.min(0.95, Math.max(0.05, baseGoodChance + lckMod * 0.03))

  var isGood = Math.random() < goodChance

  if (isGood && junkItem.good) {
    return { success: true, effect: Object.assign({}, junkItem.good), narrative: junkItem.good.text }
  } else if (junkItem.bad) {
    return { success: false, effect: Object.assign({}, junkItem.bad), narrative: junkItem.bad.text }
  }
  return { success: false, effect: null, narrative: 'Nothing happens.' }
}

// ============================================================
// EXPORTS
// ============================================================

export {
  generateJunkPiles,
  placeTerminal,
  inspectPile,
  getAvailableCleanLevels,
  resolveSearch,
  applySearch,
  inspectJunkItem,
  consumeJunk,
  CLEAN_CONFIG,
  PILE_COUNTS,
  PILE_DESCRIPTIONS,
}
