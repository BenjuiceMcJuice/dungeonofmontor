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
  var [phase, setPhase] = useState('intro')
  var [lastResult, setLastResult] = useState(null)
  var [selectedTarget, setSelectedTarget] = useState(null)
  var [combatLog, setCombatLog] = useState([])
  var [totalXp, setTotalXp] = useState(0)
  var logRef = useRef(null)

  useEffect(function() {
    startCombat()
  }, [])

  // Auto-scroll log to bottom
  useEffect(function() {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
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

    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    if (firstActor && firstActor.type === 'enemy') {
      setPhase('enemyTurn')
    } else {
      setPhase('playerTurn')
    }
  }

  // Enemy turn
  useEffect(function() {
    if (phase !== 'enemyTurn' || !battle) return

    var timeout = setTimeout(function() {
      var currentId = getCurrentTurnId(battle)
      var attackOut = resolveEnemyAttack(battle, currentId)

      var updatedBattle = battle
      if (attackOut) {
        updatedBattle = attackOut.newBattle
        var r = attackOut.result
        addLog({ type: 'enemy', text: formatAttackLog(r, 'enemy') })
        setLastResult(r)

        var endResult = checkBattleEnd(updatedBattle)
        if (endResult === 'defeat') {
          setBattle(updatedBattle)
          setPhase('defeat')
          return
        }
      }

      var nextBattle = advanceTurn(updatedBattle)
      setBattle(nextBattle)

      var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
      if (nextActor && nextActor.type === 'enemy') {
        setPhase('enemyTurn')
      } else {
        setPhase('playerTurn')
        setSelectedTarget(null)
      }
    }, 1200)

    return function() { clearTimeout(timeout) }
  }, [phase, battle])

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
      setPhase('enemyTurn')
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
          return (
            <button
              key={enemy.id}
              onClick={function() { if (!isDead && isPlayerTurn) handleSelectTarget(enemy.id) }}
              disabled={isDead || !isPlayerTurn}
              className={
                'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ' +
                (isDead ? 'opacity-20 border-transparent' :
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
        {phase === 'enemyTurn' && (
          <div className="flex flex-col items-center gap-2 p-4 border-2 border-red-400/30 rounded-lg bg-red-400/5">
            <p className="text-red-400 text-lg font-display">Enemy Turn</p>
            <p className="text-ink text-sm animate-pulse">The enemy strikes...</p>
          </div>
        )}

        {isPlayerTurn && !selectedTarget && (
          <div className="flex flex-col items-center gap-2 p-5 border-2 border-gold/40 rounded-lg bg-gold-glow">
            <p className="text-gold text-xl font-display">Your Turn</p>
            <p className="text-ink text-base">Tap an enemy above to attack</p>
          </div>
        )}

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
