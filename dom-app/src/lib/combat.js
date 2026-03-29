// Combat engine — multiplayer-ready from day one
// All state uses the BattleState structure from the tech spec
import { roll, rollWithMod, d20Check, rollDamage, applyDefence } from './dice.js'
import { getModifier } from './classes.js'

// Build initial BattleState from party and enemies
// players: [{ uid, character }], enemies: [enemy]
function createBattleState(players, enemies) {
  var playerStates = {}
  var turnOrder = []

  // Snapshot each player into BattleState
  players.forEach(function(p) {
    var char = p.character
    var agiMod = getModifier(char.stats.agi)
    var initRoll = rollWithMod(20, agiMod)

    playerStates[p.uid] = {
      uid: p.uid,
      name: char.name,
      className: char.class,
      level: char.level,
      currentHp: char.maxHp,
      maxHp: char.maxHp,
      combatStats: Object.assign({}, char.stats),
      equipped: Object.assign({}, char.equipped),
      activeInventory: char.inventory ? char.inventory.slice() : [],
      statusEffects: [],
      initiativeRoll: initRoll.total,
      isDown: false,
    }

    turnOrder.push({ id: p.uid, type: 'player', initiative: initRoll.total, agi: char.stats.agi })
  })

  // Add enemies to turn order
  var enemyStates = enemies.map(function(e) {
    var agiMod = getModifier(e.stats.agi)
    var initRoll = rollWithMod(20, agiMod)
    e.initiativeRoll = initRoll.total
    turnOrder.push({ id: e.id, type: 'enemy', initiative: initRoll.total, agi: e.stats.agi })
    return e
  })

  // Sort by initiative (highest first), ties broken by raw AGI, then coin flip
  turnOrder.sort(function(a, b) {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    if (b.agi !== a.agi) return b.agi - a.agi
    return Math.random() < 0.5 ? -1 : 1
  })

  return {
    players: playerStates,
    enemies: enemyStates,
    turnOrder: turnOrder.map(function(t) { return t.id }),
    turnOrderDetails: turnOrder,
    currentTurnIndex: 0,
    round: 1,
    inBattle: true,
    log: [],
  }
}

// Get the current actor's ID
function getCurrentTurnId(battleState) {
  return battleState.turnOrder[battleState.currentTurnIndex]
}

// Get actor info (player or enemy)
function getActor(battleState, actorId) {
  if (battleState.players[actorId]) {
    return { type: 'player', data: battleState.players[actorId] }
  }
  var enemy = battleState.enemies.find(function(e) { return e.id === actorId })
  if (enemy) {
    return { type: 'enemy', data: enemy }
  }
  return null
}

// Resolve a player attack on an enemy
function resolvePlayerAttack(battleState, playerUid, targetEnemyId) {
  var player = battleState.players[playerUid]
  var enemy = battleState.enemies.find(function(e) { return e.id === targetEnemyId })
  if (!player || !enemy || player.isDown || enemy.isDown) return null

  var strMod = getModifier(player.combatStats.str)
  var defTn = 10 + getModifier(enemy.stats.def)

  // Attack roll
  var attackResult = d20Check(strMod, defTn)

  var result = {
    attacker: player.name,
    attackerUid: playerUid,
    target: enemy.name,
    targetId: targetEnemyId,
    attackRoll: attackResult,
    damage: 0,
    enemyDefeated: false,
  }

  if (attackResult.success || attackResult.crit) {
    // Determine weapon die (default d6 shortsword if nothing equipped)
    var weaponDie = 6
    if (player.equipped && player.equipped.weapon && player.equipped.weapon.die) {
      weaponDie = player.equipped.weapon.die
    }

    var dmgResult = rollDamage(weaponDie, strMod)
    var finalDmg = applyDefence(dmgResult.total, enemy.stats.def)

    // Crits double damage
    if (attackResult.crit) {
      finalDmg = finalDmg * 2
    }

    enemy.currentHp = Math.max(0, enemy.currentHp - finalDmg)
    result.damage = finalDmg

    if (enemy.currentHp <= 0) {
      enemy.isDown = true
      result.enemyDefeated = true
    }
  }

  return result
}

// Resolve an enemy attack on a player
function resolveEnemyAttack(battleState, enemyId) {
  var enemy = battleState.enemies.find(function(e) { return e.id === enemyId })
  if (!enemy || enemy.isDown) return null

  // Pick a random living player to attack
  var livingPlayers = Object.values(battleState.players).filter(function(p) { return !p.isDown })
  if (livingPlayers.length === 0) return null

  var target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)]

  var strMod = getModifier(enemy.stats.str)
  var defTn = 10 + getModifier(target.combatStats.def)

  var attackResult = d20Check(strMod, defTn)

  var result = {
    attacker: enemy.name,
    attackerId: enemyId,
    target: target.name,
    targetUid: target.uid,
    attackRoll: attackResult,
    damage: 0,
    playerDowned: false,
  }

  if (attackResult.success || attackResult.crit) {
    var dmgResult = rollDamage(enemy.weaponDie, strMod)
    var finalDmg = applyDefence(dmgResult.total, target.combatStats.def)

    if (attackResult.crit) {
      finalDmg = finalDmg * 2
    }

    target.currentHp = Math.max(0, target.currentHp - finalDmg)
    result.damage = finalDmg

    if (target.currentHp <= 0) {
      target.isDown = true
      result.playerDowned = true
    }
  }

  return result
}

// Advance to next living combatant
function advanceTurn(battleState) {
  var maxIterations = battleState.turnOrder.length * 2
  var iterations = 0

  do {
    battleState.currentTurnIndex = (battleState.currentTurnIndex + 1) % battleState.turnOrder.length

    // New round when we wrap
    if (battleState.currentTurnIndex === 0) {
      battleState.round++
    }

    var actor = getActor(battleState, getCurrentTurnId(battleState))
    iterations++

    // Skip downed actors
    if (actor && !actor.data.isDown) break
  } while (iterations < maxIterations)

  return battleState
}

// Check win/lose conditions
function checkBattleEnd(battleState) {
  var allEnemiesDown = battleState.enemies.every(function(e) { return e.isDown })
  var allPlayersDown = Object.values(battleState.players).every(function(p) { return p.isDown })

  if (allEnemiesDown) return 'victory'
  if (allPlayersDown) return 'defeat'
  return null
}

// Calculate XP from defeated enemies
function calculateXp(battleState) {
  var xp = 0
  battleState.enemies.forEach(function(e) {
    if (e.isDown) xp += e.xp
  })
  // Bonus for winning the encounter
  xp += 25
  return xp
}

export { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp }
