// Top status bar — character HP, current act, Montor mood. Compact.
var pixelFont = "'Press Start 2P', monospace"
var displayFont = "'Sorts Mill Goudy', serif"
var uiFont = "system-ui, -apple-system, sans-serif"

var MOOD_COLOURS = {
  neutral: '#9d94b0',
  curious: '#5b8dd9',
  uneasy: '#d4a847',
  annoyed: '#d4a847',
  angry: '#c0392b',
  furious: '#c0392b',
  fond: '#27ae60',
  amused: '#27ae60',
  vengeful: '#c0392b',
}

function NarrativeStatusBar({ campaign, onExit }) {
  var c = campaign || {}
  var character = c.character || {}
  var hp = character.hp || 0
  var maxHp = character.maxHp || 1
  var hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  var hpColor = hpPct > 60 ? '#27ae60' : hpPct > 30 ? '#d4a847' : '#c0392b'
  var moodColor = MOOD_COLOURS[c.mood] || '#9d94b0'

  return (
    <div style={{
      borderBottom: '1px solid #2a1a30',
      background: '#060410',
      padding: '10px 14px',
      paddingTop: 'max(10px, env(safe-area-inset-top))',
    }}>
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Character + HP */}
        <div className="flex flex-col">
          <span style={{ fontFamily: pixelFont, fontSize: '10px', color: '#d4a017', letterSpacing: '1px' }}>
            {character.name || 'Knight'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div style={{
              width: '90px', height: '6px', background: '#1a1020',
              borderRadius: '3px', overflow: 'hidden', border: '1px solid #2a1a30',
            }}>
              <div style={{
                width: hpPct + '%', height: '100%', background: hpColor, transition: 'width 300ms ease',
              }} />
            </div>
            <span style={{ fontFamily: uiFont, fontSize: '10px', color: '#8b7b60' }}>
              {hp}/{maxHp}
            </span>
          </div>
        </div>

        {/* Act */}
        <div className="flex flex-col items-center">
          <span style={{ fontFamily: uiFont, fontSize: '8px', color: '#5a4a60', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Act
          </span>
          <span style={{ fontFamily: displayFont, fontSize: '12px', color: '#d4c8a0', fontStyle: 'italic' }}>
            {c.currentAct || 'The Grounds'}
          </span>
        </div>

        {/* Mood + exit */}
        <div className="flex flex-col items-end">
          <span style={{ fontFamily: uiFont, fontSize: '8px', color: '#5a4a60', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Mood
          </span>
          <span style={{ fontFamily: displayFont, fontSize: '12px', color: moodColor, fontStyle: 'italic' }}>
            {c.mood || 'neutral'}
          </span>
        </div>
      </div>

      {/* Inventory + threads strip */}
      {((c.inventory && c.inventory.length) || (c.openThreads && c.openThreads.length)) && (
        <div className="max-w-2xl mx-auto" style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {c.inventory && c.inventory.length > 0 && (
            <span style={{ fontFamily: uiFont, fontSize: '10px', color: '#8b7b60' }}>
              <span style={{ color: '#5a4a60' }}>Carrying:</span> {c.inventory.join(', ')}
            </span>
          )}
        </div>
      )}

      {onExit && (
        <button onClick={onExit}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            fontFamily: uiFont, fontSize: '10px', color: '#5a4a60',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
          ✕
        </button>
      )}
    </div>
  )
}

export default NarrativeStatusBar
