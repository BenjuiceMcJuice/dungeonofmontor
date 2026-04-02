// Character classes, skills, and generation
// Data loaded from JSON — see src/data/classes.json for definitions

import classData from '../data/classes.json'
import ITEMS from '../data/items.json'

var CLASSES = classData.classes
var SKILLS = classData.skills
var STAT_POINTS_TOTAL = classData.statPointsTotal

// Modifier formula: floor((skill - 10) / 2)
function getModifier(value) {
  return Math.floor((value - 10) / 2)
}

// Max HP: 20 + (VIT * 5)
function getMaxHp(stats) {
  return 20 + ((stats.vit || 8) * 5)
}

// Generate a Knight with base stats, no equipment, and starting gold
// Stats are allocated on the Preparation screen before the run
function generateKnight(name) {
  var start = classData.startingKnight
  var stats = Object.assign({}, start.baseStats)

  return {
    name: name,
    class: 'knight',
    level: 1,
    xp: 0,
    stats: stats,
    maxHp: getMaxHp(stats),
    abilities: [],
    scars: [],
    titles: [],
    equipped: {
      weapon: null,
      offhand: null,
      armour: null,
      relics: [],
    },
    inventory: [],
    gold: start.startingGold || 50,
  }
}

export { CLASSES, SKILLS, STAT_POINTS_TOTAL, getModifier, getMaxHp, generateKnight }
