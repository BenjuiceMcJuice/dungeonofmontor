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

// Max HP: classBaseHP + (VIT * 5) + (END * 2)
function getMaxHp(cls, stats) {
  return cls.baseHp + (stats.vit * 5) + (stats.end * 2)
}

// Generate a Knight with stats and equipment from JSON data
function generateKnight(name) {
  var start = classData.startingKnight
  var stats = Object.assign({}, start.stats)

  return {
    name: name,
    class: 'knight',
    level: 1,
    xp: 0,
    stats: stats,
    maxHp: start.maxHp,
    abilities: [],
    scars: [],
    titles: [],
    equipped: {
      weapon: ITEMS[start.weaponId] ? Object.assign({}, ITEMS[start.weaponId]) : null,
      offhand: null,
      armour: ITEMS[start.armourId] ? Object.assign({}, ITEMS[start.armourId]) : null,
      relics: [],
    },
    inventory: [],
    gold: 0,
  }
}

export { CLASSES, SKILLS, STAT_POINTS_TOTAL, getModifier, getMaxHp, generateKnight }
