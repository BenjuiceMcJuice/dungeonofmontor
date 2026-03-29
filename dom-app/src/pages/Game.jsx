import { getModifier } from '../lib/classes.js'

function Game({ character, onEndRun }) {
  var hpMod = getModifier(character.stats.str)

  return (
    <div className="min-h-svh flex flex-col px-4 pt-6 pb-6">
      {/* Scene header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-ink-faint text-xs uppercase tracking-widest">
          The Dungeon
        </span>
        <span className="text-ink-faint text-xs">
          {character.name} — Knight L{character.level}
        </span>
      </div>

      {/* Character summary bar */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="font-display text-lg text-gold">{character.name}</span>
          <span className="text-ink-dim text-sm">
            HP {character.maxHp}/{character.maxHp}
          </span>
        </div>
        <div className="w-full bg-raised rounded-full h-2 mb-3">
          <div className="bg-gold rounded-full h-2 w-full" />
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {['str', 'def', 'agi', 'vit'].map(function(s) {
            var val = character.stats[s]
            var mod = getModifier(val)
            return (
              <div key={s} className="bg-raised rounded px-2 py-1">
                <div className="text-ink-faint text-[10px] uppercase">{s}</div>
                <div className="text-ink text-sm font-sans">{val}</div>
                <div className={'text-[10px] ' + (mod >= 0 ? 'text-gold' : 'text-crimson')}>
                  {mod >= 0 ? '+' : ''}{mod}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Placeholder — combat comes in Sprint 3 */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <p className="text-ink-dim italic max-w-sm">
          The stairway descends into darkness. The air is cold and stale. Something shifts in the deep.
        </p>
        <p className="text-ink-faint text-xs">
          Combat engine coming in Sprint 3
        </p>
      </div>

      {/* Temp: end run button */}
      <button
        onClick={function() { onEndRun({ victory: true, encounters: 0, xp: 0 }) }}
        className="mt-4 py-3 px-4 rounded-lg bg-raised border border-border text-ink-dim font-sans text-sm hover:border-border-hl transition-colors"
      >
        Leave Dungeon (temp)
      </button>
    </div>
  )
}

export default Game
