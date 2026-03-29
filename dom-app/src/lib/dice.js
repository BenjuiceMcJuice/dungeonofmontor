// Dice library — all dice types, modifiers, crit/fumble detection

// Roll a single die (d4, d6, d8, d10, d12, d20, d100)
function roll(sides) {
  return Math.floor(Math.random() * sides) + 1
}

// Roll with modifier: { roll, modifier, total, sides }
function rollWithMod(sides, modifier) {
  var r = roll(sides)
  return {
    sides: sides,
    roll: r,
    modifier: modifier,
    total: r + modifier,
  }
}

// d20 check against a target number
// Returns { roll, modifier, total, tn, success, crit, fumble }
function d20Check(modifier, tn) {
  var r = roll(20)
  var total = r + modifier
  return {
    sides: 20,
    roll: r,
    modifier: modifier,
    total: total,
    tn: tn,
    success: total >= tn,
    crit: r === 20,
    fumble: r === 1,
  }
}

// Roll damage: weapon die + STR modifier
function rollDamage(weaponDie, strMod) {
  var r = roll(weaponDie)
  var total = r + strMod
  return {
    sides: weaponDie,
    roll: r,
    modifier: strMod,
    total: Math.max(total, 1),
  }
}

// Apply DEF reduction: damage - floor(def / 2), min 1
function applyDefence(damage, defStat) {
  var reduction = Math.floor(defStat / 2)
  return Math.max(damage - reduction, 1)
}

// Initiative roll: d20 + AGI modifier
function rollInitiative(agiMod) {
  return rollWithMod(20, agiMod)
}

// Loot rarity roll: d100 + LCK modifier
// Returns { roll, modifier, total, rarity }
function rollLootRarity(lckMod) {
  var result = rollWithMod(100, lckMod)
  var t = result.total
  var rarity
  if (t >= 96) rarity = 'legendary'
  else if (t >= 86) rarity = 'epic'
  else if (t >= 71) rarity = 'rare'
  else if (t >= 51) rarity = 'uncommon'
  else rarity = 'common'
  return Object.assign({}, result, { rarity: rarity })
}

// Crit chance: base 5% (nat 20), +1% per 4 LCK above 10
function getCritChance(lckStat) {
  var bonus = Math.max(0, Math.floor((lckStat - 10) / 4))
  return 5 + bonus
}

// Check if a roll is a crit (expanded crit range for high LCK)
function isCrit(d20Roll, lckStat) {
  var chance = getCritChance(lckStat)
  var critThreshold = 21 - Math.floor(chance / 5)
  return d20Roll >= Math.max(critThreshold, 2)
}

export { roll, rollWithMod, d20Check, rollDamage, applyDefence, rollInitiative, rollLootRarity, getCritChance, isCrit }
