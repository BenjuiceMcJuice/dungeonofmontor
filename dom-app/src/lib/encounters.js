// Encounter generation algorithm
// Determines enemy types, tiers, and count based on:
//   - depth: how far into the run (0.0 = start, 1.0 = boss)
//   - partyLevel: average party level (for future scaling)
//   - biome: affects enemy weighting (future — defaults to 'dungeon')
import { roll } from './dice.js'
import { generateEnemy } from './enemies.js'

// Enemy type weights by biome — higher = more likely to appear
// Each biome can favour certain types. Weights are relative, not percentages.
var BIOME_WEIGHTS = {
  dungeon: { rat: 30, orc: 25, slug: 20, wraith: 15, rock: 10 },
  // Future biomes:
  // swamp:   { slug: 40, rat: 25, wraith: 20, orc: 10, rock: 5 },
  // crypt:   { wraith: 40, slug: 15, rat: 20, orc: 15, rock: 10 },
  // mines:   { rock: 35, orc: 25, rat: 25, slug: 10, wraith: 5 },
  // ruins:   { orc: 30, wraith: 25, rock: 20, rat: 15, slug: 10 },
}

// Tier probability by depth (0.0–1.0)
// Early: almost all Dust. Mid: mix. Late: mostly Slate, some Iron.
function getTierWeights(depth) {
  if (depth < 0.2) return { dust: 90, slate: 10, iron: 0 }
  if (depth < 0.4) return { dust: 60, slate: 35, iron: 5 }
  if (depth < 0.6) return { dust: 30, slate: 55, iron: 15 }
  if (depth < 0.8) return { dust: 10, slate: 55, iron: 35 }
  return { dust: 5, slate: 40, iron: 55 }
}

// Enemy type eligibility by depth — some types don't appear early
function getTypeEligibility(depth) {
  if (depth < 0.15) return { rat: true, slug: true, orc: false, wraith: false, rock: false }
  if (depth < 0.3)  return { rat: true, slug: true, orc: true, wraith: false, rock: false }
  if (depth < 0.5)  return { rat: true, slug: true, orc: true, wraith: true, rock: false }
  return { rat: true, slug: true, orc: true, wraith: true, rock: true }
}

// Enemy count by depth — more enemies as you go deeper
function getEnemyCount(depth) {
  if (depth < 0.2) return 1 + (Math.random() < 0.3 ? 1 : 0) // 1, sometimes 2
  if (depth < 0.5) return 1 + Math.floor(Math.random() * 2)   // 1-2
  if (depth < 0.8) return 2 + (Math.random() < 0.4 ? 1 : 0)  // 2, sometimes 3
  return 2 + Math.floor(Math.random() * 2)                     // 2-3
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
