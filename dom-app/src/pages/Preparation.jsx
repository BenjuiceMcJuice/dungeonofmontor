// Preparation — pre-run screen: allocate stats + buy starter gear
import { useState } from 'react'
import StatPicker from '../components/StatPicker.jsx'
import { getMaxHp } from '../lib/classes.js'
import classData from '../data/classes.json'
import ITEMS from '../data/items.json'

var startConfig = classData.startingKnight

function Preparation({ character, onReady }) {
  var [phase, setPhase] = useState('stats') // stats | shop | ready
  var [godInvincible, setGodInvincible] = useState(false)
  var [godOneShot, setGodOneShot] = useState(false)
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
    // Recalculate maxHp when VIT changes
    character.maxHp = getMaxHp(character.stats)
    setFreePoints(freePoints - 1)
  }

  function handleBuy(shopIndex) {
    var item = shopItems[shopIndex]
    if (!item) return
    var price = item.buyPrice || 0
    if (gold < price) return
    setGold(gold - price)

    // Remove from shop
    setShopItems(function(prev) {
      var next = prev.slice()
      next.splice(shopIndex, 1)
      return next
    })

    // Auto-equip weapons, armour, shields. Non-equippable goes to bag.
    var boughtItem = Object.assign({}, item)
    if (boughtItem.type === 'weapon' && boughtItem.slot === 'weapon') {
      setEquipped(function(prev) {
        var returnItem = prev.weapon
        var newEq = Object.assign({}, prev, { weapon: boughtItem })
        // Heavy weapons unequip shield
        if (boughtItem.hand === 'heavy' && prev.offhand && prev.offhand.slot === 'offhand') {
          setInventory(function(inv) { return inv.concat(prev.offhand ? [prev.offhand] : []) })
          newEq.offhand = null
        }
        if (returnItem) setInventory(function(inv) { return inv.concat([returnItem]) })
        return newEq
      })
    } else if (boughtItem.type === 'armour' && boughtItem.slot === 'offhand') {
      // Can't equip shield with heavy weapon
      if (equipped.weapon && equipped.weapon.hand === 'heavy') {
        setInventory(function(prev) { return prev.concat([boughtItem]) })
      } else {
        setEquipped(function(prev) {
          var returnItem = prev.offhand
          if (returnItem) setInventory(function(inv) { return inv.concat([returnItem]) })
          return Object.assign({}, prev, { offhand: boughtItem })
        })
      }
    } else if (boughtItem.type === 'armour' && boughtItem.slot === 'armour') {
      setEquipped(function(prev) {
        var returnItem = prev.armour
        if (returnItem) setInventory(function(inv) { return inv.concat([returnItem]) })
        return Object.assign({}, prev, { armour: boughtItem })
      })
    } else {
      setInventory(function(prev) { return prev.concat([boughtItem]) })
    }
  }

  function handleEquip(invIndex) {
    var item = inventory[invIndex]
    if (!item) return
    var newEquipped = Object.assign({}, equipped)
    var returnItem = null

    if (item.type === 'weapon' && item.slot === 'weapon') {
      // Dagger can go to offhand if main hand is a dagger or sword and offhand is empty
      if (item.weaponType === 'dagger' && newEquipped.weapon &&
          (newEquipped.weapon.weaponType === 'dagger' || newEquipped.weapon.weaponType === 'sword') &&
          !newEquipped.offhand) {
        newEquipped.offhand = item
      } else {
        returnItem = newEquipped.weapon
        newEquipped.weapon = item
        // Heavy weapons can't use shields — unequip offhand
        if (item.hand === 'heavy' && newEquipped.offhand && newEquipped.offhand.slot === 'offhand') {
          var shieldReturn = newEquipped.offhand
          newEquipped.offhand = null
          setInventory(function(prev) { return prev.concat([shieldReturn]) })
        }
        // Heavy weapons can't dual wield — unequip offhand weapon too
        if (item.hand === 'heavy' && newEquipped.offhand && newEquipped.offhand.type === 'weapon') {
          var weaponReturn = newEquipped.offhand
          newEquipped.offhand = null
          setInventory(function(prev) { return prev.concat([weaponReturn]) })
        }
      }
    } else if (item.type === 'armour' && item.slot === 'offhand') {
      // Can't equip shield with heavy weapon
      if (newEquipped.weapon && newEquipped.weapon.hand === 'heavy') return
      returnItem = newEquipped.offhand
      newEquipped.offhand = item
    } else if (item.type === 'armour' && item.slot === 'armour') {
      returnItem = newEquipped.armour
      newEquipped.armour = item
    } else if (item.slot === 'helmet') {
      returnItem = newEquipped.helmet
      newEquipped.helmet = item
    } else if (item.slot === 'boots') {
      returnItem = newEquipped.boots
      newEquipped.boots = item
    } else if (item.slot === 'amulet') {
      returnItem = newEquipped.amulet
      newEquipped.amulet = item
    } else if (item.type === 'ring' && item.slot === 'ring') {
      if (!newEquipped.rings) newEquipped.rings = []
      if (newEquipped.rings.length >= 2) return
      newEquipped.rings = newEquipped.rings.concat([item])
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
    character.godInvincible = godInvincible
    character.godOneShot = godOneShot
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

        {/* God mode toggles — testing */}
        <div className="mt-6 flex flex-col gap-2 items-center">
          <p className="text-ink-faint text-[9px] uppercase tracking-wide">Testing</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={godInvincible} onChange={function() { setGodInvincible(!godInvincible) }}
                className="w-4 h-4 accent-green-400" />
              <span className={'text-xs font-sans ' + (godInvincible ? 'text-green-400' : 'text-ink-faint')}>Invincible</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={godOneShot} onChange={function() { setGodOneShot(!godOneShot) }}
                className="w-4 h-4 accent-red-400" />
              <span className={'text-xs font-sans ' + (godOneShot ? 'text-red-400' : 'text-ink-faint')}>One-Shot</span>
            </label>
          </div>
        </div>
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
          <p className="text-[10px] text-gold uppercase tracking-wide mb-2">Equipped</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] text-ink-faint uppercase">Weapon</span>
                <span className="text-ink text-sm font-sans">{equipped.weapon ? equipped.weapon.name : 'Fists'}</span>
                {equipped.weapon && <span className="text-ink-dim text-[10px]">d{equipped.weapon.damageDie} {equipped.weapon.weaponType} ({equipped.weapon.hand})</span>}
                {!equipped.weapon && <span className="text-ink-dim text-[10px]">d4, -1 acc, 2× STR</span>}
              </div>
              {equipped.weapon && (
                <button onClick={function() { setInventory(function(inv) { return inv.concat([equipped.weapon]) }); setEquipped(function(e) { return Object.assign({}, e, { weapon: null }) }) }}
                  className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
              )}
            </div>
            {equipped.armour && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-ink-faint uppercase">Armour</span>
                  <span className="text-ink text-sm font-sans">{equipped.armour.name}</span>
                  <span className="text-ink-dim text-[10px]">+{equipped.armour.defBonus} DEF</span>
                </div>
                <button onClick={function() { setInventory(function(inv) { return inv.concat([equipped.armour]) }); setEquipped(function(e) { return Object.assign({}, e, { armour: null }) }) }}
                  className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
              </div>
            )}
            {equipped.offhand && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-ink-faint uppercase">Offhand</span>
                  <span className="text-ink text-sm font-sans">{equipped.offhand.name}</span>
                  <span className="text-ink-dim text-[10px]">+{equipped.offhand.defBonus} DEF, {Math.round((equipped.offhand.passiveValue || 0) * 100)}% block</span>
                </div>
                <button onClick={function() { setInventory(function(inv) { return inv.concat([equipped.offhand]) }); setEquipped(function(e) { return Object.assign({}, e, { offhand: null }) }) }}
                  className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
              </div>
            )}
            {equipped.helmet && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-ink-faint uppercase">Helmet</span>
                  <span className="text-ink text-sm font-sans">{equipped.helmet.name}</span>
                  <span className="text-ink-dim text-[10px]">+{equipped.helmet.defBonus || 0} DEF{equipped.helmet.agiPenalty ? ', ' + equipped.helmet.agiPenalty + ' AGI' : ''}</span>
                </div>
                <button onClick={function() { setInventory(function(inv) { return inv.concat([equipped.helmet]) }); setEquipped(function(e) { return Object.assign({}, e, { helmet: null }) }) }}
                  className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
              </div>
            )}
            {equipped.boots && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-ink-faint uppercase">Boots</span>
                  <span className="text-ink text-sm font-sans">{equipped.boots.name}</span>
                  <span className="text-ink-dim text-[10px]">{equipped.boots.agiBonus ? '+' + equipped.boots.agiBonus + ' AGI' : ''}{equipped.boots.defBonus ? (equipped.boots.agiBonus ? ', ' : '') + '+' + equipped.boots.defBonus + ' DEF' : ''}{equipped.boots.initBonus ? (equipped.boots.agiBonus || equipped.boots.defBonus ? ', ' : '') + '+' + equipped.boots.initBonus + ' init' : ''}</span>
                </div>
                <button onClick={function() { setInventory(function(inv) { return inv.concat([equipped.boots]) }); setEquipped(function(e) { return Object.assign({}, e, { boots: null }) }) }}
                  className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
              </div>
            )}
            {equipped.amulet && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-ink-faint uppercase">Amulet</span>
                  <span className="text-ink text-sm font-sans">{equipped.amulet.name}</span>
                  <span className="text-ink-dim text-[10px]">{equipped.amulet.description}</span>
                </div>
                <button onClick={function() { setInventory(function(inv) { return inv.concat([equipped.amulet]) }); setEquipped(function(e) { return Object.assign({}, e, { amulet: null }) }) }}
                  className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
              </div>
            )}
            {equipped.rings && equipped.rings.map(function(ring, ri) {
              return (
                <div key={'ring-' + ri} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-ink-faint uppercase">Ring {ri + 1}</span>
                    <span className="text-ink text-sm font-sans">{ring.name}</span>
                    <span className="text-ink-dim text-[10px]">{ring.description}</span>
                  </div>
                  <button onClick={function() {
                    var ringItem = equipped.rings[ri]
                    setInventory(function(inv) { return inv.concat([ringItem]) })
                    setEquipped(function(e) { var nr = e.rings.slice(); nr.splice(ri, 1); return Object.assign({}, e, { rings: nr }) })
                  }} className="text-[9px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink transition-colors">Unequip</button>
                </div>
              )
            })}
          </div>
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
                     item.type === 'armour' && item.slot === 'helmet' ? 'helmet, +' + (item.defBonus || 0) + ' DEF' + (item.agiPenalty ? ', ' + item.agiPenalty + ' AGI' : '') :
                     item.type === 'armour' && item.slot === 'boots' ? 'boots' + (item.agiBonus ? ', +' + item.agiBonus + ' AGI' : '') + (item.defBonus ? ', +' + item.defBonus + ' DEF' : '') + (item.initBonus ? ', +' + item.initBonus + ' init' : '') :
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
