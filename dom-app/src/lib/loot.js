// Item catalogue, rarity rolling, and loot drop generation
// Data loaded from JSON — see src/data/ for item and loot table definitions

import { roll } from './dice.js'
import { getModifier } from './classes.js'
import ITEMS from '../data/items.json'
import lootData from '../data/loot-tables.json'

var RARITY_BANDS = lootData.rarityBands
var RARITY_ORDER = lootData.rarityOrder
var LOOT_TABLES = lootData.tables

function getRarityIndex(rarity) {
  return RARITY_ORDER.indexOf(rarity)
}

// Roll for rarity tier
function rollRarity(lckStat) {
  var lckMod = lckStat ? getModifier(lckStat) : 0
  var result = roll(100) + lckMod
  for (var i = 0; i < RARITY_BANDS.length; i++) {
    if (result >= RARITY_BANDS[i].min) return RARITY_BANDS[i].rarity
  }
  return 'common'
}

// --- Drop generation ---

// Pick an item from a loot table, respecting rarity roll
function rollDrop(tableId, lckStat) {
  var table = LOOT_TABLES[tableId]
  if (!table) return null

  // Check if an item drops at all
  if (Math.random() > table.itemDropChance) return null

  // Roll rarity
  var rarity = rollRarity(lckStat)
  var rarityIdx = getRarityIndex(rarity)

  // Filter entries to those whose minRarity is at or below rolled rarity
  var eligible = table.entries.filter(function(e) {
    return getRarityIndex(e.minRarity) <= rarityIdx
  })
  if (eligible.length === 0) return null

  // Weighted random pick
  var totalWeight = 0
  for (var i = 0; i < eligible.length; i++) totalWeight += eligible[i].weight
  var pick = Math.random() * totalWeight
  var cumulative = 0
  for (var j = 0; j < eligible.length; j++) {
    cumulative += eligible[j].weight
    if (pick <= cumulative) {
      var item = ITEMS[eligible[j].itemId]
      if (!item) return null
      // Return a copy with the rolled rarity (for display, even though base item has its own rarity)
      return Object.assign({}, item)
    }
  }
  return null
}

// Roll gold from a loot table
function rollGold(tableId) {
  var table = LOOT_TABLES[tableId]
  if (!table) return 0
  return table.goldMin + Math.floor(Math.random() * (table.goldMax - table.goldMin + 1))
}

// Generate full loot from a combat encounter
// floorId determines which loot table set to use
function generateCombatLoot(encounterLevel, lckStat, floorId) {
  var prefix = getFloorLootPrefix(floorId)
  var tableId = encounterLevel >= 2 ? prefix + '_elite' : prefix + '_standard'
  // Fall back to garden if table doesn't exist
  if (!LOOT_TABLES[tableId]) tableId = encounterLevel >= 2 ? 'garden_elite' : 'garden_standard'
  return {
    gold: rollGold(tableId),
    item: rollDrop(tableId, lckStat),
  }
}

// Generate loot for a chest/hidden chamber
function generateChestLoot(lckStat, floorId) {
  var prefix = getFloorLootPrefix(floorId)
  var tableId = prefix + '_chest'
  if (!LOOT_TABLES[tableId]) tableId = 'garden_chest'
  return {
    gold: rollGold(tableId),
    item: rollDrop(tableId, lckStat),
  }
}

// Map floor IDs to loot table prefixes — uses floorId directly, falls back to closest available
function getFloorLootPrefix(floorId) {
  if (LOOT_TABLES[floorId + '_standard']) return floorId
  // Fallback chain for floors without their own tables
  var fallbacks = {
    'grounds': 'garden',
    'underground': 'underground',
    'underbelly': 'underbelly',
    'quarters': 'quarters',
    'works': 'works',
    'deep': 'deep',
    'domain': 'domain',
  }
  var prefix = fallbacks[floorId]
  if (prefix && LOOT_TABLES[prefix + '_standard']) return prefix
  return 'garden'
}

// Get a specific item by ID (for merchant, equipping, etc.)
function getItem(itemId) {
  return ITEMS[itemId] ? Object.assign({}, ITEMS[itemId]) : null
}

// Get all items of a type
function getItemsByType(type) {
  return Object.values(ITEMS).filter(function(item) { return item.type === type })
}

