import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Check } from '../lib/dice.js'
import { generateBoss } from '../lib/enemies.js'
import { generateEncounter } from '../lib/encounters.js'
import { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import PlayerSprite from '../components/PlayerSprite.jsx'
import CombatRoller from '../components/CombatRoller.jsx'

var MAX_LOG_ENTRIES = 6

function formatAttackLog(r, type) {
  var who = r.attacker
  var target = r.target
  if (r.attackRoll.crit) {
    var defeated = type === 'player' ? (r.enemyDefeated ? ' It crumbles.' : '') : (r.playerDowned ? ' You fall.' : '')
    return who + ' lands a devastating blow on ' + target + '. ' + r.damage + ' damage.' + defeated
  }
  if (r.attackRoll.fumble) {
    return who + ' swings wildly and misses completely.'
  }
  if (r.attackRoll.success) {
    var defeated2 = type === 'player' ? (r.enemyDefeated ? ' It falls.' : '') : (r.playerDowned ? ' You collapse.' : '')
    return who + ' strikes ' + target + ' for ' + r.damage + ' damage.' + defeated2
  }
  return who + ' attacks ' + target + ' but misses.'
}

function Game({ character, user, onEndRun }) {
  var [battle, setBattle] = useState(null)
  var [phase, setPhase] = useState('intro')
  var [selectedTarget, setSelectedTarget] = useState(null)
  var [combatLog, setCombatLog] = useState([])
  var [totalXp, setTotalXp] = useState(0)
  var [pendingAttackResult, setPendingAttackResult] = useState(null)
  var [encounterNumber, setEncounterNumber] = useState(1)
  var MAX_ENCOUNTERS = 2
  // Enemy turn state
  var [enemyAttackInfo, setEnemyAttackInfo] = useState(null)
  var [enemyRollerKey, setEnemyRollerKey] = useState(0)
  var logRef = useRef(null)

  useEffect(function() {
    window.scrollTo(0, 0)
    startCombat()
  }, [])

  useEffect(function() {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [combatLog])

  function addLog(entry) {
    setCombatLog(function(prev) {
      var next = prev.concat([entry])
      if (next.length > MAX_LOG_ENTRIES) next = next.slice(next.length - MAX_LOG_ENTRIES)
      return next
    })
  }

  function startCombat() {
    var enemies = generateEncounter(0.1, 1, 'seasoned', 'dungeon')
    var players = [{ uid: user.uid, character: character }]
    var bs = createBattleState(players, enemies)
    setBattle(bs)
    setSelectedTarget(null)
    setCombatLog([])
    setPendingAttackResult(null)
    setEnemyAttackInfo(null)

    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    setPhase(firstActor && firstActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === ENEMY TURN ===

  // Windup: pre-resolve, show who's acting, then show roller
  useEffect(function() {
    if (phase !== 'enemyWindup' || !battle) return

    var currentId = getCurrentTurnId(battle)
    var attackOut = resolveEnemyAttack(battle, currentId)
    if (attackOut) {
      setEnemyAttackInfo({ attackOut: attackOut })
      setEnemyRollerKey(function(k) { return k + 1 })
    }

    var timeout = setTimeout(function() {
      setPhase('enemyRolling')
    }, 800)

    return function() { clearTimeout(timeout) }
  }, [phase, battle])

  function handleEnemyRollForRoller() {
    if (!enemyAttackInfo) return { roll: 1, modifier: 0, total: 1, tn: 10, success: false, crit: false, fumble: true }
    return enemyAttackInfo.attackOut.result.attackRoll
  }

  function handleEnemyComplete() {
    if (!enemyAttackInfo) return
    var attackOut = enemyAttackInfo.attackOut
    var r = attackOut.result
    addLog({ type: 'enemy', text: formatAttackLog(r, 'enemy') })

    var updatedBattle = attackOut.newBattle
    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'defeat') {
      setBattle(updatedBattle)
      setEnemyAttackInfo(null)
      setPhase('defeat')
      return
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setEnemyAttackInfo(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    setPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
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
  var isPlayerTurn = currentTurnId === user.uid && phase === 'playerTurn'
  var activeEnemyId = enemyAttackInfo ? enemyAttackInfo.attackOut.result.attackerId : null

  function handlePlayerAttackRoll() {
    var enemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
    var defTn = 10 + getModifier(enemy.stats.def)
    var rollResult = d20Check(strMod, defTn)

    var attackOut = resolvePlayerAttack(battle, user.uid, selectedTarget, rollResult)
    if (attackOut) setPendingAttackResult(attackOut)

    return rollResult
  }

  function handlePlayerComplete() {
    if (!pendingAttackResult) return
    var attackOut = pendingAttackResult
    var r = attackOut.result
    addLog({ type: 'player', text: formatAttackLog(r, 'player') })
    setPendingAttackResult(null)

    var updatedBattle = attackOut.newBattle
    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'victory') {
      setTotalXp(totalXp + calculateXp(updatedBattle))
      setBattle(updatedBattle)
      setPhase('victory')
      return
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setSelectedTarget(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    setPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === RENDER ===

  if (!battle) {
    return (
      <div className="h-full flex items-center justify-center bg-raised">
        <span className="text-ink text-base">Entering the dungeon...</span>
      </div>
    )
  }

  function startNextEncounter() {
    var depth = encounterNumber / MAX_ENCOUNTERS // 0.5 for encounter 2 of 2
    var enemies = generateEncounter(depth, 1, 'seasoned', 'dungeon')
    var players = [{ uid: user.uid, character: Object.assign({}, character, { maxHp: playerState.maxHp }) }]
    // Keep current HP from previous encounter
    var bs = createBattleState(players, enemies)
    bs.players[user.uid].currentHp = playerState.currentHp
    setBattle(bs)
    setSelectedTarget(null)
    setCombatLog([])
    setPendingAttackResult(null)
    setEnemyAttackInfo(null)
    setEncounterNumber(encounterNumber + 1)

    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    setPhase(firstActor && firstActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  if (phase === 'victory') {
    var isLastEncounter = encounterNumber >= MAX_ENCOUNTERS
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <h1 className="font-display text-4xl text-gold">Victory</h1>
        <p className="text-ink text-base italic">
          {isLastEncounter
            ? 'The dungeon falls silent. You have survived.'
            : 'The enemies fall. But the dungeon stirs deeper ahead...'}
        </p>
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
          <p className="text-ink text-sm">Encounter {encounterNumber} of {MAX_ENCOUNTERS}</p>
          <p className="text-ink text-base mt-1">XP earned: <span className="text-gold font-display text-xl">{totalXp}</span></p>
          <p className="text-ink-dim text-sm mt-1">HP remaining: {playerState ? playerState.currentHp : '?'}/{character.maxHp}</p>
        </div>
        {isLastEncounter ? (
          <button onClick={function() { onEndRun({ victory: true, encounters: encounterNumber, xp: totalXp }) }}
            className="py-3 px-8 rounded-lg bg-gold text-bg font-sans text-base font-semibold">
            Leave the Dungeon
          </button>
        ) : (
          <button onClick={startNextEncounter}
            className="py-3 px-8 rounded-lg bg-gold text-bg font-sans text-base font-semibold">
            Go Deeper
          </button>
        )}
      </div>
    )
  }

  if (phase === 'defeat') {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <h1 className="font-display text-4xl text-red-400">Defeated</h1>
        <p className="text-ink text-lg italic">Darkness swallows you whole.</p>
        <button onClick={function() { onEndRun({ victory: false, encounters: 1, xp: Math.round(totalXp * 0.5) }) }}
          className="py-3 px-8 rounded-lg bg-surface border border-border text-ink font-sans text-base">
          Return to Tavern
        </button>
      </div>
    )
  }

  // Get enemy info for roller display
  var enemyResult = enemyAttackInfo ? enemyAttackInfo.attackOut.result : null

  return (
    <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-ink-dim text-xs uppercase tracking-widest">Encounter {encounterNumber}/{MAX_ENCOUNTERS} -- Round {battle.round}</span>
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
          return <p key={i} className={'text-sm leading-relaxed mb-1 ' + (entry.type === 'player' ? 'text-green-400' : 'text-red-400')}>{entry.text}</p>
        })}
      </div>

      {/* Action area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">

        {/* Enemy windup */}
        {phase === 'enemyWindup' && enemyResult && (
          <div className="flex flex-col items-center gap-2 p-3 border-2 border-red-400/30 rounded-lg bg-red-400/5">
            <p className="text-red-400 text-lg font-display">{enemyResult.attacker}</p>
            <p className="text-ink text-sm italic">prepares to strike...</p>
          </div>
        )}

        {/* Enemy rolling — uses CombatRoller */}
        {phase === 'enemyRolling' && enemyResult && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-red-400 text-base font-display">{enemyResult.attacker} attacks {enemyResult.target}</p>
            <CombatRoller
              key={'enemy-' + enemyRollerKey}
              onAttackRoll={handleEnemyRollForRoller}
              onComplete={handleEnemyComplete}
              attackMod={enemyResult.attackRoll.modifier}
              tn={enemyResult.attackRoll.tn}
              damageDie={4}
              damageMod={enemyResult.attackRoll.modifier}
              colour="red"
              buttonLabel=""
              autoRoll={true}
              resolvedDamage={enemyResult.damage}
            />
          </div>
        )}

        {/* Player turn — no target */}
        {isPlayerTurn && !selectedTarget && (
          <div className="flex flex-col items-center gap-2 p-4 border-2 border-gold/40 rounded-lg bg-gold-glow">
            <p className="text-gold text-lg font-display">Your Turn</p>
            <p className="text-ink text-sm">Choose an enemy above to attack</p>
          </div>
        )}

        {/* Player turn — target selected */}
        {isPlayerTurn && selectedTarget && (function() {
          var targetEnemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
          var defTn = 10 + getModifier(targetEnemy.stats.def)
          var needToRoll = defTn - strMod
          var weaponDie = 8 // longsword
          return (
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-gold text-lg font-display mb-1">{targetEnemy.name}</p>
                <p className="text-ink text-sm italic">
                  You need to roll <span className="text-gold font-semibold not-italic">{needToRoll} or higher</span> to hit.
                </p>
              </div>
              <CombatRoller
                key={'player-' + selectedTarget}
                onAttackRoll={handlePlayerAttackRoll}
                onComplete={handlePlayerComplete}
                attackMod={strMod}
                tn={defTn}
                damageDie={weaponDie}
                damageMod={strMod}
                colour="gold"
                buttonLabel="Attack!"
                resolvedDamage={pendingAttackResult ? pendingAttackResult.result.damage : null}
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
      <div className="shrink-0 bg-surface border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <PlayerSprite classKey="knight" scale={2} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-sm text-ink truncate">{playerState.name}</span>
                <span className="text-[10px] font-sans text-ink-dim">
                  STR {playerState.combatStats.str} DEF {playerState.combatStats.def} AGI {playerState.combatStats.agi}
                </span>
              </div>
              <span className="text-ink text-xs font-sans shrink-0">{playerState.currentHp}/{playerState.maxHp}</span>
            </div>
            <div className="w-full bg-bg rounded-full h-2 mt-1">
              <div className={'rounded-full h-2 transition-all duration-500 ' +
                  (playerState.currentHp / playerState.maxHp > 0.5 ? 'bg-green-500' :
                   playerState.currentHp / playerState.maxHp > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: Math.max(0, (playerState.currentHp / playerState.maxHp) * 100) + '%' }} />
            </div>
            <div className="flex gap-2 mt-1 text-[10px] font-sans text-ink-faint">
              {playerState.equipped && playerState.equipped.weapon && (
                <span>{playerState.equipped.weapon.name}</span>
              )}
              {playerState.equipped && playerState.equipped.armour && (
                <span>{playerState.equipped.armour.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Game
