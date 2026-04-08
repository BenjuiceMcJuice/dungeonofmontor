var FLOOR_LABELS = {
  grounds: 'The Grounds',
  underground: 'The Underground',
  underbelly: 'The Underbelly',
  quarters: 'The Quarters',
  works: 'The Works',
  deep: 'The Deep',
  domain: "Montor's Domain",
}

var GIFT_NAMES = {
  petal: 'Petal of Gerald',
  stone: "Grandmother's Gravy Boat",
  bile: 'Toilet Lid',
  blood: 'Music Box',
  ember: 'Calibrated Tongs',
  void: 'Night Light',
}

function Results({ character, result, onReturnToTavern }) {
  var gifts = result.collectedTreasures || []

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
            <span className="text-ink">{result.chambersCleared || 0}</span>
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
          {result.floorReached && (
            <div className="flex justify-between">
              <span>Deepest Floor</span>
              <span className="text-ink">{FLOOR_LABELS[result.floorReached] || result.floorReached}</span>
            </div>
          )}
          {result.enemiesDefeated > 0 && (
            <div className="flex justify-between">
              <span>Enemies Defeated</span>
              <span className="text-ink">{result.enemiesDefeated}</span>
            </div>
          )}
        </div>
      </div>

      {/* Banked gifts */}
      {gifts.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
          <p className="text-ink-dim text-xs uppercase tracking-wider mb-2">Gifts Banked</p>
          {gifts.map(function(giftId) {
            return (
              <p key={giftId} className="text-sm" style={{ color: '#c06ee0' }}>
                {GIFT_NAMES[giftId] || giftId}
              </p>
            )
          })}
        </div>
      )}

      <p className="text-ink-faint text-xs italic max-w-sm">
        Your gifts have been banked. Stats, items, and gold reset for the next run.
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
