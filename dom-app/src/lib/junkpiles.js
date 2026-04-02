// Junk Pile generation, inspect, and depth-based search resolution
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
  boss:            { min: 1, max: 1, forceSize: 'large' },
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

// Risk 1-5, determines base danger of the pile regardless of search depth
var RISK_WEIGHTS = [
  { risk: 1, weight: 25 },  // calm
  { risk: 2, weight: 30 },  // mild
  { risk: 3, weight: 25 },  // moderate
  { risk: 4, weight: 15 },  // dangerous
  { risk: 5, weight: 5 },   // deadly
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

// Inspect hints based on PER accuracy
// Higher PER = more accurate. Low PER might lie.
var RISK_HINTS = {
  1: { accurate: 'Seems quiet',           vague: 'Hard to tell' },
  2: { accurate: 'Probably fine',          vague: 'Maybe fine?' },
  3: { accurate: 'Something stirs inside', vague: 'Could go either way' },
  4: { accurate: 'Definitely not empty',   vague: 'Got a bad feeling' },
  5: { accurate: 'This will hurt',         vague: 'No idea' },
}

// ============================================================
// SEARCH DEPTH — player chooses per layer
// ============================================================

// Depth modifiers applied on top of base risk
// Sift: careful, low reward, low danger
// Rummage: balanced
// Deep clean: aggressive, best loot, most danger
var DEPTH_CONFIG = {
  sift: {
    label: 'Sift',
    description: 'Careful. Quiet.',
    goldMul: 0.5,
    itemChance: 0.05,
    enemyMul: 0.0,     // sifting never triggers enemies
    conditionMul: 0.2,  // very low condition chance
    xpMul: 0.5,
    terminalReveal: false,
    lootTable: 'standard',
  },
  rummage: {
    label: 'Rummage',
    description: 'Thorough. Some noise.',
    goldMul: 1.0,
    itemChance: 0.2,
    enemyMul: 0.5,     // half of base enemy chance
    conditionMul: 0.7,
    xpMul: 1.0,
    terminalReveal: false,
    lootTable: 'elite',
  },
  deep_clean: {
    label: 'Deep Clean',
    description: 'All in. Everything comes out.',
    goldMul: 1.5,
    itemChance: 0.4,
    enemyMul: 1.5,     // amplified enemy chance
    conditionMul: 1.5,
    xpMul: 2.0,
    terminalReveal: true,  // only deep clean reveals terminals
    lootTable: 'chest',
  },
}

// ============================================================
// BASE TABLES — scale with risk level
// ============================================================

// Base gold per layer (scales with risk — risky piles have more)
function getBaseGold(riskLevel) {
  var ranges = [
    { min: 1, max: 3 },   // risk 1
    { min: 2, max: 5 },   // risk 2
    { min: 3, max: 8 },   // risk 3
    { min: 5, max: 12 },  // risk 4
    { min: 8, max: 18 },  // risk 5
  ]
  var r = ranges[Math.min(riskLevel - 1, ranges.length - 1)]
  return r.min + Math.floor(Math.random() * (r.max - r.min + 1))
}

// Base enemy chance per risk level
function getBaseEnemyChance(riskLevel) {
  var chances = [0.0, 0.05, 0.15, 0.30, 0.50]
  return chances[Math.min(riskLevel - 1, chances.length - 1)]
}

// Base condition chance per risk level
function getBaseConditionChance(riskLevel) {
  var chances = [0.0, 0.05, 0.10, 0.20, 0.35]
  return chances[Math.min(riskLevel - 1, chances.length - 1)]
}

// XP base per risk level
function getBaseXp(riskLevel) {
  var xps = [3, 5, 8, 12, 18]
  return xps[Math.min(riskLevel - 1, xps.length - 1)]
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
      size = sizeRoll < 0.6 ? 'small' : sizeRoll < 0.9 ? 'medium' : 'large'
    }
    piles.push(createPile('pile_' + i, size, floorId))
  }
  return piles
}

function createPile(id, size, floorId) {
  var maxLayers = size === 'small' ? 1 : size === 'medium' ? 2 : 3
  var riskLevel = rollRiskLevel()
  var desc = PILE_DESCRIPTIONS[floorId] || PILE_DESCRIPTIONS['grounds']

  return {
    id: id,
    size: size,
    maxLayers: maxLayers,
    currentLayer: 0,        // 0 = top, increments as layers are searched
    depleted: false,
    floorId: floorId,
    riskLevel: riskLevel,   // hidden 1-5
    inspected: false,       // true after player inspects
    inspectHint: null,      // set on inspect
    hasTerminal: false,     // set by placeTerminal()
    terminalLayer: -1,      // which layer the terminal is on (-1 = none)
    description: desc[size] || 'A pile of junk',
  }
}

// ============================================================
// TERMINAL PLACEMENT
// ============================================================

