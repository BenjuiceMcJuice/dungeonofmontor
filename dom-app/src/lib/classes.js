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
  // STR 14 (+2 mod) — trained fighter, hits reliably
  // DEF 10 (+0 mod) — base defence, armour adds the rest
  // AGI 10 (+0) — average initiative, not slow not fast
  var stats = {
    str: 14, def: 10, vit: 10, end: 8,
    agi: 10, per: 4, wil: 3,
    int: 2, wis: 1, lck: 2,
    cha: 1, res: 2, sth: 1, cun: 2,
  }
  // Total: 14+10+10+8+10+4+3+2+1+2+1+2+1+2 = 70 ✓

  var cls = CLASSES.knight
  return {
    name: name,
    class: 'knight',
    level: 1,
    xp: 0,
    stats: stats,
    maxHp: 35, // Stage 1: fixed HP. Slightly lower — rats should feel threatening in groups.
    abilities: [],
    scars: [],
    titles: [],
    equipped: {
      weapon: { name: 'Longsword', die: 8, stat: 'str', rarity: 'common' },
      offhand: null,
      armour: { name: 'Chainmail', defBonus: 4, agiPenalty: -1, rarity: 'common' },
      relics: [],
    },
    inventory: [],
    gold: 0,
  }
}

export { CLASSES, SKILLS, STAT_POINTS_TOTAL, getModifier, getMaxHp, generateKnight }
