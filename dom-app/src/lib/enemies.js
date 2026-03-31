// Enemy generation — archetypes × tiers
// Stats are designed for D&D-style modifiers: floor((STAT-10)/2)
// Base stats represent Iron tier (1.0x) at Seasoned difficulty
// All stats should land in 8-18 range across tiers to keep modifiers meaningful (-1 to +4)
import { roll } from './dice.js'

// Base stats per archetype — tuned so Dust tier (0.8x) stays above 8
var ARCHETYPES = {
  rat:    { hp: 10, str: 8,  agi: 14, def: 6,  int: 6,  weaponDie: 4,  xp: 10 },
  orc:    { hp: 35, str: 16, agi: 8,  def: 14, int: 8,  weaponDie: 8,  xp: 30 },
  rock:   { hp: 50, str: 14, agi: 6,  def: 18, int: 6,  weaponDie: 10, xp: 40 },
  slug:   { hp: 16, str: 8,  agi: 6,  def: 4,  int: 6,  weaponDie: 4,  xp: 15 },
  wraith: { hp: 22, str: 12, agi: 12, def: 8,  int: 16, weaponDie: 6,  xp: 35 },
}

// Tier multipliers — narrower range so stats stay in 8-18 band
// Dust = weak but functional, Void = fearsome but not absurd
var TIER_MULTIPLIERS = {
  dust:    0.8,
  slate:   0.9,
  iron:    1.0,
  crimson: 1.15,
  void:    1.3,
}

// Difficulty modifiers
var DIFFICULTY_MULTIPLIERS = {
  novice:    0.9,
  seasoned:  1.0,
  veteran:   1.1,
  legendary: 1.2,
}

// One canonical name per archetype per tier — name should tell you what it is
// Variants with effects (slime, parasite, etc.) added later via conditions system
var NAME_POOLS = {
  rat:    { dust: ['Dungeon Rat'], slate: ['Sewer Rat'], iron: ['Plague Rat'], crimson: ['Blood Rat'], void: ['Void Rat'] },
  orc:    { dust: ['Orc Grunt'], slate: ['Orc Brute'], iron: ['Orc Warlord'], crimson: ['Orc Berserker'], void: ['Orc Champion'] },
  rock:   { dust: ['Rock Golem'], slate: ['Stone Golem'], iron: ['Steel Golem'], crimson: ['Magma Golem'], void: ['Void Golem'] },
  slug:   { dust: ['Ashslug'], slate: ['Venomslug'], iron: ['Bile Slug'], crimson: ['Blood Slug'], void: ['Void Slug'] },
  wraith: { dust: ['Wisp'], slate: ['Shade'], iron: ['Wraith'], crimson: ['Banshee'], void: ['Void Wraith'] },
}

var nextEnemyId = 1

function generateEnemy(archetypeKey, tierKey, difficulty) {
  var base = ARCHETYPES[archetypeKey]
  var tierMul = TIER_MULTIPLIERS[tierKey]
  var diffMul = DIFFICULTY_MULTIPLIERS[difficulty || 'seasoned']
  var mul = tierMul * diffMul

  var names = (NAME_POOLS[archetypeKey] && NAME_POOLS[archetypeKey][tierKey]) || ['Unknown']
  var name = names[Math.floor(Math.random() * names.length)]

  // Apply multiplier — minimum 4 for combat stats (allows weak mobs to feel weak)
  var maxHp = Math.max(6, Math.round(base.hp * mul))
  var str = Math.max(4, Math.round(base.str * mul))
  var agi = Math.max(4, Math.round(base.agi * mul))
  var def = Math.max(4, Math.round(base.def * mul))
  var int = Math.round(base.int * mul)

  var id = 'enemy_' + (nextEnemyId++)

  return {
    id: id,
    name: name,
    archetypeKey: archetypeKey,
    tierKey: tierKey,
    currentHp: maxHp,
    maxHp: maxHp,
    stats: {
      str: str,
      agi: agi,
      def: def,
      int: int,
    },
    weaponDie: base.weaponDie,
    xp: Math.round(base.xp * tierMul),
    isDown: false,
    phase: 1,
  }
}

// Enemy pools by encounter difficulty (not game difficulty)
// Garden (Floor 0): levels 1-3. Dust only. Mini boss is a tougher dust enemy, not a tier jump.
var ENCOUNTER_POOLS = {
  1: { types: ['rat', 'slug'], tiers: ['dust'], count: [1, 2] },
  2: { types: ['rat', 'slug', 'rat'], tiers: ['dust'], count: [2, 3] },
  3: { types: ['rat', 'slug'], tiers: ['slate'], count: [1, 1] },
  // Future floors:
  4: { types: ['orc', 'rock', 'wraith'], tiers: ['slate', 'iron'], count: [1, 2] },
}

function generateCombatEnemies(difficulty, encounterLevel, zonePools) {
  var level = encounterLevel || 1
  var pools = zonePools || ENCOUNTER_POOLS
  var pool = pools[level] || pools[1] || ENCOUNTER_POOLS[1]

  var minCount = pool.count[0]
  var maxCount = pool.count[1]
  var count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1))

  var enemies = []
  for (var i = 0; i < count; i++) {
    var type = pool.types[Math.floor(Math.random() * pool.types.length)]
    var tier = pool.tiers[Math.floor(Math.random() * pool.tiers.length)]
    enemies.push(generateEnemy(type, tier, difficulty))
  }
  return enemies
}

function generateBoss(difficulty, archetypeKey, tierKey, bossName) {
  var type = archetypeKey || 'orc'
  var tier = tierKey || 'void'
  var boss = generateEnemy(type, tier, difficulty)
  // Bosses are beefier — 3x HP, +2 STR, +2 DEF
  boss.maxHp = boss.maxHp * 3
  boss.currentHp = boss.maxHp
  boss.stats.str = boss.stats.str + 2
  boss.stats.def = boss.stats.def + 2
  boss.name = bossName || 'The Unbroken'
  boss.xp = tier === 'dust' ? 40 : tier === 'slate' ? 60 : tier === 'iron' ? 80 : 100
  boss.isBoss = true
  return boss
}

export { ARCHETYPES, TIER_MULTIPLIERS, generateEnemy, generateCombatEnemies, generateBoss }
