// Resume Run prompt — shown when a saved run is found on load

function ResumeRunPrompt({ savedRun, onResume, onAbandon }) {
  var c = savedRun.character
  var floorName = savedRun.floorId || 'unknown'
  var floorLabels = {
    grounds: 'The Grounds',
    underground: 'The Underground',
    underbelly: 'The Underbelly',
    quarters: 'The Quarters',
    works: 'The Works',
    deep: 'The Deep',
    domain: 'The Domain',
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
      <p className="font-display text-3xl text-gold">Welcome Back</p>
      <p className="text-ink text-lg font-display">{c.name}</p>
      <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs space-y-1">
        <p className="text-ink text-sm font-sans">Floor: <span className="text-gold">{floorLabels[floorName] || floorName}</span></p>
        <p className="text-ink text-sm font-sans">HP: <span className="text-green-400">{savedRun.playerHp}</span>/{c.maxHp}</p>
        <p className="text-ink text-sm font-sans">Gold: <span className="text-amber-400">{savedRun.playerGold}</span></p>
        <p className="text-ink text-sm font-sans">Level: <span className="text-gold">{savedRun.runLevel}</span></p>
        <p className="text-ink text-sm font-sans">Chambers: <span className="text-ink-dim">{savedRun.chambersCleared}</span></p>
      </div>
      <div className="flex gap-4">
        <button onClick={onResume}
          className="py-2 px-6 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm hover:bg-gold/30 transition-colors">
          Resume Run
        </button>
        <button onClick={onAbandon}
          className="py-2 px-6 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm hover:text-ink hover:border-ink-faint transition-colors">
          Start Fresh
        </button>
      </div>
    </div>
  )
}

export default ResumeRunPrompt
