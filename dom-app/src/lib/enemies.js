// Enemy generation — archetypes × tiers
// Data loaded from JSON — see src/data/enemies.json for definitions
import { roll } from './dice.js'
import enemyData from '../data/enemies.json'

var ARCHETYPES = enemyData.archetypes
var TIER_MULTIPLIERS = enemyData.tierMultipliers
var DIFFICULTY_MULTIPLIERS = enemyData.difficultyMultipliers
var NAME_POOLS = enemyData.namePools
var ENCOUNTER_POOLS = enemyData.encounterPools

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
    _baseStats: { str: str, def: def },
    weaponDie: base.weaponDie,
    xp: Math.round(base.xp * tierMul),
    isDown: false,
    phase: 1,
    behaviour: base.behaviour || {},
    turnCount: 0,
    howlCooldownLeft: 0,
    hasHidden: false,
  }
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
