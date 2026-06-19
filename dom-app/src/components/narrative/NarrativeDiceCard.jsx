import { useState } from 'react'
import { d20Check } from '../../lib/dice.js'

var pixelFont = "'Press Start 2P', monospace"
var displayFont = "'Sorts Mill Goudy', serif"
var uiFont = "system-ui, -apple-system, sans-serif"

// Interactive d20 card for narrative mode. Three states: idle → rolling → result.
// On Continue, calls onCommit(rollRes) to finalise the outcome in the campaign hook.
function NarrativeDiceCard({ stat, dc, modifier, onCommit }) {
  var [phase, setPhase] = useState('idle') // idle | rolling | result
  var [display, setDisplay] = useState(null)
  var [rollRes, setRollRes] = useState(null)

  function handleRoll() {
    if (phase === 'rolling') return
    setPhase('rolling')
    setRollRes(null)

    var ticks = 0
    var maxTicks = 12
    var interval = setInterval(function() {
      setDisplay(Math.floor(Math.random() * 20) + 1)
      ticks++
      if (ticks >= maxTicks) {
        clearInterval(interval)
        var res = d20Check(modifier, dc)
        setRollRes(res)
        setDisplay(res.roll)
        setPhase('result')
      }
    }, 60)
  }

  function handleContinue() {
    if (onCommit) onCommit(rollRes)
  }

  // Colours and labels by outcome
  var color = '#6a5840' // default: fail brown
  var label = 'ROLL'
  if (rollRes) {
    if (rollRes.crit)        { color = '#9a8020'; label = 'CRITICAL!' }
    else if (rollRes.fumble) { color = '#7a2818'; label = 'FUMBLE'    }
    else if (rollRes.success){ color = '#5a7830'; label = 'SUCCESS'   }
    else                     { color = '#6a5840'; label = 'FAIL'      }
  }

  var modSign = modifier >= 0 ? '+' : '−'
  var modAbs  = Math.abs(modifier)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '20px 16px',
      background: '#110f09',
      borderTop: '1px solid #2e2818',
    }}>
      {/* Stat + DC label */}
      <div style={{ fontFamily: pixelFont, fontSize: '10px', color: '#9a8a68', letterSpacing: '2px' }}>
        d20 — {stat.toUpperCase()} vs DC {dc}
      </div>

      {/* Die face */}
      <div
        onClick={phase === 'idle' ? handleRoll : undefined}
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '12px',
          border: '2px solid ' + (phase === 'idle' ? '#3a3020' : color),
          background: phase === 'rolling' ? 'rgba(154,128,32,0.08)' : phase === 'result' ? 'rgba(0,0,0,0.4)' : '#211c14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: displayFont,
          fontSize: '32px',
          color: phase === 'idle' ? '#3a3020' : color,
          cursor: phase === 'idle' ? 'pointer' : 'default',
          transform: phase === 'rolling' ? 'scale(1.1)' : phase === 'result' ? 'scale(1.08)' : 'scale(1)',
          transition: 'all 0.15s ease',
          boxShadow: phase !== 'idle' ? ('0 0 20px ' + color + '33') : 'none',
          userSelect: 'none',
        }}
      >
        {display !== null ? display : '?'}
      </div>

      {/* Result breakdown */}
      {rollRes && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: pixelFont, fontSize: '11px', color: color, letterSpacing: '2px', marginBottom: '6px' }}>
            {label}
          </div>
          <div style={{ fontFamily: displayFont, fontSize: '18px', color: '#c8ba90' }}>
            {rollRes.roll} {modSign} {modAbs} = {rollRes.total}
          </div>
          <div style={{ fontFamily: uiFont, fontSize: '10px', color: '#6a5e48', marginTop: '2px' }}>
            vs DC {dc}
          </div>
        </div>
      )}

      {/* Tap prompt when idle */}
      {phase === 'idle' && (
        <button
          onClick={handleRoll}
          style={{
            fontFamily: pixelFont,
            fontSize: '9px',
            color: '#9a8a68',
            background: 'transparent',
            border: '1px solid #3a3020',
            borderRadius: '6px',
            padding: '10px 20px',
            cursor: 'pointer',
            letterSpacing: '1px',
          }}
        >
          ROLL THE DICE
        </button>
      )}

      {/* Continue after result */}
      {phase === 'result' && (
        <button
          onClick={handleContinue}
          style={{
            fontFamily: uiFont,
            fontSize: '14px',
            color: '#c8ba90',
            background: '#211c14',
            border: '1px solid #3a3020',
            borderRadius: '8px',
            padding: '10px 28px',
            cursor: 'pointer',
          }}
        >
          Continue →
        </button>
      )}
    </div>
  )
}

export default NarrativeDiceCard
