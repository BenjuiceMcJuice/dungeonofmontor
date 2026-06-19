// Top status bar — character HP, current act, Montor mood. Compact.
var pixelFont = "'Press Start 2P', monospace"
var displayFont = "'Sorts Mill Goudy', serif"
var uiFont = "system-ui, -apple-system, sans-serif"

var MOOD_COLOURS = {
  neutral:  '#7a7468',
  curious:  '#5a7048',
  uneasy:   '#8a7020',
  annoyed:  '#8a7020',
  angry:    '#7a2818',
  furious:  '#7a2818',
  fond:     '#5a7048',
  amused:   '#5a7048',
  vengeful: '#7a2818',
}

function NarrativeStatusBar({ campaign, onExit }) {
  var c = campaign || {}
  var character = c.character || {}
  var hp = character.hp || 0
  var maxHp = character.maxHp || 1
  var hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  var hpColor = hpPct > 60 ? '#5a7830' : hpPct > 30 ? '#8a7020' : '#7a2818'
  var moodColor = MOOD_COLOURS[c.mood] || '#7a7468'

  return (
    <div style={{
      borderBottom: '1px solid #2e2818',
      background: '#110f09',
      padding: '10px 14px',
      paddingTop: 'max(10px, env(safe-area-inset-top))',
    }}>
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3" style={{ paddingRight: '80px' }}>
        {/* Character + HP + Mood */}
        <div className="flex flex-col">
          <span style={{ fontFamily: pixelFont, fontSize: '10px', color: '#c0a030', letterSpacing: '1px' }}>
            {character.name || 'Knight'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div style={{
              width: '90px', height: '6px', background: '#1a1510',
              borderRadius: '3px', overflow: 'hidden', border: '1px solid #2e2818',
            }}>
              <div style={{
                width: hpPct + '%', height: '100%', background: hpColor, transition: 'width 300ms ease',
              }} />
            </div>
            <span style={{ fontFamily: uiFont, fontSize: '10px', color: '#9a8a68' }}>
              {hp}/{maxHp}
            </span>
          </div>
          <span style={{ fontFamily: uiFont, fontSize: '9px', color: moodColor, marginTop: '3px', letterSpacing: '1px' }}>
            {c.mood || 'neutral'}
          </span>
        </div>

        {/* Act */}
        <div className="flex flex-col items-center">
          <span style={{ fontFamily: uiFont, fontSize: '8px', color: '#3a3428', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Act
          </span>
          <span style={{ fontFamily: displayFont, fontSize: '12px', color: '#c8ba90', fontStyle: 'italic' }}>
            {c.currentAct || 'The Grounds'}
          </span>
        </div>
      </div>

      {/* Inventory strip */}
      {((c.inventory && c.inventory.length) || (c.openThreads && c.openThreads.length)) && (
        <div className="max-w-2xl mx-auto" style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {c.inventory && c.inventory.length > 0 && (
            <span style={{ fontFamily: uiFont, fontSize: '10px', color: '#9a8a68' }}>
              <span style={{ color: '#6a5e48' }}>Carrying:</span> {c.inventory.map(function(item) { return typeof item === 'string' ? item : (item && item.name) || JSON.stringify(item) }).join(', ')}
            </span>
          )}
        </div>
      )}

      {onExit && (
        <button onClick={onExit}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            fontFamily: uiFont, fontSize: '10px', color: '#6a5e48',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
          ✕
        </button>
      )}
    </div>
  )
}

export default NarrativeStatusBar
