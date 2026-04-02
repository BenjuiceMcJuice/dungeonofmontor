// Junk Pile generation, layer content, and PER-based search resolution
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
// LAYER CONTENT TABLES
// ============================================================

// Gold ranges per layer depth
var GOLD_RANGES = [
  { min: 1, max: 3 },   // layer 0 (small pile / first layer)
  { min: 3, max: 8 },   // layer 1 (medium second / large second)
  { min: 8, max: 15 },  // layer 2 (large third)
]

// Content chances per layer depth
var LAYER_CHANCES = [
  { junk: 0.80, item: 0.05, enemy: 0.00, condition: 0.00, xpBase: 3 },  // layer 0
  { junk: 0.65, item: 0.20, enemy: 0.10, condition: 0.10, xpBase: 8 },  // layer 1
  { junk: 0.50, item: 0.35, enemy: 0.25, condition: 0.20, xpBase: 15 }, // layer 2
]

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
  var maxSearches = size === 'small' ? 1 : size === 'medium' ? 2 : 3
  var layers = []
  for (var i = 0; i < maxSearches; i++) {
    layers.push(generateLayer(i, floorId))
  }

  var desc = PILE_DESCRIPTIONS[floorId] || PILE_DESCRIPTIONS['grounds']

  return {
    id: id,
    size: size,
    searched: 0,
    maxSearches: maxSearches,
    depleted: false,
    floorId: floorId,
    layers: layers,
    hasTerminal: false,
    description: desc[size] || 'A pile of junk',
  }
}

function generateLayer(depth, floorId) {
  var chances = LAYER_CHANCES[Math.min(depth, LAYER_CHANCES.length - 1)]
  var goldRange = GOLD_RANGES[Math.min(depth, GOLD_RANGES.length - 1)]

  // Pick a random junk item from the floor's pool
  var pool = JUNK_POOLS[floorId] || JUNK_POOLS['grounds']
  var junkItem = pool[Math.floor(Math.random() * pool.length)]

  // Roll for real item from floor's loot table
  var prefix = getFloorLootPrefix(floorId)
  var tableId = depth >= 2 ? prefix + '_chest' : depth >= 1 ? prefix + '_elite' : prefix + '_standard'
  var realItem = Math.random() < chances.item ? rollDrop(tableId, 10) : null

  // Roll for enemy (archetype key — spawned by Game.jsx when triggered)
  var enemyArchetype = null
  if (Math.random() < chances.enemy) {
    var hazards = CONDITION_HAZARDS[floorId] || []
    // Simple enemy selection — use first enemy type from zone (Game.jsx will handle spawning)
    enemyArchetype = 'ambush'
  }

  // Roll for condition hazard
  var conditionHazard = null
  if (Math.random() < chances.condition) {
    var condPool = CONDITION_HAZARDS[floorId] || ['NAUSEA']
    conditionHazard = condPool[Math.floor(Math.random() * condPool.length)]
  }

  return {
    gold: goldRange.min + Math.floor(Math.random() * (goldRange.max - goldRange.min + 1)),
    junk: Math.random() < chances.junk ? junkItem : null,
    item: realItem,
    enemy: enemyArchetype,
    condition: conditionHazard,
    terminal: false,
    xpBase: chances.xpBase,
  }
}

// ============================================================
// TERMINAL PLACEMENT
// ============================================================

