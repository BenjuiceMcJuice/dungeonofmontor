import { useState } from 'react'

var pixelFont = "'Press Start 2P', monospace"
var displayFont = "'Sorts Mill Goudy', serif"
var uiFont = "system-ui, -apple-system, sans-serif"

var FLOOR_LABELS = {
  grounds: 'The Grounds',
  underground: 'The Underground',
  underbelly: 'The Underbelly',
  quarters: 'The Quarters',
  works: 'The Works',
  deep: 'The Deep',
  domain: "Montor's Domain",
}

function Tavern({ user, characters, onCreateCharacter, onSelectCharacter, onResumeRun, onDeleteCharacter, onSignOut, activeRuns }) {
  var [creating, setCreating] = useState(false)
  var [newName, setNewName] = useState('')
  var [confirmDelete, setConfirmDelete] = useState(null) // charId or null

  function handleCreate() {
    var trimmed = newName.trim() || 'Unnamed Knight'
    onCreateCharacter(trimmed, 'knight')
    setNewName('')
    setCreating(false)
  }

  function handleDelete(charId) {
    setConfirmDelete(null)
    onDeleteCharacter(charId)
  }

  var slots = characters || []
  var canCreate = slots.length < 3

  return (
    <div className="h-full overflow-auto flex flex-col items-center px-4 py-8" style={{ background: '#030408' }}>
      {/* Header */}
      <h1 style={{ fontFamily: pixelFont, fontSize: '18px', color: '#c06ee0', textShadow: '0 0 20px rgba(155,89,182,0.4)', letterSpacing: '2px' }} className="mb-1">
        THE TAVERN
      </h1>
      <p style={{ fontFamily: displayFont, fontSize: '13px', color: '#5a5040', fontStyle: 'italic' }} className="mb-6">
        {user.displayName || user.email}
      </p>

      {/* Character slots */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {slots.map(function(char) {
          var hasRun = activeRuns && activeRuns[char.id]
          var last = char.lastRunResult
          return (
            <div key={char.id} style={{
              background: '#0a0812', border: '2px solid #2a1a30', borderRadius: '8px',
              padding: '16px', position: 'relative',
            }}>
              {/* Name + archetype */}
              <div className="flex items-baseline justify-between mb-2">
                <span style={{ fontFamily: pixelFont, fontSize: '13px', color: '#d4a017' }}>
                  {char.name}
                </span>
                <span style={{ fontFamily: uiFont, fontSize: '10px', color: '#5a5040', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {char.archetype}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex gap-4 mb-2" style={{ fontFamily: uiFont, fontSize: '11px', color: '#8b7b60' }}>
                <span>{char.runCount || 0} run{char.runCount !== 1 ? 's' : ''}</span>
                <span>{char.victoryCount || 0} win{char.victoryCount !== 1 ? 's' : ''}</span>
                <span>{char.deathCount || 0} death{char.deathCount !== 1 ? 's' : ''}</span>
              </div>

              {/* Best floor + gifts */}
              <div className="flex gap-4 mb-3" style={{ fontFamily: uiFont, fontSize: '11px', color: '#6a5a40' }}>
                {char.bestFloor && (
                  <span>Best: {FLOOR_LABELS[char.bestFloor] || char.bestFloor}</span>
                )}
                <span>{(char.bankedGifts || []).length}/6 gifts</span>
              </div>

              {/* Last run result */}
              {last && (
                <p style={{ fontFamily: displayFont, fontSize: '12px', color: last.outcome === 'victory' ? '#4a9' : '#a55', fontStyle: 'italic' }} className="mb-3">
                  {last.outcome === 'victory'
                    ? 'Cleared ' + (FLOOR_LABELS[last.floorReached] || last.floorReached)
                    : last.killedBy
                      ? 'Killed by ' + last.killedBy + ' on ' + (FLOOR_LABELS[last.floorReached] || last.floorReached)
                      : 'Fell on ' + (FLOOR_LABELS[last.floorReached] || last.floorReached)
                  }
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {hasRun ? (
                  <button onClick={function() { onResumeRun(char.id, activeRuns[char.id]) }}
                    style={{
                      fontFamily: uiFont, fontSize: '13px', background: '#0e0818', border: '2px solid #7a3a9a',
                      color: '#c06ee0', padding: '10px 20px', cursor: 'pointer', letterSpacing: '1px',
                      borderRadius: '6px', fontWeight: 600, flex: 1,
                    }}>
                    Continue Run
                  </button>
                ) : (
                  <button onClick={function() { onSelectCharacter(char.id) }}
                    style={{
                      fontFamily: uiFont, fontSize: '13px', background: '#0e0818', border: '2px solid #7a3a9a',
                      color: '#c06ee0', padding: '10px 20px', cursor: 'pointer', letterSpacing: '1px',
                      borderRadius: '6px', fontWeight: 600, flex: 1,
                    }}>
                    New Run
                  </button>
                )}
              </div>

              {/* Delete button */}
              {confirmDelete === char.id ? (
                <div className="mt-2 flex gap-2 items-center" style={{ fontFamily: uiFont, fontSize: '11px' }}>
                  <span style={{ color: '#a55' }}>Delete forever?</span>
                  <button onClick={function() { handleDelete(char.id) }}
                    style={{ color: '#d44', background: 'none', border: '1px solid #a33', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                    Yes
                  </button>
                  <button onClick={function() { setConfirmDelete(null) }}
                    style={{ color: '#666', background: 'none', border: '1px solid #444', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                    No
                  </button>
                </div>
              ) : (
                <button onClick={function() { setConfirmDelete(char.id) }}
                  style={{ fontFamily: uiFont, fontSize: '10px', color: '#443830', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px', padding: 0 }}>
                  Delete character
                </button>
              )}
            </div>
          )
        })}

        {/* Empty slot / create */}
        {canCreate && !creating && (
          <button onClick={function() { setCreating(true) }}
            style={{
              background: '#060410', border: '2px dashed #2a1a30', borderRadius: '8px',
              padding: '24px', cursor: 'pointer', color: '#5a4a60',
              fontFamily: uiFont, fontSize: '13px', letterSpacing: '1px',
            }}>
            + Create Character
          </button>
        )}

        {creating && (
          <div style={{
            background: '#0a0812', border: '2px solid #2a1a30', borderRadius: '8px',
            padding: '16px',
          }}>
            <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#8b5e3c', fontStyle: 'italic', marginBottom: '12px' }}>
              What is your name, knight?
            </p>
            <input type="text" placeholder="..." enterKeyHint="go" autoComplete="off" autoFocus
              value={newName} onChange={function(e) { setNewName(e.target.value) }}
              onKeyDown={function(e) { if (e.key === 'Enter') handleCreate() }}
              style={{
                fontFamily: uiFont, fontSize: '16px', background: '#060410', border: '2px solid #2a1a30',
                color: '#d4c8a0', padding: '12px 14px', outline: 'none', letterSpacing: '1px',
                borderBottom: '2px solid #7a3a9a', borderRadius: '4px', width: '100%', boxSizing: 'border-box',
                marginBottom: '12px',
              }}
            />
            <div className="flex gap-2">
              <button onClick={handleCreate}
                style={{
                  fontFamily: uiFont, fontSize: '13px', background: '#0e0818', border: '2px solid #7a3a9a',
                  color: '#c06ee0', padding: '10px 20px', cursor: 'pointer', letterSpacing: '1px',
                  borderRadius: '6px', fontWeight: 600, flex: 1,
                }}>
                Create
              </button>
              <button onClick={function() { setCreating(false); setNewName('') }}
                style={{
                  fontFamily: uiFont, fontSize: '13px', background: 'none', border: '2px solid #2a1a30',
                  color: '#5a4a60', padding: '10px 20px', cursor: 'pointer', borderRadius: '6px',
                }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button onClick={onSignOut}
          style={{ fontFamily: uiFont, fontSize: '11px', color: '#443830', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export default Tavern
