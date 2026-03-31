// ChamberView — renders the interaction UI for non-combat chambers
// Combat chambers are handled by the existing Game combat system

function ChamberView({ chamber, content, playerState, onAction, onContinue }) {
  if (!content) return null

  // --- Rest chamber ---
  if (chamber.type === 'rest') {
    var healed = content.healed
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        {!healed ? (
          <button onClick={function() { onAction('rest') }}
            className="py-3 px-8 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 font-sans text-base">
            Rest here (+{Math.round(content.hpRecovery * 100)}% HP)
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-green-400 text-base">You rest and recover <span className="font-semibold">{healed}</span> HP.</p>
            <button onClick={onContinue}
              className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
              Continue
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Merchant chamber ---
  if (chamber.type === 'merchant') {
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {content.items && content.items.map(function(item, i) {
            var canAfford = (playerState.gold || 0) >= item.cost
            return (
              <button key={i}
                onClick={function() { if (canAfford) onAction('buy', item) }}
                disabled={!canAfford}
                className={
                  'flex items-center justify-between p-3 rounded-lg border text-sm font-sans ' +
                  (canAfford
                    ? 'bg-surface border-border-hl text-ink hover:border-gold cursor-pointer'
                    : 'bg-surface border-border text-ink-faint opacity-50')
                }
              >
                <span>{item.name}</span>
                <span className="text-gold">{item.cost}g</span>
              </button>
            )
          })}
        </div>
        <p className="text-ink-dim text-xs font-sans">Your gold: {playerState.gold || 0}</p>
        <button onClick={onContinue}
          className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
          Leave
        </button>
      </div>
    )
  }

  // --- Loot chamber ---
  if (chamber.type === 'loot' || chamber.type === 'hidden') {
    var claimed = content.claimed
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        {!claimed ? (
          <button onClick={function() { onAction('claim_loot') }}
            className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-base">
            Open
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-gold text-lg font-display">+{content.gold} gold</p>
            <button onClick={onContinue}
              className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
              Continue
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Trap chamber ---
  if (chamber.type === 'trap') {
    var triggered = content.triggered
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        {!triggered ? (
          <button onClick={function() { onAction('trigger_trap') }}
            className="py-3 px-8 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-sans text-base">
            Proceed carefully...
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-red-400 text-base">A trap springs! You take <span className="font-semibold">{content.damage}</span> damage.</p>
            <button onClick={onContinue}
              className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
              Continue
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Quest NPC ---
  if (chamber.type === 'quest_npc') {
    var helped = content.helped
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        {!helped ? (
          <button onClick={function() { onAction('help_npc') }}
            className="py-3 px-8 rounded-lg bg-blue/20 border border-blue/40 text-blue font-sans text-base">
            Help them
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-blue text-base">"{content.npcName}" thanks you.</p>
            {content.reward && content.reward.gold && (
              <p className="text-gold text-sm">+{content.reward.gold} gold</p>
            )}
            <button onClick={onContinue}
              className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
              Continue
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Event chamber ---
  if (chamber.type === 'event') {
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        <button onClick={onContinue}
          className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
          Continue
        </button>
      </div>
    )
  }

  // --- Stairwell Entry ---
  if (chamber.type === 'stairwell_entry') {
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        <button onClick={onContinue}
          className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
          Continue
        </button>
      </div>
    )
  }

  // --- Stairwell Descent (exit / win) ---
  if (chamber.type === 'stairwell_descent') {
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        <button onClick={function() { onAction('descend') }}
          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-lg">
          Descend
        </button>
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex flex-col items-center gap-4 p-4 text-center">
      <p className="text-ink text-base italic">{content.description || 'An empty chamber.'}</p>
      <button onClick={onContinue}
        className="py-2 px-6 rounded-lg bg-surface border border-border text-ink font-sans text-sm">
        Continue
      </button>
    </div>
  )
}

export default ChamberView
