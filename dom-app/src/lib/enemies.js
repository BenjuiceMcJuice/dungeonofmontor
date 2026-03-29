// Enemy generation — archetypes × tiers
// Stats scale by tier and difficulty modifier
import { roll } from './dice.js'

// Base stats per archetype at Seasoned difficulty
var ARCHETYPES = {
  rat:   { hp: 12, str: 8,  agi: 12, def: 6,  int: 4,  weaponDie: 4,  xp: 10 },
  orc:   { hp: 30, str: 14, agi: 6,  def: 12, int: 6,  weaponDie: 8,  xp: 30 },
  rock:  { hp: 45, str: 12, agi: 4,  def: 16, int: 4,  weaponDie: 10, xp: 40 },
  slug:  { hp: 20, str: 8,  agi: 5,  def: 8,  int: 4,  weaponDie: 6,  xp: 20 },
  wraith:{ hp: 22, str: 10, agi: 10, def: 8,  int: 14, weaponDie: 6,  xp: 35 },
}

// Tier multipliers for stats
var TIER_MULTIPLIERS = {
  dust:    0.6,
  slate:   0.8,
  iron:    1.0,
  crimson: 1.3,
  void:    1.8,
}

// Difficulty modifiers
var DIFFICULTY_MULTIPLIERS = {
  novice:    0.8,
  seasoned:  1.0,
  veteran:   1.2,
  legendary: 1.4,
}

// Name pools per archetype per tier (subset for Stage 1)
var NAME_POOLS = {
  rat:    { dust: ['Scuttler', 'Ashrat', 'Gutter Fang'], slate: ['Swarmcaller', 'Blight Gnawer', 'Ironteeth'] },
  orc:    { dust: ['Ashback', 'Thorngrunt', 'Mudwalker'], slate: ['Ironjaw', 'Warback', 'Stonefist'] },
  rock:   { dust: ['Gravel Hulk', 'Stoneback', 'Rubblefist'], slate: ['Ironstone', 'Boulderkin', 'Cragmaw'] },
  slug:   { dust: ['Ashslug', 'Mire Crawler', 'Blight Creep'], slate: ['Venomtrail', 'Sludgeborn', 'Rot Creeper'] },
  wraith: { dust: ['Drifter', 'Pale Remnant', 'Hollow'], slate: ['Wandering Sorrow', 'Ashgast', 'Mournveil'] },
}

var nextEnemyId = 1

function generateEnemy(archetypeKey, tierKey, difficulty) {
  var base = ARCHETYPES[archetypeKey]
  var tierMul = TIER_MULTIPLIERS[tierKey]
  var diffMul = DIFFICULTY_MULTIPLIERS[difficulty || 'seasoned']
  var mul = tierMul * diffMul

  var names = (NAME_POOLS[archetypeKey] && NAME_POOLS[archetypeKey][tierKey]) || ['Unknown']
  var name = names[Math.floor(Math.random() * names.length)]

  var maxHp = Math.round(base.hp * mul)
  var id = 'enemy_' + (nextEnemyId++)

  return {
    id: id,
    name: name,
    archetypeKey: archetypeKey,
    tierKey: tierKey,
    currentHp: maxHp,
    maxHp: maxHp,
    stats: {
      str: Math.round(base.str * mul),
      agi: Math.round(base.agi * mul),
      def: Math.round(base.def * mul),
      int: Math.round(base.int * mul),
    },
    weaponDie: base.weaponDie,
    xp: Math.round(base.xp * tierMul),
    isDown: false,
    phase: 1,
  }
}

// Enemy pools by encounter difficulty (not game difficulty)
// encounterLevel: 1 = easy opener, 2 = moderate, 3 = tough, 4 = hard
var ENCOUNTER_POOLS = {
  1: { types: ['rat', 'slug'], tiers: ['dust'], count: [1, 2] },
  2: { types: ['rat', 'slug', 'orc'], tiers: ['dust', 'dust', 'slate'], count: [1, 2] },
  3: { types: ['rat', 'orc', 'slug', 'wraith'], tiers: ['dust', 'slate'], count: [1, 3] },
  4: { types: ['orc', 'rock', 'wraith'], tiers: ['slate'], count: [1, 2] },
}

// Generate enemies for a combat encounter
// encounterLevel defaults to 1 (easy)
function generateCombatEnemies(difficulty, encounterLevel) {
  var level = encounterLevel || 1
  var pool = ENCOUNTER_POOLS[level] || ENCOUNTER_POOLS[1]

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

// Generate a boss for end of run (fixed Void-tier Orc in Stage 1)
function generateBoss(difficulty) {
  var boss = generateEnemy('orc', 'void', difficulty)
  boss.name = 'The Unbroken'
  boss.xp = 80
  return boss
}

export { ARCHETYPES, TIER_MULTIPLIERS, generateEnemy, generateCombatEnemies, generateBoss }
