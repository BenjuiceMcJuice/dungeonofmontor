// Combat engine — multiplayer-ready from day one
// Returns NEW state objects (never mutates) so React re-renders correctly
// Uses 4-tier attack resolution: Crit / Hit / Glancing Blow / Miss
import { roll, rollWithMod, d20Attack, rollDamage, applyDefence } from './dice.js'
import { getModifier } from './classes.js'
import { generateEnemy } from './enemies.js'
import { tickConditions, applyCondition, rollConditionApplication, getEnemyCondition, getAllRollsMod, getConditionStatMod, getForcedTier, hasForceCrit, getMissChance, getDamageTakenMultiplier, checkConditionReactions } from './conditions.js'

// Helper: collect all passive items from player equipment (relics + rings + armour + helmet + boots + amulet)
function getPlayerPassiveItems(player) {
  var items = []
  if (!player.equipped) return items
  var eq = player.equipped
  if (eq.relics) { for (var i = 0; i < eq.relics.length; i++) items.push(eq.relics[i]) }
  if (eq.rings) { for (var ri = 0; ri < eq.rings.length; ri++) items.push(eq.rings[ri]) }
  if (eq.armour) items.push(eq.armour)
  if (eq.helmet) items.push(eq.helmet)
  if (eq.boots) items.push(eq.boots)
  if (eq.amulet) items.push(eq.amulet)
  return items
}

// Helper: check if any passive item has a specific effect
function hasPassiveEffect(player, effectName) {
  var items = getPlayerPassiveItems(player)
  for (var i = 0; i < items.length; i++) {
    if (items[i].passiveEffect === effectName) return true
  }
  return false
}

// Helper: get total passive value for a specific effect
function getPassiveTotalCombat(player, effectName) {
  var total = 0
  var items = getPlayerPassiveItems(player)
  for (var i = 0; i < items.length; i++) {
    if (items[i].passiveEffect === effectName) total += (items[i].passiveValue || 0)
  }
  return total
}

