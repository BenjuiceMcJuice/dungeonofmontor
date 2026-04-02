// Junk Pile generation, inspect, clean-level search, PER/AGI saves
// Data loaded from JSON — see src/data/junk.json

import { roll, rollWithMod } from './dice.js'
import { getModifier } from './classes.js'
import { rollDrop, getFloorLootPrefix } from './loot.js'
import junkData from '../data/junk.json'

var JUNK_POOLS = junkData.junkPools
var CONDITION_HAZARDS = junkData.conditionHazards
var TREASURES = junkData.treasures
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
  stairwell_entry: { min: 1, max: 2 },
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
// Per-layer: Careful=0.4, Thorough=1.0/layer, Deep=1.8/layer
// 3× Careful = 1.2 total. 1× Deep = 5.5 total. Deep is ~4.5× better but much riskier.
var CLEAN_CONFIG = {
  1: {
    label: 'Careful Clean',
    description: 'One layer. Slow and steady.',
    layersCost: 1,
    goldMul: 0.4,
    itemChance: 0.15,
    lootTable: 'standard',
    enemyMul: 0.2,
    conditionMul: 0.3,
    xpMul: 0.4,
    terminalReveal: false,
  },
  2: {
    label: 'Thorough Search',
    description: 'Two layers at once. Some noise.',
    layersCost: 2,
    goldMul: 2.0,
    itemChance: 0.40,
    lootTable: 'elite',
    enemyMul: 1.0,
    conditionMul: 1.0,
    xpMul: 2.0,
    terminalReveal: false,
  },
  3: {
    label: 'Deep Clean',
    description: 'Everything. All at once.',
    layersCost: 3,
    goldMul: 5.5,
    itemChance: 0.60,
    lootTable: 'chest',
    enemyMul: 2.5,
    conditionMul: 2.0,
    xpMul: 5.5,
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
  return [0.05, 0.15, 0.25, 0.40, 0.60][Math.min(riskLevel - 1, 4)]
}

function getBaseConditionChance(riskLevel) {
  return [0.05, 0.15, 0.25, 0.35, 0.50][Math.min(riskLevel - 1, 4)]
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
  // Prefer size 3 piles, then size 2, then any pile
  var candidates3 = []
  var candidates2 = []
  var candidatesAny = []
  for (var ci = 0; ci < chambers.length; ci++) {
    var ch = chambers[ci]
    if (!ch.junkPiles) continue
    for (var pi = 0; pi < ch.junkPiles.length; pi++) {
      var pile = ch.junkPiles[pi]
      if (pile.size >= 3) candidates3.push({ chamberIdx: ci, pileIdx: pi })
      else if (pile.size >= 2) candidates2.push({ chamberIdx: ci, pileIdx: pi })
      else candidatesAny.push({ chamberIdx: ci, pileIdx: pi })
    }
  }
  var candidates = candidates3.length > 0 ? candidates3 : candidates2.length > 0 ? candidates2 : candidatesAny

  if (candidates.length === 0) return

  var pick = candidates[Math.floor(Math.random() * candidates.length)]
  var pile = chambers[pick.chamberIdx].junkPiles[pick.pileIdx]
  pile.hasTerminal = true
  chambers[pick.chamberIdx].hasTerminal = true
}

// ============================================================
// TREASURE PLACEMENT — one gift treasure per floor, hidden in a pile
// ============================================================

function placeTreasure(chambers, floorId, collectedTreasures) {
  var treasure = TREASURES[floorId]
  if (!treasure) return
  // Skip if already collected this treasure
  if (collectedTreasures && collectedTreasures.indexOf(treasure.id) !== -1) return

  // Pick a random pile (any size — treasure can be anywhere)
  var candidates = []
  for (var ci = 0; ci < chambers.length; ci++) {
    var ch = chambers[ci]
    if (!ch.junkPiles) continue
    for (var pi = 0; pi < ch.junkPiles.length; pi++) {
      candidates.push({ chamberIdx: ci, pileIdx: pi })
    }
  }
  if (candidates.length === 0) return

  var pick = candidates[Math.floor(Math.random() * candidates.length)]
  var pile = chambers[pick.chamberIdx].junkPiles[pick.pileIdx]
  pile.hasTreasure = true
  pile.treasureData = treasure
}

// Get treasure data for a floor
function getTreasure(floorId) {
  return TREASURES[floorId] || null
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
    // Treasure sensing
    if (pile.hasTreasure) {
      hint = hint + ' — ' + pile.treasureData.perHint
    }
  }

  // Treasure sensing at lower PER threshold (14+)
  if (inspectRoll >= 14 && pile.hasTreasure && pile.treasureData) {
    if (hint.indexOf(pile.treasureData.perHint) === -1) {
      hint = hint + ' — ' + pile.treasureData.perHint
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
  if (quality === 'fumble') { result.gold = Math.max(1, Math.floor(result.gold * 0.3)) }
  else if (quality === 'poor') { result.gold = Math.max(1, Math.floor(result.gold * 0.6)) }
  else if (quality === 'good') { result.gold = Math.round(result.gold * 1.3) }
  else if (quality === 'excellent') { result.gold = Math.round(result.gold * 2.0) }

  // === JUNK ITEM ===
  // LCK affects: consumable vs useless junk (higher LCK = better junk)
  var floorPool = JUNK_POOLS[floorId] || JUNK_POOLS['grounds']
  var useless = floorPool.useless || []
  var consumable = floorPool.consumable || []
  var lckMod = lckStat ? getModifier(lckStat) : 0
  var consumableChance = Math.min(0.7, Math.max(0.1, 0.30 + lckMod * 0.05))
  if (consumable.length > 0 && Math.random() < consumableChance) {
    var picked = consumable[Math.floor(Math.random() * consumable.length)]
    result.junk = Object.assign({}, picked, { consumable: true })
    if (lckMod >= 2) result.narrative.push('Lucky find!')
  } else if (useless.length > 0) {
    result.junk = Object.assign({}, useless[Math.floor(Math.random() * useless.length)], { consumable: false })
  } else {
    result.junk = null
  }

  // === REAL ITEM ===
  // LCK boosts item find chance: +3% per LCK mod
  var prefix = getFloorLootPrefix(floorId)
  var tableId = prefix + '_' + config.lootTable
  var adjustedItemChance = Math.min(0.85, config.itemChance + lckMod * 0.03)
  if (Math.random() < adjustedItemChance) {
    if (quality === 'fumble') {
      result.narrative.push('Something was here... but you fumbled past it.')
    } else if (quality === 'poor') {
      if (Math.random() < 0.3) {
        result.item = rollDrop(tableId, lckStat || 10)
        result.narrative.push('Almost missed it — something useful!')
      } else {
        result.narrative.push('You sense something buried deeper... but can\'t reach it.')
      }
    } else if (quality === 'decent') {
      if (Math.random() < 0.7) {
        result.item = rollDrop(tableId, lckStat || 10)
      } else {
        result.narrative.push('Something glints but slips away...')
      }
    } else {
      // Good or excellent — always find it
      result.item = rollDrop(tableId, lckStat || 10)
      if (quality === 'excellent') result.narrative.push('Your keen eye spots something others would miss.')
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
  // Terminal revealed when you fully deplete the pile (any clean level that reaches the bottom)
  if (pile.hasTerminal && !pile.terminalRevealed) {
    if (pile.layersRemaining - config.layersCost <= 0) {
      result.terminal = true
      pile.terminalRevealed = true
      result.narrative.push('Beneath everything... a terminal hums faintly.')
    }
  }

  // === TREASURE ===
  // Montor's gift treasure — found when you search the pile that contains it
  if (pile.hasTreasure && pile.treasureData) {
    result.treasure = Object.assign({}, pile.treasureData)
    pile.hasTreasure = false // consumed — won't appear again
  }

  // === XP ===
  var baseXp = getBaseXp(risk)
  var xpQualMul = { fumble: 0.25, poor: 0.5, decent: 1, good: 1.5, excellent: 2 }
  result.xp = Math.max(1, Math.round(baseXp * config.xpMul * (xpQualMul[quality] || 1)))

  // === QUALITY NARRATIVE — with PER/LCK flavour ===
  var qualNarrative = {
    fumble: [
      'Fumble! You knock the pile over.',
      'Fumble! Everything scatters.',
      'Fumble! Your hands find nothing but splinters.',
    ],
    poor: [
      'A clumsy search. Not much here.',
      'You dig blindly. Slim pickings.',
      'Half-hearted effort. Half-hearted results.',
    ],
    decent: [
      'A solid rummage. Something turns up.',
      'Patient work pays off.',
      'Not bad. There\'s more if you look harder.',
    ],
    good: [
      'Sharp eyes! You spot what others would miss.',
      'Thorough and quick. Nice haul.',
      'Your experience shows. Good find.',
    ],
    excellent: [
      'Incredible! Everything falls into place.',
      'Masterful search. The pile gives up its secrets.',
      'Jackpot! You were born to scavenge.',
    ],
  }
  var narrs = qualNarrative[quality] || ['You search the pile.']
  result.narrative.unshift(narrs[Math.floor(Math.random() * narrs.length)])

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
  placeTreasure,
  getTreasure,
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
