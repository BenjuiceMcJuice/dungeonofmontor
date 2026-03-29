import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Check } from '../lib/dice.js'
import { generateCombatEnemies, generateBoss } from '../lib/enemies.js'
import { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import DiceRoller from '../components/DiceRoller.jsx'

var MAX_LOG_ENTRIES = 6

function formatAttackLog(r, type) {
  var who = r.attacker
  var target = r.target

  if (r.attackRoll.crit) {
    var defeated = type === 'player' ? (r.enemyDefeated ? ' — it crumbles!' : '') : (r.playerDowned ? ' — you fall!' : '')
    return '💥 ' + who + ' lands a devastating blow on ' + target + '! ' + r.damage + ' damage' + defeated
  }
  if (r.attackRoll.fumble) {
    return '😵 ' + who + ' swings wildly and misses completely!'
  }
  if (r.attackRoll.success) {
    var defeated2 = type === 'player' ? (r.enemyDefeated ? ' — it falls!' : '') : (r.playerDowned ? ' — you collapse!' : '')
    return '⚔️ ' + who + ' strikes ' + target + ' for ' + r.damage + ' damage.' + defeated2
  }
  return '🛡️ ' + who + ' attacks ' + target + ' but misses.'
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
  var [hasRolled, setHasRolled] = useState(false)
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

  // Enemy result — apply damage to log immediately, wait for player to continue
  useEffect(function() {
    if (phase !== 'enemyResult' || !enemyAttackInfo || enemyAttackInfo.logged) return

    var attackOut = enemyAttackInfo.attackOut
    var r = attackOut.result
    addLog({ type: 'enemy', text: formatAttackLog(r, 'enemy') })
    setLastResult(r)
    // Mark as logged so we don't double-log
    setEnemyAttackInfo(Object.assign({}, enemyAttackInfo, { logged: true }))
  }, [phase, enemyAttackInfo])

  function handleEnemyContinue() {
    var attackOut = enemyAttackInfo.attackOut
    var updatedBattle = attackOut.newBattle

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
  }

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
    setHasRolled(false)
  }

  function handleAttackRoll() {
    setHasRolled(true)
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
    <div className="h-svh flex flex-col px-3 pt-2 pb-3 bg-raised overflow-hidden">
      {/* Scene header + Player HP — compact single row */}
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-sm text-ink shrink-0">{playerState.name}</span>
        <div className="flex-1 bg-bg rounded-full h-2.5">
          <div
            className={'rounded-full h-2.5 transition-all duration-500 ' +
              (playerState.currentHp / playerState.maxHp > 0.5 ? 'bg-green-500' :
               playerState.currentHp / playerState.maxHp > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: Math.max(0, (playerState.currentHp / playerState.maxHp) * 100) + '%' }}
          />
        </div>
        <span className="text-ink text-sm font-sans shrink-0">
          {playerState.currentHp}/{playerState.maxHp}
        </span>
        <span className="text-ink-dim text-xs shrink-0">R{battle.round}</span>
      </div>

      {/* Enemies — compact */}
      <div className="flex flex-wrap justify-center gap-2 mb-2">
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
                'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ' +
                (isDead ? 'opacity-20 border-transparent' :
                 isActing ? 'border-red-400 bg-red-400/10 scale-105' :
                 isTarget ? 'border-gold bg-gold-glow' :
                 isPlayerTurn ? 'border-border-hl hover:border-ink-faint cursor-pointer' :
                 'border-border')
              }
            >
              <SpriteRenderer spriteKey={enemy.archetypeKey} tierKey={enemy.tierKey} scale={3} />
              <span className="font-display text-sm text-ink">{enemy.name}</span>
              <div className="w-20 bg-bg rounded-full h-2">
                <div
                  className="bg-red-500 rounded-full h-2 transition-all duration-300"
                  style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }}
                />
              </div>
              <span className="text-ink text-xs font-sans">{enemy.currentHp}/{enemy.maxHp}</span>
            </button>
          )
        })}
      </div>

      {/* Combat log — compact, last 6 entries */}
      <div ref={logRef} className="bg-surface border border-border rounded-lg p-2 mb-2 max-h-24 overflow-y-auto shrink-0">
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

      {/* Action area — fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">

        {/* Enemy windup — show who's attacking */}
        {phase === 'enemyWindup' && enemyAttackInfo && (
          <div className="flex flex-col items-center gap-2 p-4 border-2 border-red-400/30 rounded-lg bg-red-400/5 max-w-sm">
            <p className="text-red-400 text-lg font-display">{enemyAttackInfo.enemyName}</p>
            <p className="text-ink text-sm italic text-center">
              The {enemyAttackInfo.enemyName.toLowerCase()} prepares to strike...
            </p>
          </div>
        )}

        {/* Enemy rolling — animated dice */}
        {phase === 'enemyRolling' && enemyAttackInfo && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-ink text-base italic">The {enemyAttackInfo.enemyName.toLowerCase()} swings!</p>
            <div className="w-24 h-24 rounded-xl flex items-center justify-center font-display text-4xl border-2 border-red-400 bg-red-400/10 text-red-400 animate-pulse scale-110">
              {enemyDiceDisplay !== null ? enemyDiceDisplay : '?'}
            </div>
          </div>
        )}

        {/* Enemy result — show outcome in plain English */}
        {phase === 'enemyResult' && enemyResultData && (
          <div className="flex flex-col items-center gap-3 max-w-sm">
            <div className={
              'w-24 h-24 rounded-xl flex items-center justify-center font-display text-4xl border-2 ' +
              (enemyResultData.attackRoll.crit ? 'border-red-400 bg-red-400/20 text-red-400 scale-125' :
               enemyResultData.attackRoll.fumble ? 'border-green-400 bg-green-400/10 text-green-400 scale-110' :
               enemyResultData.attackRoll.success ? 'border-red-400 bg-surface text-red-400' :
               'border-green-400 bg-surface text-green-400')
            }>
              {enemyResultData.attackRoll.roll}
            </div>
            <p className="text-ink text-base italic text-center">
              {enemyResultData.attackRoll.crit
                ? 'A devastating blow! ' + enemyResultData.attacker + ' hits you for ' + enemyResultData.damage + ' damage!'
                : enemyResultData.attackRoll.fumble
                  ? enemyResultData.attacker + ' stumbles and misses completely!'
                  : enemyResultData.attackRoll.success
                    ? enemyResultData.attacker + ' hits you for ' + enemyResultData.damage + ' damage.'
                    : enemyResultData.attacker + '\'s attack glances off your armour. No damage.'}
            </p>
            <p className={'text-xl font-display ' +
              (enemyResultData.attackRoll.crit ? 'text-red-400' :
               enemyResultData.attackRoll.success ? 'text-red-400' : 'text-green-400')}>
              {enemyResultData.attackRoll.crit ? 'Critical Hit!'
                : enemyResultData.attackRoll.fumble ? 'Fumble!'
                : enemyResultData.attackRoll.success ? enemyResultData.damage + ' Damage'
                : 'Missed!'}
            </p>
            {enemyResultData.playerDowned && (
              <div className="text-red-400 text-xl font-display animate-pulse">You fall...</div>
            )}
            <button
              onClick={handleEnemyContinue}
              className="mt-2 py-3 px-8 rounded-lg bg-surface border border-border-hl text-ink font-sans text-base hover:bg-raised transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Player turn — no target selected */}
        {isPlayerTurn && !selectedTarget && (
          <div className="flex flex-col items-center gap-2 p-4 border-2 border-gold/40 rounded-lg bg-gold-glow max-w-sm">
            <p className="text-gold text-lg font-display">Your Turn</p>
            <p className="text-ink text-sm text-center">Choose an enemy above to attack</p>
          </div>
        )}

        {/* Player turn — target selected, ready to roll */}
        {isPlayerTurn && selectedTarget && (function() {
          var targetEnemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
          var defTn = 10 + getModifier(targetEnemy.stats.def)
          var needToRoll = defTn - strMod
          return (
            <div className="flex flex-col items-center gap-4 max-w-sm">
              <div className="text-center">
                <p className="text-gold text-xl font-display mb-2">{targetEnemy.name}</p>
                <p className="text-ink text-base italic">
                  You ready your longsword. You need to roll <span className="text-gold font-semibold not-italic">{needToRoll} or higher</span> to hit.
                </p>
              </div>
              <DiceRoller
                onRoll={handleAttackRoll}
                modifier={strMod}
                tn={defTn}
                onResult={handleRollComplete}
                buttonLabel="Attack!"
              />
              {!hasRolled && (
                <button
                  onClick={function() { setSelectedTarget(null) }}
                  className="text-ink-dim text-sm hover:text-ink transition-colors"
                >
                  ← Choose different target
                </button>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default Game
