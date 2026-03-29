import { useState } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Check } from '../lib/dice.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import DiceRoller from '../components/DiceRoller.jsx'

var ENEMY_TYPES = ['rat', 'orc', 'rock', 'slug', 'wraith']
var TIER_KEYS = ['dust', 'slate', 'iron', 'crimson', 'void']

function Game({ character, onEndRun }) {
  var [enemyType] = useState(function() {
    return ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]
  })
  var [enemyTier] = useState(function() {
    // Stage 1: Dust and Slate only
    return Math.random() < 0.6 ? 'dust' : 'slate'
  })

  var strMod = getModifier(character.stats.str)
  var enemyDefTn = enemyTier === 'dust' ? 12 : 14

  function handleAttackRoll() {
    return d20Check(strMod, enemyDefTn)
  }

  return (
    <div className="min-h-svh flex flex-col px-4 pt-6 pb-6">
      {/* Scene header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-ink-faint text-xs uppercase tracking-widest">
          Combat · Round 1
        </span>
        <span className="text-ink-faint text-xs">
          {character.name} — Knight L{character.level}
        </span>
      </div>

      {/* Character summary bar */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="font-display text-lg text-gold">{character.name}</span>
          <span className="text-ink-dim text-sm">
            HP {character.maxHp}/{character.maxHp}
          </span>
        </div>
        <div className="w-full bg-raised rounded-full h-2 mb-3">
          <div className="bg-gold rounded-full h-2 w-full" />
        </div>
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

      {/* Enemy */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <SpriteRenderer spriteKey={enemyType} tierKey={enemyTier} scale={5} />
        <div className="text-center">
          <p className="font-display text-lg text-ink capitalize">{enemyType}</p>
          <p className="text-ink-faint text-xs uppercase tracking-wider">{enemyTier} tier</p>
        </div>
      </div>

      {/* Narration */}
      <p className="text-ink-dim italic text-center mb-6 max-w-sm mx-auto">
        A {enemyTier}-tier {enemyType} blocks the passage ahead. It watches you with flat, ancient eyes.
      </p>

      {/* Dice roller */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <DiceRoller
          onRoll={handleAttackRoll}
          modifier={strMod}
          tn={enemyDefTn}
          label={'Attack → ' + enemyType + ' · d20 +' + strMod + ' vs TN ' + enemyDefTn}
        />
      </div>

      {/* Temp: end run button */}
      <button
        onClick={function() { onEndRun({ victory: true, encounters: 1, xp: 25 }) }}
        className="mt-6 py-3 px-4 rounded-lg bg-raised border border-border text-ink-dim font-sans text-sm hover:border-border-hl transition-colors"
      >
        Leave Dungeon (temp)
      </button>
    </div>
  )
}

export default Game
