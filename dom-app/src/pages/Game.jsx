import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Check } from '../lib/dice.js'
import { generateCombatEnemies, generateBoss } from '../lib/enemies.js'
import { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import DiceRoller from '../components/DiceRoller.jsx'

var MAX_LOG_ENTRIES = 6

function formatAttackLog(r, type) {
  var rollInfo = '🎲 ' + r.attackRoll.roll + (r.attackRoll.modifier >= 0 ? '+' : '') + r.attackRoll.modifier + ' = ' + r.attackRoll.total + ' vs TN ' + r.attackRoll.tn
  var outcome = ''
  if (r.attackRoll.crit) outcome = '💥 CRITICAL! '
  else if (r.attackRoll.fumble) outcome = '😵 FUMBLE! '

  if (r.attackRoll.success || r.attackRoll.crit) {
    var defeated = type === 'player' ? (r.enemyDefeated ? ' ☠️ DEFEATED!' : '') : (r.playerDowned ? ' 💀 DOWNED!' : '')
    return r.attacker + ' → ' + r.target + '  |  ' + rollInfo + '  |  ' + outcome + r.damage + ' damage' + defeated
  }
  return r.attacker + ' → ' + r.target + '  |  ' + rollInfo + '  |  ' + outcome + 'Miss!'
}

function Game({ character, user, onEndRun }) {
  var [battle, setBattle] = useState(null)
  // phases: playerTurn | enemyWindup | enemyRolling | enemyResult | victory | defeat
  var [phase, setPhase] = useState('intro')
  var [lastResult, setLastResult] = useState(null)
  var [selectedTarget, setSelectedTarget] = useState(null)
  var [combatLog, setCombatLog] = useState([])
  var [totalXp, setTotalXp] = useState(0)
  var [enemyAttackInfo, setEnemyAttackInfo] = useState(null) // { enemyId, enemyName, targetName, result }
  var [enemyDiceDisplay, setEnemyDiceDisplay] = useState(null)
  var logRef = useRef(null)

  useEffect(function() { startCombat() }, [])

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
    var enemies = generateCombatEnemies('seasoned')
    var players = [{ uid: user.uid, character: character }]
    var bs = createBattleState(players, enemies)
    setBattle(bs)
    setLastResult(null)
    setSelectedTarget(null)
    setCombatLog([])
    setEnemyAttackInfo(null)
    setEnemyDiceDisplay(null)

    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    if (firstActor && firstActor.type === 'enemy') {
      setPhase('enemyWindup')
    } else {
      setPhase('playerTurn')
    }
  }

  // Enemy windup — show who's attacking, pause, then roll
  useEffect(function() {
    if (phase !== 'enemyWindup' || !battle) return

    var currentId = getCurrentTurnId(battle)
    var actor = getActor(battle, currentId)
    if (!actor) return

    // Pre-resolve the attack (but don't apply yet — just to know the target)
    var attackOut = resolveEnemyAttack(battle, currentId)
    if (attackOut) {
      setEnemyAttackInfo({
        enemyId: currentId,
        enemyName: attackOut.result.attacker,
        targetName: attackOut.result.target,
        attackOut: attackOut,
      })
    }

    // Pause to show who's acting, then start dice
    var timeout = setTimeout(function() {
      setPhase('enemyRolling')
    }, 800)

    return function() { clearTimeout(timeout) }
  }, [phase, battle])

  // Enemy rolling — animate dice
  useEffect(function() {
    if (phase !== 'enemyRolling' || !enemyAttackInfo) return

    var ticks = 0
    var maxTicks = 12
    var interval = setInterval(function() {
      setEnemyDiceDisplay(Math.floor(Math.random() * 20) + 1)
      ticks++
      if (ticks >= maxTicks) {
        clearInterval(interval)
        // Show the actual roll
        var r = enemyAttackInfo.attackOut.result
        setEnemyDiceDisplay(r.attackRoll.roll)
        setPhase('enemyResult')
      }
    }, 60)

    return function() { clearInterval(interval) }
  }, [phase, enemyAttackInfo])

  // Enemy result — show outcome, apply damage, then advance
  useEffect(function() {
    if (phase !== 'enemyResult' || !enemyAttackInfo) return

    var timeout = setTimeout(function() {
      var attackOut = enemyAttackInfo.attackOut
      var updatedBattle = attackOut.newBattle
      var r = attackOut.result

      addLog({ type: 'enemy', text: formatAttackLog(r, 'enemy') })
      setLastResult(r)

      var endResult = checkBattleEnd(updatedBattle)
      if (endResult === 'defeat') {
        setBattle(updatedBattle)
        setEnemyAttackInfo(null)
        setEnemyDiceDisplay(null)
        setPhase('defeat')
        return
      }

      var nextBattle = advanceTurn(updatedBattle)
      setBattle(nextBattle)
      setEnemyAttackInfo(null)
      setEnemyDiceDisplay(null)

      var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
      if (nextActor && nextActor.type === 'enemy') {
        setPhase('enemyWindup')
      } else {
        setPhase('playerTurn')
        setSelectedTarget(null)
      }
    }, 2000)

    return function() { clearTimeout(timeout) }
  }, [phase, enemyAttackInfo])

  if (!battle) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-raised">
        <span className="text-ink text-base">Entering the dungeon...</span>
      </div>
    )
  }

  var playerState = battle.players[user.uid]
  var currentTurnId = getCurrentTurnId(battle)
  var isPlayerTurn = currentTurnId === user.uid && phase === 'playerTurn'
  var strMod = getModifier(playerState.combatStats.str)
  var activeEnemyId = enemyAttackInfo ? enemyAttackInfo.enemyId : null

  function handleSelectTarget(enemyId) {
    setSelectedTarget(enemyId)
  }

  function handleAttackRoll() {
    var enemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
    var defTn = 10 + getModifier(enemy.stats.def)
    return d20Check(strMod, defTn)
  }

  function handleRollComplete() {
    var attackOut = resolvePlayerAttack(battle, user.uid, selectedTarget)

    var updatedBattle = battle
    if (attackOut) {
      updatedBattle = attackOut.newBattle
      var r = attackOut.result
      addLog({ type: 'player', text: formatAttackLog(r, 'player') })
      setLastResult(r)

      var endResult = checkBattleEnd(updatedBattle)
      if (endResult === 'victory') {
        var xp = calculateXp(updatedBattle)
        setTotalXp(totalXp + xp)
        setBattle(updatedBattle)
        setPhase('victory')
        return
      }
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setSelectedTarget(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    if (nextActor && nextActor.type === 'enemy') {
      setPhase('enemyWindup')
    } else {
      setPhase('playerTurn')
    }
  }

  // Victory
  if (phase === 'victory') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <h1 className="font-display text-4xl text-gold">Victory!</h1>
        <p className="text-ink text-lg italic">The enemies fall. The dungeon holds its breath.</p>
        <div className="bg-surface border border-border rounded-lg p-5 w-full max-w-xs">
          <p className="text-ink text-base">XP earned: <span className="text-gold font-display text-xl">{totalXp}</span></p>
        </div>
        <button
          onClick={function() { onEndRun({ victory: true, encounters: 1, xp: totalXp }) }}
          className="py-3 px-8 rounded-lg bg-gold text-bg font-sans text-base font-semibold hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </div>
    )
  }

  // Defeat
  if (phase === 'defeat') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <h1 className="font-display text-4xl text-red-400">Defeated</h1>
        <p className="text-ink text-lg italic">Darkness swallows you whole. The dungeon does not mourn.</p>
        <button
          onClick={function() { onEndRun({ victory: false, encounters: 1, xp: Math.round(totalXp * 0.5) }) }}
          className="py-3 px-8 rounded-lg bg-surface border border-border text-ink font-sans text-base hover:border-border-hl transition-colors"
        >
          Return to Tavern
        </button>
      </div>
    )
  }

  // Determine enemy result for display
  var enemyResultData = null
  if (phase === 'enemyResult' && enemyAttackInfo) {
    enemyResultData = enemyAttackInfo.attackOut.result
  }

  return (
    <div className="min-h-svh flex flex-col px-4 pt-4 pb-6 bg-raised">
      {/* Scene header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-ink-dim text-sm uppercase tracking-widest">
          Combat · Round {battle.round}
        </span>
        <span className="text-ink text-sm">
          {character.name} — Knight L{character.level}
        </span>
      </div>

      {/* Player HP bar */}
      <div className="bg-surface border border-border rounded-lg p-3 mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-display text-base text-ink">{playerState.name}</span>
          <span className="text-ink text-sm font-sans">
            {playerState.currentHp} / {playerState.maxHp} HP
          </span>
        </div>
        <div className="w-full bg-bg rounded-full h-3">
          <div
            className={'rounded-full h-3 transition-all duration-500 ' +
              (playerState.currentHp / playerState.maxHp > 0.5 ? 'bg-green-500' :
               playerState.currentHp / playerState.maxHp > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: Math.max(0, (playerState.currentHp / playerState.maxHp) * 100) + '%' }}
          />
        </div>
      </div>

      {/* Enemies */}
      <div className="flex flex-wrap justify-center gap-3 mb-4">
        {battle.enemies.map(function(enemy) {
          var isTarget = selectedTarget === enemy.id
          var isDead = enemy.isDown
          var isActing = activeEnemyId === enemy.id
          return (
            <button
              key={enemy.id}
              onClick={function() { if (!isDead && isPlayerTurn) handleSelectTarget(enemy.id) }}
              disabled={isDead || !isPlayerTurn}
              className={
                'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ' +
                (isDead ? 'opacity-20 border-transparent' :
                 isActing ? 'border-red-400 bg-red-400/10 scale-105' :
                 isTarget ? 'border-gold bg-gold-glow' :
                 isPlayerTurn ? 'border-border-hl hover:border-ink-faint cursor-pointer' :
                 'border-border')
              }
            >
              <SpriteRenderer spriteKey={enemy.archetypeKey} tierKey={enemy.tierKey} scale={4} />
              <span className="font-display text-base text-ink">{enemy.name}</span>
              <div className="w-24 bg-bg rounded-full h-2.5">
                <div
                  className="bg-red-500 rounded-full h-2.5 transition-all duration-300"
                  style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }}
                />
              </div>
              <span className="text-ink text-sm font-sans">{enemy.currentHp}/{enemy.maxHp}</span>
            </button>
          )
        })}
      </div>

      {/* Combat log — last 6 entries */}
      <div ref={logRef} className="bg-surface border border-border rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
        {combatLog.length === 0 && (
          <p className="text-ink-dim text-sm italic">The battle begins...</p>
        )}
        {combatLog.map(function(entry, i) {
          return (
            <p key={i} className={'text-sm leading-relaxed mb-2 ' + (entry.type === 'player' ? 'text-green-400' : 'text-red-400')}>
              {entry.text}
            </p>
          )
        })}
      </div>

      {/* Action area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">

        {/* Enemy windup — show who's attacking */}
        {phase === 'enemyWindup' && enemyAttackInfo && (
          <div className="flex flex-col items-center gap-2 p-4 border-2 border-red-400/30 rounded-lg bg-red-400/5">
            <p className="text-red-400 text-lg font-display">{enemyAttackInfo.enemyName}</p>
            <p className="text-ink text-sm">Attacking {enemyAttackInfo.targetName}...</p>
          </div>
        )}

        {/* Enemy rolling — animated dice */}
        {phase === 'enemyRolling' && enemyAttackInfo && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-red-400 text-lg font-display">{enemyAttackInfo.enemyName} attacks!</p>
            <div className="w-20 h-20 rounded-xl flex items-center justify-center font-display text-3xl border-2 border-red-400 bg-red-400/10 text-red-400 animate-pulse scale-110">
              {enemyDiceDisplay !== null ? enemyDiceDisplay : '?'}
            </div>
            <p className="text-ink-dim text-xs animate-pulse">Rolling...</p>
          </div>
        )}

        {/* Enemy result — show outcome */}
        {phase === 'enemyResult' && enemyResultData && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-red-400 text-lg font-display">{enemyResultData.attacker}</p>
            <div className={
              'w-20 h-20 rounded-xl flex items-center justify-center font-display text-3xl border-2 ' +
              (enemyResultData.attackRoll.crit ? 'border-red-400 bg-red-400/20 text-red-400 scale-125' :
               enemyResultData.attackRoll.fumble ? 'border-green-400 bg-green-400/10 text-green-400 scale-110' :
               'border-border bg-surface text-ink')
            }>
              {enemyResultData.attackRoll.roll}
            </div>
            <div className="text-center">
              <div className="text-ink text-sm">
                {enemyResultData.attackRoll.roll} {enemyResultData.attackRoll.modifier >= 0 ? '+' : ''}{enemyResultData.attackRoll.modifier} = {enemyResultData.attackRoll.total} vs TN {enemyResultData.attackRoll.tn}
              </div>
              <div className={'text-xl font-display mt-1 ' +
                (enemyResultData.attackRoll.crit ? 'text-red-400' :
                 enemyResultData.attackRoll.fumble ? 'text-green-400' :
                 (enemyResultData.attackRoll.success ? 'text-red-400' : 'text-green-400'))}>
                {enemyResultData.attackRoll.crit ? 'CRITICAL HIT!' :
                 enemyResultData.attackRoll.fumble ? 'FUMBLE!' :
                 (enemyResultData.attackRoll.success ? enemyResultData.damage + ' DAMAGE' : 'MISS!')}
              </div>
              {enemyResultData.playerDowned && (
                <div className="text-red-400 text-lg font-display mt-1 animate-pulse">💀 YOU ARE DOWNED</div>
              )}
            </div>
          </div>
        )}

        {/* Player turn — no target selected */}
        {isPlayerTurn && !selectedTarget && (
          <div className="flex flex-col items-center gap-2 p-5 border-2 border-gold/40 rounded-lg bg-gold-glow">
            <p className="text-gold text-xl font-display">Your Turn</p>
            <p className="text-ink text-base">Tap an enemy above to attack</p>
          </div>
        )}

        {/* Player turn — target selected, ready to roll */}
        {isPlayerTurn && selectedTarget && (function() {
          var targetEnemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
          var defTn = 10 + getModifier(targetEnemy.stats.def)
          return (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <p className="text-gold text-lg font-display mb-1">Attacking {targetEnemy.name}</p>
                <p className="text-ink text-sm">🎲 d20 + {strMod} vs TN {defTn}  ·  ⚔️ d8 + {strMod} damage</p>
              </div>
              <DiceRoller
                onRoll={handleAttackRoll}
                modifier={strMod}
                tn={defTn}
                onResult={handleRollComplete}
              />
              <button
                onClick={function() { setSelectedTarget(null) }}
                className="text-ink-dim text-sm hover:text-ink transition-colors"
              >
                ← Choose different target
              </button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default Game
