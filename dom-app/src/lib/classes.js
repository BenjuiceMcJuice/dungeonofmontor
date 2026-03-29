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
  // 70 points across 14 skills. Knight favours STR, DEF, VIT, END.
  // Target: STR/DEF 12-13 for +1 modifier, VIT/END 11-12 for decent HP
  var stats = {
    str: 13, def: 12, vit: 11, end: 11,
    agi: 8, per: 4, wil: 3,
    int: 1, wis: 1, lck: 1,
    cha: 1, res: 1, sth: 1, cun: 2,
  }
  // Total: 13+12+11+11+8+4+3+1+1+1+1+1+1+2 = 70 ✓

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
