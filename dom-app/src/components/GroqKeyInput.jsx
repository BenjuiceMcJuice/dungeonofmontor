// Groq API key input — small inline component
import { useState } from 'react'
import { getGroqKey, setGroqKey, hasGroqKey } from '../lib/groq.js'

function GroqKeyInput() {
  var [showInput, setShowInput] = useState(false)
  var [key, setKey] = useState(getGroqKey())
  var [saved, setSaved] = useState(false)

  function handleSave() {
    setGroqKey(key)
    setSaved(true)
    setTimeout(function() { setSaved(false); setShowInput(false) }, 1500)
  }

  if (!showInput) {
    return (
      <button onClick={function() { setShowInput(true) }}
        className={'text-[10px] font-sans px-2 py-1 rounded border transition-colors ' +
          (hasGroqKey() ? 'text-purple-400 border-purple-400/30 hover:border-purple-400' : 'text-ink-faint border-border hover:text-ink')}>
        {hasGroqKey() ? 'AI: ON' : 'AI: OFF'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface border border-purple-400/30 w-full max-w-xs">
      <p className="text-purple-400 text-xs font-display">Montor AI (Groq)</p>
      <p className="text-ink-faint text-[10px] font-sans">Paste your Groq API key. Stored locally only — never sent to our servers.</p>
      <input
        type="password"
        value={key}
        onChange={function(e) { setKey(e.target.value) }}
        placeholder="gsk_..."
        className="bg-bg border border-border rounded px-2 py-1.5 text-xs text-ink font-sans w-full"
      />
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 text-xs text-purple-400 border border-purple-400/40 py-1 rounded hover:border-purple-400 transition-colors">
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button onClick={function() { setShowInput(false) }}
          className="flex-1 text-xs text-ink-dim border border-border py-1 rounded hover:text-ink transition-colors">
          Cancel
        </button>
      </div>
      {hasGroqKey() && (
        <button onClick={function() { setKey(''); setGroqKey(''); setSaved(false) }}
          className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
          Remove key
        </button>
      )}
    </div>
  )
}

export default GroqKeyInput
