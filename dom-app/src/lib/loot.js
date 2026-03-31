// Item catalogue, rarity rolling, and loot drop generation
// All items defined here until migrated to Firestore
// See docs/specs/09_Firestore_Data_Model.md for canonical schema

import { roll } from './dice.js'
import { getModifier } from './classes.js'

// --- Item catalogue ---
// Stage 1 subset: 3 weapons, 2 armours, 3 consumables, 2 relics

var ITEMS = {
  // ============================================================
  // WEAPONS — plain
  // ============================================================
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
  warhammer: {
    id: 'warhammer', name: 'Warhammer', type: 'weapon', slot: 'weapon',
    rarity: 'uncommon', damageDie: 10, attackStat: 'str', agiPenalty: -2,
    buyPrice: 40, sellPrice: 16,
    description: 'Slow. Heavy. The last thing they see.',
  },

  // ============================================================
  // WEAPONS — with conditions
  // ============================================================
  venomfang_dagger: {
    id: 'venomfang_dagger', name: 'Venomfang Dagger', type: 'weapon', slot: 'weapon',
    rarity: 'uncommon', damageDie: 4, attackStat: 'str',
    conditionOnHit: 'POISON', conditionChance: 1.0,
    buyPrice: 22, sellPrice: 9,
    description: 'The blade weeps green. Every cut festers.',
  },
  thorn_blade: {
    id: 'thorn_blade', name: 'Thorn Blade', type: 'weapon', slot: 'weapon',
    rarity: 'uncommon', damageDie: 6, attackStat: 'str',
    conditionOnHit: 'BLEED', conditionChance: 1.0,
    buyPrice: 28, sellPrice: 11,
    description: 'Grown, not forged. Thorns line the edge.',
  },
  frost_edge: {
    id: 'frost_edge', name: 'Frost Edge', type: 'weapon', slot: 'weapon',
    rarity: 'rare', damageDie: 6, attackStat: 'str',
    conditionOnHit: 'FROST', conditionChance: 1.0,
    buyPrice: 45, sellPrice: 18,
    description: 'Cold enough to see your breath. Theirs too.',
  },
  ember_mace: {
    id: 'ember_mace', name: 'Ember Mace', type: 'weapon', slot: 'weapon',
    rarity: 'rare', damageDie: 8, attackStat: 'str',
    conditionOnHit: 'BURN', conditionChance: 1.0,
    buyPrice: 55, sellPrice: 22,
    description: 'The head glows. It never cools.',
  },
  dread_blade: {
    id: 'dread_blade', name: 'Dread Blade', type: 'weapon', slot: 'weapon',
    rarity: 'rare', damageDie: 8, attackStat: 'str',
    conditionOnHit: 'FEAR', conditionChance: 0.7,
    buyPrice: 50, sellPrice: 20,
    description: 'The edge hums. Enemies flinch before you swing.',
  },
  stun_maul: {
    id: 'stun_maul', name: 'Stun Maul', type: 'weapon', slot: 'weapon',
    rarity: 'uncommon', damageDie: 8, attackStat: 'str', agiPenalty: -1,
    conditionOnHit: 'DAZE', conditionChance: 1.0,
    buyPrice: 35, sellPrice: 14,
    description: 'One good hit and they forget where they are.',
  },

  // ============================================================
  // ARMOUR
  // ============================================================
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
  spiked_plate: {
    id: 'spiked_plate', name: 'Spiked Plate', type: 'armour', slot: 'armour',
    rarity: 'rare', defBonus: 5, agiPenalty: -2,
    passiveEffect: 'damage_reflect', passiveValue: 1,
    buyPrice: 60, sellPrice: 24,
    description: 'Hurts to wear. Hurts them more.',
  },
  shadow_cloak: {
    id: 'shadow_cloak', name: 'Shadow Cloak', type: 'armour', slot: 'armour',
    rarity: 'rare', defBonus: 1, agiPenalty: 0,
    passiveEffect: 'dodge_chance', passiveValue: 0.15,
    buyPrice: 50, sellPrice: 20,
    description: 'You\'re harder to see. And to hit.',
  },

  // ============================================================
  // CONSUMABLES
  // ============================================================
  health_potion: {
    id: 'health_potion', name: 'Health Potion', type: 'consumable',
    rarity: 'common', effect: 'heal', effectValue: 15,
    buyPrice: 10, sellPrice: 4,
    description: 'Tastes foul. Works fast.',
  },
  greater_health_potion: {
    id: 'greater_health_potion', name: 'Greater Health Potion', type: 'consumable',
    rarity: 'uncommon', effect: 'heal', effectValue: 30,
    buyPrice: 25, sellPrice: 10,
    description: 'Tastes worse. Works better.',
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
  antidote: {
    id: 'antidote', name: 'Antidote', type: 'consumable',
    rarity: 'common', effect: 'cure_body', effectValue: 1,
    buyPrice: 8, sellPrice: 3,
    description: 'Chalky. Bitter. Clears the body.',
  },
  smelling_salts: {
    id: 'smelling_salts', name: 'Smelling Salts', type: 'consumable',
    rarity: 'common', effect: 'cure_mind', effectValue: 1,
    buyPrice: 8, sellPrice: 3,
    description: 'One sniff and your head clears. Violently.',
  },
  firebomb: {
    id: 'firebomb', name: 'Firebomb', type: 'consumable',
    rarity: 'uncommon', effect: 'damage_all_enemies', effectValue: 6,
    buyPrice: 20, sellPrice: 8,
    description: 'Lob it. Everyone burns.',
  },
  fortify_draught: {
    id: 'fortify_draught', name: 'Fortify Draught', type: 'consumable',
    rarity: 'uncommon', effect: 'stat_buff', effectStat: 'def', effectValue: 4, effectDuration: 3,
    buyPrice: 18, sellPrice: 7,
    description: 'Your skin hardens. Temporarily.',
  },

  // ============================================================
  // RELICS — passive while equipped (max 3 slots)
  // ============================================================
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
  bleed_ward: {
    id: 'bleed_ward', name: 'Clotting Amulet', type: 'relic', slot: 'relic',
    rarity: 'uncommon', passiveEffect: 'condition_immunity', passiveCondition: 'BLEED',
    buyPrice: 25, sellPrice: 10,
    description: 'Your blood thickens. Wounds close faster than they should.',
  },
  poison_ward: {
    id: 'poison_ward', name: 'Antivenom Charm', type: 'relic', slot: 'relic',
    rarity: 'uncommon', passiveEffect: 'condition_immunity', passiveCondition: 'POISON',
    buyPrice: 25, sellPrice: 10,
    description: 'Smells of herbs. Poison slides off you.',
  },
  fear_ward: {
    id: 'fear_ward', name: 'Courage Stone', type: 'relic', slot: 'relic',
    rarity: 'rare', passiveEffect: 'condition_immunity', passiveCondition: 'FEAR',
    buyPrice: 40, sellPrice: 16,
    description: 'Cold and heavy in your pocket. Fear can\'t find you.',
  },
  crit_ring: {
    id: 'crit_ring', name: 'Keen Edge Ring', type: 'relic', slot: 'relic',
    rarity: 'rare', passiveEffect: 'crit_bonus', passiveValue: 1,
    buyPrice: 55, sellPrice: 22,
    description: 'Crits on 19+. Your blade finds the gaps.',
  },
  vampiric_ring: {
    id: 'vampiric_ring', name: 'Vampiric Ring', type: 'relic', slot: 'relic',
    rarity: 'epic', passiveEffect: 'lifesteal', passiveValue: 0.1,
    buyPrice: 80, sellPrice: 32,
    description: 'Heal 10% of damage dealt. The ring drinks.',
  },

  // ============================================================
  // UNIQUE / WEIRD items — Montor's personal collection
  // ============================================================
  montors_lottery_ticket: {
    id: 'montors_lottery_ticket', name: "Montor's Lottery Ticket", type: 'relic', slot: 'relic',
    rarity: 'epic',
    passiveEffect: 'lottery', passiveValue: 0,
    lotteryNumbers: null, // generated on pickup: 3 random numbers 1-20
    buyPrice: 100, sellPrice: 1,
    description: 'Three numbers scratched in ink. If any die matches... "jackpot."',
  },
  montors_monocle: {
    id: 'montors_monocle', name: "Montor's Monocle", type: 'relic', slot: 'relic',
    rarity: 'epic',
    passiveEffect: 'see_enemy_hp_exact', passiveValue: 1,
    buyPrice: 70, sellPrice: 28,
    description: 'See their exact HP. Knowledge is half the battle. Montor wants it back.',
  },
  loaded_dice: {
    id: 'loaded_dice', name: 'Loaded Dice', type: 'relic', slot: 'relic',
    rarity: 'rare',
    passiveEffect: 'reroll_ones', passiveValue: 1,
    buyPrice: 60, sellPrice: 24,
    description: 'Ones become twos. Not exactly fair, is it?',
  },
  mirror_shield: {
    id: 'mirror_shield', name: 'Mirror Shard', type: 'relic', slot: 'relic',
    rarity: 'rare',
    passiveEffect: 'reflect_conditions', passiveValue: 0.25,
    buyPrice: 45, sellPrice: 18,
    description: '25% chance to reflect applied conditions back at the attacker.',
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
  // --- Garden (Floor 0) ---
  garden_standard: {
    id: 'garden_standard',
    goldMin: 2, goldMax: 8,
    itemDropChance: 0.3,
    entries: [
      { itemId: 'health_potion',    weight: 35, minRarity: 'common' },
      { itemId: 'dagger_common',    weight: 15, minRarity: 'common' },
      { itemId: 'smoke_bomb',       weight: 15, minRarity: 'common' },
      { itemId: 'antidote',         weight: 10, minRarity: 'common' },
      { itemId: 'leather_common',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'venomfang_dagger', weight: 5,  minRarity: 'uncommon' },
      { itemId: 'thorn_blade',      weight: 5,  minRarity: 'uncommon' },
      { itemId: 'bleed_ward',       weight: 3,  minRarity: 'rare' },
      { itemId: 'lucky_coin',       weight: 2,  minRarity: 'rare' },
    ],
  },
  garden_elite: {
    id: 'garden_elite',
    goldMin: 5, goldMax: 15,
    itemDropChance: 0.5,
    entries: [
      { itemId: 'health_potion',      weight: 25, minRarity: 'common' },
      { itemId: 'shortsword_common',  weight: 15, minRarity: 'common' },
      { itemId: 'thorn_blade',        weight: 10, minRarity: 'common' },
      { itemId: 'chainmail_common',   weight: 10, minRarity: 'uncommon' },
      { itemId: 'rage_draught',       weight: 10, minRarity: 'common' },
      { itemId: 'venomfang_dagger',   weight: 8,  minRarity: 'uncommon' },
      { itemId: 'ring_of_vitality',   weight: 5,  minRarity: 'uncommon' },
      { itemId: 'poison_ward',        weight: 5,  minRarity: 'uncommon' },
      { itemId: 'stun_maul',          weight: 5,  minRarity: 'rare' },
      { itemId: 'loaded_dice',        weight: 3,  minRarity: 'rare' },
      { itemId: 'crit_ring',          weight: 2,  minRarity: 'epic' },
      { itemId: 'mirror_shield',      weight: 2,  minRarity: 'rare' },
    ],
  },
  garden_chest: {
    id: 'garden_chest',
    goldMin: 8, goldMax: 25,
    itemDropChance: 0.8,
    entries: [
      { itemId: 'health_potion',        weight: 15, minRarity: 'common' },
      { itemId: 'shortsword_common',    weight: 10, minRarity: 'common' },
      { itemId: 'longsword_common',     weight: 10, minRarity: 'common' },
      { itemId: 'chainmail_common',     weight: 8,  minRarity: 'uncommon' },
      { itemId: 'thorn_blade',          weight: 8,  minRarity: 'uncommon' },
      { itemId: 'frost_edge',           weight: 5,  minRarity: 'rare' },
      { itemId: 'rage_draught',         weight: 8,  minRarity: 'common' },
      { itemId: 'ring_of_vitality',     weight: 5,  minRarity: 'uncommon' },
      { itemId: 'lucky_coin',           weight: 5,  minRarity: 'uncommon' },
      { itemId: 'fear_ward',            weight: 3,  minRarity: 'rare' },
      { itemId: 'crit_ring',            weight: 3,  minRarity: 'rare' },
      { itemId: 'shadow_cloak',         weight: 3,  minRarity: 'rare' },
      { itemId: 'loaded_dice',          weight: 3,  minRarity: 'rare' },
      { itemId: 'greater_health_potion', weight: 5, minRarity: 'uncommon' },
      { itemId: 'fortify_draught',      weight: 5,  minRarity: 'uncommon' },
      { itemId: 'firebomb',             weight: 4,  minRarity: 'uncommon' },
    ],
  },

  // --- Underground (Floor -1) — better drops ---
  underground_standard: {
    id: 'underground_standard',
    goldMin: 4, goldMax: 12,
    itemDropChance: 0.35,
    entries: [
      { itemId: 'health_potion',      weight: 25, minRarity: 'common' },
      { itemId: 'shortsword_common',  weight: 10, minRarity: 'common' },
      { itemId: 'antidote',           weight: 10, minRarity: 'common' },
      { itemId: 'smelling_salts',     weight: 10, minRarity: 'common' },
      { itemId: 'thorn_blade',        weight: 8,  minRarity: 'common' },
      { itemId: 'chainmail_common',   weight: 8,  minRarity: 'uncommon' },
      { itemId: 'venomfang_dagger',   weight: 5,  minRarity: 'uncommon' },
      { itemId: 'frost_edge',         weight: 5,  minRarity: 'uncommon' },
      { itemId: 'stun_maul',          weight: 5,  minRarity: 'uncommon' },
      { itemId: 'bleed_ward',         weight: 5,  minRarity: 'uncommon' },
      { itemId: 'fear_ward',          weight: 4,  minRarity: 'rare' },
      { itemId: 'loaded_dice',        weight: 3,  minRarity: 'rare' },
      { itemId: 'mirror_shield',      weight: 2,  minRarity: 'rare' },
    ],
  },
  underground_elite: {
    id: 'underground_elite',
    goldMin: 8, goldMax: 20,
    itemDropChance: 0.55,
    entries: [
      { itemId: 'greater_health_potion', weight: 15, minRarity: 'common' },
      { itemId: 'longsword_common',    weight: 10, minRarity: 'common' },
      { itemId: 'warhammer',           weight: 8,  minRarity: 'uncommon' },
      { itemId: 'ember_mace',          weight: 5,  minRarity: 'rare' },
      { itemId: 'dread_blade',         weight: 5,  minRarity: 'rare' },
      { itemId: 'frost_edge',          weight: 8,  minRarity: 'uncommon' },
      { itemId: 'spiked_plate',        weight: 5,  minRarity: 'rare' },
      { itemId: 'shadow_cloak',        weight: 5,  minRarity: 'rare' },
      { itemId: 'rage_draught',        weight: 8,  minRarity: 'common' },
      { itemId: 'fortify_draught',     weight: 8,  minRarity: 'common' },
      { itemId: 'firebomb',            weight: 5,  minRarity: 'uncommon' },
      { itemId: 'crit_ring',           weight: 4,  minRarity: 'rare' },
      { itemId: 'vampiric_ring',       weight: 2,  minRarity: 'epic' },
      { itemId: 'montors_monocle',     weight: 1,  minRarity: 'epic' },
      { itemId: 'montors_lottery_ticket', weight: 1, minRarity: 'epic' },
    ],
  },
  underground_chest: {
    id: 'underground_chest',
    goldMin: 12, goldMax: 35,
    itemDropChance: 0.85,
    entries: [
      { itemId: 'greater_health_potion', weight: 10, minRarity: 'common' },
      { itemId: 'warhammer',           weight: 8,  minRarity: 'uncommon' },
      { itemId: 'ember_mace',          weight: 6,  minRarity: 'rare' },
      { itemId: 'dread_blade',         weight: 6,  minRarity: 'rare' },
      { itemId: 'frost_edge',          weight: 8,  minRarity: 'uncommon' },
      { itemId: 'spiked_plate',        weight: 6,  minRarity: 'rare' },
      { itemId: 'shadow_cloak',        weight: 6,  minRarity: 'rare' },
      { itemId: 'crit_ring',           weight: 5,  minRarity: 'rare' },
      { itemId: 'vampiric_ring',       weight: 3,  minRarity: 'epic' },
      { itemId: 'fear_ward',           weight: 5,  minRarity: 'uncommon' },
      { itemId: 'poison_ward',         weight: 5,  minRarity: 'uncommon' },
      { itemId: 'loaded_dice',         weight: 4,  minRarity: 'rare' },
      { itemId: 'mirror_shield',       weight: 4,  minRarity: 'rare' },
      { itemId: 'montors_monocle',     weight: 2,  minRarity: 'epic' },
      { itemId: 'montors_lottery_ticket', weight: 2, minRarity: 'epic' },
      { itemId: 'firebomb',            weight: 5,  minRarity: 'uncommon' },
      { itemId: 'fortify_draught',     weight: 5,  minRarity: 'uncommon' },
      { itemId: 'rage_draught',        weight: 6,  minRarity: 'common' },
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

// Map floor IDs to loot table prefixes
function getFloorLootPrefix(floorId) {
  if (floorId === 'underground') return 'underground'
  // Future floors: add mappings here
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
