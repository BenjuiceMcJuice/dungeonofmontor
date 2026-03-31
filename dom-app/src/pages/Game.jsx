import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Attack, d20Flee } from '../lib/dice.js'
import { generateGardenZone, generateChamberContent, getAdjacentChambers, getDoorDirection } from '../lib/dungeon.js'
import { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import PlayerSprite from '../components/PlayerSprite.jsx'
import CombatRoller from '../components/CombatRoller.jsx'
import ChamberView from '../components/ChamberView.jsx'
import DoorSprite from '../components/DoorSprite.jsx'
import ChamberIcon from '../components/ChamberIcon.jsx'

var MAX_LOG_ENTRIES = 6

// Direction labels
var DIR_LABELS = { N: 'North', S: 'South', E: 'East', W: 'West' }

// Map chamber types to centre icon keys (after clearing)
function getChamberIconKey(type) {
  if (type === 'combat_standard' || type === 'combat_elite' || type === 'mini_boss') return 'corpse'
  if (type === 'loot' || type === 'hidden') return 'chest'
  if (type === 'merchant' || type === 'quest_npc') return 'npc'
  if (type === 'shrine') return 'shrine'
  if (type === 'trap') return 'trap'
  if (type === 'stairwell_descent') return 'stairs_down'
  return null
}

function formatAttackLog(r, type) {
  var who = r.attacker
  var target = r.target
  var tier = r.attackRoll.tierName
  var defeated = type === 'player'
    ? (r.enemyDefeated ? ' It crumbles.' : '')
    : (r.playerDowned ? ' You collapse.' : '')

  var text
  if (tier === 'crit') {
    text = who + ' lands a devastating blow on ' + target + '! ' + r.damage + ' damage.' + defeated
  } else if (tier === 'hit') {
    text = who + ' strikes ' + target + ' for ' + r.damage + ' damage.' + defeated
  } else if (tier === 'glancing') {
    text = who + ' grazes ' + target + '. ' + r.damage + ' damage.' + defeated
  } else {
    text = who + ' swings at ' + target + ' but misses.'
  }

  return { text: text, tier: tier }
}

// ============================================================
// Game — first-person dungeon crawl + combat
// ============================================================

function Game({ character, user, onEndRun }) {
  // --- Dungeon state ---
  var [zone, setZone] = useState(null)
  // Phases: doors | entering | chamber | combat | victory | defeat
  var [gamePhase, setGamePhase] = useState('doors')
  var [chamberContent, setChamberContent] = useState(null)
  var [totalXp, setTotalXp] = useState(0)
  var [playerHp, setPlayerHp] = useState(character.maxHp)
  var [playerGold, setPlayerGold] = useState(character.gold || 0)
  var [chambersCleared, setChambersCleared] = useState(0)
  var [previousPosition, setPreviousPosition] = useState(null)

  // --- Combat state ---
  var [battle, setBattle] = useState(null)
  var [combatPhase, setCombatPhase] = useState('intro')
  var [selectedTarget, setSelectedTarget] = useState(null)
  var [combatLog, setCombatLog] = useState([])
  var [pendingAttackResult, setPendingAttackResult] = useState(null)
  var [enemyAttackInfo, setEnemyAttackInfo] = useState(null)
  var [enemyRollerKey, setEnemyRollerKey] = useState(0)
  var [lootableCorpses, setLootableCorpses] = useState([])
  var logRef = useRef(null)

  // Init zone — start at entry, show doors
  useEffect(function() {
    window.scrollTo(0, 0)
    var z = generateGardenZone()
    setZone(z)
    setGamePhase('doors')
  }, [])

  useEffect(function() {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [combatLog])

  // --- Get available doors from current position ---
  function getAvailableDoors() {
    if (!zone) return []
    var chamber = zone.chambers[zone.playerPosition]
    var doors = []
    if (chamber.doors.N) doors.push({ dir: 'N', targetId: chamber.id - 4 })
    if (chamber.doors.S) doors.push({ dir: 'S', targetId: chamber.id + 4 })
    if (chamber.doors.E) doors.push({ dir: 'E', targetId: chamber.id + 1 })
    if (chamber.doors.W) doors.push({ dir: 'W', targetId: chamber.id - 1 })
    return doors
  }

  // --- Navigation: pick a door ---
  function handlePickDoor(targetId) {
    setPreviousPosition(zone.playerPosition)
    var newZone = Object.assign({}, zone, {
      playerPosition: targetId,
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === targetId) return Object.assign({}, ch, { visited: true })
        return ch
      })
    })
    setZone(newZone)

    var chamber = newZone.chambers[targetId]

    // If already cleared, just show doors again (backtracking)
    if (chamber.cleared) {
      setGamePhase('doors')
      return
    }

    var content = generateChamberContent(chamber, 'seasoned')
    setChamberContent(content)

    if (content && content.enemies) {
      setGamePhase('entering')
      setTimeout(function() {
        startCombat(content.enemies, newZone, targetId)
      }, 800)
    } else {
      setGamePhase('chamber')
    }
  }

  // --- Chamber interaction actions ---
  function handleChamberAction(action, data) {
    if (action === 'rest') {
      var heal = Math.round(character.maxHp * chamberContent.hpRecovery)
      var newHp = Math.min(playerHp + heal, character.maxHp)
      setPlayerHp(newHp)
      setChamberContent(Object.assign({}, chamberContent, { healed: heal }))
    } else if (action === 'claim_loot') {
      setPlayerGold(playerGold + chamberContent.gold)
      setChamberContent(Object.assign({}, chamberContent, { claimed: true }))
    } else if (action === 'buy' && data) {
      if ((playerGold || 0) >= data.cost) {
        setPlayerGold(playerGold - data.cost)
        if (data.effect === 'heal') {
          var newHp2 = Math.min(playerHp + data.value, character.maxHp)
          setPlayerHp(newHp2)
        }
        var remaining = chamberContent.items.filter(function(it) { return it !== data })
        setChamberContent(Object.assign({}, chamberContent, { items: remaining }))
      }
    } else if (action === 'trigger_trap') {
      var newHp3 = Math.max(0, playerHp - chamberContent.damage)
      setPlayerHp(newHp3)
      setChamberContent(Object.assign({}, chamberContent, { triggered: true }))
      if (newHp3 <= 0) {
        setTimeout(function() { setGamePhase('defeat') }, 500)
        return
      }
    } else if (action === 'help_npc') {
      if (chamberContent.reward && chamberContent.reward.gold) {
        setPlayerGold(playerGold + chamberContent.reward.gold)
      }
      setChamberContent(Object.assign({}, chamberContent, { helped: true }))
    } else if (action === 'descend') {
      onEndRun({ victory: true, chambersCleared: chambersCleared, xp: totalXp, gold: playerGold })
      return
    }
  }

  function handleChamberContinue() {
    // Mark chamber cleared, show doors
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
        return ch
      })
    })
    setZone(newZone)
    setChambersCleared(chambersCleared + 1)
    setChamberContent(null)
    setGamePhase('doors')
  }

  // ============================================================
  // COMBAT
  // ============================================================

  function addLog(entry) {
    setCombatLog(function(prev) {
      var next = prev.concat([entry])
      if (next.length > MAX_LOG_ENTRIES) next = next.slice(next.length - MAX_LOG_ENTRIES)
      return next
    })
  }

  function startCombat(enemies, currentZone, chamberId) {
    var players = [{ uid: user.uid, character: Object.assign({}, character, { maxHp: character.maxHp }) }]
    var bs = createBattleState(players, enemies)
    bs.players[user.uid].currentHp = playerHp
    bs.players[user.uid].maxHp = character.maxHp
    setBattle(bs)
    setSelectedTarget(null)
    setCombatLog([])
    setPendingAttackResult(null)
    setEnemyAttackInfo(null)
    setGamePhase('combat')

    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    setCombatPhase(firstActor && firstActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === ENEMY TURN ===
  useEffect(function() {
    if (combatPhase !== 'enemyWindup' || !battle || gamePhase !== 'combat') return
    var currentId = getCurrentTurnId(battle)
    var attackOut = resolveEnemyAttack(battle, currentId)
    if (attackOut) {
      setEnemyAttackInfo({ attackOut: attackOut })
      setEnemyRollerKey(function(k) { return k + 1 })
    }
    var timeout = setTimeout(function() { setCombatPhase('enemyRolling') }, 800)
    return function() { clearTimeout(timeout) }
  }, [combatPhase, battle, gamePhase])

  function handleEnemyRollForRoller() {
    if (!enemyAttackInfo) return { roll: 1, modifier: 0, total: 1, tn: 10, success: false, crit: false, fumble: true }
    return enemyAttackInfo.attackOut.result.attackRoll
  }

  function handleEnemyComplete() {
    if (!enemyAttackInfo) return
    var attackOut = enemyAttackInfo.attackOut
    var r = attackOut.result
    var logEntry = formatAttackLog(r, 'enemy')
    addLog({ type: 'enemy', text: logEntry.text, tier: logEntry.tier })

    var updatedBattle = attackOut.newBattle
    var pState = updatedBattle.players[user.uid]
    if (pState) setPlayerHp(pState.currentHp)

    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'defeat') {
      setBattle(updatedBattle)
      setEnemyAttackInfo(null)
      setPlayerHp(0)
      setGamePhase('defeat')
      return
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setEnemyAttackInfo(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    if (!(nextActor && nextActor.type === 'enemy')) setSelectedTarget(null)
  }

  // === PLAYER TURN ===
  function handleSelectTarget(enemyId) {
    setSelectedTarget(enemyId)
    setPendingAttackResult(null)
  }

  var playerState = battle ? battle.players[user.uid] : null
  var strMod = playerState ? getModifier(playerState.combatStats.str) : 0
  var currentTurnId = battle ? getCurrentTurnId(battle) : null
  var isPlayerTurn = currentTurnId === user.uid && combatPhase === 'playerTurn'
  var activeEnemyId = enemyAttackInfo ? enemyAttackInfo.attackOut.result.attackerId : null

  function handlePlayerAttackRoll() {
    var rollResult = d20Attack(strMod, 20)
    var attackOut = resolvePlayerAttack(battle, user.uid, selectedTarget, rollResult)
    if (attackOut) setPendingAttackResult(attackOut)
    return rollResult
  }

  function handlePlayerComplete() {
    if (!pendingAttackResult) return
    var attackOut = pendingAttackResult
    var r = attackOut.result
    var logEntry = formatAttackLog(r, 'player')
    addLog({ type: 'player', text: logEntry.text, tier: logEntry.tier })
    setPendingAttackResult(null)

    var updatedBattle = attackOut.newBattle
    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'victory') {
      var xpGained = calculateXp(updatedBattle)
      setTotalXp(totalXp + xpGained)
      setBattle(updatedBattle)
      setCombatPhase('victory')
      var newZone = Object.assign({}, zone, {
        chambers: zone.chambers.map(function(ch) {
          if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
          return ch
        })
      })
      setZone(newZone)
      setChambersCleared(chambersCleared + 1)
      return
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setSelectedTarget(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === FLEE ===
  var [fleeOutcome, setFleeOutcome] = useState(null)

  function handleFlee() {
    var agiMod = getModifier(character.stats.agi)
    var fleeResult = d20Flee(agiMod)
    var maxHp = character.maxHp

    var hpLoss = 0
    var goldLoss = 0
    var narrative = ''
    var fled = false

    if (fleeResult.tierName === 'crit_success') {
      narrative = character.name + ' dashes for the exit! Clean escape — no harm done.'
      fled = true
    } else if (fleeResult.tierName === 'success') {
      hpLoss = Math.round(maxHp * (0.05 + Math.random() * 0.05))
      narrative = character.name + ' scrambles away, taking ' + hpLoss + ' damage in the retreat.'
      fled = true
    } else if (fleeResult.tierName === 'failure') {
      hpLoss = Math.round(maxHp * (0.15 + Math.random() * 0.1))
      goldLoss = Math.round(playerGold * 0.1)
      narrative = character.name + ' stumbles badly! Takes ' + hpLoss + ' damage and drops ' + goldLoss + ' gold.'
      fled = true
    } else {
      hpLoss = Math.round(maxHp * (0.25 + Math.random() * 0.1))
      goldLoss = Math.round(playerGold * 0.2)
      narrative = character.name + ' tries to flee but is blocked! Takes ' + hpLoss + ' damage, loses ' + goldLoss + ' gold. The fight continues.'
      fled = false
    }

    var newHp = Math.max(0, playerHp - hpLoss)
    var newGold = Math.max(0, playerGold - goldLoss)
    setPlayerHp(newHp)
    setPlayerGold(newGold)

    if (newHp <= 0) {
      setGamePhase('defeat')
      return
    }

    setFleeOutcome({
      narrative: narrative,
      fled: fled,
      roll: fleeResult.roll,
      total: fleeResult.total,
      tierName: fleeResult.tierName,
      hpLoss: hpLoss,
      goldLoss: goldLoss,
    })
    setGamePhase('flee_result')
  }

  function handleFleeResultContinue() {
    if (!fleeOutcome) return

    if (fleeOutcome.fled) {
      setBattle(null)
      setCombatLog([])
      setChamberContent(null)
      if (previousPosition !== null) {
        var newZone = Object.assign({}, zone, { playerPosition: previousPosition })
        setZone(newZone)
      }
      setFleeOutcome(null)
      setGamePhase('doors')
    } else {
      // Crit failure — back to combat, sync HP to battle state, advance turn
      setFleeOutcome(null)
      var updatedBattle = Object.assign({}, battle, {
        players: Object.keys(battle.players).reduce(function(acc, uid) {
          acc[uid] = Object.assign({}, battle.players[uid], { currentHp: playerHp })
          return acc
        }, {})
      })
      var nextBattle = advanceTurn(updatedBattle)
      setBattle(nextBattle)
      setGamePhase('combat')
      var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
      setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    }
  }

  function handleCombatVictoryToDoors() {
    // Generate corpses and store them on the chamber
    var corpses = battle.enemies.filter(function(e) { return e.isDown }).map(function(e) {
      var gold = Math.max(1, Math.round(e.xp * 0.3 + Math.random() * e.xp * 0.4))
      return { id: e.id, name: e.name, archetypeKey: e.archetypeKey, tierKey: e.tierKey, gold: gold, looted: false }
    })

    // Store corpses on the chamber in zone state
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { corpses: corpses })
        return ch
      })
    })
    setZone(newZone)
    setBattle(null)
    setCombatLog([])
    setChamberContent(null)
    setGamePhase('doors')
  }

  function handleLootCorpse(corpseId) {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.corpses) return

    var goldGained = 0
    var updatedCorpses = chamber.corpses.map(function(c) {
      if (c.id === corpseId && !c.looted) {
        goldGained = c.gold
        return Object.assign({}, c, { looted: true })
      }
      return c
    })
    setPlayerGold(playerGold + goldGained)

    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { corpses: updatedCorpses })
        return ch
      })
    })
    setZone(newZone)
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (!zone) {
    return (
      <div className="h-full flex items-center justify-center bg-raised">
        <span className="text-ink text-base">Entering the dungeon...</span>
      </div>
    )
  }

  // --- Defeat ---
  if (gamePhase === 'defeat') {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <h1 className="font-display text-4xl text-red-400">Defeated</h1>
        <p className="text-ink text-lg italic">Darkness swallows you whole.</p>
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
          <p className="text-ink text-sm">Chambers cleared: {chambersCleared}</p>
          <p className="text-ink text-sm mt-1">XP earned: <span className="text-gold">{Math.round(totalXp * 0.5)}</span></p>
        </div>
        <button onClick={function() { onEndRun({ victory: false, chambersCleared: chambersCleared, xp: Math.round(totalXp * 0.5), gold: 0 }) }}
          className="py-3 px-8 rounded-lg bg-surface border border-border text-ink font-sans text-base">
          Return to Tavern
        </button>
      </div>
    )
  }

  // --- Doors view (first-person: positional door layout with centre content) ---
  if (gamePhase === 'doors') {
    var currentChamber = zone.chambers[zone.playerPosition]
    var doors = getAvailableDoors()
    var doorMap = {}
    doors.forEach(function(d) { doorMap[d.dir] = d })

    // What to show in the centre of the room
    var centreIconKey = getChamberIconKey(currentChamber.type)
    var showCentre = currentChamber.cleared && centreIconKey

    // Door button renderer
    function renderDoor(dir) {
      var door = doorMap[dir]
      if (!door) return <div className="invisible" />

      var targetChamber = zone.chambers[door.targetId]
      var isVisited = targetChamber.visited
      var isCleared = targetChamber.cleared

      var subtextCol = isCleared ? 'text-ink-faint' : isVisited ? 'text-red-400/70' : 'text-ink-faint'
      var subtext = isCleared ? 'cleared' : isVisited ? 'unfinished' : ''

      return (
        <button
          onClick={function() { handlePickDoor(door.targetId) }}
          className={
            'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all cursor-pointer ' +
            'bg-surface hover:bg-raised hover:border-gold ' +
            (isCleared ? 'border-border' : 'border-border-hl')
          }
        >
          <DoorSprite theme="garden" scale={2} />
          <span className="text-ink font-display text-xs">{DIR_LABELS[dir]}</span>
          {subtext && <span className={subtextCol + ' text-[9px] font-sans'}>{subtext}</span>}
        </button>
      )
    }

    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">
            {currentChamber.label}
          </span>
          <span className="text-gold text-xs font-sans">{playerGold}g</span>
        </div>

        {/* Room layout — doors on edges, content in centre */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* North door — pinned to top */}
          <div className="flex justify-center py-1">
            {doorMap.N ? renderDoor('N') : <div className="h-12" />}
          </div>

          {/* Middle area: West — Centre — East */}
          <div className="flex-1 flex items-center min-h-0">
            {/* West door — pinned left */}
            <div className="w-16 flex justify-center shrink-0">
              {doorMap.W ? renderDoor('W') : <div />}
            </div>

            {/* Centre content — large area */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-2">
              {/* Lootable corpses from combat */}
              {currentChamber.corpses && currentChamber.corpses.length > 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    {currentChamber.corpses.map(function(corpse) {
                      var corpseIcon = 'corpse_' + corpse.archetypeKey
                      return (
                        <button key={corpse.id}
                          onClick={function() { if (!corpse.looted) handleLootCorpse(corpse.id) }}
                          disabled={corpse.looted}
                          className={
                            'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ' +
                            (corpse.looted
                              ? 'border-border opacity-30'
                              : 'border-gold/40 bg-gold-glow cursor-pointer hover:border-gold animate-pulse')
                          }
                        >
                          <ChamberIcon iconKey={corpseIcon} theme="garden" scale={3} />
                          {corpse.looted ? (
                            <span className="text-ink-faint text-[8px] font-sans">looted</span>
                          ) : (
                            <span className="text-gold text-[8px] font-sans font-bold">LOOT</span>
                          )}
                          {corpse.looted && (
                            <span className="text-gold text-[9px] font-sans">+{corpse.gold}g</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : showCentre ? (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey={centreIconKey} theme="garden" scale={4} />
                  <span className="text-ink-faint text-[10px] font-sans uppercase">
                    {currentChamber.label}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <PlayerSprite classKey="knight" scale={3} />
                  <span className="text-ink-faint text-[10px] font-sans uppercase">you are here</span>
                </div>
              )}

              <p className="text-ink-dim text-xs italic text-center max-w-xs">
                {currentChamber.id === 0
                  ? 'The entrance to the garden. Overgrown walls rise on all sides.'
                  : 'The chamber is still. ' + doors.length + (doors.length === 1 ? ' door leads onward.' : ' doors lead onward.')}
              </p>
            </div>

            {/* East door — pinned right */}
            <div className="w-16 flex justify-center shrink-0">
              {doorMap.E ? renderDoor('E') : <div />}
            </div>
          </div>

          {/* South door — pinned to bottom */}
          <div className="flex justify-center py-1">
            {doorMap.S ? renderDoor('S') : <div className="h-12" />}
          </div>
        </div>

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  // --- Entering chamber (transition) ---
  if (gamePhase === 'entering') {
    var enteringChamber = zone.chambers[zone.playerPosition]
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
        <p className="text-ink text-base italic">Something stirs...</p>
      </div>
    )
  }

  // --- Non-combat chamber ---
  if (gamePhase === 'chamber') {
    var chamberNow = zone.chambers[zone.playerPosition]
    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">{chamberNow.label}</span>
          <span className="text-gold text-xs font-sans">{playerGold}g</span>
        </div>

        {/* Chamber content */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <ChamberView
            chamber={chamberNow}
            content={chamberContent}
            playerState={{ gold: playerGold, currentHp: playerHp, maxHp: character.maxHp }}
            onAction={handleChamberAction}
            onContinue={handleChamberContinue}
          />
        </div>

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  // --- Flee result ---
  if (gamePhase === 'flee_result' && fleeOutcome) {
    var fleeColour = fleeOutcome.tierName === 'crit_success' ? 'text-green-400'
      : fleeOutcome.tierName === 'success' ? 'text-amber-400'
      : fleeOutcome.tierName === 'failure' ? 'text-red-400'
      : 'text-crimson'

    var fleeTitle = fleeOutcome.tierName === 'crit_success' ? 'Clean Escape!'
      : fleeOutcome.tierName === 'success' ? 'Escaped!'
      : fleeOutcome.tierName === 'failure' ? 'Barely Escaped!'
      : 'Blocked!'

    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-5 bg-raised">
        <p className={'font-display text-2xl ' + fleeColour}>{fleeTitle}</p>
        <p className="text-ink text-base italic max-w-xs">{fleeOutcome.narrative}</p>

        {(fleeOutcome.hpLoss > 0 || fleeOutcome.goldLoss > 0) && (
          <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
            {fleeOutcome.hpLoss > 0 && (
              <p className="text-red-400 text-sm">-{fleeOutcome.hpLoss} HP</p>
            )}
            {fleeOutcome.goldLoss > 0 && (
              <p className="text-amber-400 text-sm">-{fleeOutcome.goldLoss} gold</p>
            )}
          </div>
        )}

        <button onClick={handleFleeResultContinue}
          className="py-3 px-8 rounded-lg bg-surface border border-border-hl text-ink font-sans text-base">
          {fleeOutcome.fled ? 'Continue' : 'Back to fight'}
        </button>

        {renderPartyBar()}
      </div>
    )
  }

  // --- Combat ---
  if (gamePhase === 'combat') {
    // Combat victory — show doors after
    if (combatPhase === 'victory') {
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
          <h1 className="font-display text-4xl text-gold">Victory</h1>
          <p className="text-ink text-base italic">The chamber falls silent.</p>
          <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
            <p className="text-ink text-sm">XP earned: <span className="text-gold font-display text-xl">{totalXp}</span></p>
            <p className="text-ink-dim text-sm mt-1">HP remaining: {playerHp}/{character.maxHp}</p>
          </div>
          <button onClick={handleCombatVictoryToDoors}
            className="py-3 px-8 rounded-lg bg-gold text-bg font-sans text-base font-semibold">
            Continue
          </button>
        </div>
      )
    }

    var enemyResult = enemyAttackInfo ? enemyAttackInfo.attackOut.result : null
    var combatChamber = zone.chambers[zone.playerPosition]

    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink-dim text-xs uppercase tracking-widest">{combatChamber.label} -- Round {battle.round}</span>
        </div>

        {/* Enemies */}
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {battle.enemies.map(function(enemy) {
            var isTarget = selectedTarget === enemy.id
            var isDead = enemy.isDown
            var isActing = activeEnemyId === enemy.id
            return (
              <button key={enemy.id}
                onClick={function() { if (!isDead && isPlayerTurn) handleSelectTarget(enemy.id) }}
                disabled={isDead || !isPlayerTurn}
                className={
                  'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ' +
                  (isDead ? 'opacity-20 border-transparent' :
                   isActing ? 'border-red-400 bg-red-400/10 scale-105' :
                   isTarget ? 'border-gold bg-gold-glow' :
                   isPlayerTurn ? 'border-border-hl hover:border-ink-faint cursor-pointer' :
                   'border-border')
                }>
                <SpriteRenderer spriteKey={enemy.archetypeKey} tierKey={enemy.tierKey} scale={3} />
                <span className="font-display text-sm text-ink">{enemy.name}</span>
                <div className="w-20 bg-bg rounded-full h-2">
                  <div className="bg-red-500 rounded-full h-2 transition-all duration-300"
                    style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }} />
                </div>
                <span className="text-ink text-xs font-sans">{enemy.currentHp}/{enemy.maxHp}</span>
                <div className="flex gap-2 text-[10px] font-sans text-ink-dim">
                  <span>STR {enemy.stats.str}</span>
                  <span>DEF {enemy.stats.def}</span>
                  <span>AGI {enemy.stats.agi}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Combat log */}
        <div ref={logRef} data-scrollable className="bg-surface border border-border rounded-lg p-2 mb-2 max-h-24 overflow-y-auto shrink-0">
          {combatLog.length === 0 && <p className="text-ink-dim text-sm italic">The battle begins...</p>}
          {combatLog.map(function(entry, i) {
            var logColour = 'text-ink-dim'
            if (entry.tier === 'crit') logColour = 'text-crimson'
            else if (entry.tier === 'hit') logColour = 'text-amber-500'
            else if (entry.tier === 'glancing') logColour = 'text-yellow-400/80'
            else if (entry.tier === 'miss') logColour = 'text-ink-faint'
            return <p key={i} className={'text-xs leading-relaxed mb-1 ' + logColour}>{entry.text}</p>
          })}
        </div>

        {/* Action area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">
          {combatPhase === 'enemyWindup' && enemyResult && (
            <div className="flex flex-col items-center gap-2 p-3 border-2 border-red-400/30 rounded-lg bg-red-400/5">
              <p className="text-red-400 text-lg font-display">{enemyResult.attacker}</p>
              <p className="text-ink text-sm italic">prepares to strike...</p>
            </div>
          )}

          {combatPhase === 'enemyRolling' && enemyResult && (
            <div className="flex flex-col items-center gap-2">
              <CombatRoller
                key={'enemy-' + enemyRollerKey}
                onAttackRoll={handleEnemyRollForRoller}
                onComplete={handleEnemyComplete}
                attackMod={enemyResult.attackRoll.modifier}
                damageDie={battle.enemies.find(function(e) { return e.id === enemyResult.attackerId }).weaponDie || 4}
                damageMod={enemyResult.attackRoll.modifier}
                colour="red"
                buttonLabel=""
                autoRoll={true}
                resolvedDamage={enemyResult.damage}
                damageBreakdown={enemyAttackInfo.attackOut.result.damageBreakdown}
                attackerName={enemyResult.attacker}
                targetName={enemyResult.target}
              />
            </div>
          )}

          {isPlayerTurn && !selectedTarget && (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 border-2 border-gold/40 rounded-lg bg-gold-glow text-center">
                <p className="text-gold text-lg font-display">Your Turn</p>
                <p className="text-ink text-sm">Choose an enemy above to attack</p>
              </div>
              <button onClick={handleFlee}
                className="py-2 px-6 rounded-lg bg-surface border border-border-hl text-ink-dim font-sans text-sm hover:text-ink hover:border-ink-faint transition-colors">
                Flee
              </button>
            </div>
          )}

          {isPlayerTurn && selectedTarget && (function() {
            var targetEnemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
            var weaponDie = 8
            return (
              <div className="flex flex-col items-center gap-3">
                <CombatRoller
                  key={'player-' + selectedTarget}
                  onAttackRoll={handlePlayerAttackRoll}
                  onComplete={handlePlayerComplete}
                  attackMod={strMod}
                  damageDie={weaponDie}
                  damageMod={strMod}
                  colour="gold"
                  buttonLabel={'Attack ' + targetEnemy.name}
                  resolvedDamage={pendingAttackResult ? pendingAttackResult.result.damage : null}
                  damageBreakdown={pendingAttackResult ? pendingAttackResult.result.damageBreakdown : null}
                  attackerName={character.name}
                  targetName={targetEnemy.name}
                />
                {!pendingAttackResult && (
                  <button onClick={function() { setSelectedTarget(null) }}
                    className="text-ink-dim text-sm hover:text-ink transition-colors">
                    Change target
                  </button>
                )}
              </div>
            )
          })()}
        </div>

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  return null

  // ============================================================
  // Shared party bar
  // ============================================================
  function renderPartyBar() {
    return (
      <div className="shrink-0 bg-surface border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <PlayerSprite classKey="knight" scale={2} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-sm text-ink truncate">{character.name}</span>
                <span className="text-[10px] font-sans text-ink-dim">
                  STR {character.stats.str} DEF {character.stats.def} AGI {character.stats.agi}
                </span>
              </div>
              <span className="text-ink text-xs font-sans shrink-0">{playerHp}/{character.maxHp}</span>
            </div>
            <div className="w-full bg-bg rounded-full h-2 mt-1">
              <div className={'rounded-full h-2 transition-all duration-500 ' +
                  (playerHp / character.maxHp > 0.5 ? 'bg-green-500' :
                   playerHp / character.maxHp > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: Math.max(0, (playerHp / character.maxHp) * 100) + '%' }} />
            </div>
            <div className="flex gap-2 mt-1 text-[10px] font-sans text-ink-faint">
              {character.equipped && character.equipped.weapon && (
                <span>{character.equipped.weapon.name}</span>
              )}
              {character.equipped && character.equipped.armour && (
                <span>{character.equipped.armour.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Game
