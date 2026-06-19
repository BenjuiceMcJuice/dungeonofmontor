// Scrolling story feed — narration, player actions, dice rolls all in one stream.
import { useEffect, useRef } from 'react'

var displayFont = "'Sorts Mill Goudy', serif"
var pixelFont = "'Press Start 2P', monospace"
var uiFont = "system-ui, -apple-system, sans-serif"

function DiceRollCard({ dice }) {
  var color =
    dice.crit ? '#9a8020' :
    dice.fumble ? '#7a2818' :
    dice.success ? '#5a7830' :
    '#6a5840'

  var label =
    dice.crit ? 'CRIT' :
    dice.fumble ? 'CRIT FAIL' :
    dice.success ? 'SUCCESS' : 'FAIL'

  return (
    <div className="flex justify-center my-3">
      <div style={{
        border: '2px solid ' + color,
        borderRadius: '8px',
        padding: '10px 16px',
        background: '#1a1510',
        textAlign: 'center',
        minWidth: '180px',
        boxShadow: '0 0 16px ' + color + '22',
      }}>
        <div style={{ fontFamily: pixelFont, fontSize: '11px', color: color, letterSpacing: '2px', marginBottom: '4px' }}>
          d20 — {dice.stat.toUpperCase()}
        </div>
        <div style={{ fontFamily: displayFont, fontSize: '20px', color: '#c8ba90', fontWeight: 'bold' }}>
          {dice.roll} {dice.modifier >= 0 ? '+' : '−'} {Math.abs(dice.modifier)} = {dice.total}
        </div>
        <div style={{ fontFamily: uiFont, fontSize: '10px', color: '#6a5e48', marginTop: '2px' }}>
          vs DC {dice.dc}
        </div>
        <div style={{ fontFamily: pixelFont, fontSize: '10px', color: color, marginTop: '6px', letterSpacing: '1px' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// Renders a scene block (DM-mode atmospheric, italic, no label),
// an optional Montor speech block (first-person, labelled, ashen),
// and the hook (the concrete event that demands a reaction — emphasised).
// Backward compat: legacy messages with `content` and no `scene` render as scene-only.
function NarrationBlock({ msg }) {
  var scene = msg.scene
  var montor = msg.montor
  var hook = msg.hook
  // Legacy fallback for messages saved before the scene/montor split.
  if (!scene && !montor && msg.content) scene = msg.content

  return (
    <div style={{ padding: '14px 6px 18px 6px', margin: '6px 0' }}>
      {/* SCENE — DM-mode, italic Goudy, aged paper, no label */}
      {scene && (
        <div style={{
          fontFamily: displayFont,
          fontSize: '16px',
          color: '#c8ba90',
          lineHeight: '1.75',
          fontStyle: 'italic',
          whiteSpace: 'pre-wrap',
        }}>
          {scene}
        </div>
      )}

      {/* MONTOR — labelled speech block, muted purple. Only when he speaks. */}
      {montor && (
        <div style={{ marginTop: scene ? '18px' : '0' }}>
          <div style={{
            fontFamily: pixelFont,
            fontSize: '10px',
            color: '#9b5bbd',
            letterSpacing: '3px',
            marginBottom: '10px',
            textShadow: '0 0 12px rgba(155,91,189,0.3)',
          }}>
            MONTOR
          </div>
          <div style={{
            fontFamily: displayFont,
            fontSize: '16px',
            color: '#c4aad4',
            lineHeight: '1.7',
            whiteSpace: 'pre-wrap',
            paddingLeft: '12px',
            borderLeft: '2px solid rgba(155,91,189,0.35)',
          }}>
            {montor}
          </div>
        </div>
      )}

      {/* HOOK — the concrete event. Amber, slight left rule. */}
      {hook && (
        <div style={{
          marginTop: (scene || montor) ? '18px' : '0',
          fontFamily: displayFont,
          fontSize: '15px',
          color: '#c0a040',
          lineHeight: '1.6',
          fontStyle: 'italic',
          fontWeight: 600,
          paddingLeft: '14px',
          borderLeft: '2px solid #5a4820',
        }}>
          {hook}
        </div>
      )}
    </div>
  )
}

function PlayerActionBlock({ author, content }) {
  return (
    <div style={{
      margin: '12px 0 8px 0',
      padding: '10px 14px',
      background: '#1a1510',
      border: '1px solid #2e2818',
      borderRadius: '6px',
      borderLeft: '3px solid #7a6430',
    }}>
      <div style={{ fontFamily: pixelFont, fontSize: '9px', color: '#9a8a68', letterSpacing: '1px', marginBottom: '4px' }}>
        {(author || 'PLAYER').toUpperCase()}
      </div>
      <div style={{ fontFamily: displayFont, fontSize: '14px', color: '#c8ba90', fontStyle: 'italic' }}>
        "{content}"
      </div>
    </div>
  )
}

function NarrativeFeed({ messages, busy }) {
  var endRef = useRef(null)

  useEffect(function() {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  if (!messages || messages.length === 0) {
    return (
      <div style={{ fontFamily: displayFont, color: '#6a5e48', fontStyle: 'italic', textAlign: 'center', padding: '40px 20px' }}>
        The house is settling...
      </div>
    )
  }

  return (
    <div className="flex flex-col px-3 pt-4 pb-2">
      {messages.map(function(m) {
        if (m.type === 'narration') return <NarrationBlock key={m.id} msg={m} />
        if (m.type === 'player_action') return <PlayerActionBlock key={m.id} author={m.author} content={m.content} />
        if (m.type === 'dice_roll') return <DiceRollCard key={m.id} dice={m.dice} />
        if (m.type === 'system') {
          return (
            <div key={m.id} style={{ fontFamily: uiFont, fontSize: '11px', color: '#6a5e48', textAlign: 'center', margin: '8px 0', fontStyle: 'italic' }}>
              — {m.content} —
            </div>
          )
        }
        return null
      })}
      {busy && (
        <div style={{ fontFamily: displayFont, color: '#9b5bbd', fontStyle: 'italic', textAlign: 'center', padding: '12px', fontSize: '13px' }}>
          Something shifts...
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

export default NarrativeFeed