// Get merchant inventory — health potions always, plus random picks from the floor's loot pool
function getMerchantItems(floorId) {
  var prefix = getFloorLootPrefix(floorId)
  var table = LOOT_TABLES[prefix + '_standard'] || LOOT_TABLES['garden_standard']

  // Always stock health potions
  var stock = [getItem('health_potion')]

  // Build a pool of other items from the floor's loot table (exclude potions already added)
  var pool = []
  if (table && table.entries) {
    for (var i = 0; i < table.entries.length; i++) {
      var entry = table.entries[i]
      if (entry.itemId !== 'health_potion' && ITEMS[entry.itemId]) {
        pool.push({ itemId: entry.itemId, weight: entry.weight })
      }
    }
  }
  // Also pull from elite table for rarer stock
  var eliteTable = LOOT_TABLES[prefix + '_elite']
  if (eliteTable && eliteTable.entries) {
    for (var j = 0; j < eliteTable.entries.length; j++) {
      var eEntry = eliteTable.entries[j]
      if (eEntry.itemId !== 'health_potion' && ITEMS[eEntry.itemId]) {
        // Check not already in pool
        var alreadyIn = false
        for (var k = 0; k < pool.length; k++) {
          if (pool[k].itemId === eEntry.itemId) { alreadyIn = true; break }
        }
        if (!alreadyIn) pool.push({ itemId: eEntry.itemId, weight: Math.round(eEntry.weight * 0.5) })
      }
    }
  }

  // Weighted random pick from pool (without replacement)
  var extraCount = 3 + Math.floor(Math.random() * 3) // 3-5 extra items
  for (var n = 0; n < extraCount && pool.length > 0; n++) {
    var totalWeight = 0
    for (var wi = 0; wi < pool.length; wi++) totalWeight += pool[wi].weight
    var pick = Math.random() * totalWeight
    var cumulative = 0
    for (var pi = 0; pi < pool.length; pi++) {
      cumulative += pool[pi].weight
      if (pick <= cumulative) {
        stock.push(getItem(pool[pi].itemId))
        pool.splice(pi, 1) // remove so no duplicates
        break
      }
    }
  }

  return stock.filter(Boolean)
}

// --- Consumable effect application ---
// Returns a description of what happened + state changes

function applyConsumable(item, playerState) {
  if (item.type !== 'consumable') return null

  var result = { used: true, description: '', stateChanges: {} }

  if (item.effect === 'heal') {
    var healed = Math.min(item.effectValue, playerState.maxHp - playerState.currentHp)
    result.description = 'Healed ' + healed + ' HP.'
    result.stateChanges.hpChange = healed
  } else if (item.effect === 'stat_buff') {
    result.description = '+' + item.effectValue + ' ' + (item.effectStat || '').toUpperCase() + ' for ' + item.effectDuration + ' turns.'
    result.stateChanges.buff = {
      stat: item.effectStat,
      value: item.effectValue,
      turnsRemaining: item.effectDuration,
    }
  } else if (item.effect === 'flee_guaranteed') {
    result.description = 'Smoke fills the chamber. You vanish.'
    result.stateChanges.guaranteedFlee = true
  } else if (item.effect === 'cure_body') {
    result.description = 'Body condition cleared.'
    result.stateChanges.cureSlot = 'body'
  } else if (item.effect === 'cure_mind') {
    result.description = 'Mind condition cleared.'
    result.stateChanges.cureSlot = 'mind'
  } else if (item.effect === 'damage_all_enemies') {
    result.description = item.effectValue + ' damage to all enemies!'
    result.stateChanges.damageAllEnemies = item.effectValue
  } else if (item.effect === 'apply_condition') {
    result.description = item.effectCondition === 'ADRENALINE'
      ? 'ADRENALINE! Guaranteed crit, +3 STR. Brace for the crash.'
      : item.effectCondition + ' applied!'
    result.stateChanges.applyCondition = item.effectCondition
  } else if (item.effect === 'random_effect') {
    var effects = [
      { desc: 'Healed 20 HP!', changes: { hpChange: 20 } },
      { desc: 'Healed 10 HP!', changes: { hpChange: 10 } },
      { desc: 'Healed 5 HP. Barely.', changes: { hpChange: 5 } },
      { desc: '+3 STR for 3 turns! Muscles!', changes: { buff: { stat: 'str', value: 3, turnsRemaining: 3 } } },
      { desc: '+3 DEF for 3 turns! Tough!', changes: { buff: { stat: 'def', value: 3, turnsRemaining: 3 } } },
      { desc: '+3 AGI for 3 turns! Fast!', changes: { buff: { stat: 'agi', value: 3, turnsRemaining: 3 } } },
      { desc: 'Cured body condition!', changes: { cureSlot: 'body' } },
      { desc: 'Cured mind condition!', changes: { cureSlot: 'mind' } },
      { desc: 'Lost 5 HP. Ouch.', changes: { hpChange: -5 } },
      { desc: 'Lost 10 HP! That was not medicine!', changes: { hpChange: -10 } },
      { desc: 'Nothing happened. Tastes like water.', changes: {} },
      { desc: 'Nothing happened. Tastes like regret.', changes: {} },
      { desc: '6 damage to all enemies! It exploded!', changes: { damageAllEnemies: 6 } },
    ]
    var pick = effects[Math.floor(Math.random() * effects.length)]
    result.description = pick.desc
    result.stateChanges = pick.changes
  } else {
    result.used = false
  }

  return result
}

export {
  ITEMS,
  RARITY_BANDS,
  RARITY_ORDER,
  LOOT_TABLES,
  rollRarity,
  rollDrop,
  rollGold,
  generateCombatLoot,
  generateChestLoot,
  getItem,
  getItemsByType,
  getMerchantItems,
  applyConsumable,
  getFloorLootPrefix,
}
