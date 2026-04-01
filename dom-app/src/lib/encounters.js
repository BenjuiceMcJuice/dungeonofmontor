// Encounter generation algorithm
// Data loaded from JSON — see src/data/encounters.json for definitions
import { roll } from './dice.js'
import { generateEnemy } from './enemies.js'
import encounterData from '../data/encounters.json'

var BIOME_WEIGHTS = encounterData.biomeWeights

function getTierWeights(depth) {
  for (var i = 0; i < encounterData.tierProgression.length; i++) {
    if (depth < encounterData.tierProgression[i].maxDepth) return encounterData.tierProgression[i].weights
  }
  var last = encounterData.tierProgression[encounterData.tierProgression.length - 1]
  return last.weights
}

function getTypeEligibility(depth) {
  for (var i = 0; i < encounterData.typeEligibility.length; i++) {
    if (depth < encounterData.typeEligibility[i].maxDepth) return encounterData.typeEligibility[i].eligible
  }
  var last = encounterData.typeEligibility[encounterData.typeEligibility.length - 1]
  return last.eligible
}

function getEnemyCount(depth) {
  for (var i = 0; i < encounterData.countProgression.length; i++) {
    var band = encounterData.countProgression[i]
    if (depth < band.maxDepth) {
      var count = band.min + Math.floor(Math.random() * (band.max - band.min + 1))
      if (band.bonusChance > 0 && Math.random() < band.bonusChance) count++
      return count
    }
  }
  return 2 + Math.floor(Math.random() * 2)
}

// Pick from weighted options: { key: weight, ... } → key
function weightedPick(weights) {
  var entries = Object.keys(weights).filter(function(k) { return weights[k] > 0 })
  var total = entries.reduce(function(sum, k) { return sum + weights[k] }, 0)
  var r = Math.random() * total
  var cumulative = 0
  for (var i = 0; i < entries.length; i++) {
    cumulative += weights[entries[i]]
    if (r <= cumulative) return entries[i]
  }
  return entries[entries.length - 1]
}

// Main encounter generator
// depth: 0.0 to 1.0 (position in run)
// partyLevel: average level (defaults to 1)
// difficulty: game difficulty setting
// biome: biome key (defaults to 'dungeon')
function generateEncounter(depth, partyLevel, difficulty, biome) {
  var biomeName = biome || 'dungeon'
  var biomeWeights = BIOME_WEIGHTS[biomeName] || BIOME_WEIGHTS.dungeon
  var eligibility = getTypeEligibility(depth)
  var tierWeights = getTierWeights(depth)
  var count = getEnemyCount(depth)

  // Filter biome weights by what's eligible at this depth
  var availableWeights = {}
  Object.keys(biomeWeights).forEach(function(type) {
    if (eligibility[type]) {
      availableWeights[type] = biomeWeights[type]
    }
  })

  var enemies = []
  for (var i = 0; i < count; i++) {
    var type = weightedPick(availableWeights)
    var tier = weightedPick(tierWeights)
    enemies.push(generateEnemy(type, tier, difficulty || 'seasoned'))
  }

  return enemies
}

export { generateEncounter, BIOME_WEIGHTS, getTierWeights, getTypeEligibility }
