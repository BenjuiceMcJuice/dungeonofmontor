// Montor personality picker — select or randomise
import { useState } from 'react'

var PERSONALITIES = [
  { id: 'random', label: 'Random' },
  { id: 'melancholy', label: 'Melancholy' },
  { id: 'paranoid', label: 'Paranoid' },
  { id: 'comedic', label: 'Comedic' },
  { id: 'proud', label: 'Proud' },
  { id: 'lonely', label: 'Lonely' },
  { id: 'vengeful', label: 'Vengeful' },
  { id: 'passive_aggressive', label: 'Passive Aggressive' },
  { id: 'mum_mode', label: 'Mum Mode' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'philosophical', label: 'Philosophical' },
  { id: 'petty', label: 'Petty' },
  { id: 'chef', label: 'Chef' },
  { id: 'estate_agent', label: 'Estate Agent' },
  { id: 'bureaucratic', label: 'Bureaucratic' },
]

var LS_KEY = 'dom_montor_personality'

function getSelectedPersonality() {
  try { return localStorage.getItem(LS_KEY) || 'random' } catch (e) { return 'random' }
}

function setSelectedPersonality(id) {
  try { localStorage.setItem(LS_KEY, id) } catch (e) { /* ignore */ }
}

function PersonalityPicker() {
  var [showPicker, setShowPicker] = useState(false)
  var [selected, setSelected] = useState(getSelectedPersonality())

  if (!showPicker) {
    var label = PERSONALITIES.find(function(p) { return p.id === selected })
    return (
      <button onClick={function() { setShowPicker(true) }}
        className="text-[10px] font-sans px-2 py-1 rounded border border-purple-400/30 text-purple-400 hover:border-purple-400 transition-colors">
        Mood: {label ? label.label : 'Random'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-surface border border-purple-400/30 w-full max-w-xs max-h-48 overflow-y-auto">
      {PERSONALITIES.map(function(p) {
        var isActive = p.id === selected
        return (
          <button key={p.id} onClick={function() {
            setSelected(p.id)
            setSelectedPersonality(p.id)
            setShowPicker(false)
          }}
            className={'text-[10px] font-sans px-2 py-1 rounded text-left transition-colors ' +
              (isActive ? 'bg-purple-400/20 text-purple-400' : 'text-ink-dim hover:text-ink')}>
            {p.label}{p.id === 'random' ? ' (default)' : ''}
          </button>
        )
      })}
    </div>
  )
}

export { PERSONALITIES, getSelectedPersonality }
export default PersonalityPicker
