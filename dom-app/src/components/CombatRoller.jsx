import { useState, useEffect } from 'react'

// Two-dice combat roller: d20 attack → pause → weapon damage die
// Shows both dice side by side. Damage die only appears on hit.
// States: idle → attackRolling → attackResult → damageRolling → damageResult
// resolvedDamage: if provided, this is the actual damage to display (from combat.js)
// The damage die animation is visual only — the final number comes from resolvedDamage
function CombatRoller({ onAttackRoll, onComplete, attackMod, tn, damageDie, damageMod, buttonLabel, colour, autoRoll, resolvedDamage }) {
  var accentBorder = colour === 'red' ? 'border-red-400' : 'border-gold'
  var accentBg = colour === 'red' ? 'bg-red-400/10' : 'bg-gold-glow'
  var accentText = colour === 'red' ? 'text-red-400' : 'text-gold'
  var dimText = colour === 'red' ? 'text-red-400' : 'text-ink-dim'

  var [phase, setPhase] = useState('idle')
  var [attackDisplay, setAttackDisplay] = useState(null)
  var [attackResult, setAttackResult] = useState(null)
  var [damageDisplay, setDamageDisplay] = useState(null)
  var [damageTotal, setDamageTotal] = useState(null)
  var [isHit, setIsHit] = useState(false)
  var [started, setStarted] = useState(false)

  // Auto-roll on mount if autoRoll is true (for enemy turns)
  useEffect(function() {
    if (autoRoll && !started) {
      setStarted(true)
      setTimeout(function() { handleRoll() }, 300)
    }
  }, [autoRoll])

  function handleRoll() {
    if (phase !== 'idle') return
    setPhase('attackRolling')
    setAttackResult(null)
    setDamageDisplay(null)
    setDamageTotal(null)
    setIsHit(false)

    // Animate d20
    var ticks = 0
    var interval = setInterval(function() {
      setAttackDisplay(Math.floor(Math.random() * 20) + 1)
      ticks++
      if (ticks >= 12) {
        clearInterval(interval)
        var result = onAttackRoll()
        setAttackResult(result)
        setAttackDisplay(result.roll)

        var hit = result.crit || (!result.fumble && result.success)
        setIsHit(hit)
        setPhase('attackResult')

        // If hit, pause then roll damage
        if (hit) {
          setTimeout(function() {
            setPhase('damageRolling')
            var dTicks = 0
            var dInterval = setInterval(function() {
              setDamageDisplay(Math.floor(Math.random() * damageDie) + 1)
              dTicks++
              if (dTicks >= 8) {
                clearInterval(dInterval)
                // Roll actual damage
                var visualRoll = Math.floor(Math.random() * damageDie) + 1
                setDamageDisplay(visualRoll)
                // Use the actual resolved damage from combat.js, not our own calc
                setDamageTotal(resolvedDamage != null ? resolvedDamage : Math.max(visualRoll + damageMod, 1))
                setPhase('damageResult')
              }
            }, 60)
          }, 800)
        }
      }
    }, 60)
  }

  // Outcome text
  var outcomeText = ''
  var outcomeColor = 'text-ink'
  if (attackResult) {
    if (attackResult.crit) { outcomeText = 'Critical Hit!'; outcomeColor = accentText }
    else if (attackResult.fumble) { outcomeText = 'Fumble!'; outcomeColor = colour === 'red' ? 'text-green-400' : 'text-red-400' }
    else if (attackResult.success) { outcomeText = 'Hit!'; outcomeColor = accentText }
    else { outcomeText = 'Missed'; outcomeColor = colour === 'red' ? 'text-green-400' : 'text-ink-dim' }
  }

  var showContinue = phase === 'attackResult' && !isHit || phase === 'damageResult'

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Dice row */}
      <div className="flex items-center justify-center gap-4">
        {/* d20 attack die */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={
              'w-16 h-16 rounded-xl flex items-center justify-center font-display text-2xl border-2 transition-all ' +
              (phase === 'attackRolling'
                ? accentBorder + ' ' + accentBg + ' ' + accentText + ' animate-pulse scale-110'
                : attackResult
                  ? (attackResult.crit
                      ? accentBorder + ' ' + accentBg + ' ' + accentText + ' scale-110'
                      : attackResult.fumble
                        ? 'border-border bg-surface text-ink-dim'
                        : attackResult.success
                          ? accentBorder + ' bg-surface ' + accentText
                          : 'border-border bg-surface text-ink-dim')
                  : 'border-border-hl bg-raised text-ink-dim')
            }
          >
            {attackDisplay !== null ? attackDisplay : 'd20'}
          </div>
          <span className="text-ink-dim text-xs">Attack</span>
        </div>

        {/* Damage die — only visible on hit */}
        {(phase === 'damageRolling' || phase === 'damageResult') && (
          <div className="flex flex-col items-center gap-1">
            <div
              className={
                'w-16 h-16 rounded-xl flex items-center justify-center font-display text-2xl border-2 transition-all ' +
                (phase === 'damageRolling'
                  ? accentBorder + ' ' + accentBg + ' ' + accentText + ' animate-pulse scale-110'
                  : accentBorder + ' bg-surface ' + accentText)
              }
            >
              {damageDisplay !== null ? damageDisplay : '?'}
            </div>
            <span className="text-ink-dim text-xs">d{damageDie} Damage</span>
          </div>
        )}

        {/* Empty slot placeholder when damage die not yet shown */}
        {phase !== 'damageRolling' && phase !== 'damageResult' && phase !== 'idle' && isHit && (
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center border-2 border-border-hl bg-raised text-ink-faint font-display text-lg opacity-30">
              d{damageDie}
            </div>
            <span className="text-ink-faint text-xs">Damage</span>
          </div>
        )}
      </div>

      {/* Result text */}
      {attackResult && (
        <div className="text-center">
          <p className={'text-lg font-display ' + outcomeColor}>{outcomeText}</p>
          <p className="text-ink-dim text-xs">
            Rolled {attackResult.roll} (needed {tn - attackMod} or higher)
          </p>
        </div>
      )}

      {/* Damage total */}
      {phase === 'damageResult' && damageTotal !== null && (
        <div className="text-center">
          <p className={'text-xl font-display ' + accentText}>
            {damageTotal} damage
          </p>
          {attackResult && attackResult.crit && (
            <p className="text-ink-dim text-xs">Critical -- double damage!</p>
          )}
        </div>
      )}

      {/* Roll button — hidden for autoRoll (enemy turns) */}
      {phase === 'idle' && !autoRoll && (
        <button
          onClick={handleRoll}
          className={
            'py-3 px-8 rounded-lg font-sans text-base font-semibold transition-all ' +
            (colour === 'red'
              ? 'bg-red-400/20 border border-red-400 text-red-400'
              : 'bg-gold text-bg hover:opacity-90 active:scale-95')
          }
        >
          {buttonLabel || 'Attack!'}
        </button>
      )}

      {/* Continue */}
      {showContinue && (
        <button
          onClick={function() {
            if (onComplete) onComplete(attackResult, damageTotal || 0)
          }}
          className="py-2 px-6 rounded-lg bg-surface border border-border-hl text-ink font-sans text-sm hover:bg-raised transition-colors"
        >
          Continue
        </button>
      )}
    </div>
  )
}

export default CombatRoller
