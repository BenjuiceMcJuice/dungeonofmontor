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
    var showSell = content.showSell
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <p className="text-ink text-base italic">{content.description}</p>
        <p className="text-gold text-xs font-sans">Your gold: {playerState.gold || 0}</p>

        {/* Tab toggle: Buy / Sell */}
        <div className="flex gap-2">
          <button onClick={function() { onAction('merchant_tab', 'buy') }}
            className={'px-4 py-1 rounded text-xs font-sans border transition-colors ' +
              (!showSell ? 'border-gold text-gold' : 'border-border text-ink-dim hover:text-ink')}>
            Buy
          </button>
          {playerState.inventory && playerState.inventory.length > 0 && (
            <button onClick={function() { onAction('merchant_tab', 'sell') }}
              className={'px-4 py-1 rounded text-xs font-sans border transition-colors ' +
                (showSell ? 'border-gold text-gold' : 'border-border text-ink-dim hover:text-ink')}>
              Sell
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 w-full max-w-xs max-h-48 overflow-y-auto">
          {!showSell && content.items && content.items.map(function(item, i) {
            var price = item.buyPrice || item.cost || 0
            var canAfford = (playerState.gold || 0) >= price
            return (
              <div key={'buy-' + i}
                className="flex items-center justify-between p-3 rounded-lg border border-border-hl bg-surface text-sm font-sans"
              >
                <div className="flex flex-col items-start">
                  <span className="text-ink">{item.name}</span>
                  <span className="text-ink-faint text-[10px]">
                    {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                     item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                     item.description || item.type}
                  </span>
                </div>
                <button
                  onClick={function() { if (canAfford) onAction('buy', item) }}
                  disabled={!canAfford}
                  className={
                    'text-xs px-3 py-1 rounded border transition-colors ' +
                    (canAfford
                      ? 'text-gold border-gold/40 hover:border-gold cursor-pointer'
                      : 'text-ink-faint border-border opacity-50')
                  }
                >
                  {price}g
                </button>
              </div>
            )
          })}
          {showSell && playerState.inventory && playerState.inventory.map(function(item, i) {
            var sellPrice = item.sellPrice || Math.max(1, Math.round((item.buyPrice || 10) * 0.4))
            return (
              <div key={'sell-' + i}
                className="flex items-center justify-between p-3 rounded-lg border border-border-hl bg-surface text-sm font-sans"
              >
                <div className="flex flex-col items-start">
                  <span className="text-ink">{item.name}</span>
                  <span className="text-ink-faint text-[10px]">
                    {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                     item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                     item.description || item.type}
                  </span>
                </div>
                <button
                  onClick={function() { onAction('sell', { itemIndex: i, sellPrice: sellPrice }) }}
                  className="text-xs text-gold px-3 py-1 rounded border border-gold/40 hover:border-gold cursor-pointer transition-colors"
                >
                  Sell {sellPrice}g
                </button>
              </div>
            )
          })}
          {showSell && (!playerState.inventory || playerState.inventory.length === 0) && (
            <p className="text-ink-faint text-xs italic">Nothing to sell.</p>
          )}
        </div>

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
            {content.item && (
              <p className="text-emerald-400 text-sm font-sans">Found: <span className="font-semibold">{content.item.name}</span></p>
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
