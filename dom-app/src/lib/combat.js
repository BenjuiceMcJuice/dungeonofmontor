// Combat engine — multiplayer-ready from day one
// Returns NEW state objects (never mutates) so React re-renders correctly
import { roll, rollWithMod, d20Check, rollDamage, applyDefence } from './dice.js'
import { getModifier } from './classes.js'

// Deep-clone battle state for immutable updates
function cloneBattle(bs) {
  return {
    players: Object.keys(bs.players).reduce(function(acc, uid) {
      acc[uid] = Object.assign({}, bs.players[uid], {
        combatStats: Object.assign({}, bs.players[uid].combatStats),
        statusEffects: bs.players[uid].statusEffects.slice(),
      })
      return acc
    }, {}),
    enemies: bs.enemies.map(function(e) {
      return Object.assign({}, e, { stats: Object.assign({}, e.stats) })
    }),
    turnOrder: bs.turnOrder.slice(),
    turnOrderDetails: bs.turnOrderDetails.slice(),
    currentTurnIndex: bs.currentTurnIndex,
    round: bs.round,
    inBattle: bs.inBattle,
    log: bs.log.slice(),
  }
}

// Build initial BattleState from party and enemies
function createBattleState(players, enemies) {
  var playerStates = {}
  var turnOrder = []

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

  var enemyStates = enemies.map(function(e) {
    var agiMod = getModifier(e.stats.agi)
    var initRoll = rollWithMod(20, agiMod)
    e.initiativeRoll = initRoll.total
    turnOrder.push({ id: e.id, type: 'enemy', initiative: initRoll.total, agi: e.stats.agi })
    return e
  })

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

function getCurrentTurnId(battleState) {
  return battleState.turnOrder[battleState.currentTurnIndex]
}

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

// Resolve player attack — accepts pre-rolled attackResult from DiceRoller
// This ensures the roll the player SEES is the roll that determines the outcome
function resolvePlayerAttack(battleState, playerUid, targetEnemyId, attackResult) {
  var bs = cloneBattle(battleState)
  var player = bs.players[playerUid]
  var enemy = bs.enemies.find(function(e) { return e.id === targetEnemyId })
  if (!player || !enemy || player.isDown || enemy.isDown) return null

  var strMod = getModifier(player.combatStats.str)

  // If no pre-rolled result provided, roll now (for AI/multiplayer use)
  if (!attackResult) {
    var defTn = 10 + getModifier(enemy.stats.def)
    attackResult = d20Check(strMod, defTn)
  }

  // Enforce D&D natural roll rules:
  // Natural 1 = ALWAYS miss regardless of modifiers
  // Natural 20 = ALWAYS hit regardless of target
  var isHit = false
  if (attackResult.fumble) {
    isHit = false  // nat 1 always misses
  } else if (attackResult.crit) {
    isHit = true   // nat 20 always hits
  } else {
    isHit = attackResult.success
  }

  var result = {
    attacker: player.name,
    attackerUid: playerUid,
    target: enemy.name,
    targetId: targetEnemyId,
    attackRoll: attackResult,
    damage: 0,
    enemyDefeated: false,
  }

  if (isHit) {
    var weaponDie = 6
    if (player.equipped && player.equipped.weapon && player.equipped.weapon.die) {
      weaponDie = player.equipped.weapon.die
    }

    var dmgResult = rollDamage(weaponDie, strMod)
    var finalDmg = applyDefence(dmgResult.total, enemy.stats.def)

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

  return { newBattle: bs, result: result }
}

// Resolve enemy attack — returns { newBattle, result }
// Same nat 1/nat 20 rules as player attacks
function resolveEnemyAttack(battleState, enemyId) {
  var bs = cloneBattle(battleState)
  var enemy = bs.enemies.find(function(e) { return e.id === enemyId })
  if (!enemy || enemy.isDown) return null

  var livingPlayers = Object.values(bs.players).filter(function(p) { return !p.isDown })
  if (livingPlayers.length === 0) return null

  var target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)]

  var strMod = getModifier(enemy.stats.str)
  var defTn = 10 + getModifier(target.combatStats.def)
  var attackResult = d20Check(strMod, defTn)

  // Enforce nat 1/nat 20 rules
  var isHit = false
  if (attackResult.fumble) {
    isHit = false
  } else if (attackResult.crit) {
    isHit = true
  } else {
    isHit = attackResult.success
  }

  var result = {
    attacker: enemy.name,
    attackerId: enemyId,
    target: target.name,
    targetUid: target.uid,
    attackRoll: attackResult,
    damage: 0,
    playerDowned: false,
  }

  if (isHit) {
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

  return { newBattle: bs, result: result }
}

// Advance to next living combatant — returns new battle state
function advanceTurn(battleState) {
  var bs = cloneBattle(battleState)
  var maxIterations = bs.turnOrder.length * 2
  var iterations = 0

  do {
    bs.currentTurnIndex = (bs.currentTurnIndex + 1) % bs.turnOrder.length
    if (bs.currentTurnIndex === 0) {
      bs.round++
    }
    var actor = getActor(bs, getCurrentTurnId(bs))
    iterations++
    if (actor && !actor.data.isDown) break
  } while (iterations < maxIterations)

  return bs
}

function checkBattleEnd(battleState) {
  var allEnemiesDown = battleState.enemies.every(function(e) { return e.isDown })
  var allPlayersDown = Object.values(battleState.players).every(function(p) { return p.isDown })
  if (allEnemiesDown) return 'victory'
  if (allPlayersDown) return 'defeat'
  return null
}

function calculateXp(battleState) {
  var xp = 0
  battleState.enemies.forEach(function(e) {
    if (e.isDown) xp += e.xp
  })
  xp += 25
  return xp
}

export { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp }
