// Scrolling story feed — narration, player actions, dice rolls all in one stream.
import { useEffect, useRef } from 'react'

var displayFont = "'Sorts Mill Goudy', serif"
var pixelFont = "'Press Start 2P', monospace"
var uiFont = "system-ui, -apple-system, sans-serif"

function DiceRollCard({ dice }) {
  var color =
    dice.crit ? '#d4a847' :
    dice.fumble ? '#c0392b' :
    dice.success ? '#5b8dd9' :
    '#9d94b0'

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
        background: '#0a0812',
        textAlign: 'center',
        minWidth: '180px',
        boxShadow: '0 0 20px ' + color + '22',
      }}>
        <div style={{ fontFamily: pixelFont, fontSize: '11px', color: color, letterSpacing: '2px', marginBottom: '4px' }}>
          d20 — {dice.stat.toUpperCase()}
        </div>
        <div style={{ fontFamily: displayFont, fontSize: '20px', color: '#ede5f8', fontWeight: 'bold' }}>
          {dice.roll} {dice.modifier >= 0 ? '+' : '−'} {Math.abs(dice.modifier)} = {dice.total}
        </div>
        <div style={{ fontFamily: uiFont, fontSize: '10px', color: '#9d94b0', marginTop: '2px' }}>
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
// an optional Montor speech block (first-person, labelled, Montor purple),
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
      {/* SCENE — DM-mode, italic Goudy, soft cream, no label */}
      {scene && (
        <div style={{
          fontFamily: displayFont,
          fontSize: '16px',
          color: '#d4c8a0',
          lineHeight: '1.75',
          fontStyle: 'italic',
          whiteSpace: 'pre-wrap',
        }}>
          {scene}
        </div>
      )}

      {/* MONTOR — labelled speech block, purple. Only when he speaks. */}
      {montor && (
        <div style={{ marginTop: scene ? '18px' : '0' }}>
          <div style={{
            fontFamily: pixelFont,
            fontSize: '10px',
            color: '#c06ee0',
            letterSpacing: '3px',
            marginBottom: '10px',
            textShadow: '0 0 12px rgba(192, 110, 224, 0.35)',
          }}>
            MONTOR
          </div>
          <div style={{
            fontFamily: displayFont,
            fontSize: '16px',
            color: '#d8b8e8',
            lineHeight: '1.7',
            whiteSpace: 'pre-wrap',
            paddingLeft: '12px',
            borderLeft: '2px solid rgba(192, 110, 224, 0.4)',
          }}>
            {montor}
          </div>
        </div>
      )}

      {/* HOOK — the concrete event. Emphasised, slight visual punctuation. */}
      {hook && (
        <div style={{
          marginTop: (scene || montor) ? '18px' : '0',
          fontFamily: displayFont,
          fontSize: '15px',
          color: '#e8c8a0',
          lineHeight: '1.6',
          fontStyle: 'italic',
          fontWeight: 600,
          paddingLeft: '14px',
          borderLeft: '2px solid #d4a847',
          textShadow: '0 0 14px rgba(212, 168, 71, 0.18)',
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
      background: '#0e0818',
      border: '1px solid #2a1a30',
      borderRadius: '6px',
      borderLeft: '3px solid #c06ee0',
    }}>
      <div style={{ fontFamily: pixelFont, fontSize: '9px', color: '#c06ee0', letterSpacing: '1px', marginBottom: '4px' }}>
        {(author || 'PLAYER').toUpperCase()}
      </div>
      <div style={{ fontFamily: displayFont, fontSize: '14px', color: '#ede5f8', fontStyle: 'italic' }}>
        “{content}”
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
      <div style={{ fontFamily: displayFont, color: '#5a4a60', fontStyle: 'italic', textAlign: 'center', padding: '40px 20px' }}>
        Montor is preparing the scene...
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
            <div key={m.id} style={{ fontFamily: uiFont, fontSize: '11px', color: '#5a4a60', textAlign: 'center', margin: '8px 0', fontStyle: 'italic' }}>
              — {m.content} —
            </div>
          )
        }
        return null
      })}
      {busy && (
        <div style={{ fontFamily: displayFont, color: '#c06ee0', fontStyle: 'italic', textAlign: 'center', padding: '12px', fontSize: '13px' }}>
          Montor is thinking...
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

export default NarrativeFeed
