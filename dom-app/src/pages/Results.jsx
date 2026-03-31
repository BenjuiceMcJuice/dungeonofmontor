function Results({ character, result, onReturnToTavern }) {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6">
      <h1 className="font-display text-4xl text-gold">
        {result.victory ? 'Victory' : 'Defeat'}
      </h1>

      <div className="bg-surface border border-border rounded-lg p-5 w-full max-w-xs">
        <h2 className="font-display text-xl text-gold mb-3">{character.name}</h2>
        <p className="text-ink-dim text-sm mb-1">Knight — Level {character.level}</p>

        <div className="flex flex-col gap-2 mt-4 text-sm text-ink-dim">
          <div className="flex justify-between">
            <span>Chambers Cleared</span>
            <span className="text-ink">{result.chambersCleared || result.encounters || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>XP Earned</span>
            <span className="text-ink">{result.xp}</span>
          </div>
          {result.gold > 0 && (
            <div className="flex justify-between">
              <span>Gold</span>
              <span className="text-gold">{result.gold}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-ink-faint text-xs italic max-w-sm">
        Stage 1 — characters are not persisted between runs.
      </p>

      <button
        onClick={onReturnToTavern}
        className="py-3 px-6 rounded-lg bg-gold text-bg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Return to Tavern
      </button>
    </div>
  )
}

export default Results
