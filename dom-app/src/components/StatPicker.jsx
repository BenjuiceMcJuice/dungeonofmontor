// StatPicker — reusable stat selection with info panel
// Used by: level-up screen, starting screen stat allocation

import { useState } from 'react'

var STAT_INFO = {
  str: {
    name: 'Strength', abbrev: 'STR', group: 'Combat',
    summary: 'Attack and damage rolls.',
    detail: 'Every +1 modifier adds to your attack roll (d20) and damage. Core stat for swords and maces. Higher STR = bigger hits.',
    tip: 'Best for: Sword and mace builds.',
  },
  def: {
    name: 'Defence', abbrev: 'DEF', group: 'Combat',
    summary: 'Damage reduction and shield block.',
    detail: 'Incoming damage is reduced by floor(DEF/3). Also improves shield block chance (+2.5% per modifier). Higher DEF = take less damage.',
    tip: 'Best for: Shield builds, tanking.',
  },
  agi: {
    name: 'Agility', abbrev: 'AGI', group: 'Combat',
    summary: 'Initiative, dodge, and double strike.',
    detail: 'Higher AGI = go first, +2% dodge chance per modifier (all builds), +5% dagger double strike per modifier. Armour agiPenalty reduces this.',
    tip: 'Best for: Dagger builds, evasion builds.',
  },
  int: {
    name: 'Intellect', abbrev: 'INT', group: 'Mental',
    summary: 'Condition chance + enchanted weapon damage.',
    detail: 'Enchanted weapons get +1 damage per INT modifier AND +5% condition application chance per modifier. Smart fighters hit harder with special weapons.',
    tip: "Best for: Montor's enchanted weapon builds.",
  },
  lck: {
    name: 'Luck', abbrev: 'LCK', group: 'Fortune',
    summary: 'Crit chance and loot rarity.',
    detail: 'Each +1 modifier lowers your crit threshold by 1 (base 20). Also added to loot rarity rolls. Higher LCK = more crits + better drops.',
    tip: 'Best for: High-variance builds, treasure hunters.',
  },
  per: {
    name: 'Perception', abbrev: 'PER', group: 'Mental',
    summary: 'Searching and spotting.',
    detail: 'Improves results when searching junk piles (d20 + PER modifier). Higher PER = better finds, spot hidden items and traps.',
    tip: 'Best for: Explorers, junk pile builds.',
  },
  end: {
    name: 'Endurance', abbrev: 'END', group: 'Body',
    summary: 'HP regen per room.',
    detail: 'Heal extra HP each time you enter a new room. Base 1 HP + END modifier per room. END 14 = 3 HP/room. Stacks with regen relics and gifts.',
    tip: 'Best for: Tanky builds, potion-free runs.',
  },
  wis: {
    name: 'Wisdom', abbrev: 'WIS', group: 'Mental',
    summary: "Montor's Gift power.",
    detail: "When activating Montor's Gifts at safe rooms, WIS determines how powerful the boon is. Higher WIS = stronger permanent abilities.",
    tip: 'Best for: Gift hunters, long runs.',
  },
  vit: {
    name: 'Vitality', abbrev: 'VIT', group: 'Body',
    summary: 'Max HP.',
    detail: 'Max HP = 25 + (VIT × 5). Each +1 VIT gives +5 max HP. Survive longer, take more risks.',
    tip: 'Best for: Survival builds, tanking without DEF.',
  },
  cha: {
    name: 'Charisma', abbrev: 'CHA', group: 'Fortune',
    summary: 'Prices + premium access.',
    detail: 'Buy -5% and sell +5% per CHA modifier at all vendors. CHA 12+ unlocks premium items at the Tailor — rare gear only discerning characters can buy.',
    tip: 'Best for: Economy builds, premium gear access.',
  },
}

function StatPicker({ stats, onPick, onCancel, mode, freePoints }) {
  var [selectedStat, setSelectedStat] = useState(null)
  var isLevelUp = mode === 'levelup'
  var isAllocate = mode === 'allocate'

  var statOrder = ['str', 'def', 'agi', 'vit', 'int', 'lck', 'per', 'end', 'wis', 'cha']

  // Info panel — shown when a stat is tapped
  if (selectedStat) {
    var info = STAT_INFO[selectedStat]
    var currentVal = stats[selectedStat] || 0
    return (
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <div className="bg-surface border-2 border-gold rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-gold font-display text-lg">{info.abbrev}</span>
              <span className="text-ink-dim text-sm ml-2">{info.name}</span>
            </div>
            <span className="text-ink-faint text-xs">{info.group}</span>
          </div>
          <p className="text-ink text-sm mb-2">{info.detail}</p>
          <p className="text-ink-faint text-xs italic mb-3">{info.tip}</p>
          <div className="flex items-center justify-between bg-raised rounded p-2 mb-3">
            <span className="text-ink-dim text-sm">Value</span>
            <span className="text-ink">{currentVal} <span className="text-gold">→ {currentVal + 1}</span></span>
          </div>
          <div className="flex gap-2">
            <button onClick={function() { onPick(selectedStat); setSelectedStat(null) }}
              className="flex-1 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm hover:border-gold transition-colors">
              Confirm +1 {info.abbrev}
            </button>
            <button onClick={function() { setSelectedStat(null) }}
              className="flex-1 py-2 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm hover:text-ink transition-colors">
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Stat list
  return (
    <div className="flex flex-col gap-1.5 w-full max-w-sm">
      {isAllocate && freePoints !== undefined && (
        <p className="text-gold text-sm font-sans text-center mb-1">Points remaining: <span className="font-display text-lg">{freePoints}</span></p>
      )}
      {isLevelUp && (
        <p className="text-ink text-sm mb-1">Tap a stat to see what it does:</p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {statOrder.map(function(id) {
          var info = STAT_INFO[id]
          var val = stats[id] || 0
          var disabled = isAllocate && freePoints !== undefined && freePoints <= 0
          return (
            <button key={id}
              onClick={disabled ? undefined : function() { setSelectedStat(id) }}
              className={'flex items-center justify-between p-2 rounded border text-sm font-sans transition-colors ' +
                (disabled ? 'border-border bg-raised text-ink-faint opacity-50' : 'border-border-hl bg-raised hover:border-gold cursor-pointer')}
            >
              <div className="flex flex-col items-start">
                <span className="text-ink uppercase font-semibold text-xs">{info.abbrev}</span>
                <span className="text-ink-faint text-[9px] leading-tight">{info.summary}</span>
              </div>
              <span className="text-ink font-display text-base">{val}</span>
            </button>
          )
        })}
      </div>
      {isAllocate && onCancel && freePoints <= 0 && (
        <button onClick={onCancel}
          className="mt-2 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm hover:border-gold transition-colors">
          Continue
        </button>
      )}
    </div>
  )
}

export { StatPicker, STAT_INFO }
export default StatPicker
