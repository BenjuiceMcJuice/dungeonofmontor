// Preparation — pre-run screen: allocate stats + buy starter gear
import { useState } from 'react'
import StatPicker from '../components/StatPicker.jsx'
import classData from '../data/classes.json'
import ITEMS from '../data/items.json'

var startConfig = classData.startingKnight

function Preparation({ character, onReady }) {
  var [phase, setPhase] = useState('stats') // stats | shop | ready
  var [freePoints, setFreePoints] = useState(startConfig.freeStatPoints || 10)
  var [gold, setGold] = useState(character.gold)
  var [inventory, setInventory] = useState(character.inventory.slice())
  var [equipped, setEquipped] = useState(Object.assign({}, character.equipped))
  var [shopItems, setShopItems] = useState(function() {
    return (startConfig.starterShopItems || []).map(function(id) {
      return ITEMS[id] ? Object.assign({}, ITEMS[id]) : null
    }).filter(Boolean)
  })

  function handleStatPick(statId) {
    if (freePoints <= 0) return
    character.stats[statId] = (character.stats[statId] || 0) + 1
    setFreePoints(freePoints - 1)
  }

  function handleBuy(shopIndex) {
    var item = shopItems[shopIndex]
    if (!item) return
    var price = item.buyPrice || 0
    if (gold < price) return
    setGold(gold - price)
    setInventory(function(prev) { return prev.concat([Object.assign({}, item)]) })
    // Remove from shop (one-time purchase per slot)
    setShopItems(function(prev) {
      var next = prev.slice()
      next.splice(shopIndex, 1)
      return next
    })
  }

  function handleEquip(invIndex) {
    var item = inventory[invIndex]
    if (!item) return
    var newEquipped = Object.assign({}, equipped)
    var returnItem = null

    if (item.type === 'weapon' && item.slot === 'weapon') {
      returnItem = newEquipped.weapon
      newEquipped.weapon = item
    } else if (item.type === 'armour' && item.slot === 'offhand') {
      returnItem = newEquipped.offhand
      newEquipped.offhand = item
    } else if (item.type === 'armour' && item.slot === 'armour') {
      returnItem = newEquipped.armour
      newEquipped.armour = item
    } else {
      return
    }

    setEquipped(newEquipped)
    setInventory(function(prev) {
      var next = prev.slice()
      next.splice(invIndex, 1)
      if (returnItem) next.push(returnItem)
      return next
    })
  }

  function handleReady() {
    // Apply final state to character
    character.equipped = equipped
    character.inventory = inventory
    character.gold = gold
    onReady(character)
  }

  // --- Stats phase ---
  if (phase === 'stats') {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 bg-raised">
        <h2 className="font-display text-2xl text-gold mb-2">Prepare Your Knight</h2>
        <p className="text-ink-dim text-sm mb-4 text-center max-w-xs">
          Distribute {startConfig.freeStatPoints} points across your stats. Tap a stat to see what it does.
        </p>
        <StatPicker
          stats={character.stats}
          onPick={handleStatPick}
          onCancel={function() { setPhase('shop') }}
          mode="allocate"
          freePoints={freePoints}
        />
        {freePoints > 0 && (
          <button onClick={function() { setPhase('shop') }}
            className="mt-3 text-ink-faint text-xs hover:text-ink transition-colors">
            Skip — keep remaining points
          </button>
        )}
      </div>
    )
  }

  // --- Shop phase ---
  if (phase === 'shop') {
    var equippedWeaponName = equipped.weapon ? equipped.weapon.name : 'None'
    var equippedArmourName = equipped.armour ? equipped.armour.name : 'None'
    var equippedOffhandName = equipped.offhand ? equipped.offhand.name : 'None'

    return (
      <div className="h-full flex flex-col px-4 py-4 bg-raised overflow-y-auto">
        <h2 className="font-display text-2xl text-gold mb-1 text-center">Starter Kit</h2>
        <p className="text-ink-dim text-sm mb-3 text-center">
          Spend your gold wisely. This is all you start with.
        </p>
        <p className="text-gold text-sm font-sans text-center mb-3">
          Gold: <span className="font-display text-lg">{gold}</span>
        </p>

        {/* Currently equipped */}
        <div className="bg-surface border border-border rounded-lg p-3 mb-3">
          <p className="text-[10px] text-gold uppercase tracking-wide mb-1">Equipped</p>
          <div className="flex gap-4 text-xs text-ink-dim font-sans">
            <span>Weapon: <span className="text-ink">{equippedWeaponName}</span></span>
            <span>Armour: <span className="text-ink">{equippedArmourName}</span></span>
          </div>
          {equippedOffhandName !== 'None' && (
            <div className="text-xs text-ink-dim font-sans mt-1">
              <span>Offhand: <span className="text-ink">{equippedOffhandName}</span></span>
            </div>
          )}
        </div>

        {/* Shop items */}
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-ink-dim text-xs uppercase tracking-wide">Buy</p>
          {shopItems.map(function(item, i) {
            var price = item.buyPrice || 0
            var canAfford = gold >= price
            return (
              <div key={'shop-' + i} className="flex items-center justify-between p-2 rounded border border-border-hl bg-surface text-sm font-sans">
                <div className="flex flex-col items-start">
                  <span className="text-ink">{item.name}</span>
                  <span className="text-ink-faint text-[10px]">
                    {item.type === 'weapon' ? item.weaponType + ', d' + item.damageDie + (item.defIgnore ? ', ignores ' + Math.round(item.defIgnore * 100) + '% DEF' : '') + (item.doubleStrikeBase ? ', ' + Math.round(item.doubleStrikeBase * 100) + '% double strike' : '') :
                     item.type === 'armour' && item.slot === 'offhand' ? '+' + item.defBonus + ' DEF, ' + Math.round((item.passiveValue || 0) * 100) + '% block' :
                     item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                     item.description || item.type}
                  </span>
                </div>
                <button onClick={function() { if (canAfford) handleBuy(i) }}
                  disabled={!canAfford}
                  className={'text-xs px-3 py-1 rounded border transition-colors ' +
                    (canAfford ? 'text-gold border-gold/40 hover:border-gold cursor-pointer' : 'text-ink-faint border-border opacity-50')}>
                  {price}g
                </button>
              </div>
            )
          })}
          {shopItems.length === 0 && (
            <p className="text-ink-faint text-xs italic text-center">Sold out.</p>
          )}
        </div>

        {/* Inventory — equip purchased items */}
        {inventory.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            <p className="text-ink-dim text-xs uppercase tracking-wide">Your Bag</p>
            {inventory.map(function(item, i) {
              var isEquippable = item.type === 'weapon' || item.type === 'armour'
              return (
                <div key={'inv-' + i} className="flex items-center justify-between p-2 rounded border border-border bg-raised text-sm font-sans">
                  <div className="flex flex-col items-start">
                    <span className="text-ink">{item.name}</span>
                    <span className="text-ink-faint text-[10px]">
                      {item.type === 'weapon' ? item.weaponType + ', d' + item.damageDie :
                       item.type === 'armour' ? '+' + (item.defBonus || 0) + ' DEF' :
                       item.description || ''}
                    </span>
                  </div>
                  {isEquippable && (
                    <button onClick={function() { handleEquip(i) }}
                      className="text-xs text-gold border border-gold/40 px-2 py-1 rounded hover:border-gold transition-colors">
                      Equip
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Enter dungeon */}
        <button onClick={handleReady}
          className="mt-auto py-3 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-lg hover:border-gold transition-colors">
          Enter the Dungeon
        </button>
      </div>
    )
  }

  return null
}

export default Preparation
