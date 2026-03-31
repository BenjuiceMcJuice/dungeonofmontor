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

// 4-Tier attack resolution (replaces binary hit/miss)
// Tiers based on d20 roll + modifier:
//   Tier 1 — Critical Hit: natural 20 (or critThreshold)
//   Tier 2 — Hit: 11-19
//   Tier 3 — Glancing Blow: 5-10
//   Tier 4 — Miss: 1-4
// Modifier shifts the effective roll, making higher tiers more likely
function d20Attack(modifier, critThreshold) {
  var r = roll(20)
  var total = r + modifier
  var threshold = critThreshold || 20

  var tier, tierName
  if (r >= threshold) {
    tier = 1
    tierName = 'crit'
  } else if (total >= 11) {
    tier = 2
    tierName = 'hit'
  } else if (total >= 5) {
    tier = 3
    tierName = 'glancing'
  } else {
    tier = 4
    tierName = 'miss'
  }

  return {
    sides: 20,
    roll: r,
    modifier: modifier,
    total: total,
    tier: tier,
    tierName: tierName,
    crit: tier === 1,
    hit: tier === 2,
    glancing: tier === 3,
    miss: tier === 4,
  }
}

// Legacy d20Check — kept for any non-combat checks that still use binary pass/fail
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

// Flee resolution — 4-tier AGI check
// Crit Success: 17-20 (clean exit)
// Success: 11-16 (messy exit, some HP loss)
// Failure: 5-10 (bad exit, HP + gold loss)
// Crit Failure: 1-4 (flee fails, combat continues, heavy HP + gold loss)
function d20Flee(agiModifier) {
  var r = roll(20)
  var total = r + agiModifier

  var tier, tierName
  if (total >= 17) { tier = 1; tierName = 'crit_success' }
  else if (total >= 11) { tier = 2; tierName = 'success' }
  else if (total >= 5) { tier = 3; tierName = 'failure' }
  else { tier = 4; tierName = 'crit_failure' }

  return {
    roll: r,
    modifier: agiModifier,
    total: total,
    tier: tier,
    tierName: tierName,
  }
}

export { roll, rollWithMod, d20Attack, d20Check, d20Flee, rollDamage, applyDefence, rollInitiative, rollLootRarity }
