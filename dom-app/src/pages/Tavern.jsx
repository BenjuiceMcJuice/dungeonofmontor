import { useState } from 'react'

function Tavern({ user, onSignOut, onStartRun }) {
  var [name, setName] = useState('')

  function handleStart() {
    var charName = name.trim() || 'Unnamed Knight'
    onStartRun(charName)
  }

  return (
    <div className="h-full overflow-auto flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl text-gold mb-2">The Tavern</h1>
      <p className="text-ink-dim text-sm mb-8">
        Signed in as {user.displayName || user.email}
      </p>

      <div className="w-full max-w-xs flex flex-col gap-5">
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl text-gold">New Run</h2>
          <p className="text-ink-faint text-xs">
            Stage 1 — Knight class. Stats auto-assigned. No persistence between runs.
          </p>

          <input
            type="text"
            placeholder="Name your Knight"
            value={name}
            onChange={function(e) { setName(e.target.value) }}
            className="w-full py-3 px-4 rounded-lg bg-raised border border-border text-ink font-sans text-sm placeholder:text-ink-faint focus:border-border-hl focus:outline-none"
          />

          <button
            onClick={handleStart}
            className="w-full py-3 px-4 rounded-lg bg-gold text-bg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Enter the Dungeon
          </button>
        </div>

        <button
          onClick={onSignOut}
          className="text-ink-faint text-xs hover:text-ink-dim transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default Tavern
