// Gift powers — Montor's sacrificed treasures
// Each gift can be applied to ONE slot: body, mind, weapon, or shield
import giftData from '../data/gifts.json'

var GIFTS = giftData

function getGiftDef(giftId) {
  return GIFTS[giftId] || null
}

function hasGiftInSlot(giftSlots, slotName) {
  return giftSlots && giftSlots[slotName] != null
}

function getGiftEffect(giftSlots, slotName) {
  return giftSlots && giftSlots[slotName] ? giftSlots[slotName] : null
}

// Get weapon gift effect for the current weapon type
function getWeaponGiftEffect(giftSlots, weaponType) {
  var slot = giftSlots && giftSlots.weapon
  if (!slot) return null
  // The weapon slot stores { giftId, weaponType, ...effect }
  // Only active if current weapon matches the type it was applied to
  if (slot.appliedWeaponType && slot.appliedWeaponType !== weaponType) return null
  return slot
}

// Check if a gift effect should trigger based on chance
function rollGiftChance(chance) {
  return Math.random() < chance
}

// Upgrade damage die (for ember — future)
function upgradeDamageDie(die) {
  var ladder = [4, 6, 8, 10, 12]
  var idx = ladder.indexOf(die)
  if (idx === -1 || idx >= ladder.length - 1) return die
  return ladder[idx + 1]
}

export {
  GIFTS,
  getGiftDef,
  hasGiftInSlot,
  getGiftEffect,
  getWeaponGiftEffect,
  rollGiftChance,
  upgradeDamageDie,
}