// Stamp condition enhancements from player equipment onto applied condition
function enhanceAppliedCondition(statusEffects, conditionId, player) {
  var cond = statusEffects.find(function(c) { return c.id === conditionId })
  if (!cond) return

  // Fever Stone — condition DoT multiplier (+50%)
  var dotMul = getPassiveTotalCombat(player, 'condition_dot_multiplier')
  if (dotMul > 0 && cond.damagePerTurn > 0) {
    cond.damagePerTurn = Math.round(cond.damagePerTurn * dotMul)
  }
  if (dotMul > 0 && cond.burstDamage > 0) {
    cond.burstDamage = Math.round(cond.burstDamage * dotMul)
  }

  // Rusty Nail Chain — poison enhanced drain
  var poisonDrain = getPassiveTotalCombat(player, 'poison_enhanced_drain')
  if (poisonDrain > 0 && cond.statDrain) {
    cond.statDrainValue = -(poisonDrain) // override to -2 (or whatever passiveValue is)
  }

  // Petrol Can / Napalm — burn lingers extra turns
  var burnLinger = getPassiveTotalCombat(player, 'burn_linger')
  // Also check gift mind slot for napalm effect
  var gifts2 = player._gifts || {}
  if (gifts2.mind && gifts2.mind.effect === 'burn_linger') burnLinger += (gifts2.mind.lingerTurns || 1)
  if (burnLinger > 0 && cond.id === 'BURN') {
    cond.turnsRemaining = (cond.turnsRemaining || 1) + burnLinger
    if (!cond.damagePerTurn) cond.damagePerTurn = 2 // linger damage per extra turn
  }

  // Barbed Wire Twist — bleed enhanced damage (+1 per stack)
  var bleedBonus = getPassiveTotalCombat(player, 'bleed_enhanced_damage')
  if (bleedBonus > 0 && cond.id === 'BLEED') {
    cond.damagePerTurn += bleedBonus * (cond.stacks || 1)
  }
}

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
      return Object.assign({}, e, { stats: Object.assign({}, e.stats), statusEffects: e.statusEffects ? e.statusEffects.slice() : [] })
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

    // Apply all equipment penalties/bonuses to combat stats
    var combatStats = Object.assign({}, char.stats)
    if (char.equipped) {
      var w = char.equipped.weapon
      var a = char.equipped.armour
      var o = char.equipped.offhand
      var h = char.equipped.helmet
      var b = char.equipped.boots
      if (w && w.agiPenalty) combatStats.agi = Math.max(1, combatStats.agi + w.agiPenalty)
      if (a && a.agiPenalty) combatStats.agi = Math.max(1, combatStats.agi + a.agiPenalty)
      if (o && o.agiPenalty) combatStats.agi = Math.max(1, combatStats.agi + o.agiPenalty)
      if (h && h.agiPenalty) combatStats.agi = Math.max(1, combatStats.agi + h.agiPenalty)
      if (b && b.agiPenalty) combatStats.agi = Math.max(1, combatStats.agi + b.agiPenalty)
      // AGI bonuses from boots
      if (b && b.agiBonus) combatStats.agi += b.agiBonus
      // STR bonuses from boots (boxing boots)
      if (b && b.strBonus) combatStats.str += b.strBonus
      // Passive stat bonuses from relics/rings/amulets
      var cItems = getPlayerPassiveItems({ equipped: char.equipped })
      for (var csi = 0; csi < cItems.length; csi++) {
        if (cItems[csi].passiveEffect === 'str_bonus') combatStats.str += (cItems[csi].passiveValue || 0)
      }
    }

    var agiMod = getModifier(combatStats.agi)
    var weaponInitBonus = (char.equipped && char.equipped.weapon) ? (char.equipped.weapon.initBonus || 0) : 1 // unarmed: +1 init
    // Init bonuses from boots/helmet
    var bootInitBonus = (char.equipped && char.equipped.boots && char.equipped.boots.initBonus) || 0
    var helmetInitBonus = (char.equipped && char.equipped.helmet && char.equipped.helmet.initBonus) || 0
    var initRoll = rollWithMod(20, agiMod + weaponInitBonus + bootInitBonus + helmetInitBonus)

    playerStates[p.uid] = {
      uid: p.uid,
      name: char.name,
      className: char.class,
      level: char.level,
      currentHp: char.maxHp,
      maxHp: char.maxHp,
      combatStats: combatStats,
      equipped: Object.assign({}, char.equipped),
      activeInventory: char.inventory ? char.inventory.slice() : [],
      statusEffects: [],
      initiativeRoll: initRoll.total,
      isDown: false,
    }

    turnOrder.push({ id: p.uid, type: 'player', initiative: initRoll.total, agi: combatStats.agi })
  })

  var enemyStates = enemies.map(function(e) {
    var agiMod = getModifier(e.stats.agi)
    var initRoll = rollWithMod(20, agiMod)
    e.initiativeRoll = initRoll.total
    if (!e.statusEffects) e.statusEffects = []
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
// Order: raw damage (weapon + STR) → tier multiplier → percentage DEF reduction
function calculateTierDamage(weaponRoll, strMod, tier, defStat, critMultiplier) {
  if (tier === 4) return { final: 0, weaponRoll: weaponRoll, strMod: strMod, raw: 0, tierMul: 'miss', afterTier: 0, defReduction: 0 }

  var raw = Math.max(weaponRoll + strMod, 1)
  var afterTier = raw
  var tierMul = 'x1'
  if (tier === 1) { afterTier = Math.round(raw * (critMultiplier || 2.0)); tierMul = 'x' + (critMultiplier || 2.0) }
  if (tier === 3) { afterTier = Math.max(Math.round(raw / 2), 1); tierMul = 'x0.5' }

  // Percentage-based DEF: each point = 2% reduction, capped at 50%
  var defPct = Math.min(defStat * 2, 50) / 100
  var defReduction = Math.floor(afterTier * defPct)
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

// Tick conditions at start of a combatant's turn
// Returns { newBattle, damage, skipped, narrative, died }
function tickTurnStart(battleState, actorId) {
  var bs = cloneBattle(battleState)
  var actor = getActor(bs, actorId)
  if (!actor || actor.data.isDown) return { newBattle: bs, damage: 0, skipped: false, narrative: '', died: false }

  var entity = actor.data
  var effects = entity.statusEffects || []
  if (effects.length === 0) return { newBattle: bs, damage: 0, skipped: false, narrative: '', died: false }

  var result = tickConditions(effects, entity.currentHp, entity.maxHp)
  entity.statusEffects = result.newEffects
  entity.currentHp = Math.max(0, entity.currentHp - result.damage)

  // BURN AoE — spread fire damage to other enemies (or players if enemy burned)
  if (result.aoeDamage > 0) {
    if (actor.type === 'enemy') {
      // Burn spreads to other living enemies
      bs.enemies.forEach(function(e) {
        if (e.id !== actorId && !e.isDown) {
          e.currentHp = Math.max(0, e.currentHp - result.aoeDamage)
          if (e.currentHp <= 0) e.isDown = true
        }
      })
    } else {
      // Burn on player spreads to... nothing in solo. Future: party members.
    }
  }

  var died = false
  if (entity.currentHp <= 0) {
    entity.isDown = true
    died = true
  }

  return {
    newBattle: bs,
    damage: result.damage,
    skipped: result.skipped,
    narrative: result.narrative,
    died: died,
  }
}

// Resolve player attack — 4-tier system
function resolvePlayerAttack(battleState, playerUid, targetEnemyId, attackResult) {
  var bs = cloneBattle(battleState)
  var player = bs.players[playerUid]
  var enemy = bs.enemies.find(function(e) { return e.id === targetEnemyId })
  if (!player || !enemy || player.isDown || enemy.isDown) return null

  var condStatMod = getConditionStatMod(player.statusEffects, 'str')
  var strMod = getModifier(player.combatStats.str) + condStatMod
  var rollsMod = getAllRollsMod(player.statusEffects)

  // Check for forced tier (DAZE)
  var forcedTier = getForcedTier(player.statusEffects)

  // Check for extra miss chance (BLIND)
  var missChance = getMissChance(player.statusEffects)

  // If no pre-rolled result provided, roll now (includes weapon accuracy bonus)
  if (!attackResult) {
    var accBonus = (player.equipped && player.equipped.weapon) ? (player.equipped.weapon.accuracyBonus || 0) : -1 // unarmed: -1 accuracy
    // Gift: Predator's Focus (blood mind) — +1 accuracy
    var gifts = player._gifts || {}
    if (gifts.mind && gifts.mind.effect === 'fear_immunity_and_accuracy' && gifts.mind.accuracyBonus) {
      accBonus += gifts.mind.accuracyBonus
    }
    // Nudge — +1 to d20 rolls
    var nudgeBonus = getPassiveTotalCombat(player, 'd20_nudge')
    var chaosShift = 0
    var passiveItems = getPlayerPassiveItems(player)
    for (var ni = 0; ni < passiveItems.length; ni++) {
      if (passiveItems[ni].passiveEffect === 'chaos_shift') {
        var range = passiveItems[ni].passiveValue || 2
        chaosShift = Math.floor(Math.random() * (range * 2 + 1)) - range
      }
    }
    attackResult = d20Attack(strMod + rollsMod + accBonus + nudgeBonus + chaosShift, 20)
    if (nudgeBonus > 0) attackResult.nudge = nudgeBonus
    if (chaosShift !== 0) attackResult.chaosShift = chaosShift

    // --- DICE-TRIGGERED RELIC EFFECTS ---

    // Metronome: every Nth turn, force crit
    for (var mi = 0; mi < passiveItems.length; mi++) {
      if (passiveItems[mi].passiveEffect === 'metronome') {
        passiveItems[mi]._metronomeCount = (passiveItems[mi]._metronomeCount || 0) + 1
        if (passiveItems[mi]._metronomeCount >= passiveItems[mi].passiveValue) {
          attackResult = Object.assign({}, attackResult, { tier: 1, tierName: 'crit' })
          passiveItems[mi]._metronomeCount = 0
          result.metronomeCrit = true
        }
      }
    }

    // Gremlin Bell: nat 1 → apply random condition to enemy instead of fumble
    if (attackResult.roll === 1) {
      for (var gi = 0; gi < passiveItems.length; gi++) {
        if (passiveItems[gi].passiveEffect === 'gremlin_bell') {
          var gremlinConditions = ['BLEED', 'POISON', 'BURN', 'FROST', 'DAZE', 'FEAR', 'BLIND', 'NAUSEA']
          var gremlinPick = gremlinConditions[Math.floor(Math.random() * gremlinConditions.length)]
          enemy.statusEffects = applyCondition(enemy.statusEffects || [], gremlinPick, 'gremlin')
          attackResult = Object.assign({}, attackResult, { tier: 3, tierName: 'glancing' }) // upgrade from miss
          result.gremlinBell = true
          result.gremlinCondition = gremlinPick
          break
        }
      }
    }

    // Magic 8-Ball: nat 20 triggers d6 effect
    if (attackResult.roll === 20) {
      for (var m8i = 0; m8i < passiveItems.length; m8i++) {
        if (passiveItems[m8i].passiveEffect === 'magic_8_ball') {
          var m8roll = Math.floor(Math.random() * 6) + 1
          result.magic8Ball = true
          result.magic8BallRoll = m8roll
          if (m8roll === 1) {
            // Instakill
            enemy.currentHp = 0; enemy.isDown = true; result.enemyDefeated = true
            result.magic8BallEffect = 'instakill'
          } else if (m8roll === 2) {
            result.magic8BallEffect = 'full_heal'
          } else if (m8roll === 3) {
            result.magic8BallEffect = 'double_gold'
          } else if (m8roll === 4) {
            result.magic8BallEffect = 'fear_self'
          } else if (m8roll === 5) {
            bs.enemies.forEach(function(e8) {
              if (!e8.isDown) e8.statusEffects = applyCondition(e8.statusEffects || [], 'DAZE', 'magic_8_ball')
            })
            result.magic8BallEffect = 'daze_all'
          } else {
            result.magic8BallEffect = 'nothing'
          }
          break
        }
      }
    }

    // Pressure Cooker: count nat 1s (persistent)
    if (attackResult.roll === 1) {
      for (var pci = 0; pci < passiveItems.length; pci++) {
        if (passiveItems[pci].passiveEffect === 'pressure_cooker') {
          passiveItems[pci]._pressureCount = (passiveItems[pci]._pressureCount || 0) + 1
          if (passiveItems[pci]._pressureCount >= passiveItems[pci].passiveValue) {
            // DETONATE — 15 AoE + BURN + DAZE all
            bs.enemies.forEach(function(e2) {
              if (!e2.isDown) {
                e2.currentHp = Math.max(0, e2.currentHp - 15)
                e2.statusEffects = applyCondition(e2.statusEffects || [], 'BURN', 'pressure_cooker')
                e2.statusEffects = applyCondition(e2.statusEffects, 'DAZE', 'pressure_cooker')
                if (e2.currentHp <= 0) e2.isDown = true
              }
            })
            passiveItems[pci]._pressureCount = 0
            result.pressureCookerDetonated = true
          } else {
            result.pressureCookerCount = passiveItems[pci]._pressureCount
          }
          break
        }
      }
    }
  }

  // Apply forced tier
  if (forcedTier && attackResult.tier < forcedTier) {
    attackResult = Object.assign({}, attackResult, { tier: forcedTier, tierName: forcedTier === 3 ? 'glancing' : attackResult.tierName })
  }

  // Apply forced crit (ADRENALINE)
  var isForcedCrit = hasForceCrit(player.statusEffects)
  if (isForcedCrit && attackResult.tier > 1) {
    attackResult = Object.assign({}, attackResult, { tier: 1, tierName: 'crit' })
  }

  // Apply miss chance
  if (missChance > 0 && attackResult.tier <= 3 && Math.random() < missChance) {
    attackResult = Object.assign({}, attackResult, { tier: 4, tierName: 'miss' })
  }

  var result = {
    attacker: player.name,
    attackerUid: playerUid,
    target: enemy.name,
    targetId: targetEnemyId,
    attackRoll: attackResult,
    damage: 0,
    enemyDefeated: false,
    conditionApplied: null,
    adrenalineCrit: isForcedCrit,
  }

  // Gift: Shadow Blade (void weapon) — misses have 30% chance to deal half damage
  var gifts = player._gifts || {}
  if (attackResult.tier === 4 && gifts.weapon && gifts.weapon.effect === 'miss_damage_chance' && Math.random() < gifts.weapon.chance) {
    // Treat as glancing blow for damage calc
    attackResult = Object.assign({}, attackResult, { tier: 3, tierName: 'glancing' })
    result.shadowBlade = true
  }

  // Calculate damage based on tier
  var isUnarmed = !player.equipped || !player.equipped.weapon
  if (attackResult.tier <= 3) {
    var weaponDie = 4 // unarmed: d4
    var unarmedStrBonus = 0
    if (!isUnarmed) {
      weaponDie = player.equipped.weapon.damageDie || player.equipped.weapon.die || 6
    } else {
      // Unarmed — STR mod counts double for damage
      unarmedStrBonus = Math.max(0, strMod)
      // Unarmed die upgrade from gear (e.g. Sovereign amulet d4→d6)
      var allItems = getPlayerPassiveItems(player)
      for (var udi = 0; udi < allItems.length; udi++) {
        if (allItems[udi].unarmedBonus && allItems[udi].unarmedDieUpgrade) {
          weaponDie = Math.max(weaponDie, allItems[udi].unarmedDieUpgrade)
        }
        if (allItems[udi].unarmedBonus && allItems[udi].unarmedDamageBonus) {
          unarmedStrBonus += allItems[udi].unarmedDamageBonus
        }
      }
      // Gift unarmed die upgrade (Stonefist d6, Forge Fists d6)
      var giftW = (player._gifts || {}).weapon
      if (giftW && giftW.dieUpgrade) {
        weaponDie = Math.max(weaponDie, giftW.dieUpgrade)
      }
    }

    var dmgResult = rollDamage(weaponDie, strMod + unarmedStrBonus)

    // Chaos Marble — shift damage die too
    if (attackResult.chaosShift) {
      dmgResult = Object.assign({}, dmgResult, { roll: Math.max(1, dmgResult.roll + attackResult.chaosShift) })
    }

    // Reroll ones — Loaded Dice / Rabbit's Foot
    if (dmgResult.roll === 1 && hasPassiveEffect(player, 'reroll_ones')) {
      dmgResult = rollDamage(weaponDie, strMod)
      result.rerolled = true
    }

    var weapon = player.equipped && player.equipped.weapon

    // INT bonus — enchanted weapons deal extra damage per INT modifier
    var intDmgBonus = 0
    if (weapon && weapon.conditionOnHit) {
      var intMod = getModifier(player.combatStats.int || 10)
      intDmgBonus = Math.max(0, intMod)
    }

    // Gift: Bloodrage (blood mind) — +2 STR when HP below 50%
    var gifts = player._gifts || {}
    var giftStrBonus = 0
    if (gifts.mind && gifts.mind.effect === 'low_hp_stat_bonus' && gifts.mind.stat === 'str' && player.currentHp < player.maxHp * gifts.mind.hpThreshold) {
      giftStrBonus = gifts.mind.value
    }

    // DEF ignore — maces bypass a % of enemy DEF
    var defWithConditions = enemy.stats.def + getConditionStatMod(enemy.statusEffects || [], 'def')
    var effectiveDef = Math.max(0, defWithConditions)
    if (weapon && weapon.defIgnore) {
      effectiveDef = Math.max(0, Math.round(effectiveDef * (1 - weapon.defIgnore)))
    }
    // Gift: Earthshatter (stone weapon) — extra DEF ignore
    if (gifts.weapon && gifts.weapon.effect === 'def_ignore_bonus') {
      effectiveDef = Math.max(0, Math.round(effectiveDef * (1 - gifts.weapon.value)))
    }
    // Gift: Void Strike — 10% chance to ignore ALL DEF
    if (gifts.weapon && gifts.weapon.effect === 'full_def_ignore_chance' && Math.random() < gifts.weapon.chance) {
      effectiveDef = 0
      result.voidStrike = true
    }

    // Gift: Avalanche (stone weapon) — crit multiplier override
    var critMul = 2.0
    if (gifts.weapon && gifts.weapon.effect === 'crit_multiplier') critMul = gifts.weapon.value

    var breakdown = calculateTierDamage(dmgResult.roll, strMod + intDmgBonus + giftStrBonus, attackResult.tier, effectiveDef, critMul)

    // Gift: Molten Edge (ember weapon) — flat damage bonus
    if (gifts.weapon && gifts.weapon.effect === 'flat_damage_bonus') {
      breakdown.final += gifts.weapon.value
    }

    // Gift: Entropy Edge (void weapon) — random +50% or -25% damage
    if (gifts.weapon && gifts.weapon.effect === 'chaos_damage') {
      if (Math.random() < gifts.weapon.highChance) {
        breakdown.final = Math.round(breakdown.final * gifts.weapon.highMultiplier)
        result.entropyHigh = true
      } else {
        breakdown.final = Math.round(breakdown.final * gifts.weapon.lowMultiplier)
        result.entropyLow = true
      }
    }

    // Brittle — FROST increases damage taken
    var enemyBrittleMul = getDamageTakenMultiplier(enemy.statusEffects || [])
    if (enemyBrittleMul > 1) breakdown.final = Math.round(breakdown.final * enemyBrittleMul)

    // Amulet damage modifiers
    var flatDmgBonus = getPassiveTotalCombat(player, 'flat_damage_bonus')
    if (flatDmgBonus > 0) breakdown.final += flatDmgBonus

    var dmgMul = getPassiveTotalCombat(player, 'damage_multiplier')
    if (dmgMul > 0) breakdown.final = Math.round(breakdown.final * dmgMul)

    // Blood Bead — 1.5x when HP below 50%
    var lowHpMul = getPassiveTotalCombat(player, 'damage_multiplier_low_hp')
    if (lowHpMul > 0 && player.currentHp < player.maxHp * 0.5) {
      breakdown.final = Math.round(breakdown.final * lowHpMul)
      result.lowHpBonus = true
    }

    // Executioner's Coin — first hit multiplier (flag managed by caller)
    var firstHitMul = getPassiveTotalCombat(player, 'first_hit_multiplier')
    if (firstHitMul > 0 && player._firstHitAvailable) {
      breakdown.final = Math.round(breakdown.final * firstHitMul)
      player._firstHitAvailable = false
      result.firstHitCrit = true
    }

    // Coin Flip: 50% +3 dmg, 50% -2 dmg
    if (hasPassiveEffect(player, 'coin_flip')) {
      if (Math.random() < 0.5) { breakdown.final += 3; result.coinFlipWin = true }
      else { breakdown.final = Math.max(1, breakdown.final - 2); result.coinFlipLose = true }
    }

    // Double or Nothing: on crit, 50% double or becomes miss
    if (hasPassiveEffect(player, 'double_or_nothing') && attackResult.tierName === 'crit') {
      if (Math.random() < 0.5) { breakdown.final = breakdown.final * 2; result.doubleOrNothingWin = true }
      else { breakdown.final = 0; result.doubleOrNothingLose = true }
    }

    // Egg Timer: +50% damage after 3 turns without a kill
    if (hasPassiveEffect(player, 'egg_timer') && player._turnsWithoutKill >= 3) {
      breakdown.final = Math.round(breakdown.final * 1.5)
      result.eggTimerBonus = true
    }

    // Chaos Blade: d20 roll determines condition applied
    var weapon2 = player.equipped && player.equipped.weapon
    if (weapon2 && weapon2.chaosCondition && attackResult.tier <= 3) {
      var chaosRoll = attackResult.roll
      var chaosCond = null
      if (chaosRoll === 1) { result.chaosBackfire = true; /* self-damage handled by caller */ }
      else if (chaosRoll <= 5) chaosCond = 'NAUSEA'
      else if (chaosRoll <= 8) chaosCond = 'DAZE'
      else if (chaosRoll <= 11) chaosCond = 'FEAR'
      else if (chaosRoll <= 14) chaosCond = 'BLEED'
      else if (chaosRoll <= 16) chaosCond = 'POISON'
      else if (chaosRoll <= 18) chaosCond = 'FROST'
      else if (chaosRoll === 19) chaosCond = 'BURN'
      else if (chaosRoll >= 20) {
        // DEVASTATION — all conditions
        var devConds = ['BLEED', 'POISON', 'BURN', 'FROST', 'FEAR', 'DAZE']
        for (var dci = 0; dci < devConds.length; dci++) {
          enemy.statusEffects = applyCondition(enemy.statusEffects || [], devConds[dci], 'chaos_blade')
        }
        result.chaosDevastation = true
        chaosCond = null // already applied
      }
      if (chaosCond) {
        enemy.statusEffects = applyCondition(enemy.statusEffects || [], chaosCond, 'chaos_blade')
        result.chaosCondition = chaosCond
      }
    }

    // Nuke: Big Red Button — d20 and weapon die match = instakill all
    if (hasPassiveEffect(player, 'nuke') && attackResult.roll > 0) {
      var wepDie = (weapon2 && weapon2.damageDie) || 4
      var wepRoll = dmgResult ? dmgResult.roll : 0
      if (attackResult.roll === wepRoll && attackResult.roll <= wepDie) {
        // NUKE — everything dies
        bs.enemies.forEach(function(e3) {
          if (!e3.isDown) { e3.currentHp = 0; e3.isDown = true }
        })
        result.nukeTriggered = true
        result.enemyDefeated = true
        // Mark nuke relic for removal by caller
        result.nukeConsumed = true
      }
    }

    breakdown.final = Math.max(breakdown.final >= 0 ? breakdown.final : 0, attackResult.tier <= 3 ? 1 : 0) // minimum 1 damage on hit

    enemy.currentHp = Math.max(0, enemy.currentHp - breakdown.final)
    result.damage = breakdown.final
    result.damageBreakdown = breakdown
    if (intDmgBonus > 0) result.intBonus = intDmgBonus

    // Haemorrhagic Blood — bleed max stacks bonus
    var bleedOptions = null
    var gifts3 = player._gifts || {}
    if (gifts3.body && gifts3.body.effect === 'bleed_max_stacks_bonus') {
      bleedOptions = { maxStacksBonus: gifts3.body.value }
    }

    // Festering Bile — poison stacking
    var poisonStacking = gifts3.body && gifts3.body.effect === 'poison_stacking'

    // Try to apply weapon condition on hit
    if (weapon && weapon.conditionOnHit) {
      var intStat = player.combatStats.int || 10
      // Spear identity: +15% condition chance, conditions last 1 extra turn
      var isSpear = weapon.weaponType === 'spear'
      var spearCondBonus = isSpear ? 0.15 : 0
      // Gift: Corrosive Strike (bile weapon) — +25% condition chance
      var condChanceBonus = (gifts.weapon && gifts.weapon.effect === 'condition_chance_bonus') ? gifts.weapon.value : 0
      if (rollConditionApplication(attackResult.tier, intStat, Math.min(1.0, (weapon.conditionChance || 1.0) + condChanceBonus + spearCondBonus))) {
        var condOpts = weapon.conditionOnHit === 'BLEED' ? bleedOptions : null
        // Festering Bile: stack poison like bleed
        if (poisonStacking && weapon.conditionOnHit === 'POISON') {
          var existingPoison = (enemy.statusEffects || []).find(function(c) { return c.id === 'POISON' })
          if (existingPoison) {
            var pStacks = existingPoison.stacks || 1
            if (pStacks < gifts3.body.maxStacks) {
              existingPoison.stacks = pStacks + 1
              existingPoison.damagePerTurn = (pStacks + 1) * 2
              existingPoison.turnsRemaining = 3 // refresh duration
              existingPoison.name = 'Poisoned x' + (pStacks + 1)
            }
          } else {
            enemy.statusEffects = applyCondition(enemy.statusEffects || [], 'POISON', 'weapon')
          }
        } else {
          enemy.statusEffects = applyCondition(enemy.statusEffects || [], weapon.conditionOnHit, 'weapon', condOpts)
        }
        result.conditionApplied = weapon.conditionOnHit
        // Spear identity: conditions last 1 extra turn
        if (isSpear) {
          var spearCond = enemy.statusEffects.find(function(c) { return c.id === weapon.conditionOnHit })
          if (spearCond && spearCond.turnsRemaining) spearCond.turnsRemaining += 1
        }
        // Gift: Virulent Mind (bile mind) — conditions last 1 extra turn
        if (gifts.mind && gifts.mind.effect === 'condition_duration_bonus') {
          var appliedCond = enemy.statusEffects.find(function(c) { return c.id === weapon.conditionOnHit })
          if (appliedCond && appliedCond.turnsRemaining) appliedCond.turnsRemaining += gifts.mind.value
        }
        // Magnifying Glass — conditions apply twice
        if (hasPassiveEffect(player, 'double_condition')) {
          enemy.statusEffects = applyCondition(enemy.statusEffects, weapon.conditionOnHit, 'weapon')
          result.doubleCondition = true
        }
        // Stamp condition enhancements from amulet
        enhanceAppliedCondition(enemy.statusEffects, weapon.conditionOnHit, player)
        // Check for condition reactions (FROST+BURN=SHATTER etc.)
        var reaction = checkConditionReactions(enemy.statusEffects)
        if (reaction) {
          enemy.statusEffects = reaction.newEffects
          if (reaction.damage > 0) {
            enemy.currentHp = Math.max(0, enemy.currentHp - reaction.damage)
            result.damage += reaction.damage
            if (enemy.currentHp <= 0) { enemy.isDown = true; result.enemyDefeated = true }
          }
          result.conditionReaction = reaction
        }
      }
    }

    // Stagger — heavy weapons can DAZE enemies on hit
    var staggerChance = (weapon && weapon.staggerChance) || 0
    // Tectonic Slam (stone mace): +30% stagger
    if (gifts.weapon && gifts.weapon.effect === 'stagger_extended') staggerChance += (gifts.weapon.staggerBonus || 0)
    if (staggerChance > 0 && breakdown.final > 0 && !enemy.isDown) {
      if (Math.random() < staggerChance) {
        enemy.statusEffects = applyCondition(enemy.statusEffects || [], 'DAZE', 'stagger')
        result.staggerApplied = true
        // Null Crush (void mace): stagger ignores 50% DEF — apply retroactive damage
        if (gifts.weapon && gifts.weapon.effect === 'stagger_def_ignore') {
          var extraFromDef = Math.round(breakdown.defReduction * gifts.weapon.value)
          if (extraFromDef > 0) {
            enemy.currentHp = Math.max(0, enemy.currentHp - extraFromDef)
            result.damage += extraFromDef
            if (enemy.currentHp <= 0) { enemy.isDown = true; result.enemyDefeated = true }
          }
        }
      }
    }

    // Lifesteal — heal % of damage dealt
    var lifestealTotal = getPassiveTotalCombat(player, 'lifesteal')
    if (breakdown.final > 0 && lifestealTotal > 0) {
      var healAmount = Math.max(1, Math.round(breakdown.final * lifestealTotal))
      player.currentHp = Math.min(player.currentHp + healAmount, player.maxHp)
      result.lifestealHeal = healAmount
    }

    if (enemy.currentHp <= 0) {
      enemy.isDown = true
      result.enemyDefeated = true
    }

    // Lottery ticket — check d20 AND weapon die against winning numbers
    if (player.equipped && player.equipped.relics) {
      for (var lti = 0; lti < player.equipped.relics.length; lti++) {
        var lotteryRelic = player.equipped.relics[lti]
        if (lotteryRelic.passiveEffect === 'lottery') {
          var natRoll = attackResult.roll
          // d20 match
          if (lotteryRelic.lotteryD20 && natRoll === lotteryRelic.lotteryD20) {
            result.lotteryWin = true
            result.lotteryNumber = natRoll
            result.lotteryDie = 'd20'
          }
          // Weapon die match
          if (lotteryRelic.lotteryWeapon && dmgResult && dmgResult.roll === lotteryRelic.lotteryWeapon) {
            result.lotteryWin = true
            result.lotteryNumber = dmgResult.roll
            result.lotteryDie = result.lotteryDie ? 'BOTH!' : 'weapon'
          }
        }
      }
    }

    // Unarmed condition (e.g. Costume Ring: 30% BLEED)
    if (isUnarmed && !enemy.isDown && breakdown.final > 0) {
      var unarmedItems = getPlayerPassiveItems(player)
      for (var uci = 0; uci < unarmedItems.length; uci++) {
        if (unarmedItems[uci].unarmedBonus && unarmedItems[uci].unarmedCondition && unarmedItems[uci].unarmedConditionChance) {
          if (Math.random() < unarmedItems[uci].unarmedConditionChance) {
            enemy.statusEffects = applyCondition(enemy.statusEffects || [], unarmedItems[uci].unarmedCondition, 'unarmed_gear')
            result.conditionApplied = unarmedItems[uci].unarmedCondition
          }
        }
      }
    }

    // Double strike — daggers get a chance for a bonus attack (scales with AGI)
    if (!enemy.isDown && weapon && weapon.doubleStrikeBase > 0) {
      var agiMod = getModifier(player.combatStats.agi || 10)
      var doubleChance = weapon.doubleStrikeBase + (agiMod * 0.05) // +5% per AGI mod
      if (Math.random() < Math.min(doubleChance, 0.6)) { // cap at 60%
        var bonusRoll = rollDamage(weaponDie, strMod)
        var bonusBreakdown = calculateTierDamage(bonusRoll.roll, strMod, 2, effectiveDef, 1.0) // always "hit" tier, no crit multiplier
        enemy.currentHp = Math.max(0, enemy.currentHp - bonusBreakdown.final)
        result.damage += bonusBreakdown.final
        result.doubleStrike = true
        result.doubleStrikeDamage = bonusBreakdown.final
        if (enemy.currentHp <= 0) {
          enemy.isDown = true
          result.enemyDefeated = true
        }
        // Double strike can also apply weapon condition (rolled normally)
        if (!enemy.isDown && weapon.conditionOnHit) {
          var dsIntStat = player.combatStats.int || 10
          if (rollConditionApplication(2, dsIntStat, weapon.conditionChance || 1.0)) {
            enemy.statusEffects = applyCondition(enemy.statusEffects || [], weapon.conditionOnHit, 'weapon')
            result.doubleStrikeCondition = weapon.conditionOnHit
            enhanceAppliedCondition(enemy.statusEffects, weapon.conditionOnHit, player)
          }
        }
      }
    }

    // Unarmed double strike (e.g. Hairpin amulet: 25%)
    if (!enemy.isDown && isUnarmed) {
      var unarmedDS = 0
      var uItems2 = getPlayerPassiveItems(player)
      for (var udsi = 0; udsi < uItems2.length; udsi++) {
        if (uItems2[udsi].unarmedBonus && uItems2[udsi].unarmedDoubleStrike) {
          unarmedDS = Math.max(unarmedDS, uItems2[udsi].unarmedDoubleStrike)
        }
      }
      if (unarmedDS > 0 && Math.random() < Math.min(unarmedDS, 0.6)) {
        var uBonusRoll = rollDamage(weaponDie, strMod + unarmedStrBonus)
        var uBonusBreakdown = calculateTierDamage(uBonusRoll.roll, strMod, 2, effectiveDef, 1.0)
        enemy.currentHp = Math.max(0, enemy.currentHp - uBonusBreakdown.final)
        result.damage += uBonusBreakdown.final
        result.doubleStrike = true
        result.doubleStrikeDamage = uBonusBreakdown.final
        if (enemy.currentHp <= 0) { enemy.isDown = true; result.enemyDefeated = true }
      }
    }

    // Dual wield — offhand dagger gets a bonus attack (-2 accuracy, no crits)
    // Phantom Flurry (void dagger): removes penalty + allows crits
    if (!enemy.isDown && player.equipped && player.equipped.offhand && player.equipped.offhand.type === 'weapon') {
      var offhand = player.equipped.offhand
      var phantomFlurry = gifts.weapon && gifts.weapon.effect === 'offhand_enhanced'
      var offhandPenalty = phantomFlurry ? 0 : -2
      var offhandCritThreshold = phantomFlurry ? 20 : 99
      var offhandRoll = d20Attack(strMod + rollsMod + offhandPenalty, offhandCritThreshold)
      if (offhandRoll.tier <= 3) {
        var offDmg = rollDamage(offhand.damageDie || 4, strMod)
        var offBreakdown = calculateTierDamage(offDmg.roll, strMod, offhandRoll.tier, effectiveDef, 1.0)
        enemy.currentHp = Math.max(0, enemy.currentHp - offBreakdown.final)
        result.damage += offBreakdown.final
        result.offhandHit = true
        result.offhandDamage = offBreakdown.final
        // Offhand can apply its own condition
        if (offhand.conditionOnHit) {
          var offInt = player.combatStats.int || 10
          if (rollConditionApplication(offhandRoll.tier, offInt, offhand.conditionChance || 1.0)) {
            enemy.statusEffects = applyCondition(enemy.statusEffects || [], offhand.conditionOnHit, 'offhand_weapon')
            result.offhandCondition = offhand.conditionOnHit
            // Magnifying Glass — double condition on offhand too
            if (player.equipped && player.equipped.relics) {
              for (var odci = 0; odci < player.equipped.relics.length; odci++) {
                if (player.equipped.relics[odci].passiveEffect === 'double_condition') {
                  enemy.statusEffects = applyCondition(enemy.statusEffects, offhand.conditionOnHit, 'offhand_weapon')
                  result.doubleConditionOffhand = true
                  break
                }
              }
            }
          }
        }
        // Check for condition reactions after offhand condition
        var offReaction = checkConditionReactions(enemy.statusEffects)
        if (offReaction) {
          enemy.statusEffects = offReaction.newEffects
          if (offReaction.damage > 0) {
            enemy.currentHp = Math.max(0, enemy.currentHp - offReaction.damage)
            result.damage += offReaction.damage
          }
          if (!result.conditionReaction) result.conditionReaction = offReaction
        }
        if (enemy.currentHp <= 0) {
          enemy.isDown = true
          result.enemyDefeated = true
        }
        // Twin Fangs — dual daggers OR amulet grant: if main hand AND offhand both hit, apply free BLEED
        var hasTwinFangs = (offhand.weaponType === 'dagger' && player.equipped.weapon && player.equipped.weapon.weaponType === 'dagger') ||
            (player.equipped.amulet && player.equipped.amulet.twinFangsGrant)
        if (!enemy.isDown && result.tier <= 3 && hasTwinFangs) {
          enemy.statusEffects = applyCondition(enemy.statusEffects || [], 'BLEED', 'twin_fangs')
          result.twinFangs = true
          // Check reactions after Twin Fangs too
          var tfReaction = checkConditionReactions(enemy.statusEffects)
          if (tfReaction) {
            enemy.statusEffects = tfReaction.newEffects
            if (tfReaction.damage > 0) { enemy.currentHp = Math.max(0, enemy.currentHp - tfReaction.damage); result.damage += tfReaction.damage }
            if (!result.conditionReaction) result.conditionReaction = tfReaction
          }
        }
      } else {
        result.offhandMiss = true
      }
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

  // --- ENEMY AI BEHAVIOUR ---
  var beh = enemy.behaviour || {}
  enemy.turnCount = (enemy.turnCount || 0) + 1
  if (enemy.howlCooldownLeft > 0) enemy.howlCooldownLeft--

  var hpPercent = enemy.currentHp / enemy.maxHp

  // MATURE — babies grow into adults after enough turns
  if (enemy.isBaby && !enemy.cannotMature) {
    var matureTurns = { rat: 4, hound: 3, moth: 2 }
    var matureAt = matureTurns[enemy.archetypeKey] || 4
    if (enemy.turnCount >= matureAt) {
      enemy.isBaby = false
      enemy.name = enemy.name.replace('Baby ', '')
      // Grow to full stats
      var adult = generateEnemy(enemy.archetypeKey, enemy.tierKey || 'dust', 'novice')
      enemy.maxHp = adult.maxHp
      enemy.currentHp = Math.min(enemy.currentHp + Math.round(adult.maxHp * 0.5), adult.maxHp)
      enemy.stats = Object.assign({}, adult.stats)
      enemy.weaponDie = adult.weaponDie
      enemy.behaviour = Object.assign({}, adult.behaviour || {})
      return { newBattle: bs, result: {
        attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
        attackRoll: null, damage: 0, matured: true, maturedName: enemy.name,
      }}
    }
  }

  // FLEE — cowardly enemies run at low HP
  if (beh.fleeThreshold && hpPercent <= beh.fleeThreshold && Math.random() < 0.6) {
    enemy.isDown = true; enemy.fled = true // fled = removed from battle, drops bag
    return { newBattle: bs, result: {
      attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
      attackRoll: null, damage: 0, fled: true,
    }}
  }

  // HOWL — buff all allies (orc warchief) — once per combat
  if (beh.canHowl && !enemy.hasHowled) {
    var livingAllies = bs.enemies.filter(function(e) { return !e.isDown && e.id !== enemy.id })
    if (livingAllies.length > 0 && Math.random() < 0.4) {
      livingAllies.forEach(function(ally) {
        ally.stats = Object.assign({}, ally.stats, { str: ally.stats.str + beh.howlBonus })
      })
      enemy.hasHowled = true
      return { newBattle: bs, result: {
        attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
        attackRoll: null, damage: 0, howled: true, howlBonus: beh.howlBonus,
      }}
    }
  }

  // HEAL ALLY — hounds lick wounded packmate — once per combat
  if (beh.canHealAlly && !enemy.hasHealed) {
    var woundedAlly = bs.enemies.find(function(e) { return !e.isDown && e.id !== enemy.id && e.currentHp < e.maxHp * 0.5 })
    if (woundedAlly && Math.random() < 0.5) {
      var healAmt = beh.healAmount || 5
      woundedAlly.currentHp = Math.min(woundedAlly.maxHp, woundedAlly.currentHp + healAmt)
      enemy.hasHealed = true
      return { newBattle: bs, result: {
        attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
        attackRoll: null, damage: 0, healedAlly: true, healedAllyName: woundedAlly.name, healAmount: healAmt,
      }}
    }
  }

  // EAT CORPSE — orcs eat dead allies for strength
  if (beh.canEatCorpse) {
    var corpse = bs.enemies.find(function(e) { return e.isDown && !e.eaten && e.id !== enemy.id })
    if (corpse && Math.random() < 0.3) {
      enemy.stats = Object.assign({}, enemy.stats, { str: enemy.stats.str + 4 })
      enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + 10)
      corpse.eaten = true // mark so it can't be eaten again
      return { newBattle: bs, result: {
        attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
        attackRoll: null, damage: 0, ateCorpse: true, ateCorpseName: corpse.name,
      }}
    }
  }

  // SACRIFICE — shades sacrifice themselves to buff allies
  if (beh.canSacrifice && hpPercent <= 0.2) {
    var sacrificeAllies = bs.enemies.filter(function(e) { return !e.isDown && e.id !== enemy.id })
    if (sacrificeAllies.length > 0 && Math.random() < 0.5) {
      sacrificeAllies.forEach(function(ally) {
        ally.stats = Object.assign({}, ally.stats, { str: ally.stats.str + beh.sacrificeBonus, def: ally.stats.def + 2 })
      })
      enemy.isDown = true // sacrifice = death
      return { newBattle: bs, result: {
        attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
        attackRoll: null, damage: 0, sacrificed: true, sacrificeBonus: beh.sacrificeBonus,
      }}
    }
  }

  // HIDE — slugs and spiders burrow for a turn (untargetable, heal)
  // SLIME COAT — slugs/spiders coat themselves in defensive mucus (costs their attack turn)
  if (beh.canHide && !enemy.hasHidden && hpPercent <= (beh.hideThreshold || 0.3)) {
    if (Math.random() < 0.5) {
      var slimeHeal = beh.hideHeal || 5
      var slimeDef = beh.hideDefBonus || 6
      enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + slimeHeal)
      enemy.stats = Object.assign({}, enemy.stats, { def: enemy.stats.def + slimeDef })
      enemy.hasHidden = true
      enemy.slimeCoated = true
      return { newBattle: bs, result: {
        attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
        attackRoll: null, damage: 0, slimeCoated: true, slimeHeal: slimeHeal, slimeDef: slimeDef,
      }}
    }
  }

  // SPAWN — adults breed in long fights. Babies CANNOT spawn. Max 5 enemies.
  var livingEnemyCount = bs.enemies.filter(function(e) { return !e.isDown }).length
  if (beh.canSpawn && !enemy.isBaby && livingEnemyCount < 5 && enemy.turnCount >= (beh.spawnAfterTurns || 4) && Math.random() < (beh.spawnChance || 0.2)) {
    var spawnType = enemy.archetypeKey
    // Per-creature spawn count: spiders spawn 2, others spawn 1
    var spawnCount = spawnType === 'spider' ? 2 : 1
    var spawnNames = []
    for (var spawnI = 0; spawnI < spawnCount && livingEnemyCount + spawnI < 5; spawnI++) {
      var spawnEnemy = generateEnemy(spawnType, 'dust', 'novice')
      // Moths lay eggs (not live babies)
      var isMothEgg = spawnType === 'moth'
      spawnEnemy.name = isMothEgg ? 'Moth Egg' : 'Baby ' + spawnEnemy.name
      spawnEnemy.currentHp = Math.round(spawnEnemy.currentHp * 0.4)
      spawnEnemy.maxHp = spawnEnemy.currentHp
      spawnEnemy.stats = Object.assign({}, spawnEnemy.stats, {
        str: Math.max(2, Math.round(spawnEnemy.stats.str * 0.4)),
        def: Math.max(1, Math.round(spawnEnemy.stats.def * 0.3)),
        agi: Math.max(2, Math.round(spawnEnemy.stats.agi * 0.5)),
      })
      spawnEnemy.weaponDie = Math.max(2, Math.round(spawnEnemy.weaponDie * 0.5))
      spawnEnemy.isBaby = true
      spawnEnemy.behaviour = Object.assign({}, spawnEnemy.behaviour || {}, { canSpawn: false })
      // Moth eggs: 0 STR (can't attack), hatch in 2 turns
      if (isMothEgg) { spawnEnemy.stats.str = 0; spawnEnemy.stats.def = 1; spawnEnemy.currentHp = 2; spawnEnemy.maxHp = 2 }
      // Spiders: babies can't mature, stay fragile
      if (spawnType === 'spider') { spawnEnemy.cannotMature = true; spawnEnemy.currentHp = 1; spawnEnemy.maxHp = 1 }
      bs.enemies.push(spawnEnemy)
      bs.turnOrder.push(spawnEnemy.id)
      spawnNames.push(spawnEnemy.name)
    }
    return { newBattle: bs, result: {
      attacker: enemy.name, attackerId: enemy.id, target: target.name, targetUid: target.uid,
      attackRoll: null, damage: 0, spawned: true, spawnedName: spawnNames.join(' + '),
    }}
  }

  // --- DEFAULT: ATTACK ---
  var condStatMod = getConditionStatMod(enemy.statusEffects || [], 'str')
  var strMod = getModifier(enemy.stats.str) + condStatMod
  var rollsMod = getAllRollsMod(enemy.statusEffects || [])
  var forcedTier = getForcedTier(enemy.statusEffects || [])
  var missChance = getMissChance(enemy.statusEffects || [])

  // Pack tactics — rats and similar swarming enemies buff each other
  var packBonus = 0
  if (enemy.archetypeKey === 'rat' || enemy.archetypeKey === 'moth' || enemy.archetypeKey === 'bat') {
    var packCount = bs.enemies.filter(function(e) { return !e.isDown && e.archetypeKey === enemy.archetypeKey }).length
    if (packCount >= 3) packBonus = 2
    else if (packCount >= 2) packBonus = 1
  }

  // Gift modifiers on enemy attacks
  var targetGifts = target._gifts || {}

  // Gift: Null Field (void mind) — enemies have -2 to all rolls
  var giftRollPenalty = 0
  if (targetGifts.mind && targetGifts.mind.effect === 'enemy_roll_penalty') giftRollPenalty = targetGifts.mind.value

  // Gift: Noxious Aura (bile mind) — enemies have -1 STR (applied at combat start concept, but simpler as roll penalty)
  if (targetGifts.mind && targetGifts.mind.effect === 'enemy_stat_penalty') giftRollPenalty += targetGifts.mind.value

  // Gift: Predator's Focus (blood mind) — +1 accuracy (enemy penalty equivalent: -1 enemy roll)
  // Already handled via player accuracy bonus

  var attackResult = d20Attack(strMod + rollsMod + packBonus + giftRollPenalty, 20)

  // Gift: Dice Corruption (void mind) — enemy even d20 rolls are halved
  if (targetGifts.mind && targetGifts.mind.effect === 'enemy_even_roll_halved' && attackResult.roll % 2 === 0) {
    var corruptedRoll = Math.floor(attackResult.roll / 2)
    attackResult = d20Attack(strMod + rollsMod + packBonus + giftRollPenalty, 20)
    attackResult = Object.assign({}, attackResult, { roll: corruptedRoll, total: corruptedRoll + strMod + rollsMod + packBonus + giftRollPenalty })
    // Recalculate tier from corrupted total
    if (attackResult.total >= 20) attackResult = Object.assign({}, attackResult, { tier: 1, tierName: 'crit' })
    else if (attackResult.total >= 11) attackResult = Object.assign({}, attackResult, { tier: 2, tierName: 'hit' })
    else if (attackResult.total >= 6) attackResult = Object.assign({}, attackResult, { tier: 3, tierName: 'glancing' })
    else attackResult = Object.assign({}, attackResult, { tier: 4, tierName: 'miss' })
  }

  // Adrenaline — enemies can crit too (triggered by FEAR fight-or-flight)
  var enemyForceCrit = hasForceCrit(enemy.statusEffects || [])
  if (enemyForceCrit && attackResult.tier > 1) {
    attackResult = Object.assign({}, attackResult, { tier: 1, tierName: 'crit' })
  }

  if (forcedTier && attackResult.tier < forcedTier) {
    attackResult = Object.assign({}, attackResult, { tier: forcedTier, tierName: forcedTier === 3 ? 'glancing' : attackResult.tierName })
  }
  if (missChance > 0 && attackResult.tier <= 3 && Math.random() < missChance) {
    attackResult = Object.assign({}, attackResult, { tier: 4, tierName: 'miss' })
  }

  var result = {
    attacker: enemy.name,
    attackerId: enemyId,
    target: target.name,
    targetUid: target.uid,
    attackRoll: attackResult,
    damage: 0,
    playerDowned: false,
    conditionApplied: null,
  }

  if (attackResult.tier <= 3) {
    // Block chance — shields (offhand slot)
    var blockChance = 0
    if (target.equipped && target.equipped.offhand && target.equipped.offhand.passiveEffect === 'block_chance') {
      blockChance = target.equipped.offhand.passiveValue || 0
      // DEF modifier adds to block chance (+2.5% per DEF mod)
      var defMod = getModifier(target.combatStats.def || 10)
      blockChance += defMod * 0.025
    }
    if (blockChance > 0 && Math.random() < Math.min(blockChance, 0.5)) {
      attackResult = Object.assign({}, attackResult, { tier: 4, tierName: 'miss' })
      result.attackRoll = attackResult
      result.blocked = true
      return { newBattle: bs, result: result }
    }

    // Dodge chance — AGI base (2% per mod) + all equipment with dodge_chance + gift bonus
    var agiDodge = getModifier(target.combatStats.agi || 10) * 0.02
    var dodgeChance = Math.max(0, agiDodge) + getPassiveTotalCombat(target, 'dodge_chance')
    // Gift: Phase Shift (void body) — +15% dodge
    var targetGifts2 = target._gifts || {}
    if (targetGifts2.body && targetGifts2.body.effect === 'dodge_bonus') dodgeChance += targetGifts2.body.value
    if (dodgeChance > 0 && Math.random() < Math.min(dodgeChance, 0.35)) {
      attackResult = Object.assign({}, attackResult, { tier: 4, tierName: 'miss' })
      result.attackRoll = attackResult
      result.dodged = true
      return { newBattle: bs, result: result }
    }

    var dmgResult = rollDamage(enemy.weaponDie, strMod)
    var defWithConditions = target.combatStats.def + getConditionStatMod(target.statusEffects, 'def')
    var breakdown = calculateTierDamage(dmgResult.roll, strMod, attackResult.tier, Math.max(0, defWithConditions), 2.0)

    // Brittle — FROST increases damage taken
    var brittleMul = getDamageTakenMultiplier(target.statusEffects || [])
    if (brittleMul > 1) breakdown.final = Math.round(breakdown.final * brittleMul)

    target.currentHp = Math.max(0, target.currentHp - breakdown.final)
    result.damage = breakdown.final
    result.damageBreakdown = breakdown

    // Damage reflect — Spiked Plate etc.
    var reflectDmg = getPassiveTotalCombat(target, 'damage_reflect')
    if (reflectDmg > 0 && breakdown.final > 0) {
      enemy.currentHp = Math.max(0, enemy.currentHp - reflectDmg)
      result.reflectDamage = reflectDmg
      if (enemy.currentHp <= 0) { enemy.isDown = true; result.reflectKill = true }
    }

    // Enemy innate condition application (blocked by relics: immunity, resist, multi, all)
    var enemyCond = getEnemyCondition(enemy.archetypeKey)
    if (enemyCond) {
      var condBlocked = false
      var condResistType = null
      if (target.equipped && target.equipped.relics) {
        var resistChance = 0
        for (var ri = 0; ri < target.equipped.relics.length; ri++) {
          var rel = target.equipped.relics[ri]
          if (rel.passiveEffect === 'condition_immunity' && rel.passiveCondition === enemyCond.conditionId) {
            condBlocked = true; condResistType = 'immune'; break
          }
          if (rel.passiveEffect === 'condition_resist' && rel.passiveCondition === enemyCond.conditionId) {
            resistChance = Math.max(resistChance, rel.passiveValue || 0)
          }
          if (rel.passiveEffect === 'condition_resist_multi' && rel.passiveConditions && rel.passiveConditions.indexOf(enemyCond.conditionId) !== -1) {
            resistChance = Math.max(resistChance, rel.passiveValue || 0)
          }
          if (rel.passiveEffect === 'condition_resist_all') {
            resistChance = Math.max(resistChance, rel.passiveValue || 0)
          }
        }
        if (!condBlocked && resistChance > 0 && Math.random() < resistChance) {
          condBlocked = true; condResistType = 'resisted'
        }
      }
      if (!condBlocked) {
        var enemyInt = enemy.stats.int || 10
        if (rollConditionApplication(attackResult.tier, enemyInt, enemyCond.chance)) {
          target.statusEffects = applyCondition(target.statusEffects, enemyCond.conditionId, 'enemy')
          result.conditionApplied = enemyCond.conditionId
        }
      } else {
        result.conditionBlocked = enemyCond.conditionId
        result.conditionResistType = condResistType
      }
    }

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

export { createBattleState, getCurrentTurnId, getActor, tickTurnStart, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp }
