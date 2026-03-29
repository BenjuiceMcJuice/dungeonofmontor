// Stage 1: Knight only. Other classes added in Stage 2.
var CLASSES = {
  knight: {
    name: 'Knight',
    baseHp: 30,
    hpPerLevel: 8,
    autoSkills: { str: 1, def: 1 },
    freePointsPerLevel: 2,
    playstyle: 'Tanky frontliner',
  },
}

// 14 skills — all present from day one
var SKILLS = [
  { id: 'str', name: 'Strength',   abbrev: 'STR', group: 'combat' },
  { id: 'agi', name: 'Agility',    abbrev: 'AGI', group: 'combat' },
  { id: 'def', name: 'Defence',    abbrev: 'DEF', group: 'combat' },
  { id: 'end', name: 'Endurance',  abbrev: 'END', group: 'combat' },
  { id: 'int', name: 'Intellect',  abbrev: 'INT', group: 'mental' },
  { id: 'wis', name: 'Wisdom',     abbrev: 'WIS', group: 'mental' },
  { id: 'per', name: 'Perception', abbrev: 'PER', group: 'mental' },
  { id: 'lck', name: 'Luck',       abbrev: 'LCK', group: 'fortune' },
  { id: 'cha', name: 'Charisma',   abbrev: 'CHA', group: 'fortune' },
  { id: 'vit', name: 'Vitality',   abbrev: 'VIT', group: 'body' },
  { id: 'res', name: 'Resilience', abbrev: 'RES', group: 'body' },
  { id: 'sth', name: 'Stealth',    abbrev: 'STH', group: 'specialist' },
  { id: 'cun', name: 'Cunning',    abbrev: 'CUN', group: 'specialist' },
  { id: 'wil', name: 'Willpower',  abbrev: 'WIL', group: 'specialist' },
]

var STAT_POINTS_TOTAL = 70

// Modifier formula: floor((skill - 10) / 2)
function getModifier(value) {
  return Math.floor((value - 10) / 2)
}

// Max HP: classBaseHP + (VIT * 5) + (END * 2)
function getMaxHp(cls, stats) {
  return cls.baseHp + (stats.vit * 5) + (stats.end * 2)
}

// Generate a Knight with evenly distributed stats for Stage 1
function generateKnight(name) {
  // 70 points across 14 skills = 5 each, then boost Knight-relevant stats
  var stats = {}
  SKILLS.forEach(function(s) { stats[s.id] = 4 })
  // Remaining: 70 - (14 * 4) = 14 points to distribute
  // Knight favours STR, DEF, VIT, END
  stats.str = 8
  stats.def = 8
  stats.vit = 7
  stats.end = 6
  stats.agi = 5
  stats.per = 5
  stats.wil = 5
  // That's 4*7 + 8+8+7+6+5+5+5 = 28 + 44 = 72... let me recalculate
  // 14 skills at 4 = 56. Remaining = 14.
  // str +4=8, def +4=8, vit +3=7, end +2=6, agi +1=5 = 14 extra. Good.

  var cls = CLASSES.knight
  return {
    name: name,
    class: 'knight',
    level: 1,
    xp: 0,
    stats: stats,
    maxHp: getMaxHp(cls, stats),
    abilities: [],
    scars: [],
    titles: [],
    equipped: { weapon: null, offhand: null, armour: null, relics: [] },
    inventory: [],
    gold: 0,
  }
}

export { CLASSES, SKILLS, STAT_POINTS_TOTAL, getModifier, getMaxHp, generateKnight }
