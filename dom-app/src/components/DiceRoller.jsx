import { useState, useEffect } from 'react'

function DiceRoller({ onRoll, onResult, modifier, tn, disabled, buttonLabel }) {
  var [state, setState] = useState('idle')
  var [display, setDisplay] = useState(null)
  var [result, setResult] = useState(null)

  function handleRoll() {
    if (state === 'rolling' || disabled) return
    setState('rolling')
    setResult(null)

    var ticks = 0
    var maxTicks = 12
    var interval = setInterval(function() {
      setDisplay(Math.floor(Math.random() * 20) + 1)
      ticks++
      if (ticks >= maxTicks) {
        clearInterval(interval)
        var rollResult = onRoll()
        setResult(rollResult)
        setDisplay(rollResult.roll)
        setState('result')
      }
    }, 60)
  }

  // No auto-advance — wait for user to tap Continue
  function handleContinue() {
    setState('idle')
    if (onResult) onResult(result)
  }

  // Outcome label only — damage details handled by parent
  var outcomeText = null
  var outcomeColor = 'text-ink'
  if (result) {
    if (result.crit) { outcomeText = 'Critical Hit!'; outcomeColor = 'text-gold' }
    else if (result.fumble) { outcomeText = 'Fumble!'; outcomeColor = 'text-red-400' }
    else if (result.success) { outcomeText = 'Hit!'; outcomeColor = 'text-gold' }
    else { outcomeText = 'Missed'; outcomeColor = 'text-ink-dim' }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Die */}
      <div
        className={
          'w-20 h-20 rounded-xl flex items-center justify-center font-display text-3xl border-2 transition-all ' +
          (state === 'rolling'
            ? 'border-gold bg-gold-glow text-gold animate-pulse scale-110'
            : state === 'result'
              ? (result && result.crit
                  ? 'border-gold bg-gold-glow text-gold scale-125'
                  : result && result.fumble
                    ? 'border-red-400 bg-red-400/10 text-red-400 scale-110'
                    : result && result.success
                      ? 'border-gold bg-surface text-gold'
                      : 'border-border bg-surface text-ink-dim')
              : 'border-border-hl bg-raised text-ink-dim')
        }
      >
        {display !== null ? display : '?'}
      </div>

      {/* Result narrative */}
      {result && (
        <div className="text-center">
          <p className={'text-xl font-display mb-1 ' + outcomeColor}>{outcomeText}</p>
          <p className="text-ink-dim text-sm">
            Rolled {result.roll} (needed {tn - modifier} or higher)
          </p>
        </div>
      )}

      {/* Roll button */}
      {state === 'idle' && (
        <button
          onClick={handleRoll}
          disabled={disabled}
          className={
            'py-3 px-8 rounded-lg font-sans text-base font-semibold transition-all ' +
            (disabled
              ? 'bg-raised text-ink-faint border border-border'
              : 'bg-gold text-bg hover:opacity-90 active:scale-95')
          }
        >
          {buttonLabel || 'Roll the Dice'}
        </button>
      )}

      {/* Continue button after result */}
      {state === 'result' && (
        <button
          onClick={handleContinue}
          className="py-3 px-8 rounded-lg bg-surface border border-border-hl text-ink font-sans text-base hover:bg-raised transition-colors"
        >
          Continue →
        </button>
      )}
    </div>
  )
}

export default DiceRoller
