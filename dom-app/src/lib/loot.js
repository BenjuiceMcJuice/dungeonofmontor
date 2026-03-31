// Item catalogue, rarity rolling, and loot drop generation
// All items defined here until migrated to Firestore
// See docs/specs/09_Firestore_Data_Model.md for canonical schema

import { roll } from './dice.js'
import { getModifier } from './classes.js'

// --- Item catalogue ---
// Stage 1 subset: 3 weapons, 2 armours, 3 consumables, 2 relics

var ITEMS = {
  // Weapons
  dagger_common: {
    id: 'dagger_common', name: 'Dagger', type: 'weapon', slot: 'weapon',
    rarity: 'common', damageDie: 4, attackStat: 'str',
    buyPrice: 8, sellPrice: 3,
    description: 'Quick and light. Better than bare hands.',
  },
  shortsword_common: {
    id: 'shortsword_common', name: 'Shortsword', type: 'weapon', slot: 'weapon',
    rarity: 'common', damageDie: 6, attackStat: 'str',
    buyPrice: 15, sellPrice: 6,
    description: 'A reliable blade. Nothing more, nothing less.',
  },
  longsword_common: {
    id: 'longsword_common', name: 'Longsword', type: 'weapon', slot: 'weapon',
    rarity: 'common', damageDie: 8, attackStat: 'str',
    buyPrice: 25, sellPrice: 10,
    description: 'A sturdy blade. Gets the job done.',
  },

  // Armour
  leather_common: {
    id: 'leather_common', name: 'Leather Armour', type: 'armour', slot: 'armour',
    rarity: 'common', defBonus: 2, agiPenalty: 0,
    buyPrice: 12, sellPrice: 5,
    description: 'Supple hide. Moves with you.',
  },
  chainmail_common: {
    id: 'chainmail_common', name: 'Chainmail', type: 'armour', slot: 'armour',
    rarity: 'common', defBonus: 4, agiPenalty: -1,
    buyPrice: 30, sellPrice: 12,
    description: 'Heavy but protective. You hear yourself coming.',
  },

  // Consumables
  health_potion: {
    id: 'health_potion', name: 'Health Potion', type: 'consumable',
    rarity: 'common', effect: 'heal', effectValue: 15,
    buyPrice: 10, sellPrice: 4,
    description: 'Tastes foul. Works fast.',
  },
  rage_draught: {
    id: 'rage_draught', name: 'Rage Draught', type: 'consumable',
    rarity: 'uncommon', effect: 'stat_buff', effectStat: 'str', effectValue: 4, effectDuration: 3,
    buyPrice: 18, sellPrice: 7,
    description: 'Thick, red, tastes of iron. Your muscles burn with fury.',
  },
  smoke_bomb: {
    id: 'smoke_bomb', name: 'Smoke Bomb', type: 'consumable',
    rarity: 'common', effect: 'flee_guaranteed', effectValue: 1,
    buyPrice: 12, sellPrice: 5,
    description: 'Crack it. Run. Ask questions never.',
  },

  // Relics (passive while equipped)
  ring_of_vitality: {
    id: 'ring_of_vitality', name: 'Ring of Vitality', type: 'relic', slot: 'relic',
    rarity: 'uncommon', passiveEffect: 'hp_bonus', passiveValue: 5,
    buyPrice: 35, sellPrice: 14,
    description: 'A warm band of copper. You feel... sturdier.',
  },
  lucky_coin: {
    id: 'lucky_coin', name: 'Lucky Coin', type: 'relic', slot: 'relic',
    rarity: 'uncommon', passiveEffect: 'lck_bonus', passiveValue: 2,
    buyPrice: 30, sellPrice: 12,
    description: 'Heads you win. Tails — well, you still feel lucky.',
  },
}

// --- Rarity bands ---
// d100 + LCK modifier vs these thresholds

var RARITY_BANDS = [
  { rarity: 'heirloom',  min: 100 },
  { rarity: 'legendary', min: 94 },
  { rarity: 'epic',      min: 83 },
  { rarity: 'rare',      min: 66 },
  { rarity: 'uncommon',  min: 41 },
  { rarity: 'common',    min: 1 },
]

var RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'heirloom']

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

// --- Loot tables ---
// Defines what items can drop per zone, with weights

var LOOT_TABLES = {
  garden_standard: {
    id: 'garden_standard',
    goldMin: 2, goldMax: 8,
    itemDropChance: 0.3,
    entries: [
      { itemId: 'health_potion',    weight: 40, minRarity: 'common' },
      { itemId: 'dagger_common',    weight: 20, minRarity: 'common' },
      { itemId: 'smoke_bomb',       weight: 15, minRarity: 'common' },
      { itemId: 'leather_common',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'lucky_coin',       weight: 5,  minRarity: 'rare' },
      { itemId: 'ring_of_vitality', weight: 5,  minRarity: 'rare' },
      { itemId: 'rage_draught',     weight: 5,  minRarity: 'uncommon' },
    ],
  },
  garden_elite: {
    id: 'garden_elite',
    goldMin: 5, goldMax: 15,
    itemDropChance: 0.5,
    entries: [
      { itemId: 'health_potion',      weight: 30, minRarity: 'common' },
      { itemId: 'shortsword_common',  weight: 20, minRarity: 'common' },
      { itemId: 'chainmail_common',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'rage_draught',       weight: 15, minRarity: 'common' },
      { itemId: 'ring_of_vitality',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'lucky_coin',         weight: 10, minRarity: 'uncommon' },
      { itemId: 'smoke_bomb',         weight: 5,  minRarity: 'common' },
    ],
  },
  garden_chest: {
    id: 'garden_chest',
    goldMin: 5, goldMax: 20,
    itemDropChance: 0.7,
    entries: [
      { itemId: 'health_potion',      weight: 25, minRarity: 'common' },
      { itemId: 'shortsword_common',  weight: 15, minRarity: 'common' },
      { itemId: 'longsword_common',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'chainmail_common',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'rage_draught',       weight: 15, minRarity: 'common' },
      { itemId: 'ring_of_vitality',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'lucky_coin',         weight: 10, minRarity: 'uncommon' },
      { itemId: 'smoke_bomb',         weight: 5,  minRarity: 'common' },
    ],
  },
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
// Returns { gold: number, item: Item|null }
function generateCombatLoot(encounterLevel, lckStat) {
  var tableId = encounterLevel >= 2 ? 'garden_elite' : 'garden_standard'
  return {
    gold: rollGold(tableId),
    item: rollDrop(tableId, lckStat),
  }
}

// Generate loot for a chest/hidden chamber
function generateChestLoot(lckStat) {
  return {
    gold: rollGold('garden_chest'),
    item: rollDrop('garden_chest', lckStat),
  }
}

// Get a specific item by ID (for merchant, equipping, etc.)
function getItem(itemId) {
  return ITEMS[itemId] ? Object.assign({}, ITEMS[itemId]) : null
}

// Get all items of a type
function getItemsByType(type) {
  return Object.values(ITEMS).filter(function(item) { return item.type === type })
}

// Get merchant inventory for a zone
function getMerchantItems(inventoryIds) {
  if (!inventoryIds) inventoryIds = ['health_potion', 'rage_draught', 'smoke_bomb']
  return inventoryIds.map(function(id) { return getItem(id) }).filter(Boolean)
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
}
