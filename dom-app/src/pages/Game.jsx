import { useState, useEffect } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Check } from '../lib/dice.js'
import { generateCombatEnemies, generateBoss } from '../lib/enemies.js'
import { createBattleState, getCurrentTurnId, getActor, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import DiceRoller from '../components/DiceRoller.jsx'

function Game({ character, user, onEndRun }) {
  // Battle state — multiplayer-ready structure
  var [battle, setBattle] = useState(null)
  var [phase, setPhase] = useState('intro') // intro | playerTurn | enemyTurn | rolling | result | victory | defeat
  var [lastResult, setLastResult] = useState(null)
  var [selectedTarget, setSelectedTarget] = useState(null)
  var [combatLog, setCombatLog] = useState([])
  var [totalXp, setTotalXp] = useState(0)

  // Initialize combat on mount
  useEffect(function() {
    startCombat()
  }, [])

  function startCombat() {
    var enemies = generateCombatEnemies('seasoned')
    var players = [{ uid: user.uid, character: character }]
    var bs = createBattleState(players, enemies)
    setBattle(bs)
    setLastResult(null)
    setSelectedTarget(null)
    setCombatLog([])

    // Check who goes first based on initiative
    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    if (firstActor && firstActor.type === 'enemy') {
      setPhase('enemyTurn')
    } else {
      setPhase('playerTurn')
    }
  }

  // Enemy turn — auto-attack after a delay
  useEffect(function() {
    if (phase !== 'enemyTurn' || !battle) return

    var timeout = setTimeout(function() {
      var currentId = getCurrentTurnId(battle)
      var attackOut = resolveEnemyAttack(battle, currentId)

      var updatedBattle = battle
      if (attackOut) {
        updatedBattle = attackOut.newBattle
        var r = attackOut.result
        var newLog = combatLog.concat([{
          type: 'enemy',
          text: r.attacker + ' attacks ' + r.target + ' — ' +
            (r.attackRoll.crit ? 'CRITICAL! ' : r.attackRoll.fumble ? 'FUMBLE! ' : '') +
            (r.attackRoll.success || r.attackRoll.crit
              ? 'Hit for ' + r.damage + ' damage' + (r.playerDowned ? ' — DOWNED!' : '')
              : 'Miss!'),
        }])
        setCombatLog(newLog)
        setLastResult(r)

        var endResult = checkBattleEnd(updatedBattle)
        if (endResult === 'defeat') {
          setBattle(updatedBattle)
          setPhase('defeat')
          return
        }
      }

      // Advance to next turn
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
      <div className="min-h-svh flex items-center justify-center">
        <span className="text-ink-faint text-sm">Entering the dungeon...</span>
      </div>
    )
  }

  var playerState = battle.players[user.uid]
  var livingEnemies = battle.enemies.filter(function(e) { return !e.isDown })
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
      var newLog = combatLog.concat([{
        type: 'player',
        text: r.attacker + ' attacks ' + r.target + ' — ' +
          (r.attackRoll.crit ? 'CRITICAL! ' : r.attackRoll.fumble ? 'FUMBLE! ' : '') +
          (r.attackRoll.success || r.attackRoll.crit
            ? 'Hit for ' + r.damage + ' damage' + (r.enemyDefeated ? ' — DEFEATED!' : '')
            : 'Miss!'),
      }])
      setCombatLog(newLog)
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

    // Advance turn
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

  // Victory / defeat screens
  if (phase === 'victory') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6">
        <h1 className="font-display text-4xl text-gold">Victory!</h1>
        <p className="text-ink-dim italic">The enemies fall. The dungeon holds its breath.</p>
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
          <p className="text-ink-dim text-sm">XP earned: <span className="text-gold">{totalXp}</span></p>
        </div>
        <button
          onClick={function() { onEndRun({ victory: true, encounters: 1, xp: totalXp }) }}
          className="py-3 px-6 rounded-lg bg-gold text-bg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </div>
    )
  }

  if (phase === 'defeat') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6">
        <h1 className="font-display text-4xl text-crimson">Defeated</h1>
        <p className="text-ink-dim italic">Darkness swallows you whole. The dungeon does not mourn.</p>
        <button
          onClick={function() { onEndRun({ victory: false, encounters: 1, xp: Math.round(totalXp * 0.5) }) }}
          className="py-3 px-6 rounded-lg bg-raised border border-border text-ink-dim font-sans text-sm hover:border-border-hl transition-colors"
        >
          Return to Tavern
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col px-4 pt-4 pb-6">
      {/* Scene header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-ink-dim text-xs uppercase tracking-widest">
          Combat · Round {battle.round}
        </span>
        <span className="text-ink text-xs">
          {character.name} — Knight L{character.level}
        </span>
      </div>

      {/* Player HP bar */}
      <div className="bg-surface border border-border rounded-lg p-3 mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="font-display text-sm text-ink">{playerState.name}</span>
          <span className="text-ink text-xs">
            HP {playerState.currentHp}/{playerState.maxHp}
          </span>
        </div>
        <div className="w-full bg-raised rounded-full h-2.5">
          <div
            className={'rounded-full h-2.5 transition-all duration-500 ' +
              (playerState.currentHp / playerState.maxHp > 0.5 ? 'bg-green-500' :
               playerState.currentHp / playerState.maxHp > 0.25 ? 'bg-amber-500' : 'bg-crimson')}
            style={{ width: Math.max(0, (playerState.currentHp / playerState.maxHp) * 100) + '%' }}
          />
        </div>
      </div>

      {/* Enemies */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {battle.enemies.map(function(enemy) {
          var isTarget = selectedTarget === enemy.id
          var isDead = enemy.isDown
          return (
            <button
              key={enemy.id}
              onClick={function() { if (!isDead && isPlayerTurn) handleSelectTarget(enemy.id) }}
              disabled={isDead || !isPlayerTurn}
              className={
                'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ' +
                (isDead ? 'opacity-25 border-border' :
                 isTarget ? 'border-gold bg-gold-glow' :
                 isPlayerTurn ? 'border-border hover:border-border-hl cursor-pointer' :
                 'border-border')
              }
            >
              <SpriteRenderer spriteKey={enemy.archetypeKey} tierKey={enemy.tierKey} scale={4} />
              <span className="font-display text-sm text-ink">{enemy.name}</span>
              <div className="w-20 bg-raised rounded-full h-2">
                <div
                  className="bg-crimson rounded-full h-2 transition-all duration-300"
                  style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }}
                />
              </div>
              <span className="text-ink-dim text-xs">{enemy.currentHp}/{enemy.maxHp}</span>
            </button>
          )
        })}
      </div>

      {/* Combat log */}
      <div className="bg-surface border border-border rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
        {combatLog.length === 0 && (
          <p className="text-ink-dim text-sm italic">The battle begins...</p>
        )}
        {combatLog.map(function(entry, i) {
          return (
            <p key={i} className={'text-sm mb-1.5 ' + (entry.type === 'player' ? 'text-ink' : 'text-crimson')}>
              {entry.text}
            </p>
          )
        })}
      </div>

      {/* Action area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        {phase === 'enemyTurn' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-crimson text-sm font-display">Enemy Turn</p>
            <p className="text-ink-faint text-sm animate-pulse">The enemy strikes...</p>
          </div>
        )}

        {isPlayerTurn && !selectedTarget && (
          <div className="flex flex-col items-center gap-2 p-4 border border-gold/30 rounded-lg bg-gold-glow">
            <p className="text-gold text-lg font-display">Your Turn</p>
            <p className="text-ink-dim text-sm">Tap an enemy above to attack</p>
          </div>
        )}

        {isPlayerTurn && selectedTarget && (function() {
          var targetEnemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
          var defTn = 10 + getModifier(targetEnemy.stats.def)
          return (
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-gold text-sm font-display mb-1">Attacking {targetEnemy.name}</p>
                <p className="text-ink-faint text-xs">d20 + {strMod} vs TN {defTn} · Longsword d8 + {strMod} damage</p>
              </div>
              <DiceRoller
                onRoll={handleAttackRoll}
                modifier={strMod}
                tn={defTn}
                onResult={handleRollComplete}
              />
              <button
                onClick={function() { setSelectedTarget(null) }}
                className="text-ink-faint text-xs hover:text-ink-dim"
              >
                Choose different target
              </button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default Game