// Place exactly one terminal in a zone's chambers (call after all piles generated)
function placeTerminal(chambers) {
  // Find all piles that can hold a terminal (medium/large, layer 1+)
  var candidates = []
  for (var ci = 0; ci < chambers.length; ci++) {
    var ch = chambers[ci]
    if (!ch.junkPiles) continue
    for (var pi = 0; pi < ch.junkPiles.length; pi++) {
      var pile = ch.junkPiles[pi]
      if (pile.maxSearches >= 2) {
        candidates.push({ chamberIdx: ci, pileIdx: pi, deepestLayer: pile.maxSearches - 1 })
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback: use any pile's last layer
    for (var fi = 0; fi < chambers.length; fi++) {
      if (chambers[fi].junkPiles && chambers[fi].junkPiles.length > 0) {
        var fallbackPile = chambers[fi].junkPiles[0]
        candidates.push({ chamberIdx: fi, pileIdx: 0, deepestLayer: fallbackPile.maxSearches - 1 })
        break
      }
    }
  }

  if (candidates.length === 0) return // no piles at all

  var pick = candidates[Math.floor(Math.random() * candidates.length)]
  var pile = chambers[pick.chamberIdx].junkPiles[pick.pileIdx]
  pile.layers[pick.deepestLayer].terminal = true
  pile.hasTerminal = true
  chambers[pick.chamberIdx].hasTerminal = true
}

// ============================================================
// SEARCH RESOLUTION
// ============================================================

// Resolve a search attempt on a pile
// Returns { quality, gold, junk, item, enemy, condition, terminal, xp, narrative }
function resolveSearch(pile, perStat) {
  if (pile.depleted) return null

  var layerIdx = pile.searched
  var layer = pile.layers[layerIdx]
  if (!layer) return null

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
    gold: 0,
    junk: null,
    item: null,
    enemy: null,
    condition: null,
    terminal: layer.terminal,
    xp: 0,
    narrative: [],
    pileId: pile.id,
    layerIdx: layerIdx,
  }

  // Gold
  if (quality === 'fumble' || quality === 'poor') {
    result.gold = Math.max(1, Math.floor(layer.gold * 0.5))
  } else if (quality === 'excellent') {
    result.gold = layer.gold + Math.floor(layer.gold * 0.5)
  } else {
    result.gold = layer.gold
  }

  // Junk — always found (even on fumble)
  if (layer.junk) {
    result.junk = Object.assign({}, layer.junk)
  }

  // Real item
  if (layer.item) {
    if (quality === 'fumble' || quality === 'poor') {
      // No item found
      result.narrative.push('You missed something buried deeper...')
    } else if (quality === 'decent') {
      if (Math.random() < 0.5) result.item = layer.item
      else result.narrative.push('Something glints but slips away...')
    } else {
      result.item = layer.item
    }
  }

  // Enemy
  if (layer.enemy) {
    if (quality === 'excellent') {
      result.narrative.push('You spot something hiding — it scurries away.')
    } else if (quality === 'good') {
      result.enemy = 'spotted' // player can choose to fight or back away
      result.narrative.push('You spot something lurking in the pile!')
    } else if (quality === 'decent') {
      result.enemy = 'normal' // standard combat
      result.narrative.push('Something bursts from the pile!')
    } else {
      result.enemy = 'ambush' // enemy gets free first strike
      result.narrative.push('AMBUSH! Something lunges from the junk!')
    }
  }

  // Condition hazard
  if (layer.condition) {
    if (quality === 'good' || quality === 'excellent') {
      result.narrative.push('You carefully avoid the ' + layer.condition.toLowerCase() + ' hazard.')
    } else if (quality === 'decent') {
      if (Math.random() < 0.5) {
        result.condition = layer.condition
        result.narrative.push('A hazard in the pile — ' + layer.condition + '!')
      }
    } else {
      result.condition = layer.condition
      result.narrative.push('A hazard in the pile — ' + layer.condition + '!')
    }
  }

  // XP
  var xpMul = { fumble: 0, poor: 0.5, decent: 1, good: 1.5, excellent: 2 }
  result.xp = Math.round(layer.xpBase * (xpMul[quality] || 1))

  // Terminal always revealed regardless of roll
  if (layer.terminal) {
    result.narrative.push('You uncover something beneath the junk... a strange terminal hums faintly.')
  }

  // Quality narrative prefix
  var qualityText = {
    fumble: 'Fumble!',
    poor: 'Poor search.',
    decent: 'Decent find.',
    good: 'Good search!',
    excellent: 'Excellent find!',
  }
  result.narrative.unshift(qualityText[quality] || '')

  return result
}

// Apply search result to pile state (call after resolveSearch)
function applySearch(pile) {
  pile.searched++
  if (pile.searched >= pile.maxSearches) {
    pile.depleted = true
  }
}

// ============================================================
// EXPORTS
// ============================================================

export {
  generateJunkPiles,
  placeTerminal,
  resolveSearch,
  applySearch,
  PILE_COUNTS,
  PILE_DESCRIPTIONS,
}
