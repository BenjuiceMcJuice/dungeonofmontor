import { useState, useEffect } from 'react'

// Dice animation states: idle → rolling → result
function DiceRoller({ onRoll, modifier, tn, label, disabled }) {
  var [state, setState] = useState('idle') // idle | rolling | result
  var [display, setDisplay] = useState(null)
  var [result, setResult] = useState(null)

  function handleRoll() {
    if (state === 'rolling' || disabled) return

    setState('rolling')
    setResult(null)

    // Animate: show random numbers for ~700ms
    var ticks = 0
    var maxTicks = 12
    var interval = setInterval(function() {
      setDisplay(Math.floor(Math.random() * 20) + 1)
      ticks++
      if (ticks >= maxTicks) {
        clearInterval(interval)
        // Final roll
        var rollResult = onRoll()
        setResult(rollResult)
        setDisplay(rollResult.roll)
        setState('result')
      }
    }, 60)
  }

  // Auto-reset after showing result
  useEffect(function() {
    if (state === 'result') {
      var timeout = setTimeout(function() {
        setState('idle')
      }, 3000)
      return function() { clearTimeout(timeout) }
    }
  }, [state])

  var outcomeLabel = null
  var outcomeColor = 'text-ink'
  if (result) {
    if (result.crit) { outcomeLabel = 'CRITICAL HIT'; outcomeColor = 'text-gold' }
    else if (result.fumble) { outcomeLabel = 'FUMBLE'; outcomeColor = 'text-crimson' }
    else if (result.success) { outcomeLabel = 'HIT'; outcomeColor = 'text-gold' }
    else { outcomeLabel = 'MISS'; outcomeColor = 'text-ink-dim' }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Confirmation strip */}
      {label && state === 'idle' && (
        <p className="text-ink-dim text-sm">{label}</p>
      )}

      {/* Die display */}
      <div
        className={
          'w-20 h-20 rounded-xl flex items-center justify-center font-display text-3xl border-2 transition-all ' +
          (state === 'rolling'
            ? 'border-gold bg-gold-glow text-gold animate-pulse scale-110'
            : state === 'result'
              ? (result && result.crit
                  ? 'border-gold bg-gold-glow text-gold scale-125'
                  : result && result.fumble
                    ? 'border-crimson bg-surface text-crimson scale-110'
                    : 'border-border bg-surface text-ink scale-100')
              : 'border-border bg-raised text-ink-faint')
        }
      >
        {display !== null ? display : 'd20'}
      </div>

      {/* Modifier breakdown */}
      {result && (
        <div className="text-center">
          <div className="text-ink-faint text-xs">
            {result.roll} {result.modifier >= 0 ? '+' : ''}{result.modifier} = {result.total}
            {tn ? ' vs TN ' + tn : ''}
          </div>
          <div className={'text-lg font-display mt-1 ' + outcomeColor}>
            {outcomeLabel}
          </div>
        </div>
      )}

      {/* Roll button */}
      {state === 'idle' && (
        <button
          onClick={handleRoll}
          disabled={disabled}
          className={
            'py-3 px-8 rounded-lg font-sans text-sm font-semibold transition-all ' +
            (disabled
              ? 'bg-raised text-ink-faint border border-border'
              : 'bg-gold text-bg hover:opacity-90 active:scale-95')
          }
        >
          Roll the Dice
        </button>
      )}

      {state === 'rolling' && (
        <p className="text-ink-faint text-xs animate-pulse">Rolling...</p>
      )}
    </div>
  )
}

export default DiceRoller
