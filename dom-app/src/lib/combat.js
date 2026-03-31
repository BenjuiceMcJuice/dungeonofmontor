// Combat engine — multiplayer-ready from day one
// Returns NEW state objects (never mutates) so React re-renders correctly
// Uses 4-tier attack resolution: Crit / Hit / Glancing Blow / Miss
import { roll, rollWithMod, d20Attack, rollDamage, applyDefence } from './dice.js'
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

// Calculate damage for a given tier — returns breakdown object
// Order: raw damage (weapon + STR) → tier multiplier → DEF reduction
function calculateTierDamage(weaponRoll, strMod, tier, defStat, critMultiplier) {
  if (tier === 4) return { final: 0, weaponRoll: weaponRoll, strMod: strMod, raw: 0, tierMul: 'miss', afterTier: 0, defReduction: 0 }

  var raw = Math.max(weaponRoll + strMod, 1)
  var afterTier = raw
  var tierMul = 'x1'
  if (tier === 1) { afterTier = Math.round(raw * (critMultiplier || 2.0)); tierMul = 'x' + (critMultiplier || 2.0) }
  if (tier === 3) { afterTier = Math.max(Math.round(raw / 2), 1); tierMul = 'x0.5' }

  var defReduction = Math.floor(defStat / 2)
  var final_ = Math.max(afterTier - defReduction, 1)

  return {
    final: final_,
    weaponRoll: weaponRoll,
    strMod: strMod,
    raw: raw,
    tierMul: tierMul,
    afterTier: afterTier,
    defReduction: defReduction,
  }
}

// Resolve player attack — 4-tier system
function resolvePlayerAttack(battleState, playerUid, targetEnemyId, attackResult) {
  var bs = cloneBattle(battleState)
  var player = bs.players[playerUid]
  var enemy = bs.enemies.find(function(e) { return e.id === targetEnemyId })
  if (!player || !enemy || player.isDown || enemy.isDown) return null

  var strMod = getModifier(player.combatStats.str)

  // If no pre-rolled result provided, roll now
  if (!attackResult) {
    attackResult = d20Attack(strMod, 20)
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

  // Calculate damage based on tier
  if (attackResult.tier <= 3) {
    var weaponDie = 6
    if (player.equipped && player.equipped.weapon) {
      weaponDie = player.equipped.weapon.damageDie || player.equipped.weapon.die || 6
    }

    var dmgResult = rollDamage(weaponDie, strMod)
    var breakdown = calculateTierDamage(dmgResult.roll, strMod, attackResult.tier, enemy.stats.def, 2.0)

    enemy.currentHp = Math.max(0, enemy.currentHp - breakdown.final)
    result.damage = breakdown.final
    result.damageBreakdown = breakdown

    if (enemy.currentHp <= 0) {
      enemy.isDown = true
      result.enemyDefeated = true
    }
  }

  return { newBattle: bs, result: result }
}

// Resolve enemy attack — 4-tier system
function resolveEnemyAttack(battleState, enemyId) {
  var bs = cloneBattle(battleState)
  var enemy = bs.enemies.find(function(e) { return e.id === enemyId })
  if (!enemy || enemy.isDown) return null

  var livingPlayers = Object.values(bs.players).filter(function(p) { return !p.isDown })
  if (livingPlayers.length === 0) return null

  var target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)]

  var strMod = getModifier(enemy.stats.str)
  var attackResult = d20Attack(strMod, 20)

  var result = {
    attacker: enemy.name,
    attackerId: enemyId,
    target: target.name,
    targetUid: target.uid,
    attackRoll: attackResult,
    damage: 0,
    playerDowned: false,
  }

  if (attackResult.tier <= 3) {
    var dmgResult = rollDamage(enemy.weaponDie, strMod)
    var breakdown = calculateTierDamage(dmgResult.roll, strMod, attackResult.tier, target.combatStats.def, 2.0)

    target.currentHp = Math.max(0, target.currentHp - breakdown.final)
    result.damage = breakdown.final
    result.damageBreakdown = breakdown

    if (target.currentHp <= 0) {
      target.isDown = true
      result.playerDowned = true
    }
  }

  return { newBattle: bs, result: result }
}

// Advance to next living combatant
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