// Place exactly one terminal in a zone's chambers
// Terminal goes on the deepest layer of a medium/large pile
function placeTerminal(chambers) {
  var candidates = []
  for (var ci = 0; ci < chambers.length; ci++) {
    var ch = chambers[ci]
    if (!ch.junkPiles) continue
    for (var pi = 0; pi < ch.junkPiles.length; pi++) {
      var pile = ch.junkPiles[pi]
      if (pile.maxLayers >= 2) {
        candidates.push({ chamberIdx: ci, pileIdx: pi })
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback: any pile
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
  pile.terminalLayer = pile.maxLayers - 1  // deepest layer
  chambers[pick.chamberIdx].hasTerminal = true
}

// ============================================================
// INSPECT — free action, reveals risk hint
// ============================================================

function inspectPile(pile, perStat) {
  if (pile.inspected) return pile.inspectHint

  var perMod = perStat ? getModifier(perStat) : 0
  // Silent roll: d20 + PER. High = accurate hint, low = vague
  var inspectRoll = roll(20) + perMod
  var accurate = inspectRoll >= 12

  var hints = RISK_HINTS[pile.riskLevel] || RISK_HINTS[3]
  var hint = accurate ? hints.accurate : hints.vague

  pile.inspected = true
  pile.inspectHint = hint
  return hint
}

// ============================================================
// SEARCH — player chooses depth (sift/rummage/deep_clean)
// ============================================================

// Resolve a search at the current layer with chosen depth
// Returns { quality, roll, natRoll, gold, junk, item, enemy, condition, terminal, xp, narrative }
function resolveSearch(pile, perStat, depthKey) {
  if (pile.depleted) return null
  if (pile.currentLayer >= pile.maxLayers) return null

  var depth = DEPTH_CONFIG[depthKey] || DEPTH_CONFIG['sift']
  var risk = pile.riskLevel
  var layerIdx = pile.currentLayer
  var floorId = pile.floorId

  // PER roll
  var perMod = perStat ? getModifier(perStat) : 0
  var searchRoll = rollWithMod(20, perMod)
  var natRoll = searchRoll.roll
  var total = searchRoll.total

  // Determine quality
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
    depthKey: depthKey,
    depthLabel: depth.label,
    gold: 0,
    junk: null,
    item: null,
    enemy: null,
    condition: null,
    terminal: false,
    xp: 0,
    narrative: [],
    pileId: pile.id,
    layerIdx: layerIdx,
  }

  // --- Gold ---
  var baseGold = getBaseGold(risk)
  result.gold = Math.max(1, Math.round(baseGold * depth.goldMul))
  if (quality === 'fumble' || quality === 'poor') result.gold = Math.max(1, Math.floor(result.gold * 0.5))
  if (quality === 'excellent') result.gold = Math.round(result.gold * 1.5)

  // --- Junk item ---
  var pool = JUNK_POOLS[floorId] || JUNK_POOLS['grounds']
  result.junk = pool[Math.floor(Math.random() * pool.length)]

  // --- Real item (from loot table) ---
  var prefix = getFloorLootPrefix(floorId)
  var tableId = prefix + '_' + depth.lootTable
  if (Math.random() < depth.itemChance) {
    if (quality === 'fumble' || quality === 'poor') {
      result.narrative.push('You missed something buried deeper...')
    } else if (quality === 'decent') {
      if (Math.random() < 0.5) result.item = rollDrop(tableId, 10)
      else result.narrative.push('Something glints but slips away...')
    } else {
      result.item = rollDrop(tableId, 10)
    }
  }

  // --- Enemy ---
  var enemyChance = getBaseEnemyChance(risk) * depth.enemyMul
  if (enemyChance > 0 && Math.random() < enemyChance) {
    if (quality === 'excellent') {
      result.narrative.push('You spot something hiding — it scurries away.')
    } else if (quality === 'good') {
      result.enemy = 'spotted'
      result.narrative.push('You spot something lurking!')
    } else if (quality === 'decent') {
      result.enemy = 'normal'
      result.narrative.push('Something bursts from the pile!')
    } else {
      result.enemy = 'ambush'
      result.narrative.push('AMBUSH! Something lunges from the junk!')
    }
  }

  // --- Condition hazard ---
  var condChance = getBaseConditionChance(risk) * depth.conditionMul
  if (condChance > 0 && Math.random() < condChance) {
    var condPool = CONDITION_HAZARDS[floorId] || ['NAUSEA']
    var condId = condPool[Math.floor(Math.random() * condPool.length)]
    if (quality === 'good' || quality === 'excellent') {
      result.narrative.push('You carefully avoid a hazard.')
    } else if (quality === 'decent') {
      if (Math.random() < 0.5) {
        result.condition = condId
        result.narrative.push('Hazard — ' + condId + '!')
      }
    } else {
      result.condition = condId
      result.narrative.push('Hazard — ' + condId + '!')
    }
  }

  // --- Terminal ---
  if (pile.hasTerminal && layerIdx === pile.terminalLayer && depth.terminalReveal) {
    result.terminal = true
    result.narrative.push('You uncover something beneath the junk... a strange terminal hums faintly.')
  }

  // --- XP ---
  var baseXp = getBaseXp(risk)
  var xpMul = { fumble: 0.25, poor: 0.5, decent: 1, good: 1.5, excellent: 2 }
  result.xp = Math.max(1, Math.round(baseXp * depth.xpMul * (xpMul[quality] || 1)))

  // --- Quality narrative ---
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

// Apply search — advance layer, mark depleted if done
function applySearch(pile) {
  pile.currentLayer++
  if (pile.currentLayer >= pile.maxLayers) {
    pile.depleted = true
  }
}

// ============================================================
// EXPORTS
// ============================================================

export {
  generateJunkPiles,
  placeTerminal,
  inspectPile,
  resolveSearch,
  applySearch,
  DEPTH_CONFIG,
  PILE_COUNTS,
  PILE_DESCRIPTIONS,
}
