import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Attack, d20Flee } from '../lib/dice.js'
import { generateGardenZone, generateFloor, generateChamberContent, getAdjacentChambers, getDoorDirection, ZONES, FLOORS } from '../lib/dungeon.js'
import { db } from '../lib/firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { generateCombatLoot, generateChestLoot, getMerchantItems, getItem, getItemsByType, applyConsumable, ITEMS } from '../lib/loot.js'
import { resolveSearch, applySearch, inspectPile, getAvailableCleanLevels, inspectJunkItem, consumeJunk, getTreasure, CLEAN_CONFIG } from '../lib/junkpiles.js'
import { createBattleState, getCurrentTurnId, getActor, tickTurnStart, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import { generateCombatEnemies } from '../lib/enemies.js'
import { getGiftDef, getGiftEffect, getWeaponGiftEffect, rollGiftChance } from '../lib/gifts.js'
import { isFleeBlocked, areItemsBlocked, applyCondition as applyConditionToEffects, checkConditionReactions } from '../lib/conditions.js'
import conditionsData from '../data/conditions.json'
import dialogueData from '../data/dialogue.json'
import themeData from '../data/themes.json'
import montorDialogue from '../data/montor-dialogue.json'
import { hasGroqKey, generateWhisper, generateSafeRoomLine, generateTreasureReaction, generateTreasureFollowUp } from '../lib/groq.js'
import progressionData from '../data/progression.json'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import PlayerSprite from '../components/PlayerSprite.jsx'
import CombatRoller from '../components/CombatRoller.jsx'
import StatPicker from '../components/StatPicker.jsx'
import ConditionIcon from '../components/ConditionIcon.jsx'
import ChamberView from '../components/ChamberView.jsx'
import DoorSprite from '../components/DoorSprite.jsx'
import ChamberIcon from '../components/ChamberIcon.jsx'

var MAX_LOG_ENTRIES = 6

// Condition ID → display name (e.g. "BLEED" → "Bleeding", "FEAR" → "Afraid")
function condName(id) {
  var c = conditionsData.conditions[id]
  return c ? c.name : id
}

// Direction labels
var DIR_LABELS = { N: 'North', S: 'South', E: 'East', W: 'West' }

var MONTOR_WHISPERS = dialogueData.montorWhispers

// Rarity colour system
var RARITY_COLOURS = {
  common: { text: 'text-ink', border: 'border-border', bg: 'bg-surface', label: '' },
  uncommon: { text: 'text-green-400', border: 'border-green-500/40', bg: 'bg-green-500/5', label: 'Uncommon' },
  rare: { text: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/5', label: 'Rare' },
  epic: { text: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/5', label: 'Epic' },
  legendary: { text: 'text-gold', border: 'border-gold/60', bg: 'bg-gold/5', label: 'Legendary' },
  heirloom: { text: 'text-crimson', border: 'border-crimson/60', bg: 'bg-crimson/5', label: 'Heirloom' },
}
function rarityCol(rarity) { return RARITY_COLOURS[rarity] || RARITY_COLOURS.common }

// Canonical stat order — used everywhere stats are displayed
var STAT_ORDER = [
  { id: 'str', label: 'STR', hint: 'Attack + damage' },
  { id: 'def', label: 'DEF', hint: 'Damage reduction' },
  { id: 'agi', label: 'AGI', hint: 'Initiative + dodge' },
  { id: 'vit', label: 'VIT', hint: 'Max HP' },
  { id: 'int', label: 'INT', hint: 'Conditions + enchant dmg' },
  { id: 'lck', label: 'LCK', hint: 'Crits + loot' },
  { id: 'per', label: 'PER', hint: 'Searching' },
  { id: 'end', label: 'END', hint: 'HP regen per room' },
  { id: 'wis', label: 'WIS', hint: 'Gift power' },
  { id: 'cha', label: 'CHA', hint: 'Merchant prices' },
]

// Helper: collect all equipped items that can have passive effects
function getAllPassiveItems(equipped) {
  var items = []
  if (!equipped) return items
  if (equipped.relics) { for (var i = 0; i < equipped.relics.length; i++) items.push(equipped.relics[i]) }
  if (equipped.rings) { for (var ri = 0; ri < equipped.rings.length; ri++) items.push(equipped.rings[ri]) }
  if (equipped.armour) items.push(equipped.armour)
  if (equipped.helmet) items.push(equipped.helmet)
  if (equipped.boots) items.push(equipped.boots)
  if (equipped.amulet) items.push(equipped.amulet)
  return items
}

// Helper: get active set bonuses from equipped items
function getSetBonuses(equipped) {
  if (!equipped) return []
  var items = getAllPassiveItems(equipped)
  // Also count weapon and offhand for sets
  if (equipped.weapon) items.push(equipped.weapon)
  if (equipped.offhand) items.push(equipped.offhand)

  // Count pieces per setId
  var setCounts = {}
  for (var i = 0; i < items.length; i++) {
    if (items[i].setId) {
      setCounts[items[i].setId] = (setCounts[items[i].setId] || 0) + 1
    }
  }

  // Collect active bonuses — use highest threshold reached
  var bonuses = []
  for (var setId in setCounts) {
    var count = setCounts[setId]
    // Find any item with setBonuses for this setId
    for (var si = 0; si < items.length; si++) {
      if (items[si].setId === setId && items[si].setBonuses) {
        // Find highest active threshold
        for (var threshold = count; threshold >= 2; threshold--) {
          var bonus = items[si].setBonuses[String(threshold)]
          if (bonus) {
            bonuses.push(bonus)
            break
          }
        }
        break // only need one item's setBonuses definition
      }
    }
  }
  return bonuses
}

// Helper: get total passive value from all equipped items + set bonuses
function getPassiveTotal(equipped, effectName) {
  var total = 0
  var items = getAllPassiveItems(equipped)
  for (var i = 0; i < items.length; i++) {
    if (items[i].passiveEffect === effectName) total += (items[i].passiveValue || 0)
  }
  // Add set bonus contributions
  var setBonuses = getSetBonuses(equipped)
  for (var si = 0; si < setBonuses.length; si++) {
    if (setBonuses[si].passiveEffect === effectName) total += (setBonuses[si].passiveValue || 0)
    if (setBonuses[si].secondEffect === effectName) total += (setBonuses[si].secondValue || 0)
  }
  return total
}

// Helper: check if equipped items block a condition (immunity or resist roll)
// Returns { blocked: bool, type: 'immune'|'resisted'|null }
function checkConditionResist(equipped, conditionId) {
  if (!equipped) return { blocked: false, type: null }
  var items = getAllPassiveItems(equipped)
  var resistChance = 0
  for (var i = 0; i < items.length; i++) {
    var r = items[i]
    // Full immunity
    if (r.passiveEffect === 'condition_immunity' && r.passiveCondition === conditionId) {
      return { blocked: true, type: 'immune' }
    }
    // Single condition resist — stacks additively
    if (r.passiveEffect === 'condition_resist' && r.passiveCondition === conditionId) {
      resistChance += (r.passiveValue || 0)
    }
    // Multi condition resist
    if (r.passiveEffect === 'condition_resist_multi' && r.passiveConditions && r.passiveConditions.indexOf(conditionId) !== -1) {
      resistChance += (r.passiveValue || 0)
    }
    // All condition resist
    if (r.passiveEffect === 'condition_resist_all') {
      resistChance += (r.passiveValue || 0)
    }
  }
  resistChance = Math.min(resistChance, 1.0) // cap at 100%
  if (resistChance > 0 && Math.random() < resistChance) {
    return { blocked: true, type: 'resisted' }
  }
  return { blocked: false, type: null }
}

// Backwards compat wrapper
function hasConditionImmunity(equipped, conditionId) {
  return checkConditionResist(equipped, conditionId).blocked
}

// Map chamber types to centre icon keys (after clearing)
function getChamberIconKey(type) {
  if (type === 'combat_standard' || type === 'combat_elite' || type === 'mini_boss') return 'corpse'
  if (type === 'loot' || type === 'hidden') return 'chest'
  if (type === 'merchant' || type === 'quest_npc') return 'npc'
  if (type === 'shrine') return 'shrine'
  if (type === 'trap') return 'trap'
  if (type === 'stairwell_descent') return 'stairs_down'
  return null
}

function formatAttackLog(r, type) {
  var who = r.attacker
  var target = r.target
  var tier = r.attackRoll.tierName
  var defeated = type === 'player'
    ? (r.enemyDefeated ? ' It crumbles.' : '')
    : (r.playerDowned ? ' You collapse.' : '')

  var text
  if (tier === 'crit') {
    text = who + ' lands a devastating blow on ' + target + '! ' + r.damage + ' damage.' + defeated
  } else if (tier === 'hit') {
    text = who + ' strikes ' + target + ' for ' + r.damage + ' damage.' + defeated
  } else if (tier === 'glancing') {
    text = who + ' grazes ' + target + '. ' + r.damage + ' damage.' + defeated
  } else {
    text = who + ' swings at ' + target + ' but misses.'
  }

  return { text: text, tier: tier }
}

// ============================================================
// Game — first-person dungeon crawl + combat
// ============================================================

function Game({ character, user, onEndRun, savedRun, onSaveRun }) {
  // --- Dungeon state ---
  var [floor, setFloor] = useState(null)
  var [zone, setZone] = useState(null)
  // Phases: doors | entering | chamber | combat | victory | defeat | safe_room | floor_transition
  var [gamePhase, setGamePhase] = useState('doors')
  var [chamberContent, setChamberContent] = useState(null)
  var [totalXp, setTotalXp] = useState(0)
  var [lastXpGained, setLastXpGained] = useState(0)
  var [playerHp, setPlayerHp] = useState(character.maxHp)
  var [playerGold, setPlayerGold] = useState(character.gold || 0)
  var [chambersCleared, setChambersCleared] = useState(0)
  var [previousPosition, setPreviousPosition] = useState(null)
  var [playerInventory, setPlayerInventory] = useState(character.inventory ? character.inventory.slice() : [])
  var [activeBuffs, setActiveBuffs] = useState([])
  var [hasZoneKey, setHasZoneKey] = useState(false)
  var [floorsCompleted, setFloorsCompleted] = useState([])
  var [collectedTreasures, setCollectedTreasures] = useState([])
  var [runLevel, setRunLevel] = useState(0)
  var [pendingLevelUp, setPendingLevelUp] = useState(null) // { hpGain, statPick } or null

  // Montor's mood system — tidiness, greed, taste
  var [floorDisturbance, setFloorDisturbance] = useState(0)
  var [maxFloorDisturbance, setMaxFloorDisturbance] = useState(0)
  var [greedScore, setGreedScore] = useState(0)
  var MONTOR_PERSONALITIES = [
    { id: 'melancholy', label: 'Melancholy', desc: 'Sad old monster missing the old days. Talks about Gran and the past.' },
    { id: 'paranoid', label: 'Paranoid', desc: 'Convinced the player was sent by someone. Suspicious of everything.' },
    { id: 'comedic', label: 'Comedic', desc: 'Actually witty — dry humour, observational comedy, absurdist one-liners. Roasts the player affectionately. Self-deprecating about his own dungeon. Think British sitcom deadpan, not dad jokes.' },
    { id: 'proud', label: 'Proud', desc: 'Insufferably proud of his dungeon. Points out architecture and craftsmanship.' },
    { id: 'lonely', label: 'Lonely', desc: 'Just wants someone to talk to. Tries to keep the conversation going.' },
    { id: 'vengeful', label: 'Vengeful', desc: 'Actively hostile. Holds grudges. References past destruction.' },
    { id: 'passive_aggressive', label: 'Passive Aggressive', desc: 'Polite but seething. Says "fine" when it is not fine.' },
    { id: 'mum_mode', label: 'Mum Mode', desc: 'Channelling his mum. Tells you to eat, wipe your feet, wear a coat.' },
    { id: 'dramatic', label: 'Dramatic', desc: 'Everything is the worst thing ever. Theatrical gasps and declarations.' },
    { id: 'sleepy', label: 'Sleepy', desc: 'Groggy, confused, grumpy about being woken up. Yawns mid-sentence.' },
    { id: 'philosophical', label: 'Philosophical', desc: 'Deep thoughts. Questions existence. Ponders the meaning of gnomes.' },
    { id: 'petty', label: 'Petty', desc: 'Fixated on tiny grievances. You moved a chair 2 inches.' },
    { id: 'chef', label: 'Chef', desc: 'Obsessed with food and cooking. Every weapon is a kitchen utensil to him.' },
    { id: 'estate_agent', label: 'Estate Agent', desc: 'Trying to sell you on the dungeon. Open plan, south-facing, original features.' },
    { id: 'bureaucratic', label: 'Bureaucratic', desc: 'Treats the dungeon like an office. Wants forms filled in and procedures followed.' },
    { id: 'bad_montor', label: 'Bad Montor', desc: 'Evil villain mode. Monologues about his master plan. Calls himself "Lord Montor". Dramatically evil but incompetent. Think cartoon villain who keeps failing. Threatens doom but trips over his own dungeon.' },
  ]

  var [montorPersonality, setMontorPersonality] = useState(function() {
    // Check if user selected a specific personality
    try {
      var pick = localStorage.getItem('dom_montor_personality') || 'random'
      if (pick !== 'random') {
        var found = MONTOR_PERSONALITIES.find(function(p) { return p.id === pick })
        if (found) return found
      }
    } catch (e) { /* ignore */ }
    return MONTOR_PERSONALITIES[Math.floor(Math.random() * MONTOR_PERSONALITIES.length)]
  })

  var [montorTaste, setMontorTaste] = useState(function() {
    var stats = ['str', 'def', 'agi', 'int', 'lck', 'per', 'end', 'wis', 'cha', 'vit']
    var shuffled = stats.slice().sort(function() { return Math.random() - 0.5 })
    return { favours: shuffled[0], dislikes: shuffled[1] }
  })

  // Gift system — Montor's sacrificed treasures, one per slot
  var [giftSlots, setGiftSlots] = useState({ body: null, mind: null, weapon: null, shield: null })
  var [unlockedGifts, setUnlockedGifts] = useState(character.godAllGifts ? ['petal', 'stone', 'bile', 'blood', 'ember', 'void'] : [])
  var [showGiftPicker, setShowGiftPicker] = useState(false)
  var [giftPickerSlot, setGiftPickerSlot] = useState(null) // which slot is being configured
  var [giftPickerGift, setGiftPickerGift] = useState(null) // which gift is selected for slot
  var [safeRoomStep, setSafeRoomStep] = useState('arrival') // arrival | offering | pick_slot | pick_option | smashed | done
  var [safeRoomGift, setSafeRoomGift] = useState(null) // the treasure being offered
  var [safeRoomSlotChoice, setSafeRoomSlotChoice] = useState(null) // body | mind | weapon | shield
  var [sporeCloudUsed, setSporeCloudUsed] = useState(false) // per-combat flag for Spore Cloud
  var [bedrockCharges, setBedrockCharges] = useState(0) // Bedrock: hits remaining at 1 damage
  var [erupted, setErupted] = useState(false) // Eruption: once per combat AoE
  var [shadowStepUsed, setShadowStepUsed] = useState(false) // Shadow Step: first hit auto-miss
  var [chaosRerollUsed, setChaosRerollUsed] = useState(false) // Chaos Reroll: force reroll
  var [ironWillUsed, setIronWillUsed] = useState(false) // Iron Will: survive lethal once
  var [harvestBuff, setHarvestBuff] = useState(0) // Harvest: bonus damage from kills
  var [killsThisCombat, setKillsThisCombat] = useState(0) // Scent of Blood: kill counter
  var [activeBombs, setActiveBombs] = useState([]) // Timed bombs: { name, fuseLeft, explosionDamage, explosionCondition, explosionCondition2, explosionStacks, explosionRandomCondition, explosionAoe }
  var [reflectNextAttack, setReflectNextAttack] = useState(false) // Mirror: reflect next enemy attack
  var [hitsTakenThisCombat, setHitsTakenThisCombat] = useState(0) // Stoneskin Mend: count hits for end-of-combat heal
  var [phoenixSparkUsed, setPhoenixSparkUsed] = useState(false) // Phoenix Spark: once per combat threshold heal
  var [tremorWaveUsed, setTremorWaveUsed] = useState(false) // Tremor Wave: once per combat AoE

  // Calculate max possible disturbance for a zone (sum of all pile layers × deep clean cost)
  function calcMaxDisturbance(z) {
    if (!z || !z.chambers) return 0
    var total = 0
    for (var ci = 0; ci < z.chambers.length; ci++) {
      var piles = z.chambers[ci].junkPiles
      if (piles) {
        for (var pi = 0; pi < piles.length; pi++) {
          total += (piles[pi].totalLayers || piles[pi].layersRemaining || 0)
        }
      }
    }
    return total * 6 // 6 = max disturbance per layer (deep clean)
  }

  // Montor mood derivation
  function getMontorMood() {
    var tidiness = maxFloorDisturbance > 0 ? 1 - (floorDisturbance / maxFloorDisturbance) : 1
    if (tidiness >= 0.8) return greedScore < 10 ? 'happy' : 'happy' // pristine is always happy (greed affects tonic count, not mood)
    if (tidiness >= 0.6) return 'neutral'
    if (tidiness >= 0.4) return 'annoyed'
    return 'angry'
  }

  function getTidinessSummary() {
    var tidiness = maxFloorDisturbance > 0 ? 1 - (floorDisturbance / maxFloorDisturbance) : 1
    if (tidiness >= 0.8) return { label: 'As I left it', colour: 'text-green-400', desc: 'You barely touched anything.' }
    if (tidiness >= 0.6) return { label: 'Tolerable', colour: 'text-emerald-400', desc: 'A few things out of place.' }
    if (tidiness >= 0.4) return { label: 'Disturbed', colour: 'text-amber-400', desc: 'He can tell you\'ve been rummaging.' }
    return { label: 'Violated', colour: 'text-red-400', desc: 'You\'ve torn his home apart.' }
  }

  function getMontorLine(category) {
    var mood = getMontorMood()
    var lines = montorDialogue[category] && montorDialogue[category][mood]
    if (!lines || lines.length === 0) return ''
    return lines[Math.floor(Math.random() * lines.length)]
  }

  var XP_THRESHOLDS = progressionData.xpThresholds

  function checkLevelUp(newXp) {
    if (runLevel >= XP_THRESHOLDS.length) return false
    var threshold = XP_THRESHOLDS[runLevel]
    if (!threshold) return false
    if (newXp >= threshold.xp) {
      // Apply HP gain immediately
      if (threshold.hpGain > 0) {
        character.maxHp += threshold.hpGain
        setPlayerHp(function(hp) { return Math.min(hp + threshold.hpGain, character.maxHp) })
      }
      if (threshold.statPick) {
        setPendingLevelUp({ hpGain: threshold.hpGain, statPick: true, level: runLevel + 1 })
      } else {
        setPendingLevelUp({ hpGain: threshold.hpGain, statPick: false, level: runLevel + 1 })
      }
      setRunLevel(runLevel + 1)
      return true
    }
    return false
  }

  function handleStatPick(stat) {
    character.stats[stat] = (character.stats[stat] || 10) + 1
    // Also update battle state if in combat
    if (battle && battle.players[user.uid]) {
      var bs = Object.assign({}, battle)
      var newPlayers = {}
      Object.keys(bs.players).forEach(function(uid) {
        newPlayers[uid] = Object.assign({}, bs.players[uid], {
          combatStats: Object.assign({}, bs.players[uid].combatStats),
          statusEffects: bs.players[uid].statusEffects.slice(),
        })
        if (uid === user.uid) {
          newPlayers[uid].combatStats[stat] = (newPlayers[uid].combatStats[stat] || 10) + 1
        }
      })
      bs.players = newPlayers
      setBattle(bs)
    }
    setPendingLevelUp(null)
  }

  function handleLevelUpDismiss() {
    setPendingLevelUp(null)
  }

  var [showInventoryPanel, setShowInventoryPanel] = useState(false)
  var [showCharPanel, setShowCharPanel] = useState(false)
  var [combatItemPhase, setCombatItemPhase] = useState(null) // null | 'use' | 'throw'
  var [consumeResult, setConsumeResult] = useState(null) // { success, narrative, junkName }
  var [expandedJunkId, setExpandedJunkId] = useState(null)
  var [inventoryTab, setInventoryTab] = useState('equipped')
  var [inventorySort, setInventorySort] = useState('rarity') // rarity | damage | def | name
  var [selectedItemIdx, setSelectedItemIdx] = useState(null)

  // --- Run tracking (for balance logging) ---
  var [runStats, setRunStats] = useState({
    enemiesDefeated: 0,
    enemiesFled: 0,
    itemsUsed: 0,
    damageDealt: 0,
    damageTaken: 0,
    critsLanded: 0,
    critsReceived: 0,
    killedBy: null,
    killedByTier: null,
    killedInChamber: null,
  })

  var godModeRef = useRef(false)
  var transitionGuardRef = useRef(0)
  var combatGuardRef = useRef(0)

  // Block taps for 400ms after screen transitions to prevent bleed-through
  function guardedSetPhase(phase) {
    transitionGuardRef.current = Date.now()
    setGamePhase(phase)
  }
  function isGuarded() {
    return Date.now() - transitionGuardRef.current < 400
  }
  // Combat-specific guard — block input for 350ms after combat phase changes
  function guardedSetCombatPhase(phase) {
    combatGuardRef.current = Date.now()
    setCombatPhase(phase)
  }
  function isCombatGuarded() {
    return Date.now() - combatGuardRef.current < 350
  }

  // --- Debug helpers (call from browser console: window.domDebug.xxx()) ---
  useEffect(function() {
    window.domDebug = {
      giveItems: function() {
        var ids = ['health_potion', 'health_potion', 'rage_draught', 'smoke_bomb', 'dagger_common', 'shortsword_common', 'leather_common', 'montors_signet_ring', 'montors_lucky_penny', 'montors_pruning_shears', 'antidote', 'montors_bath_bomb']
        var debugItems = ids.map(function(id) { return getItem(id) }).filter(Boolean)
        setPlayerInventory(function(prev) { return prev.concat(debugItems) })
        setPlayerGold(function(g) { return g + 200 })
        console.log('Added 9 items + 200 gold')
      },
      heal: function() {
        setPlayerHp(character.maxHp)
        if (battle && battle.players[user.uid]) {
          var bs = Object.assign({}, battle)
          var np = {}
          Object.keys(bs.players).forEach(function(uid) {
            np[uid] = Object.assign({}, bs.players[uid], { combatStats: Object.assign({}, bs.players[uid].combatStats), statusEffects: bs.players[uid].statusEffects.slice() })
            if (uid === user.uid) np[uid].currentHp = character.maxHp
          })
          bs.players = np
          setBattle(bs)
        }
        console.log('Healed to ' + character.maxHp)
      },
      gold: function(n) { setPlayerGold(function(g) { return g + (n || 100) }); console.log('Added ' + (n || 100) + ' gold') },
      hp: function() { console.log('HP: ' + playerHp + '/' + character.maxHp + ' | Gold: ' + playerGold + ' | Items: ' + playerInventory.length) },
      god: function() { godModeRef.current = !godModeRef.current; console.log('God mode: ' + (godModeRef.current ? 'ON — one-hit kills' : 'OFF')) },
    }
    return function() { delete window.domDebug }
  }, [playerHp, playerGold, playerInventory, character])

  function trackStat(key, value) {
    setRunStats(function(prev) {
      var next = Object.assign({}, prev)
      if (typeof value === 'number') {
        next[key] = (next[key] || 0) + value
      } else {
        next[key] = value
      }
      return next
    })
  }

  // --- Combat state ---
  var [battle, setBattle] = useState(null)
  var [combatPhase, setCombatPhase] = useState('intro')
  var [selectedTarget, setSelectedTarget] = useState(null)
  var [combatLog, setCombatLog] = useState([])
  var [pendingAttackResult, setPendingAttackResult] = useState(null)
  var [enemyAttackInfo, setEnemyAttackInfo] = useState(null)
  var [enemyBehaviourMsg, setEnemyBehaviourMsg] = useState(null) // { name, text } for non-attack actions
  var [enemyConditionMsg, setEnemyConditionMsg] = useState(null) // condition tick message for enemy turn display
  var [enemyRollerKey, setEnemyRollerKey] = useState(0)
  var [lootableCorpses, setLootableCorpses] = useState([])
  var [lootingCorpseId, setLootingCorpseId] = useState(null)
  var [lootingChestId, setLootingChestId] = useState(null)
  var [lootingNpcId, setLootingNpcId] = useState(null)
  var [montorWhisper, setMontorWhisper] = useState(null)
  var [searchingPileId, setSearchingPileId] = useState(null)
  var [searchResult, setSearchResult] = useState(null)
  var [playerJunkBag, setPlayerJunkBag] = useState(function() {
    if (character.godAllGifts) {
      var allFloors = ['grounds', 'underground', 'underbelly', 'quarters', 'works', 'deep']
      var treasures = []
      for (var fi = 0; fi < allFloors.length; fi++) {
        var t = getTreasure(allFloors[fi])
        if (t) treasures.push(Object.assign({}, t, { isTreasure: true, count: 1 }))
      }
      return treasures
    }
    return []
  })
  var logRef = useRef(null)

  // Init floor — restore from save or start fresh at Garden
  useEffect(function() {
    window.scrollTo(0, 0)
    if (savedRun) {
      // Restore all state from saved run
      setPlayerHp(savedRun.playerHp)
      setPlayerGold(savedRun.playerGold)
      setPlayerInventory(savedRun.playerInventory || [])
      setPlayerJunkBag(savedRun.playerJunkBag || [])
      setChambersCleared(savedRun.chambersCleared || 0)
      setFloorsCompleted(savedRun.floorsCompleted || [])
      setCollectedTreasures(savedRun.collectedTreasures || [])
      setHasZoneKey(savedRun.hasZoneKey || false)
      setTotalXp(savedRun.totalXp || 0)
      setRunLevel(savedRun.runLevel || 0)
      setGiftSlots(savedRun.giftSlots || { body: null, mind: null, weapon: null, shield: null })
      setUnlockedGifts(savedRun.unlockedGifts || [])
      setActiveBuffs(savedRun.activeBuffs || [])
      setRunStats(savedRun.runStats || { enemiesDefeated: 0, enemiesFled: 0, itemsUsed: 0, damageDealt: 0, damageTaken: 0, critsLanded: 0, critsReceived: 0, killedBy: null, killedByTier: null, killedInChamber: null })
      // Restore character mutable fields (maxHp changes from level-ups)
      if (savedRun.character) {
        character.maxHp = savedRun.character.maxHp
        character.stats = savedRun.character.stats
        character.equipped = savedRun.character.equipped
        character.level = savedRun.character.level
      }
      // Regenerate floor structure but use saved zone state
      var restoredFloorId = savedRun.floorId || 'grounds'
      var f = generateFloor(restoredFloorId, savedRun.collectedTreasures || [])
      // Replace the matching zone with saved state (preserves visited/cleared/corpses/junk)
      if (savedRun.zone) {
        f.zones = f.zones.map(function(z) {
          if (z.zoneId === savedRun.zone.zoneId) return savedRun.zone
          return z
        })
        setZone(savedRun.zone)
      } else {
        setZone(f.zones[0])
      }
      setFloor(f)
      setMaxFloorDisturbance(calcMaxDisturbance(savedRun.zone || f.zones[0]))
      setFloorDisturbance(savedRun.floorDisturbance || 0)
      setGreedScore(savedRun.greedScore || 0)
      if (savedRun.montorTaste) setMontorTaste(savedRun.montorTaste)
      if (savedRun.montorPersonality) setMontorPersonality(savedRun.montorPersonality)
      setGamePhase('doors')
    } else {
      var f = generateFloor('grounds', collectedTreasures)
      setFloor(f)
      setZone(f.zones[0])
      setHasZoneKey(false)
      setMaxFloorDisturbance(calcMaxDisturbance(f.zones[0]))
      setFloorDisturbance(0)
      setGamePhase('doors')
    }
  }, [])

  // Save run state — triggered by setting savePending, runs after React state flushes
  var [savePending, setSavePending] = useState(false)

  useEffect(function() {
    if (!savePending || !onSaveRun || !floor) return
    setSavePending(false)
    onSaveRun({
      character: character,
      playerHp: playerHp,
      playerGold: playerGold,
      playerInventory: playerInventory,
      playerJunkBag: playerJunkBag,
      floorId: floor ? floor.floorId : 'grounds',
      zone: zone,
      chambersCleared: chambersCleared,
      floorsCompleted: floorsCompleted,
      collectedTreasures: collectedTreasures,
      hasZoneKey: hasZoneKey,
      totalXp: totalXp,
      runLevel: runLevel,
      giftSlots: giftSlots,
      unlockedGifts: unlockedGifts,
      activeBuffs: activeBuffs,
      runStats: runStats,
      floorDisturbance: floorDisturbance,
      greedScore: greedScore,
      montorTaste: montorTaste,
      montorPersonality: montorPersonality,
    })
  }, [savePending])

  function triggerSave() { setSavePending(true) }

  useEffect(function() {
    // logRef scroll removed — now showing last 2 entries only
  }, [combatLog])

  // --- Get available doors from current position ---
  function getAvailableDoors() {
    if (!zone) return []
    var chamber = zone.chambers[zone.playerPosition]
    var doors = []
    if (chamber.doors.N) doors.push({ dir: 'N', targetId: chamber.id - 4 })
    if (chamber.doors.S) doors.push({ dir: 'S', targetId: chamber.id + 4 })
    if (chamber.doors.E) doors.push({ dir: 'E', targetId: chamber.id + 1 })
    if (chamber.doors.W) doors.push({ dir: 'W', targetId: chamber.id - 1 })
    return doors
  }

  // --- Navigation: pick a door ---
  function handlePickDoor(targetId) {
    if (targetId < 0 || targetId >= 16 || !zone.chambers[targetId]) {
      setGamePhase('doors') // defensive: invalid door target
      return
    }
    setPreviousPosition(zone.playerPosition)
    setLootingCorpseId(null)
    setLootingChestId(null)
    setLootingNpcId(null)
    setShowInventoryPanel(false)
    setShowCharPanel(false)
    // Reset any open search state
    if (searchDiceRef.current) clearInterval(searchDiceRef.current)
    if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); searchTimeoutRef.current = null }
    setSearchPhase(null)
    setSearchResult(null)
    setSearchingPileId(null)
    setSearchDiceDisplay(null)
    setSearchSaveDiceDisplay(null)

    var newZone = Object.assign({}, zone, {
      playerPosition: targetId,
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === targetId) return Object.assign({}, ch, { visited: true })
        return ch
      })
    })
    setZone(newZone)

    var chamber = newZone.chambers[targetId]

    // Passive regen on entering NEW chambers — baseline 1 HP + relic bonuses
    if (!chamber.cleared && !chamber.corpses) {
      var endMod = Math.max(0, getModifier(character.stats.end || 10))
      var regenAmount = 1 + endMod + getPassiveTotal(character.equipped, 'regen_per_chamber')
      // Bloom gift: extra HP per chamber
      var bodyGift = giftSlots.body
      if (bodyGift && bodyGift.effect === 'chamber_heal') regenAmount += bodyGift.value
      setPlayerHp(function(hp) { return Math.min(hp + regenAmount, character.maxHp) })
    }

    // Pick a static whisper — 40% personality, 30% room entry, 30% atmospheric
    function pickStaticWhisper(mood) {
      var roll = Math.random()
      var personalityPool = montorDialogue.personalityWhispers && montorDialogue.personalityWhispers[montorPersonality.id]
      if (roll < 0.4 && personalityPool && personalityPool.length > 0) {
        return personalityPool[Math.floor(Math.random() * personalityPool.length)]
      } else if (roll < 0.7) {
        var roomPool = montorDialogue.roomEntry[mood] || montorDialogue.roomEntry.neutral
        return roomPool[Math.floor(Math.random() * roomPool.length)]
      } else {
        var whisperPool = montorDialogue.whispers[mood] || montorDialogue.whispers.neutral
        return whisperPool[Math.floor(Math.random() * whisperPool.length)]
      }
    }

    // Montor whisper — 30% chance on entering a new room
    if (Math.random() < 0.3) {
      var mood = getMontorMood()
      // Try AI whisper first, fall back to static
      if (hasGroqKey()) {
        var tidySummary = getTidinessSummary()
        generateWhisper({ mood: mood, tidiness: tidySummary.label, greedScore: greedScore, floorName: floor ? floor.floorName : 'unknown', personality: montorPersonality }).then(function(result) {
          if (result && result.whisper) {
            setMontorWhisper(result.whisper)
          } else {
            // Fallback to static — mix mood, room entry, and personality
            setMontorWhisper(pickStaticWhisper(mood))
          }
          setTimeout(function() { setMontorWhisper(null) }, 6000)
        })
      } else {
        setMontorWhisper(pickStaticWhisper(mood))
        setTimeout(function() { setMontorWhisper(null) }, 6000)
      }
    } else {
      setMontorWhisper(null)
    }

    // If already cleared or has corpses (fought), just show doors (backtracking)
    if (chamber.cleared || chamber.corpses) {
      setGamePhase('doors')
      triggerSave()
      return
    }

    // If chest/npc already visited, show room without regenerating content
    if ((chamber.chest && chamber.chest.opened) || chamber.npc) {
      setChamberContent(null)
      setGamePhase('doors')
      triggerSave()
      return
    }

    var zoneDef = ZONES[newZone.zoneId] || null
    var content = generateChamberContent(chamber, 'seasoned', zoneDef)
    setChamberContent(content)

    // --- Combat chambers ---
    if (content && content.enemies) {
      setGamePhase('entering')
      setTimeout(function() {
        startCombat(content.enemies, newZone, targetId)
      }, 800)
    }
    // --- Keystone chamber --- press to unlock stairwell
    else if (chamber.type === 'keystone') {
      // Auto-mark as keystone in doors view — player interacts there
      newZone = Object.assign({}, newZone, {
        chambers: newZone.chambers.map(function(ch) {
          if (ch.id === targetId) return Object.assign({}, ch, { isKeystone: true })
          return ch
        })
      })
      setZone(newZone)
      setChamberContent(null)
      setGamePhase('doors')
    }
    // --- Zone door --- locked until key obtained
    else if (chamber.type === 'zone_door') {
      newZone = Object.assign({}, newZone, {
        chambers: newZone.chambers.map(function(ch) {
          if (ch.id === targetId) return Object.assign({}, ch, { isZoneDoor: true })
          return ch
        })
      })
      setZone(newZone)
      setChamberContent(null)
      setGamePhase('doors')
    }
    // --- Stairwell descent --- locked until keystone pressed + boss defeated
    else if (chamber.type === 'stairwell_descent') {
      // Handled in doors view — shows locked/unlocked state
      setZone(newZone)
      setChamberContent(null)
      setGamePhase('doors')
    }
    // --- Loot / Hidden --- chest entity
    else if (content && (chamber.type === 'loot' || chamber.type === 'hidden')) {
      var chestItems = []
      if (content.item) chestItems.push(content.item)
      var chest = {
        id: 'chest_' + targetId,
        gold: content.gold || 0,
        items: chestItems,
        goldTaken: false,
        itemsTaken: [],
        opened: false,
        label: chamber.type === 'hidden' ? 'Hidden Cache' : 'Chest',
      }
      newZone = Object.assign({}, newZone, {
        chambers: newZone.chambers.map(function(ch) {
          if (ch.id === targetId) return Object.assign({}, ch, { chest: chest })
          return ch
        })
      })
      setZone(newZone)
      setChamberContent(null)
      setGamePhase('doors')
    }
    // --- Merchant / Quest NPC --- NPC entity
    else if (content && (chamber.type === 'merchant' || chamber.type === 'quest_npc')) {
      var zoneDef2 = ZONES[newZone.zoneId] || null
      var npc = {
        id: 'npc_' + targetId,
        type: chamber.type,
        vendorType: content.vendorType || (chamber.type === 'merchant' ? 'tailor' : 'peddler'),
        name: chamber.type === 'merchant' ? (zoneDef2 && zoneDef2.merchantName ? zoneDef2.merchantName : 'Vendor') : (content.npcName || 'Peddler'),
        role: chamber.type === 'merchant' ? (zoneDef2 && zoneDef2.merchantRole ? zoneDef2.merchantRole : '') : 'Shouldn\'t be down here.',
        description: content.description,
        items: content.items || [],
        reward: null,
        interacted: false,
        showSell: false,
      }
      newZone = Object.assign({}, newZone, {
        chambers: newZone.chambers.map(function(ch) {
          if (ch.id === targetId) return Object.assign({}, ch, { npc: npc })
          return ch
        })
      })
      setZone(newZone)
      setChamberContent(null)
      setGamePhase('doors')
    }
    // --- Rest chamber --- interactable in doors view
    else if (content && chamber.type === 'rest') {
      newZone = Object.assign({}, newZone, {
        chambers: newZone.chambers.map(function(ch) {
          if (ch.id === targetId) return Object.assign({}, ch, { restAvailable: true, restHealPercent: content.hpRecovery || 0.25, restDescription: content.description })
          return ch
        })
      })
      setZone(newZone)
      setChamberContent(null)
      setGamePhase('doors')
    }
    // --- Everything else --- ChamberView (trap, event, etc.)
    else {
      setGamePhase('chamber')
    }
  }

  // --- Rest interaction ---
  function handleRest() {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.restAvailable) return
    var heal = Math.round(character.maxHp * (chamber.restHealPercent || 0.25))
    var newHp = Math.min(playerHp + heal, character.maxHp)
    setPlayerHp(newHp)
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { restAvailable: false, restUsed: true, restHealed: heal, cleared: true })
        return ch
      })
    })
    setZone(newZone)
    setChambersCleared(chambersCleared + 1)
  }

  // --- Junk pile search ---
  // Phases: null → 'choose' → 'rolling' → 'landed' → 'save_rolling' → 'save_landed' → 'reveal'
  var [searchPhase, setSearchPhase] = useState(null)
  var [searchDiceDisplay, setSearchDiceDisplay] = useState(null)
  var [searchSaveDiceDisplay, setSearchSaveDiceDisplay] = useState(null)
  var searchDiceRef = useRef(null)
  var searchTimeoutRef = useRef(null)

  // Step 1: Tap pile → inspect + show clean level choices
  function handleInspectPile(pileId) {
    if (searchPhase) return
    var chamber = zone.chambers[zone.playerPosition]
    var pile = chamber.junkPiles && chamber.junkPiles.find(function(p) { return p.id === pileId })
    if (!pile || pile.depleted) return

    inspectPile(pile, character.stats.per || 6)
    setZone(Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id !== zone.playerPosition) return ch
        return Object.assign({}, ch, { junkPiles: ch.junkPiles.slice() })
      })
    }))
    setSearchingPileId(pileId)
    setSearchPhase('choose')
  }

  // Step 2: Choose clean level → resolve → dice animation
  var searchLockedRef = useRef(false)
  function handleChooseCleanLevel(level) {
    if (searchPhase !== 'choose' || searchLockedRef.current) return
    searchLockedRef.current = true
    var chamber = zone.chambers[zone.playerPosition]
    var pile = chamber.junkPiles && chamber.junkPiles.find(function(p) { return p.id === searchingPileId })
    if (!pile || pile.depleted) return

    var result = resolveSearch(pile, character.stats.per || 6, character.stats.agi || 10, character.stats.lck || 10, level)
    if (!result) return

    applySearch(pile, level)
    setSearchResult(result)
    setSearchPhase('rolling')

    // Track disturbance for Montor's mood
    var disturbancePoints = { 1: 1, 2: 3, 3: 6 }
    setFloorDisturbance(function(d) { return d + (disturbancePoints[level] || 1) })

    // Dice roll animation — search roll
    var rollCount = 0
    searchDiceRef.current = setInterval(function() {
      setSearchDiceDisplay(Math.floor(Math.random() * 20) + 1)
      rollCount++
      if (rollCount > 12) {
        clearInterval(searchDiceRef.current)
        setSearchDiceDisplay(result.natRoll)
        setSearchPhase('landed')
        // Always wait for user tap — handleSearchTapContinue routes to save roll if danger exists
      }
    }, 80)
  }

  // Apply gold, xp, junk, items to player state
  function applySearchRewards(result) {
    // Overgrowth (mind gift): bonus gold from junk searches
    var goldBonus = 0
    if (giftSlots.mind && giftSlots.mind.effect === 'junk_gold_bonus') goldBonus = Math.round(result.gold * giftSlots.mind.value)
    if (result.gold > 0) setPlayerGold(function(g) { return g + result.gold + goldBonus })
    if (result.xp > 0) {
      var newXp = totalXp + result.xp
      setTotalXp(newXp)
      checkLevelUp(newXp)
    }
    if (result.junk) {
      setPlayerJunkBag(function(bag) {
        var existing = bag.find(function(j) { return j.id === result.junk.id })
        if (existing) {
          return bag.map(function(j) {
            if (j.id === result.junk.id) return Object.assign({}, j, { count: j.count + 1 })
            return j
          })
        }
        var newJunk = { id: result.junk.id, name: result.junk.name, sellPrice: result.junk.sellPrice, count: 1 }
        if (result.junk.consumable) {
          newJunk.consumable = true
          newJunk.consumeRisk = result.junk.consumeRisk
          newJunk.good = result.junk.good
          newJunk.bad = result.junk.bad
        }
        return bag.concat([newJunk])
      })
    }
    if (result.item) {
      setPlayerInventory(function(inv) { return inv.concat([Object.assign({}, result.item)]) })
    }
    // Treasure — Montor's gift artefact (goes in junk bag as a special item)
    if (result.treasure) {
      setCollectedTreasures(function(prev) { return prev.concat([result.treasure.id]) })
      setPlayerJunkBag(function(bag) {
        return bag.concat([{
          id: result.treasure.id, name: result.treasure.name,
          sellPrice: 0, count: 1, consumable: false,
          isTreasure: true, gift: result.treasure.gift,
          description: result.treasure.description,
        }])
      })
    }
    // Apply condition hazard — check immunity relics first, then DEF reduces physical damage
    if (result.condition && !result.agiSaved) {
      // Tremor Sense (stone mind): immune to trap damage/conditions from searches
      if (giftSlots.mind && giftSlots.mind.effect === 'search_trap_immunity') {
        result.trapImmune = true
        result.trapResistType = 'immune'
        result.condition = null
        result.trapDamage = 0
      }
      // Check condition resistance from relics (immunity, resist chance, multi, all)
      var resistResult = checkConditionResist(character.equipped, result.condition)
      if (resistResult.blocked) {
        result.trapImmune = true
        result.trapResistType = resistResult.type // 'immune' or 'resisted'
        result.condition = null // negated — but trap damage still applies
      }
      // Apply trap damage from search config (harsh flat damage)
      if (result.trapDamage && result.trapDamage > 0) {
        var physicalTraps = ['POISON', 'BLEED', 'BURN', 'FROST', 'SLUGGISH', 'NAUSEA']
        var defReduction = 0
        if (result.condition && physicalTraps.indexOf(result.condition) !== -1) {
          var totalDef2 = (character.stats.def || 10)
          if (character.equipped && character.equipped.armour) totalDef2 += character.equipped.armour.defBonus || 0
          if (character.equipped && character.equipped.offhand) totalDef2 += character.equipped.offhand.defBonus || 0
          if (character.equipped && character.equipped.helmet) totalDef2 += character.equipped.helmet.defBonus || 0
          if (character.equipped && character.equipped.boots) totalDef2 += character.equipped.boots.defBonus || 0
          defReduction = Math.floor(getModifier(totalDef2))
        }
        var finalDmg = Math.max(1, result.trapDamage - defReduction)
        setPlayerHp(function(hp) { return Math.max(0, hp - finalDmg) })
        result.trapDamage = finalDmg
      }
    }
    // Check if terminal was just revealed — set zone-level flag
    var foundTerminal = result.terminal
    setZone(function(prevZone) {
      return Object.assign({}, prevZone, {
        terminalFound: prevZone.terminalFound || foundTerminal,
        chambers: prevZone.chambers.map(function(ch) {
          if (ch.id !== prevZone.playerPosition) return ch
          return Object.assign({}, ch, {
            junkPiles: ch.junkPiles.slice(),
            terminalRevealed: ch.terminalRevealed || foundTerminal,
          })
        })
      })
    })
  }

  var searchTapGuardRef = useRef(0)

  function handleSearchTapContinue() {
    if (searchPhase === 'landed') {
      // Kill any pending auto-advance timeout
      if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); searchTimeoutRef.current = null }
      searchTapGuardRef.current = Date.now()

      if (searchResult && searchResult.dangerTriggered) {
        // Route to save roll — don't skip it
        setSearchPhase('save_rolling')
        var saveCount = 0
        searchDiceRef.current = setInterval(function() {
          setSearchSaveDiceDisplay(Math.floor(Math.random() * 20) + 1)
          saveCount++
          if (saveCount > 10) {
            clearInterval(searchDiceRef.current)
            var saveRoll = searchResult.dangerType === 'enemy' ? searchResult.perSaveRoll : searchResult.agiSaveRoll
            setSearchSaveDiceDisplay(saveRoll || '?')
            setSearchPhase('save_landed')
          }
        }, 80)
      } else {
        // No danger — go straight to reveal
        applySearchRewards(searchResult)
        setSearchPhase('reveal')
      }
    } else if (searchPhase === 'save_landed') {
      searchTapGuardRef.current = Date.now()
      // Apply damage + conditions NOW, before reveal shows
      applySearchRewards(searchResult)
      // Check if trap killed the player
      if (searchResult.trapDamage > 0 && playerHp - searchResult.trapDamage <= 0) {
        setPlayerHp(0)
        guardedSetPhase('defeat')
        return
      }
      setSearchPhase('reveal')
    }
  }

  function handleDismissSearch() {
    if (searchDiceRef.current) clearInterval(searchDiceRef.current)
    if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); searchTimeoutRef.current = null }

    // Check if an enemy encounter should trigger combat
    var pendingEnemy = searchResult && searchResult.enemy && searchResult.enemy !== 'spotted' ? searchResult.enemy : null

    searchLockedRef.current = false
    setSearchResult(null)
    setSearchingPileId(null)
    setSearchPhase(null)
    setSearchDiceDisplay(null)
    setSearchSaveDiceDisplay(null)

    if (pendingEnemy) {
      // Generate enemies scaled by search level
      var junkEnemyLevel = (searchResult && searchResult.enemyLevel) || 1
      var junkEnemyMax = (searchResult && searchResult.enemyMaxCount) || 2
      var zoneDef = ZONES[zone.zoneId] || null
      var pool = zoneDef ? zoneDef.encounterPools : null
      var enemies = generateCombatEnemies('seasoned', junkEnemyLevel, pool)
      if (enemies.length > junkEnemyMax) enemies = enemies.slice(0, junkEnemyMax)
      startCombat(enemies, zone, zone.playerPosition)
      // Ambush: enemy gets first strike — must also fix turn order
      // so currentTurnIndex points to an enemy, not the player
      if (pendingEnemy === 'ambush') {
        setBattle(function(prev) {
          // Find first enemy in turn order
          for (var ai = 0; ai < prev.turnOrder.length; ai++) {
            if (prev.enemies.some(function(e) { return e.id === prev.turnOrder[ai] })) {
              if (ai !== prev.currentTurnIndex) {
                return Object.assign({}, prev, { currentTurnIndex: ai })
              }
              break
            }
          }
          return prev
        })
        guardedSetCombatPhase('enemyWindup')
      }
    }
  }

  function handleCancelSearch() {
    searchLockedRef.current = false
    setSearchingPileId(null)
    setSearchPhase(null)
  }

  // --- Keystone press ---
  function handlePressKeystone() {
    var newZone = Object.assign({}, zone, { keystonePressed: true })
    newZone.chambers = newZone.chambers.map(function(ch) {
      if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
      return ch
    })
    setZone(newZone)
    setChambersCleared(chambersCleared + 1)
  }

  // --- Zone door --- bidirectional passage between zones
  function handleOpenZoneDoor() {
    if (!floor || !floor.zones || floor.zones.length < 2) return
    var currentIdx = floor.currentZoneIndex

    // First time through requires a key; after that door stays unlocked
    var currentZoneUnlocked = zone.zoneDoorUnlocked
    if (!currentZoneUnlocked && !hasZoneKey) return

    // Figure out destination: if we came from a zone, go back; otherwise go to next
    var destIdx
    if (zone.cameFromZoneIndex != null && zone.cameFromZoneIndex !== currentIdx) {
      destIdx = zone.cameFromZoneIndex
    } else {
      destIdx = (currentIdx + 1) % floor.zones.length
      if (destIdx === currentIdx) return
    }

    // Save current zone state back to floor before switching
    // (zone has live updates — visited, cleared, corpses — that floor.zones doesn't)
    var updatedZones = floor.zones.map(function(z, i) {
      if (i === currentIdx) {
        return Object.assign({}, zone, { zoneDoorUnlocked: true })
      }
      if (i === destIdx) {
        return Object.assign({}, z, { zoneDoorUnlocked: true, cameFromZoneIndex: currentIdx })
      }
      return z
    })

    // Place player at the zone_door chamber in the destination zone
    var destZone = updatedZones[destIdx]
    var doorChamberIdx = destZone.chambers.findIndex(function(ch) { return ch.type === 'zone_door' })
    if (doorChamberIdx === -1) doorChamberIdx = 0
    destZone = Object.assign({}, destZone, {
      playerPosition: doorChamberIdx,
      chambers: destZone.chambers.map(function(ch, idx) {
        if (idx === doorChamberIdx) return Object.assign({}, ch, { visited: true, cleared: true, isZoneDoor: true })
        return ch
      })
    })
    updatedZones[destIdx] = destZone

    setFloor(Object.assign({}, floor, { zones: updatedZones, currentZoneIndex: destIdx }))
    setZone(destZone)
    setHasZoneKey(false)
    setPreviousPosition(null)
    setLootingCorpseId(null)
    setLootingChestId(null)
    setLootingNpcId(null)
    setGamePhase('doors')
  }

  // --- Stairwell descent --- triggers floor transition
  function handleDescendStairwell() {
    // Terminal must be activated
    var terminalActivated = zone.terminalFound || zone.chambers.some(function(ch) {
      return ch.terminalRevealed || (ch.junkPiles && ch.junkPiles.some(function(p) { return p.terminalRevealed }))
    })
    if (!terminalActivated) return  // terminal not found

    // Check if boss is cleared (boss chamber must be cleared)
    var bossCleared = zone.chambers.every(function(ch) {
      return ch.type !== 'boss' || ch.cleared
    })
    if (!bossCleared) return  // boss not defeated

    // Floor transition → safe room
    setFloorsCompleted(function(prev) { return prev.concat([zone.floorId]) })
    guardedSetPhase('floor_transition')
  }

  // --- Floor transition: move to next floor or victory ---
  function handleFloorTransitionContinue() {
    try {
      // Sibling zones are optional (accessed via zone door) — always descend to next floor
      var currentFloorDef = floor ? FLOORS[floor.floorId] : null
      var nextFloorId = currentFloorDef ? currentFloorDef.nextFloor : null

      if (!nextFloorId || !FLOORS[nextFloorId]) {
        // No more floors — victory!
        writeRunLog('victory')
        onEndRun({ victory: true, chambersCleared: chambersCleared, xp: totalXp, gold: playerGold, itemsFound: playerInventory.length, floorsCompleted: floorsCompleted.length + 1 })
        return
      }

      // Generate next floor (floorsCompleted already updated in handleDescendStairwell)
      var nextFloor = generateFloor(nextFloorId, collectedTreasures)
      setFloor(nextFloor)
      setZone(nextFloor.zones[0])
      setHasZoneKey(false)
      setFloorDisturbance(0)
      setMaxFloorDisturbance(calcMaxDisturbance(nextFloor.zones[0]))
      setPreviousPosition(null)
      setLootingCorpseId(null)
      setLootingChestId(null)
      setLootingNpcId(null)
      initSafeRoom()
      guardedSetPhase('safe_room')
      triggerSave()
    } catch (e) {
      console.error('Floor transition error:', e)
      // Fallback: just go to safe room with current floor
      guardedSetPhase('safe_room')
    }
  }

  // --- Safe room: Montor's audience chamber ---
  var [safeRoomAiLine, setSafeRoomAiLine] = useState(null)
  // Treasure negotiation state (AI-driven conversation with Montor)
  var [negotiationStep, setNegotiationStep] = useState(null) // null | 'loading' | 'talking' | 'done'
  var [negotiationMontor, setNegotiationMontor] = useState('')
  var [negotiationOptions, setNegotiationOptions] = useState([])
  var [negotiationHistory, setNegotiationHistory] = useState([])
  var [negotiationRound, setNegotiationRound] = useState(0)
  var [negotiationImpression, setNegotiationImpression] = useState(5) // 1-10 AI score
  var [negotiationFreeText, setNegotiationFreeText] = useState('') // free text input
  var [showNegotiationFreeText, setShowNegotiationFreeText] = useState(false)

  function initSafeRoom() {
    // Check if player has any unsmashed treasures in junk bag
    var treasure = playerJunkBag.find(function(j) { return j.isTreasure })
    setSafeRoomGift(treasure || null)
    setSafeRoomStep('arrival')
    setSafeRoomSlotChoice(null)
    // Generate AI safe room line if key available
    setSafeRoomAiLine(null)
    if (hasGroqKey()) {
      var tidySummary = getTidinessSummary()
      generateSafeRoomLine({ mood: getMontorMood(), tidiness: tidySummary.label, greedScore: greedScore, floorName: floor ? floor.floorName : 'unknown', personality: montorPersonality }).then(function(result) {
        if (result && result.line) setSafeRoomAiLine(result.line)
      })
    }
  }

  function getSafeRoomMontor() {
    return safeRoomAiLine || getMontorLine('safeRoom')
  }

  var [safeRoomTonic, setSafeRoomTonic] = useState(null)
  var [safeRoomRewardItem, setSafeRoomRewardItem] = useState(null)

  function handleSafeRoomContinue() {
    if (isGuarded()) return
    transitionGuardRef.current = Date.now()

    // Show reward choice if not yet shown
    if (safeRoomStep !== 'reward_choice' && safeRoomStep !== 'tonic' && safeRoomStep !== 'tonic_pick' && safeRoomStep !== 'tonic_done' && safeRoomStep !== 'reward_item' && safeRoomStep !== 'reward_montor') {
      var mood = getMontorMood()
      if (mood === 'angry') {
        // No reward — skip to tonic step showing nothing
        setSafeRoomStep('tonic')
        setSafeRoomTonic(null)
        return
      }
      setSafeRoomStep('reward_choice')
      return
    }

    // After any reward, proceed to doors
    setSafeRoomStep('arrival')
    setSafeRoomGift(null)
    setSafeRoomSlotChoice(null)
    setSafeRoomTonic(null)
    setSafeRoomRewardItem(null)
    setGamePhase('doors')
    triggerSave()
  }

  function handleRewardChoice(choice) {
    var mood = getMontorMood()
    if (choice === 'tonic') {
      var tonic = null
      if (mood === 'happy') {
        tonic = { count: greedScore < 10 ? 2 : 1, playerChooses: true }
      } else if (mood === 'neutral') {
        tonic = { count: 1, playerChooses: true }
      } else if (mood === 'annoyed') {
        tonic = { count: 1, playerChooses: false, montorPick: montorTaste.favours }
      }
      if (tonic) {
        setSafeRoomTonic(tonic)
        setSafeRoomStep(tonic.playerChooses ? 'tonic_pick' : 'tonic')
      } else {
        setSafeRoomStep('tonic')
        setSafeRoomTonic(null)
      }
    } else if (choice === 'item') {
      // Montor gives an item — quality based on mood
      var pool = mood === 'happy' ? 'rare' : mood === 'neutral' ? 'uncommon' : 'common'
      var candidates = Object.values(ITEMS).filter(function(it) { return it.rarity === pool && it.type !== 'consumable' })
      if (candidates.length === 0) candidates = Object.values(ITEMS).filter(function(it) { return it.rarity === 'common' && it.type !== 'consumable' })
      var pick = candidates[Math.floor(Math.random() * candidates.length)]
      if (pick) {
        var itemCopy = Object.assign({}, pick)
        setSafeRoomRewardItem(itemCopy)
        setPlayerInventory(function(prev) { return prev.concat([itemCopy]) })
      }
      setSafeRoomStep('reward_item')
    } else if (choice === 'montor') {
      // Montor's choice — blind, potentially much better (or worse)
      var roll = Math.random()
      var montorPool = 'common'
      if (mood === 'happy') {
        montorPool = roll < 0.4 ? 'epic' : roll < 0.7 ? 'rare' : 'uncommon'
      } else if (mood === 'neutral') {
        montorPool = roll < 0.2 ? 'rare' : roll < 0.6 ? 'uncommon' : 'common'
      } else {
        montorPool = roll < 0.1 ? 'uncommon' : 'common'
      }
      var montorCandidates = Object.values(ITEMS).filter(function(it) { return it.rarity === montorPool })
      if (montorCandidates.length === 0) montorCandidates = Object.values(ITEMS).filter(function(it) { return it.rarity === 'common' })
      var montorPick = montorCandidates[Math.floor(Math.random() * montorCandidates.length)]
      if (montorPick) {
        var montorItemCopy = Object.assign({}, montorPick)
        setSafeRoomRewardItem(montorItemCopy)
        setPlayerInventory(function(prev) { return prev.concat([montorItemCopy]) })
      }
      setSafeRoomStep('reward_montor')
    }
  }

  var [tonicPicks, setTonicPicks] = useState([]) // track what was picked for display

  function handleTonicPick(stat) {
    if (!safeRoomTonic) return
    character.stats[stat] = (character.stats[stat] || 10) + 1
    setTonicPicks(function(prev) { return prev.concat([stat]) })
    safeRoomTonic.count--
    if (safeRoomTonic.count <= 0) {
      setSafeRoomStep('tonic_done')
    } else {
      setSafeRoomTonic(Object.assign({}, safeRoomTonic))
    }
  }

  function handleSmashGift() {
    if (!safeRoomGift) return
    // Unlock the gift permanently
    var giftId = safeRoomGift.gift
    if (unlockedGifts.indexOf(giftId) === -1) {
      setUnlockedGifts(function(prev) { return prev.concat([giftId]) })
    }
    // Remove treasure from junk bag
    setPlayerJunkBag(function(bag) {
      return bag.filter(function(j) { return j.id !== safeRoomGift.id })
    })
    // Open the gift picker to choose slot + power
    setSafeRoomStep('gift_picker')
    setShowGiftPicker(true)
    setGiftPickerSlot(null)
    setGiftPickerGift(null)
  }

  // --- Gift Picker: apply a gift to a slot (used at terminal + after smash) ---
  function handleGiftPickerSelectSlot(slotName) {
    setGiftPickerSlot(slotName)
    setGiftPickerGift(null)
  }

  function handleGiftPickerSelectGift(giftId) {
    setGiftPickerGift(giftId)
  }

  function handleGiftPickerApply(option) {
    if (!giftPickerSlot || !giftPickerGift) return

    // Build the slot data
    var slotData = Object.assign({}, option, { giftId: giftPickerGift, giftName: giftPickerGift })

    // For weapon, tag with the current weapon type ONLY for class-specific gifts (Petal)
    // Petal weapon data is an object keyed by weapon type; all others are arrays (universal)
    if (giftPickerSlot === 'weapon') {
      var giftDef = getGiftDef(giftPickerGift)
      var isClassSpecific = giftDef && giftDef.weapon && !Array.isArray(giftDef.weapon)
      if (isClassSpecific) {
        var wt = character.equipped && character.equipped.weapon ? character.equipped.weapon.weaponType : 'fists'
        slotData.appliedWeaponType = wt
      }
    }

    // Reverse old gift's stat boosts before applying new ones
    var oldGift = giftSlots[giftPickerSlot]
    if (oldGift && oldGift.stats) {
      Object.keys(oldGift.stats).forEach(function(stat) {
        character.stats[stat] = (character.stats[stat] || 10) - oldGift.stats[stat]
      })
    }

    // Apply new stat boosts (permanent for the run)
    if (option.stats) {
      Object.keys(option.stats).forEach(function(stat) {
        character.stats[stat] = (character.stats[stat] || 10) + option.stats[stat]
      })
    }

    // Set the slot
    setGiftSlots(function(prev) {
      var updated = Object.assign({}, prev)
      updated[giftPickerSlot] = slotData
      return updated
    })

    // Close picker
    setShowGiftPicker(false)
    setGiftPickerSlot(null)
    setGiftPickerGift(null)

    // If we came from safe room smash, advance to smashed state
    if (safeRoomStep === 'gift_picker') {
      setSafeRoomStep('smashed')
    }
  }

  function handleGiftPickerClose() {
    setShowGiftPicker(false)
    setGiftPickerSlot(null)
    setGiftPickerGift(null)
    if (safeRoomStep === 'gift_picker') {
      setSafeRoomStep('smashed')
    }
  }

  // --- Chamber interaction actions ---
  function handleChamberAction(action, data) {
    if (action === 'rest') {
      var heal = Math.round(character.maxHp * chamberContent.hpRecovery)
      var newHp = Math.min(playerHp + heal, character.maxHp)
      setPlayerHp(newHp)
      setChamberContent(Object.assign({}, chamberContent, { healed: heal }))
    } else if (action === 'claim_loot') {
      setPlayerGold(playerGold + chamberContent.gold)
      if (chamberContent.item) {
        setPlayerInventory(function(prev) { return prev.concat([chamberContent.item]) })
      }
      setChamberContent(Object.assign({}, chamberContent, { claimed: true }))
    } else if (action === 'merchant_tab') {
      setChamberContent(Object.assign({}, chamberContent, { showSell: data === 'sell' }))
    } else if (action === 'buy' && data) {
      var chaModBuy = getModifier(character.stats.cha || 10)
      var basePrice = data.buyPrice || data.cost || 0
      var price = Math.max(1, basePrice - Math.max(0, Math.round(basePrice * chaModBuy * 0.05)))
      if ((playerGold || 0) >= price) {
        setPlayerGold(playerGold - price)
        setPlayerInventory(function(prev) { return prev.concat([Object.assign({}, data)]) })
        var remaining = chamberContent.items.filter(function(it) { return it !== data })
        setChamberContent(Object.assign({}, chamberContent, { items: remaining }))
      }
    } else if (action === 'sell' && data) {
      setPlayerGold(playerGold + data.sellPrice)
      setPlayerInventory(function(prev) {
        var next = prev.slice()
        next.splice(data.itemIndex, 1)
        return next
      })
    } else if (action === 'trigger_trap') {
      var newHp3 = Math.max(0, playerHp - chamberContent.damage)
      setPlayerHp(newHp3)
      setChamberContent(Object.assign({}, chamberContent, { triggered: true }))
      if (newHp3 <= 0) {
        setTimeout(function() { guardedSetPhase('defeat') }, 500)
        return
      }
    } else if (action === 'help_npc') {
      if (chamberContent.reward && chamberContent.reward.gold) {
        setPlayerGold(playerGold + chamberContent.reward.gold)
      }
      setChamberContent(Object.assign({}, chamberContent, { helped: true }))
    } else if (action === 'descend') {
      handleDescendStairwell()
      return
    }
  }

  function handleChamberContinue() {
    // Mark chamber cleared, show doors
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
        return ch
      })
    })
    setZone(newZone)
    setChambersCleared(chambersCleared + 1)
    setChamberContent(null)
    setGamePhase('doors')
  }

  // ============================================================
  // COMBAT
  // ============================================================

  function addLog(entry) {
    setCombatLog(function(prev) {
      var next = prev.concat([entry])
      if (next.length > MAX_LOG_ENTRIES) next = next.slice(next.length - MAX_LOG_ENTRIES)
      return next
    })
  }

  function startCombat(enemies, currentZone, chamberId) {
    var players = [{ uid: user.uid, character: Object.assign({}, character, { maxHp: character.maxHp }) }]
    var bs = createBattleState(players, enemies)
    bs.players[user.uid].currentHp = playerHp
    bs.players[user.uid].maxHp = character.maxHp
    bs.players[user.uid]._firstHitAvailable = true // Executioner's Coin
    bs.players[user.uid]._gifts = giftSlots // Pass gifts to combat.js
    // Forge Body (ember body): +2 DEF at combat start
    if (giftSlots.body && giftSlots.body.effect === 'burn_immunity_and_def' && giftSlots.body.defBonus) {
      bs.players[user.uid].combatStats = Object.assign({}, bs.players[user.uid].combatStats, {
        def: bs.players[user.uid].combatStats.def + giftSlots.body.defBonus
      })
    }
    setBattle(bs)
    setSelectedTarget(null)
    setCombatLog([])
    setPendingAttackResult(null)
    setEnemyAttackInfo(null)
    setEnemyBehaviourMsg(null)
    setEnemyConditionMsg(null)
    // Reset per-combat gift flags
    setSporeCloudUsed(false)
    setBedrockCharges(0)
    setErupted(false)
    setShadowStepUsed(false)
    setChaosRerollUsed(false)
    setIronWillUsed(false)
    setHarvestBuff(0)
    setKillsThisCombat(0)
    setActiveBombs([])
    setReflectNextAttack(false)
    setHitsTakenThisCombat(0)
    setPhoenixSparkUsed(false)
    setTremorWaveUsed(false)
    setGamePhase('combat')

    var firstTurnId = bs.turnOrder[bs.currentTurnIndex]
    var firstActor = getActor(bs, firstTurnId)
    guardedSetCombatPhase(firstActor && firstActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === ENEMY TURN ===
  useEffect(function() {
    if (combatPhase !== 'enemyWindup' || !battle || gamePhase !== 'combat') return
    var currentId = getCurrentTurnId(battle)

    // Tick conditions on enemy's turn start
    var tickResult = tickTurnStart(battle, currentId)
    var tickedBattle = tickResult.newBattle

    // Decay Aura (bile shield): enemies lose 1 HP at start of their turn
    var shieldGTick = (character.equipped && character.equipped.offhand && character.equipped.offhand.slot === 'offhand') ? giftSlots.shield : null
    if (shieldGTick && shieldGTick.effect === 'enemy_dot') {
      var dotEnemy = tickedBattle.enemies.find(function(e) { return e.id === currentId })
      if (dotEnemy && !dotEnemy.isDown) {
        dotEnemy.currentHp = Math.max(0, dotEnemy.currentHp - shieldGTick.value)
        tickResult.damage += shieldGTick.value
        if (!tickResult.narrative) tickResult.narrative = ''
        tickResult.narrative += ' Decay Aura drains ' + shieldGTick.value + ' HP.'
        if (dotEnemy.currentHp <= 0) { dotEnemy.isDown = true; tickResult.died = true }
      }
    }

    // Show condition effects in the windup display instead of "prepares to strike"
    setEnemyConditionMsg(null)
    if (tickResult.narrative) {
      var condParts = tickResult.narrative.split('. ').filter(function(s) { return s.trim() })
      var displayParts = condParts.filter(function(p) { return p.indexOf('wears off') === -1 }).map(function(p) { return p.replace(/\.+$/, '') }).filter(Boolean)
      if (displayParts.length > 0) {
        var actorForMsg = getActor(tickedBattle, currentId)
        setEnemyConditionMsg({ name: actorForMsg ? actorForMsg.data.name : 'Enemy', text: displayParts.join('. ') })
      }
    }

    // Split narrative into individual log lines — filter out noise
    if (tickResult.narrative) {
      var eParts = tickResult.narrative.split('. ').filter(function(s) { return s.trim() })
      for (var ei = 0; ei < eParts.length; ei++) {
        var ePart = eParts[ei].replace(/\.+$/, '')
        // Skip "wears off" messages — condition icon disappearing already tells you
        if (ePart.indexOf('wears off') !== -1) continue
        // Skip routine DoT messages (Bleeding: X, Poisoned: X) — HP bar already shows it
        if (ePart.indexOf('damage') !== -1 && ePart.indexOf('SEPSIS') === -1 && ePart.indexOf('SHATTER') === -1 && ePart.indexOf('burst') === -1) continue
        // Keep: turn lost, skips, adrenaline, sepsis, poison drains, kicks in
        var eTier = 'glancing'
        if (ePart.indexOf('turn lost') !== -1 || ePart.indexOf('skip') !== -1 || ePart.indexOf('Paralysed') !== -1) eTier = 'miss'
        if (ePart.indexOf('SEPSIS') !== -1 || ePart.indexOf('ADRENALINE') !== -1) eTier = 'crit'
        addLog({ type: 'condition', text: ePart, tier: eTier })
      }
    }

    var hasEnemyConditionEffects = tickResult.damage > 0 || tickResult.narrative
    var enemyCondDelay = hasEnemyConditionEffects ? 1000 : 0

    if (tickResult.died) {
      // Enemy died from conditions — skip windup, go straight to result
      addLog({ type: 'condition', text: getActor(tickedBattle, currentId) ? getActor(tickedBattle, currentId).data.name + ' dies from conditions!' : 'Enemy dies from conditions!', tier: 'crit' })
      var diedTimeout = setTimeout(function() {
        setBattle(tickedBattle)
        var endCheck = checkBattleEnd(tickedBattle)
        if (endCheck === 'victory') {
          var xpGained = calculateXp(tickedBattle)
          var newXp = totalXp + xpGained
          setTotalXp(newXp)
          setLastXpGained(xpGained)
          checkLevelUp(newXp)
          transitionGuardRef.current = Date.now(); guardedSetCombatPhase('victory')
          return
        }
        // Other enemies still alive — skip dead enemy's turn
        var nextB = advanceTurn(tickedBattle)
        setBattle(nextB)
        var nextA = getActor(nextB, getCurrentTurnId(nextB))
        guardedSetCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
      }, 300) // Short delay — just enough to see the death log
      return function() { clearTimeout(diedTimeout) }
    }
    if (tickResult.skipped) {
      var skipTimeout = setTimeout(function() {
        var nextB2 = advanceTurn(tickedBattle)
        setBattle(nextB2)
        var nextA2 = getActor(nextB2, getCurrentTurnId(nextB2))
        guardedSetCombatPhase(nextA2 && nextA2.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
      }, enemyCondDelay)
      return function() { clearTimeout(skipTimeout) }
    }

    var attackOut = resolveEnemyAttack(tickedBattle, currentId)
    if (attackOut) {
      var eResult = attackOut.result
      // Non-attack actions (flee, howl, heal, etc.) — show in UI, log and advance, skip roller
      if (!eResult.attackRoll) {
        // Build behaviour message for the windup UI
        var behMsg = ''
        if (eResult.fled) behMsg = eResult.attacker + ' flees in terror!'
        else if (eResult.howled) behMsg = eResult.attacker + ' howls! All allies +' + eResult.howlBonus + ' STR!'
        else if (eResult.healedAlly) behMsg = eResult.attacker + ' heals ' + eResult.healedAllyName + '!'
        else if (eResult.ateCorpse) behMsg = eResult.attacker + ' devours a corpse!'
        else if (eResult.sacrificed) behMsg = eResult.attacker + ' sacrifices itself!'
        else if (eResult.slimeCoated) behMsg = eResult.attacker + ' coats itself in slime!'
        else if (eResult.hid) behMsg = eResult.attacker + ' burrows away!'
        else if (eResult.matured) behMsg = eResult.maturedName + ' has grown up!'
        else if (eResult.spawned) behMsg = eResult.attacker + ' spawns ' + eResult.spawnedName + '!'
        setEnemyBehaviourMsg({ name: eResult.attacker, text: behMsg })

        var behaviourDelay = setTimeout(function() {
          if (eResult.fled) addLog({ type: 'enemy', text: eResult.attacker + ' flees in terror!', tier: 'miss' })
          if (eResult.howled) addLog({ type: 'enemy', text: eResult.attacker + ' howls! All allies +' + eResult.howlBonus + ' STR!', tier: 'hit' })
          if (eResult.healedAlly) addLog({ type: 'enemy', text: eResult.attacker + ' heals ' + eResult.healedAllyName + ' for ' + eResult.healAmount + ' HP!', tier: 'hit' })
          if (eResult.ateCorpse) addLog({ type: 'enemy', text: eResult.attacker + ' devours ' + eResult.ateCorpseName + '! +4 STR, +10 HP!', tier: 'crit' })
          if (eResult.sacrificed) addLog({ type: 'enemy', text: eResult.attacker + ' sacrifices itself! All allies +' + eResult.sacrificeBonus + ' STR, +2 DEF!', tier: 'crit' })
          if (eResult.slimeCoated) addLog({ type: 'enemy', text: eResult.attacker + ' coats itself in slime! +' + eResult.slimeHeal + ' HP, +' + eResult.slimeDef + ' DEF!', tier: 'hit' })
          if (eResult.hid) addLog({ type: 'enemy', text: eResult.attacker + ' burrows away and heals ' + eResult.hideHeal + ' HP!', tier: 'hit' })
          if (eResult.matured) addLog({ type: 'enemy', text: eResult.maturedName + ' has grown up! Full strength!', tier: 'crit' })
          if (eResult.spawned) addLog({ type: 'enemy', text: eResult.attacker + ' spawns ' + eResult.spawnedName + '!', tier: 'crit' })
          setEnemyBehaviourMsg(null)

          var endCheck2 = checkBattleEnd(attackOut.newBattle)
          if (endCheck2 === 'victory') {
            var xpG2 = calculateXp(attackOut.newBattle)
            setTotalXp(totalXp + xpG2); setLastXpGained(xpG2); checkLevelUp(totalXp + xpG2)
            setBattle(attackOut.newBattle)
            guardedSetCombatPhase('victory')
            return
          }
          var nextB4 = advanceTurn(attackOut.newBattle)
          setBattle(nextB4)
          var nextA4 = getActor(nextB4, getCurrentTurnId(nextB4))
          guardedSetCombatPhase(nextA4 && nextA4.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
        }, Math.max(1500, enemyCondDelay))
        return function() { clearTimeout(behaviourDelay) }
      }
      // Normal attack — show roller
      setEnemyAttackInfo({ attackOut: attackOut })
      setEnemyRollerKey(function(k) { return k + 1 })
      var timeout = setTimeout(function() { guardedSetCombatPhase('enemyRolling') }, Math.max(800, enemyCondDelay))
      return function() { clearTimeout(timeout) }
    }
    // Defensive: if attack couldn't resolve (e.g. currentId isn't an enemy), skip turn
    var skipFallback = setTimeout(function() {
      var nextB3 = advanceTurn(tickedBattle)
      setBattle(nextB3)
      var nextA3 = getActor(nextB3, getCurrentTurnId(nextB3))
      guardedSetCombatPhase(nextA3 && nextA3.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    }, 200)
    return function() { clearTimeout(skipFallback) }
  }, [combatPhase, battle, gamePhase])

  function handleEnemyRollForRoller() {
    if (!enemyAttackInfo) return { roll: 1, modifier: 0, total: 1, tn: 10, success: false, crit: false, fumble: true }
    return enemyAttackInfo.attackOut.result.attackRoll
  }

  function handleEnemyComplete() {
    if (!enemyAttackInfo) return
    var attackOut = enemyAttackInfo.attackOut
    var r = attackOut.result
    var logEntry = formatAttackLog(r, 'enemy')
    if (r.blocked) {
      addLog({ type: 'player', text: 'Shield block! Attack negated!', tier: 'crit' })
    } else if (r.dodged) {
      addLog({ type: 'player', text: 'Dodged! Attack evaded!', tier: 'crit' })
      // Siphon (void body): heal on dodge
      var siphonBody = giftSlots.body
      if (siphonBody && siphonBody.effect === 'dodge_heal') {
        var pSiphon = attackOut.newBattle.players[user.uid]
        if (pSiphon) {
          pSiphon.currentHp = Math.min(pSiphon.currentHp + siphonBody.value, pSiphon.maxHp)
          addLog({ type: 'player', text: 'Siphon! Healed ' + siphonBody.value + ' HP from dodge!', tier: 'hit' })
        }
      }
      // Shadow Boxing (void fists): dodge counter-attack
      var weaponGDodge = giftSlots.weapon
      if (weaponGDodge && weaponGDodge.effect === 'dodge_counter' && rollGiftChance(weaponGDodge.chance)) {
        var attackerForCounter = updatedBattle.enemies.find(function(e) { return e.id === r.attackerId })
        if (attackerForCounter && !attackerForCounter.isDown) {
          var counterDmg = Math.max(2, Math.floor(character.stats.str / 3))
          attackerForCounter.currentHp = Math.max(0, attackerForCounter.currentHp - counterDmg)
          addLog({ type: 'player', text: 'Shadow Boxing! Counter-attack for ' + counterDmg + ' damage!', tier: 'crit' })
          if (attackerForCounter.currentHp <= 0) { attackerForCounter.isDown = true; addLog({ type: 'player', text: attackerForCounter.name + ' felled!', tier: 'crit' }) }
        }
      }
    } else {
      addLog({ type: 'enemy', text: logEntry.text, tier: logEntry.tier })
    }
    if (r.reflectDamage) {
      addLog({ type: 'player', text: 'Reflected ' + r.reflectDamage + ' damage back!' + (r.reflectKill ? ' It dies!' : ''), tier: 'hit' })
    }
    if (r.conditionBlocked) {
      addLog({ type: 'player', text: condName(r.conditionBlocked) + ' blocked by immunity!', tier: 'hit' })
    }

    // Log condition applied
    if (r.conditionApplied) {
      addLog({ type: 'condition', text: r.target + ' is now ' + condName(r.conditionApplied) + '!', tier: 'hit' })
    }

    var updatedBattle = attackOut.newBattle
    var pState = updatedBattle.players[user.uid]

    // === GIFT EFFECTS ON TAKING DAMAGE ===
    if (pState && r.damage > 0) {
      var bodyG = giftSlots.body
      var mindG = giftSlots.mind
      var shieldG = (character.equipped && character.equipped.offhand && character.equipped.offhand.slot === 'offhand') ? giftSlots.shield : null // shield gifts only work with offhand equipped
      var weaponGDef = giftSlots.weapon
      var attackerEnemy = updatedBattle.enemies.find(function(e) { return e.id === r.attackerId })

      // Track hits taken for Stoneskin Mend
      setHitsTakenThisCombat(function(h) { return h + 1 })

      // --- SHIELD GIFTS (reactive) ---

      // Block chance (Root Guard, Granite Guard)
      if (shieldG && shieldG.effect === 'block_chance' && rollGiftChance(shieldG.chance)) {
        pState.currentHp = Math.min(pState.currentHp + r.damage, pState.maxHp)
        addLog({ type: 'player', text: shieldG.name + ' blocks the attack completely!', tier: 'hit' })
      }

      // Reflect damage (Thornhide, Polished Granite, Flame Shield)
      if (shieldG && (shieldG.effect === 'reflect_damage' || shieldG.effect === 'reflect_damage_and_condition') && attackerEnemy && !attackerEnemy.isDown) {
        attackerEnemy.currentHp = Math.max(0, attackerEnemy.currentHp - shieldG.value)
        addLog({ type: 'player', text: shieldG.name + ' reflects ' + shieldG.value + ' damage!', tier: 'hit' })
        if (shieldG.reflectCondition && rollGiftChance(0.15)) {
          attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], shieldG.reflectCondition, 'gift')
          addLog({ type: 'condition', text: attackerEnemy.name + ' ' + condName(shieldG.reflectCondition) + ' from the reflection!', tier: 'hit' })
        }
        if (attackerEnemy.currentHp <= 0) { attackerEnemy.isDown = true; addLog({ type: 'player', text: attackerEnemy.name + ' felled!', tier: 'crit' }) }
      }

      // Block + condition (Glacial Wall/FROST, Bile Splash/NAUSEA, Toxic Shield)
      if (shieldG && (shieldG.effect === 'block_condition' || shieldG.effect === 'block_chance_and_condition') && attackerEnemy && !attackerEnemy.isDown) {
        // Block chance component
        if (shieldG.effect === 'block_chance_and_condition' && rollGiftChance(shieldG.chance)) {
          pState.currentHp = Math.min(pState.currentHp + r.damage, pState.maxHp)
          addLog({ type: 'player', text: shieldG.name + ' blocks!', tier: 'hit' })
        }
        // Apply condition to attacker
        var blockCondChance = shieldG.effect === 'block_condition' ? (shieldG.chance || 1.0) : 1.0
        if (rollGiftChance(blockCondChance)) {
          attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], shieldG.condition, 'gift')
          addLog({ type: 'condition', text: shieldG.name + '! ' + attackerEnemy.name + ' ' + condName(shieldG.condition) + '!', tier: 'hit' })
        }
      }

      // Block heals (Blood Absorb)
      if (shieldG && shieldG.effect === 'block_heal' && r.blocked) {
        pState.currentHp = Math.min(pState.currentHp + shieldG.value, pState.maxHp)
        addLog({ type: 'player', text: shieldG.name + ': healed ' + shieldG.value + ' HP!', tier: 'hit' })
      }

      // Quartz Resonance (stone mind): blocking heals 2 HP — stacks with Blood Absorb since it's mind slot
      if (mindG && mindG.effect === 'block_heal_mind' && r.blocked) {
        pState.currentHp = Math.min(pState.currentHp + mindG.value, pState.maxHp)
        addLog({ type: 'player', text: mindG.name + ': healed ' + mindG.value + ' HP!', tier: 'hit' })
      }

      // Damage mirror (Mirror Shield — 25% of damage back)
      if (shieldG && shieldG.effect === 'damage_mirror' && attackerEnemy && !attackerEnemy.isDown) {
        var mirrorDmg = Math.max(1, Math.round(r.damage * shieldG.value))
        attackerEnemy.currentHp = Math.max(0, attackerEnemy.currentHp - mirrorDmg)
        addLog({ type: 'player', text: shieldG.name + ' reflects ' + mirrorDmg + ' damage!', tier: 'hit' })
        if (attackerEnemy.currentHp <= 0) { attackerEnemy.isDown = true; addLog({ type: 'player', text: attackerEnemy.name + ' felled!', tier: 'crit' }) }
      }

      // Block → gold (Smelt — 50% of blocked damage as gold)
      if (shieldG && shieldG.effect === 'block_gold' && r.blocked) {
        var goldGain = Math.max(1, Math.round(r.damage * shieldG.value))
        setPlayerGold(function(g) { return g + goldGain })
        addLog({ type: 'player', text: shieldG.name + ': smelted ' + goldGain + ' gold!', tier: 'hit' })
      }

      // Negate chance (Null Block — separate from dodge/block)
      if (shieldG && shieldG.effect === 'negate_chance' && rollGiftChance(shieldG.chance)) {
        pState.currentHp = Math.min(pState.currentHp + r.damage, pState.maxHp)
        addLog({ type: 'player', text: shieldG.name + ' negates the attack!', tier: 'crit' })
      }

      // Counter-attack (Crimson Counter — 20% free hit back)
      if (shieldG && shieldG.effect === 'counter_attack' && attackerEnemy && !attackerEnemy.isDown && rollGiftChance(shieldG.chance)) {
        var counterDmg = Math.max(2, Math.round(r.damage * 0.5))
        attackerEnemy.currentHp = Math.max(0, attackerEnemy.currentHp - counterDmg)
        addLog({ type: 'player', text: shieldG.name + '! Counter-attack for ' + counterDmg + '!', tier: 'crit' })
        if (attackerEnemy.currentHp <= 0) { attackerEnemy.isDown = true; addLog({ type: 'player', text: attackerEnemy.name + ' felled!', tier: 'crit' }) }
      }

      // Eruption (ember shield): AoE when hit below 25% HP, once per combat
      if (shieldG && shieldG.effect === 'threshold_aoe_damage' && !erupted) {
        var eruptPercent = pState.currentHp / pState.maxHp
        if (eruptPercent < shieldG.hpThreshold) {
          setErupted(true)
          updatedBattle.enemies.forEach(function(e) {
            if (!e.isDown) {
              e.currentHp = Math.max(0, e.currentHp - shieldG.value)
              if (e.currentHp <= 0) e.isDown = true
            }
          })
          addLog({ type: 'player', text: 'ERUPTION! ' + shieldG.value + ' damage to all enemies!', tier: 'crit' })
        }
      }

      // --- BODY GIFTS (defensive) ---

      // Roothold (petal): can't be reduced below minHpAfterHit
      if (bodyG && bodyG.effect === 'damage_floor' && pState.currentHp < bodyG.minHpAfterHit && pState.currentHp > 0) {
        pState.currentHp = bodyG.minHpAfterHit
        addLog({ type: 'player', text: bodyG.name + '! HP can\'t drop below ' + bodyG.minHpAfterHit + '.', tier: 'hit' })
      }

      // Flat damage reduction (Ironhide): reduce incoming by flat amount
      if (bodyG && bodyG.effect === 'flat_damage_reduction') {
        var reduced = Math.min(r.damage, bodyG.value)
        pState.currentHp = Math.min(pState.currentHp + reduced, pState.maxHp)
        addLog({ type: 'player', text: bodyG.name + ' absorbs ' + reduced + ' damage!', tier: 'hit' })
      }

      // Bedrock: below 15% HP, next 3 hits deal only 1 damage
      if (bodyG && bodyG.effect === 'bedrock') {
        var bedrockPercent = (pState.currentHp + r.damage) / pState.maxHp // HP before this hit
        if (bedrockCharges > 0) {
          // Active — reduce to 1 damage
          var bedrockSaved = r.damage - 1
          if (bedrockSaved > 0) pState.currentHp = Math.min(pState.currentHp + bedrockSaved, pState.maxHp)
          setBedrockCharges(bedrockCharges - 1)
          addLog({ type: 'player', text: 'Bedrock! Only 1 damage (' + (bedrockCharges - 1) + ' charges left).', tier: 'hit' })
        } else if (bedrockPercent <= bodyG.hpThreshold && pState.currentHp > 0) {
          // Trigger — activate charges
          setBedrockCharges(bodyG.charges)
          var bedrockSaved2 = r.damage - 1
          if (bedrockSaved2 > 0) pState.currentHp = Math.min(pState.currentHp + bedrockSaved2, pState.maxHp)
          setBedrockCharges(bodyG.charges - 1)
          addLog({ type: 'player', text: 'BEDROCK ACTIVATED! ' + bodyG.charges + ' hits reduced to 1 damage!', tier: 'crit' })
        }
      }

      // Spore Cloud (petal body): DAZE all enemies below HP threshold
      if (bodyG && bodyG.effect === 'threshold_aoe_condition' && !sporeCloudUsed) {
        var sporePercent = pState.currentHp / pState.maxHp
        if (sporePercent < bodyG.hpThreshold) {
          setSporeCloudUsed(true)
          updatedBattle.enemies.forEach(function(e) {
            if (!e.isDown) {
              e.statusEffects = applyConditionToEffects(e.statusEffects || [], bodyG.condition, 'gift')
            }
          })
          addLog({ type: 'condition', text: 'Spore Cloud! All enemies ' + condName(bodyG.condition) + '!', tier: 'crit' })
        }
      }

      // Tremor Wave (stone mind): below 30% HP → all enemies DAZE + FROST (once/combat)
      if (mindG && mindG.effect === 'threshold_aoe_dual_condition' && !tremorWaveUsed) {
        var tremorPercent = pState.currentHp / pState.maxHp
        if (tremorPercent < mindG.hpThreshold && pState.currentHp > 0) {
          setTremorWaveUsed(true)
          updatedBattle.enemies.forEach(function(e) {
            if (!e.isDown) {
              e.statusEffects = applyConditionToEffects(e.statusEffects || [], mindG.condition1, 'gift')
              e.statusEffects = applyConditionToEffects(e.statusEffects || [], mindG.condition2, 'gift')
            }
          })
          addLog({ type: 'condition', text: 'TREMOR WAVE! All enemies ' + condName(mindG.condition1) + ' + ' + condName(mindG.condition2) + '!', tier: 'crit' })
        }
      }

      // Blood Spray (blood body): 20% when hit → attacker BLEED + 1 random other FEAR
      if (bodyG && bodyG.effect === 'hit_taken_bleed_and_fear_spread' && attackerEnemy && !attackerEnemy.isDown && rollGiftChance(bodyG.chance)) {
        attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], 'BLEED', 'gift')
        addLog({ type: 'condition', text: 'Blood Spray! ' + attackerEnemy.name + ' BLEED!', tier: 'hit' })
        var othersForFear = updatedBattle.enemies.filter(function(e) { return !e.isDown && e.id !== attackerEnemy.id })
        if (othersForFear.length > 0) {
          var fearTarget = othersForFear[Math.floor(Math.random() * othersForFear.length)]
          fearTarget.statusEffects = applyConditionToEffects(fearTarget.statusEffects || [], 'FEAR', 'gift')
          addLog({ type: 'condition', text: fearTarget.name + ' FEAR from the blood!', tier: 'hit' })
        }
      }

      // Phoenix Spark (ember mind): below 20% HP, heal 5 + AoE BURN. Once per combat.
      if (mindG && mindG.effect === 'threshold_heal_and_aoe_condition' && !phoenixSparkUsed) {
        var phoenixPercent = pState.currentHp / pState.maxHp
        if (phoenixPercent < mindG.hpThreshold && pState.currentHp > 0) {
          setPhoenixSparkUsed(true)
          pState.currentHp = Math.min(pState.currentHp + mindG.healValue, pState.maxHp)
          updatedBattle.enemies.forEach(function(e) {
            if (!e.isDown) {
              e.statusEffects = applyConditionToEffects(e.statusEffects || [], mindG.condition, 'gift')
            }
          })
          addLog({ type: 'player', text: 'PHOENIX SPARK! Healed ' + mindG.healValue + ' HP! All enemies BURN!', tier: 'crit' })
        }
      }

      // Reflect condition (Toxic Spores/POISON, Toxic Presence/POISON)
      if (bodyG && bodyG.effect === 'reflect_condition' && attackerEnemy && !attackerEnemy.isDown && rollGiftChance(bodyG.chance)) {
        attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], bodyG.condition, 'gift')
        addLog({ type: 'condition', text: bodyG.name + '! ' + attackerEnemy.name + ' ' + condName(bodyG.condition) + '!', tier: 'hit' })
      }

      // Reflect damage (Heat Aura — enemies take damage when they hit you)
      if (bodyG && bodyG.effect === 'reflect_damage' && attackerEnemy && !attackerEnemy.isDown) {
        attackerEnemy.currentHp = Math.max(0, attackerEnemy.currentHp - bodyG.value)
        addLog({ type: 'player', text: bodyG.name + ' burns ' + attackerEnemy.name + ' for ' + bodyG.value + '!', tier: 'hit' })
        if (attackerEnemy.currentHp <= 0) { attackerEnemy.isDown = true; addLog({ type: 'player', text: attackerEnemy.name + ' felled!', tier: 'crit' }) }
      }

      // HP + damage reduction (Tempered — -1 all incoming)
      if (bodyG && bodyG.effect === 'hp_and_damage_reduction') {
        pState.currentHp = Math.min(pState.currentHp + bodyG.damageReduction, pState.maxHp)
      }

      // Burn immunity + DEF (Forge Body): immune to BURN, +2 DEF applied at combat start
      if (bodyG && bodyG.effect === 'burn_immunity_and_def' && r.conditionApplied === 'BURN') {
        pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== 'BURN' })
        r.conditionApplied = null
        addLog({ type: 'player', text: 'Forge Body! Immune to BURN!', tier: 'hit' })
      }

      // Condition immunity multi (Rot Resistance): immune to POISON and NAUSEA
      if (bodyG && bodyG.effect === 'condition_immunity_multi' && r.conditionApplied) {
        if (bodyG.conditions && bodyG.conditions.indexOf(r.conditionApplied) !== -1) {
          pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== r.conditionApplied })
          addLog({ type: 'player', text: bodyG.name + '! Immune to ' + condName(r.conditionApplied) + '!', tier: 'hit' })
          r.conditionApplied = null
        }
      }

      // Fear immunity + accuracy (Predator's Focus): immune to FEAR
      if (mindG && mindG.effect === 'fear_immunity_and_accuracy' && r.conditionApplied === 'FEAR') {
        pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== 'FEAR' })
        r.conditionApplied = null
        addLog({ type: 'player', text: 'Predator\'s Focus! Immune to FEAR!', tier: 'hit' })
      }

      // Unshakeable (stone mind): immune to DAZE
      if (mindG && mindG.effect === 'condition_immunity' && r.conditionApplied === mindG.condition) {
        pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== r.conditionApplied })
        r.conditionApplied = null
        addLog({ type: 'player', text: mindG.name + '! Immune to ' + condName(mindG.condition) + '!', tier: 'hit' })
      }

      // Mountain Mind (stone mind): 50% resist FEAR/DAZE/CHARM
      if (mindG && mindG.effect === 'mind_condition_resist' && r.conditionApplied) {
        var mindConds = ['FEAR', 'DAZE', 'CHARM']
        if (mindConds.indexOf(r.conditionApplied) !== -1 && rollGiftChance(mindG.value)) {
          pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== r.conditionApplied })
          addLog({ type: 'player', text: mindG.name + '! Resisted ' + condName(r.conditionApplied) + '!', tier: 'hit' })
          r.conditionApplied = null
        }
      }

      // Skip immunity (Void Anchor): immune to DAZE/CHARM/NAUSEA skip effects
      if (shieldG && shieldG.effect === 'skip_immunity' && r.conditionApplied) {
        var skipConditions = ['DAZE', 'CHARM', 'NAUSEA']
        if (skipConditions.indexOf(r.conditionApplied) !== -1) {
          pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== r.conditionApplied })
          addLog({ type: 'player', text: 'Void Anchor! Immune to ' + condName(r.conditionApplied) + '!', tier: 'hit' })
          r.conditionApplied = null
        }
      }

      // Condition reflect (Void Skin — 25% chance condition hits attacker instead)
      if (bodyG && bodyG.effect === 'condition_reflect' && r.conditionApplied && attackerEnemy && !attackerEnemy.isDown) {
        if (rollGiftChance(bodyG.chance)) {
          // Remove from player, apply to attacker
          pState.statusEffects = (pState.statusEffects || []).filter(function(c) { return c.id !== r.conditionApplied })
          attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], r.conditionApplied, 'gift')
          addLog({ type: 'condition', text: 'Void Skin! ' + condName(r.conditionApplied) + ' reflected to ' + attackerEnemy.name + '!', tier: 'crit' })
        }
      }

      // Chaos Reroll (void mind): force enemy to reroll — once per combat
      if (mindG && mindG.effect === 'force_reroll' && !chaosRerollUsed && r.damage > 0 && attackerEnemy) {
        setChaosRerollUsed(true)
        // Reroll — resolve a new enemy attack and use the lower damage
        var reroll = resolveEnemyAttack(updatedBattle, r.attackerId)
        if (reroll && reroll.result.damage < r.damage) {
          var savedDmg = r.damage - reroll.result.damage
          pState.currentHp = Math.min(pState.currentHp + savedDmg, pState.maxHp)
          addLog({ type: 'player', text: 'Chaos Reroll! Enemy forced to reroll — saved ' + savedDmg + ' damage!', tier: 'crit' })
        } else {
          addLog({ type: 'player', text: 'Chaos Reroll! Enemy forced to reroll — no improvement.', tier: 'glancing' })
        }
      }

      // Mirror: reflect next enemy attack back at them
      if (reflectNextAttack && attackerEnemy && !attackerEnemy.isDown && r.damage > 0) {
        pState.currentHp = Math.min(pState.currentHp + r.damage, pState.maxHp) // undo damage to player
        attackerEnemy.currentHp = Math.max(0, attackerEnemy.currentHp - r.damage) // deal to attacker
        setReflectNextAttack(false)
        addLog({ type: 'player', text: 'MIRROR! ' + attackerEnemy.name + ' attacks their own reflection for ' + r.damage + ' damage!', tier: 'crit' })
        if (attackerEnemy.currentHp <= 0) { attackerEnemy.isDown = true; addLog({ type: 'player', text: attackerEnemy.name + ' felled by their own attack!', tier: 'crit' }) }
      }

      // Shadow Step (void body): first attack auto-miss
      if (bodyG && bodyG.effect === 'first_hit_dodge' && !shadowStepUsed) {
        pState.currentHp = Math.min(pState.currentHp + r.damage, pState.maxHp)
        setShadowStepUsed(true)
        addLog({ type: 'player', text: 'Shadow Step! Attack passes through you!', tier: 'crit' })
      }

      // Iron Will (blood shield): survive lethal, once per combat
      if (shieldG && shieldG.effect === 'last_stand' && pState.currentHp <= 0 && !ironWillUsed) {
        pState.currentHp = 1
        setIronWillUsed(true)
        addLog({ type: 'player', text: 'Iron Will! Survived at 1 HP!', tier: 'crit' })
      }

      // --- WEAPON GIFTS (defensive — some weapon gifts trigger on being hit) ---

      // Reflect condition from weapon (Vine Bind on being hit — no longer used but keep pattern)
      if (weaponGDef && weaponGDef.effect === 'reflect_condition' && attackerEnemy && !attackerEnemy.isDown && rollGiftChance(weaponGDef.chance)) {
        attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], weaponGDef.condition, 'gift')
        addLog({ type: 'condition', text: weaponGDef.name + '! ' + attackerEnemy.name + ' ' + condName(weaponGDef.condition) + '!', tier: 'hit' })
      }

      // --- MIND GIFTS (defensive) ---

      // Reflect condition from mind (Fungal Confusion)
      if (mindG && mindG.effect === 'reflect_condition' && attackerEnemy && !attackerEnemy.isDown && rollGiftChance(mindG.chance)) {
        attackerEnemy.statusEffects = applyConditionToEffects(attackerEnemy.statusEffects || [], mindG.condition, 'gift')
        addLog({ type: 'condition', text: mindG.name + '! ' + attackerEnemy.name + ' ' + condName(mindG.condition) + '!', tier: 'crit' })
      }

      // Condition shorten (Deep Roots)
      if (mindG && mindG.effect === 'condition_shorten' && r.conditionApplied && pState) {
        var playerEffects = pState.statusEffects || []
        for (var dri = 0; dri < playerEffects.length; dri++) {
          if (playerEffects[dri].slot === mindG.slot && playerEffects[dri].turnsRemaining > 1) {
            playerEffects[dri].turnsRemaining = Math.max(1, playerEffects[dri].turnsRemaining - mindG.reduction)
          }
        }
        addLog({ type: 'player', text: mindG.name + ': condition duration shortened!', tier: 'hit' })
      }

      // Mind condition resist (Mountain Mind — 50% resist FEAR/DAZE/CHARM)
      // Handled via checkConditionResist in combat.js

      // Decay Aura (bile shield): passive 1 HP/turn to enemies — handled in enemy turn tick
    }

    // God mode: invincible — HP never below 1
    if (pState && character.godInvincible && pState.currentHp <= 0) {
      pState.currentHp = 1
    }
    if (pState) setPlayerHp(pState.currentHp)

    // Track damage taken
    if (r.damage > 0) trackStat('damageTaken', r.damage)
    if (r.attackRoll && r.attackRoll.tierName === 'crit') trackStat('critsReceived', 1)

    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'victory') {
      // Enemy killed by reflect/counter/gift during their own attack
      var xpGainedReflect = calculateXp(updatedBattle)
      var newXpReflect = totalXp + xpGainedReflect
      setTotalXp(newXpReflect)
      setLastXpGained(xpGainedReflect)
      checkLevelUp(newXpReflect)
      setBattle(updatedBattle)
      setEnemyAttackInfo(null)
      guardedSetCombatPhase('victory')
      var reflectZone = Object.assign({}, zone, {
        chambers: zone.chambers.map(function(ch) {
          if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
          return ch
        })
      })
      setZone(reflectZone)
      setChambersCleared(chambersCleared + 1)
      return
    }
    if (endResult === 'defeat') {
      // Track death context
      var killerEnemy = updatedBattle.enemies.find(function(e) { return e.id === r.attackerId })
      trackStat('killedBy', killerEnemy ? killerEnemy.archetypeKey : 'unknown')
      trackStat('killedByTier', killerEnemy ? killerEnemy.tierKey : 'unknown')
      var deathChamber = zone ? zone.chambers[zone.playerPosition] : null
      trackStat('killedInChamber', deathChamber ? deathChamber.type : 'unknown')
      setBattle(updatedBattle)
      setEnemyAttackInfo(null)
      setPlayerHp(0)
      guardedSetPhase('defeat')
      return
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setEnemyAttackInfo(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    guardedSetCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === PLAYER TURN ===
  // Tap-gated condition resolution — no timers, all player-driven
  var [playerConditionTicked, setPlayerConditionTicked] = useState(false)
  var [playerTurnAnnounced, setPlayerTurnAnnounced] = useState(false)
  var [playerConditionMessages, setPlayerConditionMessages] = useState([]) // messages to tap through
  var [playerConditionIndex, setPlayerConditionIndex] = useState(-1) // -1 = show "Your Turn", 0+ = showing messages
  var [playerTurnSkipped, setPlayerTurnSkipped] = useState(false) // was turn skipped by conditions?
  var [playerTickBattle, setPlayerTickBattle] = useState(null) // battle state after tick (for advancing on skip)

  // Tick conditions when playerTurn starts — compute messages but don't auto-advance
  useEffect(function() {
    if (combatPhase !== 'playerTurn' || !battle || playerTurnAnnounced) return
    var playerUid = user.uid
    var player = battle.players[playerUid]

    // Tick bombs
    if (activeBombs.length > 0) {
      var updatedBombs = []
      var bombBattle = Object.assign({}, battle, { enemies: battle.enemies.map(function(e) { return Object.assign({}, e) }) })
      for (var bi = 0; bi < activeBombs.length; bi++) {
        var bomb = Object.assign({}, activeBombs[bi], { fuseLeft: activeBombs[bi].fuseLeft - 1 })
        if (bomb.fuseLeft <= 0) {
          addLog({ type: 'player', text: bomb.name + ' EXPLODES!', tier: 'crit' })
          bombBattle.enemies.forEach(function(e) {
            if (e.isDown) return
            if (bomb.explosionDamage) { e.currentHp = Math.max(0, e.currentHp - bomb.explosionDamage); if (e.currentHp <= 0) e.isDown = true }
            if (bomb.explosionCondition) { for (var bsi = 0; bsi < (bomb.explosionStacks || 1); bsi++) { e.statusEffects = applyConditionToEffects(e.statusEffects || [], bomb.explosionCondition, 'bomb') } }
            if (bomb.explosionCondition2) { e.statusEffects = applyConditionToEffects(e.statusEffects || [], bomb.explosionCondition2, 'bomb') }
            if (bomb.explosionRandomCondition) { var rc = ['BLEED','POISON','BURN','FROST','DAZE','FEAR','BLIND','NAUSEA']; e.statusEffects = applyConditionToEffects(e.statusEffects || [], rc[Math.floor(Math.random()*rc.length)], 'bomb') }
          })
        } else {
          updatedBombs.push(bomb)
        }
      }
      setActiveBombs(updatedBombs)
      setBattle(bombBattle)
    }

    // No conditions? Go straight to action
    if (!player || !player.statusEffects || player.statusEffects.length === 0) {
      setPlayerTurnAnnounced(true)
      setPlayerConditionTicked(true)
      setPlayerConditionMessages([])
      setPlayerConditionIndex(-1)
      setPlayerTurnSkipped(false)
      return
    }

    // Tick conditions and build message queue
    var tickResult = tickTurnStart(battle, playerUid)

    // Gift: Lick Wounds (blood body) — BLEED heals instead of damaging
    var bodyGiftTick = giftSlots.body
    if (bodyGiftTick && bodyGiftTick.effect === 'bleed_heal_and_buff') {
      var hasBleedTick = player.statusEffects.some(function(c) { return c.id === 'BLEED' })
      if (hasBleedTick && tickResult.damage > 0) {
        // Bleed damage was dealt — invert to heal
        var bleedCond = player.statusEffects.find(function(c) { return c.id === 'BLEED' })
        var bleedDmg = bleedCond ? (bleedCond.stacks || 1) : 1
        var pTick = tickResult.newBattle.players[playerUid]
        if (pTick) {
          // Undo bleed damage + heal instead
          pTick.currentHp = Math.min(pTick.currentHp + bleedDmg * 2, pTick.maxHp) // undo + heal
          tickResult.damage = Math.max(0, tickResult.damage - bleedDmg)
        }
        tickResult.narrative = (tickResult.narrative || '') + ' Lick Wounds! Bleed heals ' + bleedDmg + ' HP!'
      }
    }

    // Gift: Bile Blood (bile body) — POISON heals instead of damaging
    if (bodyGiftTick && bodyGiftTick.effect === 'poison_heal') {
      var hasPoisonTick = player.statusEffects.some(function(c) { return c.id === 'POISON' })
      if (hasPoisonTick && tickResult.damage > 0) {
        var poisonCond = player.statusEffects.find(function(c) { return c.id === 'POISON' })
        var poisonDmg = poisonCond ? (poisonCond.damagePerTurn || 2) : 2
        var pTick2 = tickResult.newBattle.players[playerUid]
        if (pTick2) {
          pTick2.currentHp = Math.min(pTick2.currentHp + poisonDmg + bodyGiftTick.value, pTick2.maxHp) // undo + heal
          tickResult.damage = Math.max(0, tickResult.damage - poisonDmg)
        }
        tickResult.narrative = (tickResult.narrative || '') + ' Bile Blood! Poison heals ' + bodyGiftTick.value + ' HP!'
      }
    }

    var messages = []

    // Only show important condition messages (skips, adrenaline) — routine damage is visible via HP bar
    if (tickResult.narrative) {
      var parts = tickResult.narrative.split('. ').filter(function(s) { return s.trim() })
      for (var ni = 0; ni < parts.length; ni++) {
        var part = parts[ni].replace(/\.+$/, '')
        if (part.indexOf('turn lost') !== -1 || part.indexOf('paralysed') !== -1 || part.indexOf('skip') !== -1) {
          messages.push({ text: part, tier: 'miss' })
        } else if (part.indexOf('ADRENALINE') !== -1) {
          messages.push({ text: part, tier: 'crit' })
        }
        // Skip routine damage narratives (Bleeding: X, Poison drains, etc.)
      }
    }

    // Damage is visible via HP bar — no need for a separate message

    setBattle(tickResult.newBattle)
    setPlayerHp(tickResult.newBattle.players[playerUid].currentHp)
    setPlayerTickBattle(tickResult.newBattle)

    if (tickResult.died) {
      setPlayerHp(0)
      guardedSetPhase('defeat')
      return
    }

    // Set up tap-through sequence
    setPlayerTurnAnnounced(true)
    setPlayerTurnSkipped(tickResult.skipped)
    setPlayerConditionMessages(messages)
    setPlayerConditionIndex(messages.length > 0 ? -1 : -2) // -1 = show "Your Turn" first, -2 = no messages, skip to action
    if (messages.length === 0) {
      setPlayerConditionTicked(true)
    }
  }, [combatPhase, battle, playerTurnAnnounced])

  // Handle tapping through condition messages
  function handleConditionTap() {
    var nextIdx = playerConditionIndex + 1
    if (nextIdx < playerConditionMessages.length) {
      // Show next message
      addLog({ type: 'condition', text: playerConditionMessages[nextIdx].text, tier: playerConditionMessages[nextIdx].tier })
      setPlayerConditionIndex(nextIdx)
    } else if (playerTurnSkipped) {
      // All messages shown, turn was skipped — show skip banner
      guardedSetCombatPhase('playerSkipped')
    } else {
      // All messages shown, turn proceeds — show action buttons
      setPlayerConditionTicked(true)
    }
  }

  // Handle tap on playerSkipped banner
  function handleSkippedTap() {
    if (combatPhase !== 'playerSkipped' || !playerTickBattle) return
    var nextB = advanceTurn(playerTickBattle)
    setBattle(nextB)
    var nextA = getActor(nextB, getCurrentTurnId(nextB))
    guardedSetCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    setPlayerConditionTicked(false)
    setPlayerTurnAnnounced(false)
    setPlayerConditionMessages([])
    setPlayerConditionIndex(-1)
    setPlayerTurnSkipped(false)
    setPlayerTickBattle(null)
  }

  // Reset condition tick flags when combat phase changes away from playerTurn
  useEffect(function() {
    if (combatPhase !== 'playerTurn' && combatPhase !== 'playerSkipped') {
      setPlayerConditionTicked(false)
      setPlayerTurnAnnounced(false)
      setPlayerConditionMessages([])
      setPlayerConditionIndex(-1)
      setPlayerTurnSkipped(false)
      setPlayerTickBattle(null)
    }
  }, [combatPhase])

  // Auto-select target: if only one living enemy, select it automatically
  // Also validate existing selection — if selected target died, pick a live one
  useEffect(function() {
    if (combatPhase !== 'playerTurn' || !battle) return
    var livingEnemies = battle.enemies.filter(function(e) { return !e.isDown })
    if (livingEnemies.length === 0) return

    // If current selection is still alive, keep it
    if (selectedTarget && livingEnemies.some(function(e) { return e.id === selectedTarget })) return

    // Auto-select the only living enemy, or clear if multiple
    if (livingEnemies.length === 1) {
      setSelectedTarget(livingEnemies[0].id)
      setPendingAttackResult(null)
    }
  }, [combatPhase, battle])

  function handleSelectTarget(enemyId) {
    setSelectedTarget(enemyId)
    setPendingAttackResult(null)
  }

  var playerState = battle ? battle.players[user.uid] : null
  var strMod = playerState ? getModifier(playerState.combatStats.str) : 0
  var accuracyBonus = (character.equipped && character.equipped.weapon && character.equipped.weapon.accuracyBonus) || 0
  var currentTurnId = battle ? getCurrentTurnId(battle) : null
  var isPlayerTurn = currentTurnId === user.uid && combatPhase === 'playerTurn' && playerConditionTicked
  var activeEnemyId = enemyAttackInfo ? enemyAttackInfo.attackOut.result.attackerId : null

  // Crit threshold: base 20, lowered by LCK modifier and crit_bonus relics
  var lckMod = getModifier(character.stats.lck || 10)
  var unarmedCritBonus = 0
  if (!character.equipped || !character.equipped.weapon) {
    var allPassiveForCrit = getAllPassiveItems(character.equipped)
    for (var ucbi = 0; ucbi < allPassiveForCrit.length; ucbi++) {
      if (allPassiveForCrit[ucbi].unarmedBonus && allPassiveForCrit[ucbi].unarmedCritBonus) {
        unarmedCritBonus += allPassiveForCrit[ucbi].unarmedCritBonus
      }
    }
  }
  var critThreshold = 20 - getPassiveTotal(character.equipped, 'crit_bonus') - lckMod - unarmedCritBonus

  // Can equip: between rooms OR during combat when all enemies stunned
  var allEnemiesStunned = battle && battle.enemies.every(function(e) {
    if (e.isDown) return true
    return e.statusEffects && e.statusEffects.some(function(c) {
      return c.id === 'DAZE' || c.id === 'FROST' || c.id === 'CHARM'
    })
  })
  var canEquipNow = gamePhase === 'doors' || (gamePhase === 'combat' && isPlayerTurn && allEnemiesStunned)

  // Direct attack — click enemy card to attack without going through CombatRoller button
  function handlePlayerAttackDirect(enemyId) {
    if (isCombatGuarded() || pendingAttackResult) return
    setSelectedTarget(enemyId)
    var rollResult = d20Attack(strMod + accuracyBonus, critThreshold)
    if (godModeRef.current) {
      rollResult = { roll: 20, modifier: strMod, total: 20 + strMod, tier: 1, tierName: 'crit' }
    }
    var attackOut = resolvePlayerAttack(battle, user.uid, enemyId, rollResult)
    if (attackOut && godModeRef.current) {
      var target = attackOut.newBattle.enemies.find(function(e) { return e.id === enemyId })
      if (target) {
        var overkill = target.currentHp + target.maxHp
        target.currentHp = 0
        target.isDown = true
        attackOut.result.damage = overkill
        attackOut.result.enemyDefeated = true
        if (attackOut.result.damageBreakdown) attackOut.result.damageBreakdown.final = overkill
      }
    }
    if (attackOut) setPendingAttackResult(attackOut)
  }

  function handlePlayerAttackRoll() {
    var rollResult = d20Attack(strMod + accuracyBonus, critThreshold)
    if (godModeRef.current) {
      rollResult = { roll: 20, modifier: strMod, total: 20 + strMod, tier: 1, tierName: 'crit' }
    }
    var attackOut = resolvePlayerAttack(battle, user.uid, selectedTarget, rollResult)
    if (attackOut && godModeRef.current) {
      // One-hit kill: set damage to enemy's full HP
      var target = attackOut.newBattle.enemies.find(function(e) { return e.id === selectedTarget })
      if (target) {
        var overkill = target.currentHp + target.maxHp
        target.currentHp = 0
        target.isDown = true
        attackOut.result.damage = overkill
        attackOut.result.enemyDefeated = true
        if (attackOut.result.damageBreakdown) attackOut.result.damageBreakdown.final = overkill
      }
    }
    if (attackOut) setPendingAttackResult(attackOut)
    return rollResult
  }

  function handlePlayerComplete() {
    if (isCombatGuarded()) return
    if (!pendingAttackResult) return
    var attackOut = pendingAttackResult
    var r = attackOut.result
    var logEntry = formatAttackLog(r, 'player')
    addLog({ type: 'player', text: logEntry.text, tier: logEntry.tier })
    if (r.adrenalineCrit) {
      addLog({ type: 'condition', text: 'ADRENALINE surge! +6 STR!', tier: 'crit' })
    }
    if (r.doubleStrike) {
      addLog({ type: 'player', text: 'Double strike! ' + r.doubleStrikeDamage + ' bonus damage!', tier: 'crit' })
    }
    if (r.doubleStrikeCondition) {
      addLog({ type: 'condition', text: 'Double strike applies ' + condName(r.doubleStrikeCondition) + '!', tier: 'hit' })
    }
    if (r.lowHpBonus) {
      addLog({ type: 'player', text: 'Blood Bead pulses! 1.5x damage!', tier: 'crit' })
    }
    if (r.firstHitCrit) {
      addLog({ type: 'player', text: 'Executioner\'s Coin! 2x damage!', tier: 'crit' })
    }
    if (r.voidStrike) {
      addLog({ type: 'player', text: 'Void Strike! DEF ignored completely!', tier: 'crit' })
    }
    if (r.shadowBlade) {
      addLog({ type: 'player', text: 'Shadow Blade! Miss turns to glancing blow!', tier: 'hit' })
    }
    if (r.entropyHigh) {
      addLog({ type: 'player', text: 'Entropy Edge surges! +50% damage!', tier: 'crit' })
    }
    if (r.entropyLow) {
      addLog({ type: 'player', text: 'Entropy Edge falters... -25% damage.', tier: 'miss' })
    }
    if (r.metronomeCrit) {
      addLog({ type: 'player', text: 'Metronome! Tick tick tick... BOOM! Forced crit!', tier: 'crit' })
    }
    if (r.gremlinBell) {
      addLog({ type: 'player', text: 'Gremlin Bell! Nat 1 reversed — ' + condName(r.gremlinCondition) + ' applied to enemy!', tier: 'crit' })
    }
    if (r.pressureCookerDetonated) {
      addLog({ type: 'player', text: 'PRESSURE COOKER DETONATES! 15 AoE + BURN + DAZE all enemies!', tier: 'crit' })
    }
    if (r.pressureCookerCount) {
      addLog({ type: 'player', text: 'Pressure builds... (' + r.pressureCookerCount + '/5)', tier: 'miss' })
    }
    if (r.coinFlipWin) {
      addLog({ type: 'player', text: 'Coin Flip: Heads! +3 damage!', tier: 'hit' })
    }
    if (r.coinFlipLose) {
      addLog({ type: 'player', text: 'Coin Flip: Tails. -2 damage.', tier: 'miss' })
    }
    if (r.doubleOrNothingWin) {
      addLog({ type: 'player', text: 'DOUBLE OR NOTHING: DOUBLE! Crit damage doubled!', tier: 'crit' })
    }
    if (r.doubleOrNothingLose) {
      addLog({ type: 'player', text: 'DOUBLE OR NOTHING: Nothing. Crit becomes a whiff.', tier: 'miss' })
    }
    if (r.eggTimerBonus) {
      addLog({ type: 'player', text: 'Egg Timer dings! +50% damage from impatience!', tier: 'hit' })
    }
    if (r.chaosBackfire) {
      addLog({ type: 'player', text: 'Chaos Blade backfires! You take 3 damage!', tier: 'miss' })
      setPlayerHp(function(hp) { return Math.max(1, hp - 3) })
    }
    if (r.chaosCondition) {
      addLog({ type: 'condition', text: 'Chaos Blade: the dice choose ' + condName(r.chaosCondition) + '!', tier: 'hit' })
    }
    if (r.chaosDevastation) {
      addLog({ type: 'condition', text: 'CHAOS BLADE: DEVASTATION! ALL conditions applied!', tier: 'crit' })
    }
    if (r.magic8Ball) {
      var m8texts = {
        instakill: 'MAGIC 8-BALL: "It is certain." INSTAKILL!',
        full_heal: 'MAGIC 8-BALL: "Outlook good." Full heal!',
        double_gold: 'MAGIC 8-BALL: "Signs point to yes." Double gold from this fight!',
        fear_self: 'MAGIC 8-BALL: "Don\'t count on it." FEAR applied to you!',
        daze_all: 'MAGIC 8-BALL: "Without a doubt." All enemies DAZED!',
        nothing: 'MAGIC 8-BALL: "Reply hazy." Nothing happens.',
      }
      addLog({ type: 'player', text: m8texts[r.magic8BallEffect] || 'Magic 8-Ball activates!', tier: r.magic8BallEffect === 'instakill' ? 'crit' : r.magic8BallEffect === 'fear_self' ? 'miss' : 'hit' })
      if (r.magic8BallEffect === 'full_heal') setPlayerHp(character.maxHp)
      if (r.magic8BallEffect === 'fear_self' && battle) {
        var fearPlayers = {}
        Object.keys(attackOut.newBattle.players).forEach(function(uid) {
          var p = attackOut.newBattle.players[uid]
          fearPlayers[uid] = Object.assign({}, p, { statusEffects: applyConditionToEffects(p.statusEffects || [], 'FEAR', 'magic_8_ball') })
        })
        attackOut.newBattle = Object.assign({}, attackOut.newBattle, { players: fearPlayers })
      }
    }
    if (r.nukeTriggered) {
      addLog({ type: 'player', text: 'BIG RED BUTTON! Dice matched — EVERYTHING DIES!', tier: 'crit' })
      // Remove the nuke relic from inventory
      if (character.equipped && character.equipped.relics) {
        character.equipped.relics = character.equipped.relics.filter(function(rel) { return rel.passiveEffect !== 'nuke' })
      }
    }
    if (r.lifestealHeal) {
      addLog({ type: 'player', text: 'Lifesteal: healed ' + r.lifestealHeal + ' HP.', tier: 'hit' })
    }
    if (r.rerolled) {
      addLog({ type: 'player', text: 'Loaded Dice: rerolled a 1!', tier: 'hit' })
    }
    if (r.attackRoll && r.attackRoll.nudge) {
      addLog({ type: 'player', text: 'Montor\'s Nudge: +' + r.attackRoll.nudge + ' to roll!', tier: 'hit' })
    }
    if (r.attackRoll && r.attackRoll.chaosShift) {
      var shift = r.attackRoll.chaosShift
      addLog({ type: 'player', text: 'Chaos Marble: dice shifted ' + (shift > 0 ? '+' : '') + shift + '!', tier: shift > 0 ? 'crit' : 'miss' })
    }
    if (r.offhandHit) {
      addLog({ type: 'player', text: 'Off-hand strike! ' + r.offhandDamage + ' bonus damage!', tier: 'hit' })
    } else if (r.offhandMiss) {
      addLog({ type: 'player', text: 'Off-hand swings... misses.', tier: 'miss' })
    }
    if (r.twinFangs) {
      addLog({ type: 'condition', text: 'Twin Fangs! Both blades connect — ' + r.target + ' bleeds!', tier: 'crit' })
    }
    if (r.offhandCondition) {
      addLog({ type: 'condition', text: r.target + ' is now ' + condName(r.offhandCondition) + '! (off-hand)', tier: 'hit' })
    }
    if (r.conditionApplied) {
      addLog({ type: 'condition', text: r.target + ' is now ' + condName(r.conditionApplied) + '!', tier: 'hit' })
    }
    // Check if BLEED stacking triggered FEAR
    var hitEnemyForFear = attackOut.newBattle.enemies.find(function(e) { return e.id === (r.targetId || selectedTarget) })
    if (hitEnemyForFear && hitEnemyForFear.statusEffects && hitEnemyForFear.statusEffects._bleedTriggeredFear) {
      addLog({ type: 'condition', text: 'BLEED reaches critical — ' + r.target + ' consumed by FEAR!', tier: 'crit' })
      hitEnemyForFear.statusEffects._bleedTriggeredFear = false
    }
    if (r.doubleCondition) {
      addLog({ type: 'condition', text: 'Magnifying Glass: ' + condName(r.conditionApplied) + ' applied twice!', tier: 'crit' })
    }
    if (r.staggerApplied) {
      addLog({ type: 'condition', text: 'Stagger! ' + r.target + ' is Dazed!', tier: 'hit' })
    }
    if (r.conditionReaction) {
      addLog({ type: 'condition', text: r.conditionReaction.narrative, tier: 'crit' })
      // Handle AoE reaction (STEAM → BLIND all)
      if (r.conditionReaction.aoeCondition && attackOut.newBattle) {
        attackOut.newBattle.enemies.forEach(function(e) {
          if (!e.isDown) {
            e.statusEffects = applyConditionToEffects(e.statusEffects || [], r.conditionReaction.aoeCondition, 'reaction')
          }
        })
      }
    }
    // Lottery ticket — winning roll awards a random rare item
    if (r.lotteryWin) {
      var rareItems = Object.values(ITEMS).filter(function(it) { return it.rarity === 'rare' })
      if (rareItems.length > 0) {
        var prize = Object.assign({}, rareItems[Math.floor(Math.random() * rareItems.length)])
        setPlayerInventory(function(prev) { return prev.concat([prize]) })
        var dieText = r.lotteryDie === 'BOTH!' ? 'DOUBLE JACKPOT! Both dice match' : 'JACKPOT! ' + r.lotteryDie + ' rolled ' + r.lotteryNumber
        addLog({ type: 'player', text: dieText + '! Won: ' + prize.name + '!', tier: 'crit' })
        // Remove the matched number so each number only wins once
        if (character.equipped && character.equipped.relics) {
          for (var lri = 0; lri < character.equipped.relics.length; lri++) {
            var lr = character.equipped.relics[lri]
            if (lr.passiveEffect === 'lottery') {
              if (r.lotteryDie === 'd20' || r.lotteryDie === 'BOTH!') lr.lotteryD20 = null
              if (r.lotteryDie === 'weapon' || r.lotteryDie === 'BOTH!') lr.lotteryWeapon = null
            }
          }
        }
      }
    }
    // === GIFT EFFECTS ON PLAYER ATTACK ===
    var giftBattle = attackOut.newBattle
    var weaponG = giftSlots.weapon
    var mindG2 = giftSlots.mind
    var bodyG2 = giftSlots.body
    var hitTarget = giftBattle.enemies.find(function(e) { return e.id === (r.targetId || selectedTarget) })

    if (r.damage > 0 && hitTarget && !hitTarget.isDown) {
      var wt3 = character.equipped && character.equipped.weapon ? character.equipped.weapon.weaponType : 'fists'

      // --- CLASS-SPECIFIC WEAPON GIFTS (all gifts are now weapon-type specific) ---
      if (weaponG && weaponG.appliedWeaponType === wt3) {
        var eff = weaponG.effect

        // === PETAL ===
        if (eff === 'double_strike_bleed' && r.doubleStrike) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'BLEED', 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! Stacking bleed on ' + hitTarget.name + '!', tier: 'crit' })
        }
        if (eff === 'hit_skip_chance' && rollGiftChance(weaponG.chance)) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'DAZE', 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' entangled!', tier: 'crit' })
        }
        if (eff === 'bonus_damage_and_first_hit_condition' && !weaponG._firstHitUsed) {
          for (var trsi = 0; trsi < (weaponG.conditionStacks || 1); trsi++) {
            hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          }
          weaponG._firstHitUsed = true
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' bleeds!', tier: 'hit' })
        }
        if (eff === 'def_ignore_condition' && r.damageBreakdown && r.damageBreakdown.defIgnored) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' DAZED!', tier: 'hit' })
        }
        if (eff === 'kill_heal_and_buff' && r.enemyDefeated) {
          setPlayerHp(function(hp) { return Math.min(hp + weaponG.healValue, character.maxHp) })
          setHarvestBuff(weaponG.buffDamage)
          addLog({ type: 'player', text: weaponG.name + '! Heal ' + weaponG.healValue + ' HP + next hit +' + weaponG.buffDamage + ' damage!', tier: 'crit' })
        }
        if (eff === 'hit_condition_and_damage' && rollGiftChance(weaponG.chance)) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          hitTarget.currentHp = Math.max(0, hitTarget.currentHp - weaponG.bonusDamage)
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' ' + condName(weaponG.condition) + ' + ' + weaponG.bonusDamage + ' damage!', tier: 'crit' })
          if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
        }

        // === STONE ===
        // Tremor Flurry (dagger): double strikes +40% stagger
        if (eff === 'double_strike_stagger' && r.doubleStrike && rollGiftChance(weaponG.value)) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'DAZE', 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' staggered by double strike!', tier: 'crit' })
        }
        // Granite Edge (sword): 2x damage on dazed enemies
        if (eff === 'dazed_damage_multiplier') {
          var isDazed = hitTarget.statusEffects && hitTarget.statusEffects.some(function(c) { return c.id === 'DAZE' })
          if (isDazed) {
            var geBonusDmg = r.damage // double it
            hitTarget.currentHp = Math.max(0, hitTarget.currentHp - geBonusDmg)
            r.damage += geBonusDmg
            addLog({ type: 'player', text: weaponG.name + '! 2x damage on staggered enemy! +' + geBonusDmg + '!', tier: 'crit' })
            if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
          }
        }
        // Quake Thrust (spear): first hit DAZE + 5 damage
        if (eff === 'first_hit_daze_and_damage' && !weaponG._firstHitUsed) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'DAZE', 'gift')
          hitTarget.currentHp = Math.max(0, hitTarget.currentHp - weaponG.bonusDamage)
          r.damage += weaponG.bonusDamage
          weaponG._firstHitUsed = true
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' DAZED + ' + weaponG.bonusDamage + ' bonus damage!', tier: 'crit' })
          if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
        }
        // Tectonic Slam (mace): stagger extended + bonus — handled partially in combat.js stagger section
        if (eff === 'stagger_extended' && r.staggerApplied) {
          var dazeCond = hitTarget.statusEffects && hitTarget.statusEffects.find(function(c) { return c.id === 'DAZE' })
          if (dazeCond) dazeCond.turnsRemaining = weaponG.dazeTurns || 2
          addLog({ type: 'condition', text: weaponG.name + '! Stagger lasts ' + (weaponG.dazeTurns || 2) + ' turns!', tier: 'hit' })
        }
        // Landslide (axe): kills deal AoE
        if (eff === 'kill_aoe_damage' && r.enemyDefeated) {
          giftBattle.enemies.forEach(function(e) {
            if (!e.isDown && e.id !== hitTarget.id) {
              e.currentHp = Math.max(0, e.currentHp - weaponG.value)
              if (e.currentHp <= 0) e.isDown = true
            }
          })
          addLog({ type: 'player', text: weaponG.name + '! ' + weaponG.value + ' AoE damage!', tier: 'crit' })
        }
        // Stonefist (fists): unarmed upgrade + stagger — die handled in combat.js, stagger here
        if (eff === 'unarmed_upgrade_and_stagger' && rollGiftChance(weaponG.staggerChance)) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'DAZE', 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' staggered!', tier: 'hit' })
        }

        // === BILE ===
        // Venom Flurry (dagger): 40% poison on all hits
        // Toxic Touch (fists): 40% poison, extended duration
        if ((eff === 'hit_condition' || eff === 'hit_condition_extended') && rollGiftChance(weaponG.chance)) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          if (eff === 'hit_condition_extended') {
            var extCond = hitTarget.statusEffects.find(function(c) { return c.id === weaponG.condition })
            if (extCond && extCond.turnsRemaining) extCond.turnsRemaining = weaponG.conditionTurns
          }
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' ' + condName(weaponG.condition) + '!', tier: 'hit' })
        }
        // Acid Edge (sword): DEF shred
        if (eff === 'def_shred' && rollGiftChance(weaponG.chance || 1.0)) {
          hitTarget.stats = Object.assign({}, hitTarget.stats, { def: Math.max(0, (hitTarget.stats.def || 0) - weaponG.value) })
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' DEF -' + weaponG.value + ' (' + hitTarget.stats.def + ' remaining)!', tier: 'hit' })
        }
        // Plague Reach (spear): weapon poison spreads to 1 other enemy
        if (eff === 'poison_spread_on_hit' && r.conditionApplied === 'POISON') {
          var otherEnemies = giftBattle.enemies.filter(function(e) { return !e.isDown && e.id !== hitTarget.id })
          if (otherEnemies.length > 0) {
            var spreadTarget = otherEnemies[Math.floor(Math.random() * otherEnemies.length)]
            spreadTarget.statusEffects = applyConditionToEffects(spreadTarget.statusEffects || [], 'POISON', 'gift')
            addLog({ type: 'condition', text: weaponG.name + '! Poison spreads to ' + spreadTarget.name + '!', tier: 'hit' })
          }
        }
        // Festering Crush (mace): stagger applies NAUSEA
        if (eff === 'stagger_condition' && r.staggerApplied) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' ' + condName(weaponG.condition) + ' from stagger!', tier: 'hit' })
        }
        // Putrid Cleave (axe): kills poison all
        if (eff === 'kill_condition_all' && r.enemyDefeated) {
          giftBattle.enemies.forEach(function(e) {
            if (!e.isDown) e.statusEffects = applyConditionToEffects(e.statusEffects || [], weaponG.condition, 'gift')
          })
          addLog({ type: 'condition', text: weaponG.name + '! All enemies ' + condName(weaponG.condition) + '!', tier: 'crit' })
        }

        // === BLOOD ===
        // Crimson Flurry (dagger): double strikes heal
        if (eff === 'double_strike_heal' && r.doubleStrike) {
          setPlayerHp(function(hp) { return Math.min(hp + weaponG.value, character.maxHp) })
          addLog({ type: 'player', text: weaponG.name + '! Healed ' + weaponG.value + ' HP from double strike!', tier: 'hit' })
        }
        // Blood Tithe (sword): each hit heals 1
        if (eff === 'hit_heal') {
          setPlayerHp(function(hp) { return Math.min(hp + weaponG.value, character.maxHp) })
          addLog({ type: 'player', text: weaponG.name + '! Healed ' + weaponG.value + ' HP.', tier: 'hit' })
        }
        // Impale (spear): first hit 3 bleed + pin
        if (eff === 'first_hit_bleed_and_pin' && !weaponG._firstHitUsed) {
          for (var impSi = 0; impSi < (weaponG.bleedStacks || 1); impSi++) {
            hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'BLEED', 'gift')
          }
          if (weaponG.preventFlee && hitTarget.behaviour) hitTarget.behaviour.fleeThreshold = 0
          weaponG._firstHitUsed = true
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' impaled — ' + weaponG.bleedStacks + ' BLEED + pinned!', tier: 'crit' })
        }
        // Bone Breaker (mace): +damage on bleeding
        if (eff === 'bleed_damage_bonus' && hitTarget.statusEffects) {
          var bleedStacks2 = 0
          for (var bsi2 = 0; bsi2 < hitTarget.statusEffects.length; bsi2++) {
            if (hitTarget.statusEffects[bsi2].id === 'BLEED') bleedStacks2 += (hitTarget.statusEffects[bsi2].stacks || 1)
          }
          if (bleedStacks2 > 0) {
            var bbBonus = bleedStacks2 * weaponG.value
            hitTarget.currentHp = Math.max(0, hitTarget.currentHp - bbBonus)
            r.damage += bbBonus
            addLog({ type: 'player', text: weaponG.name + '! +' + bbBonus + ' damage (' + bleedStacks2 + ' bleed stacks)!', tier: 'hit' })
            if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
          }
        }
        // Butcher (axe): kill heals + bleed stacks → STR buff
        if (eff === 'kill_heal_and_bleed_buff' && r.enemyDefeated) {
          setPlayerHp(function(hp) { return Math.min(hp + weaponG.healValue, character.maxHp) })
          var deadBleedStacks = 0
          if (hitTarget.statusEffects) {
            for (var dbs = 0; dbs < hitTarget.statusEffects.length; dbs++) {
              if (hitTarget.statusEffects[dbs].id === 'BLEED') deadBleedStacks += (hitTarget.statusEffects[dbs].stacks || 1)
            }
          }
          if (deadBleedStacks > 0) {
            setActiveBuffs(function(prev) { return prev.concat([{ stat: 'str', value: deadBleedStacks, turnsRemaining: 2 }]) })
          }
          addLog({ type: 'player', text: weaponG.name + '! Heal ' + weaponG.healValue + ' HP' + (deadBleedStacks > 0 ? ' + ' + deadBleedStacks + ' STR buff!' : '!'), tier: 'crit' })
        }
        // Blood Knuckles (fists): 30% bleed + heal from stacks
        if (eff === 'hit_bleed_and_heal' && rollGiftChance(weaponG.chance)) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], 'BLEED', 'gift')
          var bkStacks = 0
          for (var bki = 0; bki < hitTarget.statusEffects.length; bki++) {
            if (hitTarget.statusEffects[bki].id === 'BLEED') bkStacks += (hitTarget.statusEffects[bki].stacks || 1)
          }
          if (bkStacks > 0) setPlayerHp(function(hp) { return Math.min(hp + bkStacks, character.maxHp) })
          addLog({ type: 'condition', text: weaponG.name + '! BLEED + healed ' + bkStacks + ' HP!', tier: 'hit' })
        }

        // === EMBER ===
        // Flash Fire (dagger): double strikes apply BURN
        // Forge Fists: unarmed + condition on all hits
        if (eff === 'double_strike_condition' && r.doubleStrike) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' ' + condName(weaponG.condition) + ' from double strike!', tier: 'crit' })
        }
        if (eff === 'unarmed_upgrade_and_condition') {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' ' + condName(weaponG.condition) + '!', tier: 'hit' })
        }
        // Searing Blade (sword): +damage on burning
        if (eff === 'burning_damage_bonus') {
          var isBurning = hitTarget.statusEffects && hitTarget.statusEffects.some(function(c) { return c.id === 'BURN' })
          if (isBurning) {
            hitTarget.currentHp = Math.max(0, hitTarget.currentHp - weaponG.value)
            r.damage += weaponG.value
            addLog({ type: 'player', text: weaponG.name + '! +' + weaponG.value + ' fire damage on burning enemy!', tier: 'hit' })
            if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
          }
        }
        // Fire Lance (spear): first hit BURN + damage
        if (eff === 'first_hit_burn_and_damage' && !weaponG._firstHitUsed) {
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], weaponG.condition, 'gift')
          hitTarget.currentHp = Math.max(0, hitTarget.currentHp - weaponG.bonusDamage)
          r.damage += weaponG.bonusDamage
          weaponG._firstHitUsed = true
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' BURN + ' + weaponG.bonusDamage + ' burst!', tier: 'crit' })
          if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
        }
        // Slag Hammer (mace): staggered+burning = 2x burst
        if (eff === 'dazed_burning_burst_multiplier') {
          var isDazedBurning = hitTarget.statusEffects && hitTarget.statusEffects.some(function(c) { return c.id === 'DAZE' }) && hitTarget.statusEffects.some(function(c) { return c.id === 'BURN' })
          if (isDazedBurning) {
            var burnCond = hitTarget.statusEffects.find(function(c) { return c.id === 'BURN' })
            if (burnCond && burnCond.burstDamage) {
              burnCond.burstDamage = Math.round(burnCond.burstDamage * weaponG.value)
              addLog({ type: 'condition', text: weaponG.name + '! Staggered + burning = ' + burnCond.burstDamage + ' burst!', tier: 'crit' })
            }
          }
        }
        // Eruption Cleave (axe): kill AoE + BURN all
        if (eff === 'kill_aoe_damage_and_condition' && r.enemyDefeated) {
          giftBattle.enemies.forEach(function(e) {
            if (!e.isDown && e.id !== hitTarget.id) {
              e.currentHp = Math.max(0, e.currentHp - weaponG.aoeDamage)
              e.statusEffects = applyConditionToEffects(e.statusEffects || [], weaponG.condition, 'gift')
              if (e.currentHp <= 0) e.isDown = true
            }
          })
          addLog({ type: 'player', text: weaponG.name + '! ' + weaponG.aoeDamage + ' AoE + ' + condName(weaponG.condition) + ' all!', tier: 'crit' })
        }

        // === VOID ===
        // Phantom Flurry (dagger): offhand enhanced — handled in combat.js
        // Reality Tear (sword): 25% double damage
        if (eff === 'double_damage_chance' && rollGiftChance(weaponG.chance)) {
          var tearBonus = r.damage
          hitTarget.currentHp = Math.max(0, hitTarget.currentHp - tearBonus)
          r.damage += tearBonus
          addLog({ type: 'player', text: weaponG.name + '! Reality tears — double damage! +' + tearBonus + '!', tier: 'crit' })
          if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
        }
        // Void Pierce (spear): random condition on hit
        if (eff === 'random_condition_on_hit' && rollGiftChance(weaponG.chance)) {
          var randomConds = ['BLEED', 'POISON', 'BURN', 'FROST', 'DAZE', 'FEAR', 'BLIND', 'NAUSEA']
          var randomPick = randomConds[Math.floor(Math.random() * randomConds.length)]
          hitTarget.statusEffects = applyConditionToEffects(hitTarget.statusEffects || [], randomPick, 'gift')
          addLog({ type: 'condition', text: weaponG.name + '! ' + hitTarget.name + ' ' + condName(randomPick) + '!', tier: 'hit' })
        }
        // Null Crush (mace): stagger ignores 50% DEF — handled in combat.js
        // Dimensional Rift (axe): kill chain instakill
        if (eff === 'kill_chain_instakill' && r.enemyDefeated && rollGiftChance(weaponG.chance)) {
          var chainTargets = giftBattle.enemies.filter(function(e) { return !e.isDown && e.id !== hitTarget.id })
          if (chainTargets.length > 0) {
            var chainVictim = chainTargets[Math.floor(Math.random() * chainTargets.length)]
            chainVictim.currentHp = 0; chainVictim.isDown = true
            addLog({ type: 'player', text: weaponG.name + '! Reality fractures — ' + chainVictim.name + ' erased!', tier: 'crit' })
          }
        }
        // Shadow Boxing (fists): dodge counter — handled in handleEnemyComplete
      }

      // Napalm (ember mind): enhance BURN from any source — extra turns + linger damage
      if (mindG2 && mindG2.effect === 'burn_linger' && hitTarget.statusEffects) {
        var burnOnTarget = hitTarget.statusEffects.find(function(c) { return c.id === 'BURN' && !c._napalmApplied })
        if (burnOnTarget) {
          burnOnTarget.turnsRemaining = (burnOnTarget.turnsRemaining || 1) + (mindG2.lingerTurns || 1)
          if (!burnOnTarget.damagePerTurn) burnOnTarget.damagePerTurn = 2
          burnOnTarget._napalmApplied = true // don't double-enhance same condition instance
        }
      }

      // Track kills for Scent of Blood
      if (r.enemyDefeated) {
        setKillsThisCombat(function(k) { return k + 1 })
      }

      // Cauterise (ember body): kill a burning enemy → heal 4 HP
      var bodyG2Pre = giftSlots.body
      if (bodyG2Pre && bodyG2Pre.effect === 'burn_kill_heal' && r.enemyDefeated) {
        var deadTarget = giftBattle.enemies.find(function(e) { return e.id === (r.targetId || selectedTarget) })
        var wasBurning = deadTarget && deadTarget.statusEffects && deadTarget.statusEffects.some(function(c) { return c.id === 'BURN' })
        if (wasBurning) {
          setPlayerHp(function(hp) { return Math.min(hp + bodyG2Pre.value, character.maxHp) })
          addLog({ type: 'player', text: 'Cauterise! Healed ' + bodyG2Pre.value + ' HP from burning kill!', tier: 'crit' })
        }
      }

      // Spore Burst (petal body): kill → all others BLIND
      if (bodyG2Pre && bodyG2Pre.effect === 'kill_aoe_condition' && r.enemyDefeated) {
        giftBattle.enemies.forEach(function(e) {
          if (!e.isDown) e.statusEffects = applyConditionToEffects(e.statusEffects || [], bodyG2Pre.condition, 'gift')
        })
        addLog({ type: 'condition', text: bodyG2Pre.name + '! All enemies ' + condName(bodyG2Pre.condition) + '!', tier: 'crit' })
      }

      // Plague Burst (bile body): poisoned enemy dies → all others NAUSEA
      if (bodyG2Pre && bodyG2Pre.effect === 'poison_kill_aoe_condition' && r.enemyDefeated) {
        var deadForPoison = giftBattle.enemies.find(function(e) { return e.id === (r.targetId || selectedTarget) })
        var wasPoisoned = deadForPoison && deadForPoison.statusEffects && deadForPoison.statusEffects.some(function(c) { return c.id === 'POISON' })
        if (wasPoisoned) {
          giftBattle.enemies.forEach(function(e) {
            if (!e.isDown) e.statusEffects = applyConditionToEffects(e.statusEffects || [], bodyG2Pre.condition, 'gift')
          })
          addLog({ type: 'condition', text: bodyG2Pre.name + '! Poison death spreads ' + condName(bodyG2Pre.condition) + ' to all!', tier: 'crit' })
        }
      }

      // Aftershock (stone body): stagger → 3 AoE to others
      if (bodyG2Pre && bodyG2Pre.effect === 'stagger_aoe_damage' && r.staggerApplied) {
        giftBattle.enemies.forEach(function(e) {
          if (!e.isDown && e.id !== hitTarget.id) {
            e.currentHp = Math.max(0, e.currentHp - bodyG2Pre.value)
            if (e.currentHp <= 0) e.isDown = true
          }
        })
        addLog({ type: 'player', text: bodyG2Pre.name + '! ' + bodyG2Pre.value + ' AoE from stagger!', tier: 'crit' })
      }

      // --- MIND GIFTS (offensive) ---

      // Pollen Storm (petal mind): 20% per hit → random condition spreads to 1 other
      if (mindG2 && mindG2.effect === 'hit_spread_random_condition' && r.damage > 0 && rollGiftChance(mindG2.chance)) {
        var spreadConds = ['BLIND', 'NAUSEA', 'FEAR']
        var spreadPick = spreadConds[Math.floor(Math.random() * spreadConds.length)]
        var otherForSpread = giftBattle.enemies.filter(function(e) { return !e.isDown && e.id !== hitTarget.id })
        if (otherForSpread.length > 0) {
          var spreadVictim = otherForSpread[Math.floor(Math.random() * otherForSpread.length)]
          spreadVictim.statusEffects = applyConditionToEffects(spreadVictim.statusEffects || [], spreadPick, 'gift')
          addLog({ type: 'condition', text: mindG2.name + '! ' + condName(spreadPick) + ' spreads to ' + spreadVictim.name + '!', tier: 'hit' })
        }
      }

      // Toxic Cloud (bile mind): conditions applied spread to 1 other (INT scaling)
      if (mindG2 && mindG2.effect === 'condition_spread_on_apply' && r.conditionApplied) {
        var intMod3 = Math.max(0, Math.floor(((character.stats.int || 10) - 10) / 2))
        var spreadChance = mindG2.baseChance + (intMod3 * mindG2.intScaling)
        if (rollGiftChance(spreadChance)) {
          var otherForToxic = giftBattle.enemies.filter(function(e) { return !e.isDown && e.id !== hitTarget.id })
          if (otherForToxic.length > 0) {
            var toxicVictim = otherForToxic[Math.floor(Math.random() * otherForToxic.length)]
            toxicVictim.statusEffects = applyConditionToEffects(toxicVictim.statusEffects || [], r.conditionApplied, 'gift')
            addLog({ type: 'condition', text: mindG2.name + '! ' + condName(r.conditionApplied) + ' spreads to ' + toxicVictim.name + '!', tier: 'hit' })
          }
        }
      }

      // Feeding Frenzy (blood mind): kill → all living enemies get 1 BLEED
      if (mindG2 && mindG2.effect === 'kill_aoe_bleed' && r.enemyDefeated) {
        giftBattle.enemies.forEach(function(e) {
          if (!e.isDown) e.statusEffects = applyConditionToEffects(e.statusEffects || [], 'BLEED', 'gift')
        })
        addLog({ type: 'condition', text: mindG2.name + '! Blood scent — all enemies BLEED!', tier: 'crit' })
      }

      // Pollen Cloud (petal mind): on crit, all enemies BLIND
      if (mindG2 && mindG2.effect === 'crit_aoe_condition' && r.attackRoll && r.attackRoll.tierName === 'crit') {
        giftBattle.enemies.forEach(function(e) {
          if (!e.isDown) {
            e.statusEffects = applyConditionToEffects(e.statusEffects || [], mindG2.condition, 'gift')
          }
        })
        addLog({ type: 'condition', text: 'Pollen Cloud! All enemies BLIND!', tier: 'crit' })
      }

      // Pyromaniac (ember mind): BURN applied by player deals double burst damage
      if (mindG2 && mindG2.effect === 'burn_double_burst' && r.conditionApplied === 'BURN') {
        var burnCond = hitTarget.statusEffects.find(function(c) { return c.id === 'BURN' })
        if (burnCond && burnCond.burstDamage) {
          burnCond.burstDamage = burnCond.burstDamage * 2
          addLog({ type: 'condition', text: 'Pyromaniac! BURN burst damage doubled to ' + burnCond.burstDamage + '!', tier: 'crit' })
        }
      }

      // Chain Lightning (ember mind): crits deal 3 AoE to all enemies
      if (mindG2 && mindG2.effect === 'crit_aoe_damage' && r.attackRoll && r.attackRoll.tierName === 'crit') {
        giftBattle.enemies.forEach(function(e) {
          if (!e.isDown && e.id !== hitTarget.id) {
            e.currentHp = Math.max(0, e.currentHp - mindG2.value)
            if (e.currentHp <= 0) e.isDown = true
          }
        })
        addLog({ type: 'player', text: 'Chain Lightning! ' + mindG2.value + ' damage to all enemies!', tier: 'crit' })
      }

      // Scent of Blood (blood mind): +1 damage per kill this combat
      if (mindG2 && mindG2.effect === 'kill_damage_bonus' && killsThisCombat > 0) {
        var scentBonus = killsThisCombat * mindG2.value
        hitTarget.currentHp = Math.max(0, hitTarget.currentHp - scentBonus)
        r.damage += scentBonus
        addLog({ type: 'player', text: 'Scent of Blood! +' + scentBonus + ' damage (' + killsThisCombat + ' kills)!', tier: 'hit' })
        if (hitTarget.currentHp <= 0) { hitTarget.isDown = true; r.enemyDefeated = true }
      }

      // Hyperspreader (bile mind): when poisoned enemy dies, all others get POISON
      if (mindG2 && mindG2.effect === 'poison_spread_on_kill' && r.enemyDefeated) {
        var deadEnemy = giftBattle.enemies.find(function(e) { return e.id === (r.targetId || selectedTarget) })
        var wasPoisoned = deadEnemy && deadEnemy.statusEffects && deadEnemy.statusEffects.some(function(c) { return c.id === 'POISON' })
        if (wasPoisoned) {
          giftBattle.enemies.forEach(function(e) {
            if (!e.isDown) {
              e.statusEffects = applyConditionToEffects(e.statusEffects || [], 'POISON', 'gift')
            }
          })
          addLog({ type: 'condition', text: 'Hyperspreader! Poison spreads to all enemies!', tier: 'crit' })
        }
      }
    }

    // Harvest buff: apply bonus damage from previous kill (consumed on use)
    if (harvestBuff > 0 && r.damage > 0) {
      // Already factored into damage via combat.js — just clear the buff
      setHarvestBuff(0)
    }

    // Body gift: lifesteal (Bloodpact)
    if (bodyG2 && bodyG2.effect === 'lifesteal' && r.damage > 0) {
      var giftLifesteal = Math.max(1, Math.round(r.damage * bodyG2.value))
      setPlayerHp(function(hp) { return Math.min(hp + giftLifesteal, character.maxHp) })
      addLog({ type: 'player', text: bodyG2.name + ': healed ' + giftLifesteal + ' HP!', tier: 'hit' })
    }

    setPendingAttackResult(null)

    // Track combat stats
    if (r.damage > 0) trackStat('damageDealt', r.damage)
    if (r.attackRoll && r.attackRoll.tierName === 'crit') trackStat('critsLanded', 1)
    if (r.enemyDefeated) trackStat('enemiesDefeated', 1)

    var updatedBattle = giftBattle

    // God mode: one-shot — kill all enemies on any hit
    if (character.godOneShot && r.damage > 0) {
      updatedBattle = Object.assign({}, updatedBattle, {
        enemies: updatedBattle.enemies.map(function(e) {
          return Object.assign({}, e, { currentHp: 0, isDown: true })
        })
      })
    }
    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'victory') {
      var xpGained = calculateXp(updatedBattle)
      var newXp = totalXp + xpGained
      setTotalXp(newXp)
      setLastXpGained(xpGained)
      checkLevelUp(newXp)
      setBattle(updatedBattle)
      guardedSetCombatPhase('victory')
      var newZone = Object.assign({}, zone, {
        chambers: zone.chambers.map(function(ch) {
          if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
          return ch
        })
      })
      setZone(newZone)
      setChambersCleared(chambersCleared + 1)
      return
    }

    // Tick buff durations and revert expired buffs
    setActiveBuffs(function(prev) {
      var remaining = []
      for (var bi = 0; bi < prev.length; bi++) {
        var b = Object.assign({}, prev[bi], { turnsRemaining: prev[bi].turnsRemaining - 1 })
        if (b.turnsRemaining > 0) {
          remaining.push(b)
        } else {
          // Revert the buff from combat stats
          if (updatedBattle && updatedBattle.players[user.uid] && b.stat) {
            updatedBattle.players[user.uid].combatStats[b.stat] = (updatedBattle.players[user.uid].combatStats[b.stat] || 10) - b.value
          }
        }
      }
      return remaining
    })

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)

    // Keep target if still alive, otherwise clear
    var targetStillAlive = updatedBattle.enemies.some(function(e) { return e.id === selectedTarget && !e.isDown })
    if (!targetStillAlive) setSelectedTarget(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    guardedSetCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === FLEE ===
  var [fleeOutcome, setFleeOutcome] = useState(null)

  function handleFlee() {
    var agiMod = getModifier(character.stats.agi)
    var fleeResult = d20Flee(agiMod)
    var maxHp = character.maxHp

    var hpLoss = 0
    var goldLoss = 0
    var narrative = ''
    var fled = false

    if (fleeResult.tierName === 'crit_success') {
      narrative = character.name + ' dashes for the exit! Clean escape — no harm done.'
      fled = true
    } else if (fleeResult.tierName === 'success') {
      hpLoss = Math.round(maxHp * (0.05 + Math.random() * 0.05))
      narrative = character.name + ' scrambles away, taking ' + hpLoss + ' damage in the retreat.'
      fled = true
    } else if (fleeResult.tierName === 'failure') {
      hpLoss = Math.round(maxHp * (0.15 + Math.random() * 0.1))
      goldLoss = Math.round(playerGold * 0.1)
      narrative = character.name + ' stumbles badly! Takes ' + hpLoss + ' damage and drops ' + goldLoss + ' gold.'
      fled = true
    } else {
      hpLoss = Math.round(maxHp * (0.25 + Math.random() * 0.1))
      goldLoss = Math.round(playerGold * 0.2)
      narrative = character.name + ' tries to flee but is blocked! Takes ' + hpLoss + ' damage, loses ' + goldLoss + ' gold. The fight continues.'
      fled = false
    }

    var newHp = Math.max(0, playerHp - hpLoss)
    var newGold = Math.max(0, playerGold - goldLoss)
    setPlayerHp(newHp)
    setPlayerGold(newGold)

    if (newHp <= 0) {
      guardedSetPhase('defeat')
      return
    }

    if (fled) trackStat('enemiesFled', 1)

    setFleeOutcome({
      narrative: narrative,
      fled: fled,
      roll: fleeResult.roll,
      total: fleeResult.total,
      tierName: fleeResult.tierName,
      hpLoss: hpLoss,
      goldLoss: goldLoss,
    })
    guardedSetPhase('flee_result')
  }

  function handleFleeResultContinue() {
    if (isGuarded()) return
    if (!fleeOutcome) return

    if (fleeOutcome.fled) {
      setBattle(null)
      setCombatLog([])
      setChamberContent(null)
      if (previousPosition !== null) {
        var newZone = Object.assign({}, zone, { playerPosition: previousPosition })
        setZone(newZone)
      }
      setFleeOutcome(null)
      setGamePhase('doors')
    } else {
      // Crit failure — back to combat, sync HP to battle state, advance turn
      setFleeOutcome(null)
      var updatedBattle = Object.assign({}, battle, {
        players: Object.keys(battle.players).reduce(function(acc, uid) {
          acc[uid] = Object.assign({}, battle.players[uid], { currentHp: playerHp })
          return acc
        }, {})
      })
      var nextBattle = advanceTurn(updatedBattle)
      setBattle(nextBattle)
      setGamePhase('combat')
      var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
      guardedSetCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    }
  }

  // === USE ITEM IN COMBAT ===
  function handleUseItem(itemIndex) {
    var item = playerInventory[itemIndex]
    if (!item || item.type !== 'consumable') return

    // Permanent stat boosts — handle directly, not through applyConsumable
    if (item.effect === 'permanent_stat') {
      character.stats[item.effectStat] = (character.stats[item.effectStat] || 10) + (item.effectValue || 1)
      if (item.effectStat === 'vit') { character.maxHp = 20 + ((character.stats.vit || 8) * 5); setPlayerHp(function(hp) { return Math.min(hp + 5, character.maxHp) }) }
      addLog({ type: 'player', text: item.name + ': permanently +' + item.effectValue + ' ' + item.effectStat.toUpperCase() + '!', tier: 'crit' })
      setPlayerInventory(function(prev) { var n = prev.slice(); n.splice(itemIndex, 1); return n })
      return
    }
    if (item.effect === 'permanent_stat_multi') {
      var stats = item.effectStats || []
      for (var psi = 0; psi < stats.length; psi++) {
        character.stats[stats[psi]] = (character.stats[stats[psi]] || 10) + (item.effectValue || 1)
      }
      if (stats.indexOf('vit') !== -1) { character.maxHp = 20 + ((character.stats.vit || 8) * 5); setPlayerHp(function(hp) { return Math.min(hp + 5, character.maxHp) }) }
      addLog({ type: 'player', text: item.name + ': permanently +' + item.effectValue + ' ' + stats.map(function(s) { return s.toUpperCase() }).join(', ') + '!', tier: 'crit' })
      setPlayerInventory(function(prev) { var n = prev.slice(); n.splice(itemIndex, 1); return n })
      return
    }

    var result = applyConsumable(item, { currentHp: playerHp, maxHp: character.maxHp })
    if (!result || !result.used) return

    // Apply state changes
    // Start from battle HP if in combat (source of truth), else playerHp
    var currentHp = (battle && battle.players[user.uid]) ? battle.players[user.uid].currentHp : playerHp
    var updatedBattleForItem = battle

    if (result.stateChanges.hpChange !== undefined && result.stateChanges.hpChange !== null) {
      var newHp = Math.min(currentHp + result.stateChanges.hpChange, character.maxHp)
      setPlayerHp(newHp)
      if (battle) {
        var newPlayers = {}
        Object.keys(battle.players).forEach(function(uid) {
          newPlayers[uid] = Object.assign({}, battle.players[uid], {
            combatStats: Object.assign({}, battle.players[uid].combatStats),
            statusEffects: battle.players[uid].statusEffects.slice(),
          })
          if (uid === user.uid) newPlayers[uid].currentHp = newHp
        })
        updatedBattleForItem = Object.assign({}, battle, { players: newPlayers })
      }
    }
    if (result.stateChanges.buff) {
      setActiveBuffs(function(prev) { return prev.concat([result.stateChanges.buff]) })
      if (updatedBattleForItem && result.stateChanges.buff.stat) {
        var buffStat = result.stateChanges.buff.stat
        var buffVal = result.stateChanges.buff.value
        var newPlayers2 = {}
        Object.keys(updatedBattleForItem.players).forEach(function(uid) {
          newPlayers2[uid] = Object.assign({}, updatedBattleForItem.players[uid], {
            combatStats: Object.assign({}, updatedBattleForItem.players[uid].combatStats),
            statusEffects: updatedBattleForItem.players[uid].statusEffects.slice(),
          })
          if (uid === user.uid) {
            newPlayers2[uid].combatStats[buffStat] = (newPlayers2[uid].combatStats[buffStat] || 10) + buffVal
          }
        })
        updatedBattleForItem = Object.assign({}, updatedBattleForItem, { players: newPlayers2 })
      }
    }
    if (updatedBattleForItem !== battle) {
      setBattle(updatedBattleForItem)
    }
    // Cure conditions
    if (result.stateChanges.cureSlot && battle) {
      var curePlayers = {}
      Object.keys(updatedBattleForItem.players).forEach(function(uid) {
        curePlayers[uid] = Object.assign({}, updatedBattleForItem.players[uid], {
          combatStats: Object.assign({}, updatedBattleForItem.players[uid].combatStats),
          statusEffects: updatedBattleForItem.players[uid].statusEffects.filter(function(c) { return c.slot !== result.stateChanges.cureSlot }),
        })
      })
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, { players: curePlayers })
    }
    // Damage all enemies
    if (result.stateChanges.damageAllEnemies && battle) {
      var dmgAll = result.stateChanges.damageAllEnemies
      var damagedEnemies = updatedBattleForItem.enemies.map(function(e) {
        if (e.isDown) return e
        var newHp = Math.max(0, e.currentHp - dmgAll)
        var downed = newHp <= 0
        return Object.assign({}, e, { currentHp: newHp, isDown: downed })
      })
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, { enemies: damagedEnemies })
    }
    // Apply condition (Adrenaline Shot etc.)
    if (result.stateChanges.applyCondition && battle) {
      var condPlayers = {}
      Object.keys(updatedBattleForItem.players).forEach(function(uid) {
        var p = updatedBattleForItem.players[uid]
        var newEffects = uid === user.uid
          ? applyConditionToEffects(p.statusEffects, result.stateChanges.applyCondition, 'consumable')
          : p.statusEffects.slice()
        condPlayers[uid] = Object.assign({}, p, {
          combatStats: Object.assign({}, p.combatStats),
          statusEffects: newEffects,
        })
      })
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, { players: condPlayers })
    }
    // Condition throwable — apply condition to ALL enemies
    if (result.stateChanges.conditionAllEnemies && battle) {
      var condAll = result.stateChanges.conditionAllEnemies
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, {
        enemies: updatedBattleForItem.enemies.map(function(e) {
          if (e.isDown) return e
          return Object.assign({}, e, { statusEffects: applyConditionToEffects(e.statusEffects || [], condAll, 'throwable') })
        })
      })
      addLog({ type: 'condition', text: condAll + ' applied to all enemies!', tier: 'crit' })
      // Check for condition reactions on each enemy
      updatedBattleForItem.enemies.forEach(function(e) {
        if (e.isDown) return
        var throwReaction = checkConditionReactions(e.statusEffects)
        if (throwReaction) {
          e.statusEffects = throwReaction.newEffects
          if (throwReaction.damage > 0) {
            e.currentHp = Math.max(0, e.currentHp - throwReaction.damage)
            if (e.currentHp <= 0) e.isDown = true
          }
          addLog({ type: 'condition', text: throwReaction.narrative, tier: 'crit' })
        }
      })
    }
    // Condition throwable — apply condition to selected target (auto-target first living if none selected)
    var throwTarget = selectedTarget || (battle ? (battle.enemies.find(function(e) { return !e.isDown }) || {}).id : null)
    if (result.stateChanges.conditionOneEnemy && battle && throwTarget) {
      var condOne = result.stateChanges.conditionOneEnemy
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, {
        enemies: updatedBattleForItem.enemies.map(function(e) {
          if (e.id !== throwTarget || e.isDown) return e
          var newE = Object.assign({}, e, { statusEffects: applyConditionToEffects(e.statusEffects || [], condOne, 'throwable') })
          if (result.stateChanges.throwDamage) {
            newE.currentHp = Math.max(0, newE.currentHp - result.stateChanges.throwDamage)
            if (newE.currentHp <= 0) newE.isDown = true
          }
          return newE
        })
      })
      var targetName = updatedBattleForItem.enemies.find(function(e) { return e.id === throwTarget })
      addLog({ type: 'condition', text: condOne + ' applied to ' + (targetName ? targetName.name : 'enemy') + '!', tier: 'hit' })
    }
    // Multi-target throwable — apply to N random enemies
    if (result.stateChanges.conditionMultiEnemies && battle) {
      var condMulti = result.stateChanges.conditionMultiEnemies
      var multiN = result.stateChanges.multiTargets || 2
      var livingForMulti = updatedBattleForItem.enemies.filter(function(e) { return !e.isDown })
      // Shuffle and pick N
      var shuffled = livingForMulti.slice().sort(function() { return Math.random() - 0.5 })
      var targets = shuffled.slice(0, multiN)
      var targetIds = targets.map(function(e) { return e.id })
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, {
        enemies: updatedBattleForItem.enemies.map(function(e) {
          if (e.isDown || targetIds.indexOf(e.id) === -1) return e
          var newE = Object.assign({}, e, { statusEffects: applyConditionToEffects(e.statusEffects || [], condMulti, 'throwable') })
          if (result.stateChanges.throwDamage) {
            newE.currentHp = Math.max(0, newE.currentHp - result.stateChanges.throwDamage)
            if (newE.currentHp <= 0) newE.isDown = true
          }
          return newE
        })
      })
      addLog({ type: 'condition', text: condMulti + ' hits ' + targets.length + ' enemies!', tier: 'crit' })
    }
    // Damage multi-target throwable
    if (result.stateChanges.damageMultiEnemies && battle) {
      var dmgMulti = result.stateChanges.damageMultiEnemies
      var multiN2 = result.stateChanges.multiTargets || 2
      var livingForDmg = updatedBattleForItem.enemies.filter(function(e) { return !e.isDown })
      var shuffled2 = livingForDmg.slice().sort(function() { return Math.random() - 0.5 })
      var targets2 = shuffled2.slice(0, multiN2)
      var targetIds2 = targets2.map(function(e) { return e.id })
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, {
        enemies: updatedBattleForItem.enemies.map(function(e) {
          if (e.isDown || targetIds2.indexOf(e.id) === -1) return e
          var newHp = Math.max(0, e.currentHp - dmgMulti)
          return Object.assign({}, e, { currentHp: newHp, isDown: newHp <= 0 })
        })
      })
      addLog({ type: 'player', text: dmgMulti + ' damage to ' + targets2.length + ' enemies!', tier: 'hit' })
    }
    // Cure all conditions
    if (result.stateChanges.cureAll && battle) {
      var curePlayers = {}
      Object.keys(updatedBattleForItem.players).forEach(function(uid) {
        var p = updatedBattleForItem.players[uid]
        curePlayers[uid] = Object.assign({}, p, { statusEffects: [] })
      })
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, { players: curePlayers })
      addLog({ type: 'player', text: 'All conditions cleared!', tier: 'hit' })
    }
    // Timed bomb — add to active bombs list
    if (result.stateChanges.timedBomb) {
      setActiveBombs(function(prev) { return prev.concat([result.stateChanges.timedBomb]) })
      addLog({ type: 'player', text: result.stateChanges.timedBomb.name + ' fuse lit! ' + result.stateChanges.timedBomb.fuseLeft + ' turns!', tier: 'crit' })
    }
    // Mirror — reflect next attack
    if (result.stateChanges.reflectNextAttack) {
      setReflectNextAttack(true)
      addLog({ type: 'player', text: 'Mirror raised! Next attack will be reflected!', tier: 'hit' })
    }
    // Heal enemy (Expired Yoghurt backfire)
    if (result.stateChanges.healEnemy && battle && throwTarget) {
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, {
        enemies: updatedBattleForItem.enemies.map(function(e) {
          if (e.id !== throwTarget || e.isDown) return e
          return Object.assign({}, e, { currentHp: Math.min(e.maxHp, e.currentHp + result.stateChanges.healEnemy) })
        })
      })
      addLog({ type: 'enemy', text: 'Backfire! Enemy heals ' + result.stateChanges.healEnemy + ' HP!', tier: 'miss' })
    }
    // Second condition on single target (Party Popper)
    if (result.stateChanges.conditionOneEnemy2 && battle && throwTarget) {
      updatedBattleForItem = Object.assign({}, updatedBattleForItem, {
        enemies: updatedBattleForItem.enemies.map(function(e) {
          if (e.id !== throwTarget || e.isDown) return e
          return Object.assign({}, e, { statusEffects: applyConditionToEffects(e.statusEffects || [], result.stateChanges.conditionOneEnemy2, 'throwable') })
        })
      })
    }
    // Debuff all enemies (Whoopee Cushion)
    if (result.stateChanges.debuffAllEnemies && battle) {
      var debuff = result.stateChanges.debuffAllEnemies
      addLog({ type: 'player', text: 'All enemies ' + debuff.value + ' ' + (debuff.stat || '').toUpperCase() + ' for ' + debuff.duration + ' turns!', tier: 'hit' })
      // Applied as a temporary condition-like effect via roll penalty on enemies
      updatedBattleForItem.enemies.forEach(function(e) {
        if (!e.isDown) {
          e.stats = Object.assign({}, e.stats)
          if (debuff.stat === 'accuracy') e._accuracyDebuff = (e._accuracyDebuff || 0) + debuff.value
        }
      })
    }
    if (result.stateChanges.guaranteedFlee) {
      // Remove item, then auto-flee successfully
      setPlayerInventory(function(prev) {
        var next = prev.slice()
        next.splice(itemIndex, 1)
        return next
      })
      setBattle(null)
      setCombatLog([])
      setChamberContent(null)
      if (previousPosition !== null) {
        var newZone = Object.assign({}, zone, { playerPosition: previousPosition })
        setZone(newZone)
      }
      addLog({ type: 'player', text: 'Smoke fills the chamber. You vanish.', tier: 'hit' })
      setShowInventoryPanel(false)
      setGamePhase('doors')
      return
    }

    // Remove consumed item
    setPlayerInventory(function(prev) {
      var next = prev.slice()
      next.splice(itemIndex, 1)
      return next
    })
    trackStat('itemsUsed', 1)
    addLog({ type: 'player', text: character.name + ' uses ' + item.name + '. ' + result.description, tier: 'hit' })
    setShowInventoryPanel(false)

    // Using an item costs your turn — must use updated battle state (with healed HP / buffs applied)
    var battleAfterItem = updatedBattleForItem || battle
    if (battleAfterItem) {
      var nextBattle = advanceTurn(battleAfterItem)
      setBattle(nextBattle)
      setSelectedTarget(null)
      var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
      guardedSetCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    }
  }

  // === EQUIP ITEM (out of combat) ===
  function handleEquipItem(itemIndex) {
    var item = playerInventory[itemIndex]
    if (!item) return

    var newEquipped = Object.assign({}, character.equipped)
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
        // Heavy weapons can't use shields — unequip offhand shield back to inventory
        if (item.hand === 'heavy' && newEquipped.offhand && newEquipped.offhand.slot === 'offhand') {
          var shieldReturn = newEquipped.offhand
          newEquipped.offhand = null
          if (shieldReturn) {
            setPlayerInventory(function(inv) { return inv.concat([shieldReturn]) })
          }
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
      if (newEquipped.rings.length >= 2) return // ring slots full
      newEquipped.rings = newEquipped.rings.concat([item])
    } else if (item.type === 'relic' && item.slot === 'relic') {
      if (!newEquipped.relics) newEquipped.relics = []
      // Only condition resist/immunity relics count toward 3-slot cap
      var isResistRelic = item.passiveEffect === 'condition_resist' || item.passiveEffect === 'condition_immunity' || item.passiveEffect === 'condition_resist_multi' || item.passiveEffect === 'condition_resist_all'
      if (isResistRelic) {
        var resistCount = newEquipped.relics.filter(function(r) {
          return r.passiveEffect === 'condition_resist' || r.passiveEffect === 'condition_immunity' || r.passiveEffect === 'condition_resist_multi' || r.passiveEffect === 'condition_resist_all'
        }).length
        if (resistCount >= 3) return // resist relic slots full
      }
      newEquipped.relics = newEquipped.relics.concat([item])
    } else {
      return
    }

    // Update character equipped (mutating the prop — Stage 1 ephemeral character)
    character.equipped = newEquipped

    // Apply hp_bonus from newly equipped relic
    if (item.passiveEffect === 'hp_bonus' && item.passiveValue) {
      character.maxHp += item.passiveValue
      setPlayerHp(function(hp) { return Math.min(hp + item.passiveValue, character.maxHp) })
    }

    // Lottery ticket — scratch off: one d20 number and one weapon die number
    if (item.passiveEffect === 'lottery' && !item.lotteryD20) {
      item.lotteryD20 = 2 + Math.floor(Math.random() * 19) // 2-20
      item.lotteryWeapon = 1 + Math.floor(Math.random() * 10) // 1-10 (covers d4 through d10)
      // Keep legacy lotteryNumbers for combat check (d20 number)
      item.lotteryNumbers = [item.lotteryD20]
      addLog({ type: 'player', text: 'Scratched off Gran\'s ticket... d20: ' + item.lotteryD20 + ', weapon die: ' + item.lotteryWeapon + '!', tier: 'crit' })
    }

    // Remove equipped item from inventory, add old item back
    setPlayerInventory(function(prev) {
      var next = prev.slice()
      next.splice(itemIndex, 1)
      if (returnItem) next.push(returnItem)
      return next
    })
  }

  // === UNEQUIP ITEM (out of combat) ===
  function handleUnequipWeapon() {
    if (!character.equipped || !character.equipped.weapon) return
    var item = character.equipped.weapon
    character.equipped = Object.assign({}, character.equipped, { weapon: null })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipArmour() {
    if (!character.equipped || !character.equipped.armour) return
    var item = character.equipped.armour
    character.equipped = Object.assign({}, character.equipped, { armour: null })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipOffhand() {
    if (!character.equipped || !character.equipped.offhand) return
    var item = character.equipped.offhand
    character.equipped = Object.assign({}, character.equipped, { offhand: null })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipRelic(relicIndex) {
    if (!character.equipped || !character.equipped.relics) return
    var item = character.equipped.relics[relicIndex]
    if (!item) return
    // Remove hp_bonus when unequipping
    if (item.passiveEffect === 'hp_bonus' && item.passiveValue) {
      character.maxHp -= item.passiveValue
      setPlayerHp(function(hp) { return Math.min(hp, character.maxHp) })
    }
    var newRelics = character.equipped.relics.slice()
    newRelics.splice(relicIndex, 1)
    character.equipped = Object.assign({}, character.equipped, { relics: newRelics })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipHelmet() {
    if (!character.equipped || !character.equipped.helmet) return
    var item = character.equipped.helmet
    character.equipped = Object.assign({}, character.equipped, { helmet: null })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipBoots() {
    if (!character.equipped || !character.equipped.boots) return
    var item = character.equipped.boots
    character.equipped = Object.assign({}, character.equipped, { boots: null })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipAmulet() {
    if (!character.equipped || !character.equipped.amulet) return
    var item = character.equipped.amulet
    character.equipped = Object.assign({}, character.equipped, { amulet: null })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  function handleUnequipRing(ringIndex) {
    if (!character.equipped || !character.equipped.rings) return
    var item = character.equipped.rings[ringIndex]
    if (!item) return
    // Remove hp_bonus when unequipping ring
    if (item.passiveEffect === 'hp_bonus' && item.passiveValue) {
      character.maxHp -= item.passiveValue
      setPlayerHp(function(hp) { return Math.min(hp, character.maxHp) })
    }
    var newRings = character.equipped.rings.slice()
    newRings.splice(ringIndex, 1)
    character.equipped = Object.assign({}, character.equipped, { rings: newRings })
    setPlayerInventory(function(prev) { return prev.concat([item]) })
  }

  // === WRITE RUN LOG TO FIRESTORE ===
  function writeRunLog(outcome) {
    var visitedCount = zone ? zone.chambers.filter(function(ch) { return ch.visited }).length : 0
    var logDoc = {
      userId: user.uid,
      timestamp: serverTimestamp(),
      outcome: outcome,
      floorReached: zone ? zone.floorId : 'grounds',
      zoneReached: zone ? zone.zoneId : 'montors_garden',
      chambersCleared: chambersCleared,
      chambersVisited: visitedCount,
      totalXp: totalXp,
      totalGold: playerGold,
      runDurationMs: null,
      characterClass: character.class || 'knight',
      characterLevel: character.level || 1,
      characterMaxHp: character.maxHp,
      enemiesDefeated: runStats.enemiesDefeated,
      enemiesFled: runStats.enemiesFled,
      itemsUsed: runStats.itemsUsed,
      itemsFound: playerInventory.length,
      damageDealt: runStats.damageDealt,
      damageTaken: runStats.damageTaken,
      critsLanded: runStats.critsLanded,
      critsReceived: runStats.critsReceived,
      killedBy: runStats.killedBy,
      killedByTier: runStats.killedByTier,
      killedInChamber: runStats.killedInChamber,
    }
    addDoc(collection(db, 'runLog'), logDoc).catch(function(err) {
      console.error('Failed to write run log:', err)
    })
  }

  function handleCombatVictoryToDoors() {
    if (isGuarded()) return
    transitionGuardRef.current = Date.now()
    setCombatItemPhase(null)

    // Regrowth gift: heal at end of combat
    var bodyGiftV = giftSlots.body
    if (bodyGiftV && bodyGiftV.effect === 'post_combat_heal') {
      setPlayerHp(function(hp) { return Math.min(hp + bodyGiftV.value, character.maxHp) })
    }

    // Stoneskin Mend (stone body): heal 1 HP per hit taken this combat
    if (bodyGiftV && bodyGiftV.effect === 'hits_taken_heal' && hitsTakenThisCombat > 0) {
      var mendHeal = hitsTakenThisCombat * bodyGiftV.healPerHit
      setPlayerHp(function(hp) { return Math.min(hp + mendHeal, character.maxHp) })
    }

    // Reset weapon per-combat flags
    if (giftSlots.weapon && giftSlots.weapon._firstHitUsed) {
      setGiftSlots(function(prev) {
        var w = Object.assign({}, prev.weapon, { _firstHitUsed: false })
        return Object.assign({}, prev, { weapon: w })
      })
    }

    // Generate corpses with loot (gold + items array)
    var encounterLevel = chamberContent ? (chamberContent.type === 'combat_elite' ? 2 : chamberContent.type === 'mini_boss' ? 3 : 1) : 1
    var lckStat = (character.stats.lck || 10) + getPassiveTotal(character.equipped, 'lck_bonus')
    var corpses = battle.enemies.filter(function(e) { return e.isDown }).map(function(e) {
      var currentFloorId = zone ? zone.floorId : 'grounds'
      var loot = generateCombatLoot(encounterLevel, lckStat, currentFloorId)
      // Build items array — stronger enemies can drop multiple items
      var items = []
      if (loot.item) items.push(loot.item)
      // Elite: extra roll for a second item
      if (encounterLevel >= 2) {
        var loot2 = generateCombatLoot(encounterLevel, lckStat, currentFloorId)
        if (loot2.item) items.push(loot2.item)
      }
      // Boss: guaranteed item + extra roll from chest table (best loot)
      if (e.isBoss) {
        var bossLoot = generateChestLoot(lckStat, currentFloorId)
        if (bossLoot.item) items.push(bossLoot.item)
        // If still no items, force one
        if (items.length === 0) {
          var forcedLoot = generateChestLoot(lckStat, currentFloorId)
          if (forcedLoot.item) items.push(forcedLoot.item)
        }
      }
      var corpseGold = Math.max(1, loot.gold + Math.round(e.xp * (e.isBoss ? 0.5 : 0.2)))
      // Fled enemies drop a bag with reduced gold but keep items
      if (e.fled) corpseGold = Math.max(1, Math.round(corpseGold * 0.5))
      return {
        id: e.id, name: e.fled ? 'Dropped Bag' : e.name, archetypeKey: e.archetypeKey, tierKey: e.tierKey,
        gold: corpseGold,
        items: items,
        goldTaken: false,
        itemsTaken: [],
        opened: false,
        fled: e.fled || false,
      }
    })

    // Mini-boss drops zone key
    if (chamberContent && (chamberContent.dropsZoneKey || chamberContent.isBoss)) {
      if (floor && floor.zones && floor.zones.length > 1 && !hasZoneKey) {
        setHasZoneKey(true)
      }
    }

    // Store corpses on the chamber in zone state + ensure cleared
    // Append to existing corpses (junk search combat can happen in rooms with prior corpses)
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) {
          var existingCorpses = ch.corpses || []
          return Object.assign({}, ch, { corpses: existingCorpses.concat(corpses), cleared: true })
        }
        return ch
      })
    })
    setZone(newZone)
    setBattle(null)
    setCombatLog([])
    setChamberContent(null)
    setGamePhase('doors')
    triggerSave()
  }

  // Open a corpse to see what's inside
  function handleOpenCorpse(corpseId) {
    setLootingCorpseId(corpseId)
    setShowInventoryPanel(false)
    setShowCharPanel(false)
    // Mark as opened
    updateCorpse(corpseId, function(c) { return Object.assign({}, c, { opened: true }) })
  }

  // Take gold from opened corpse
  function handleTakeGold(corpseId) {
    var chamber = zone.chambers[zone.playerPosition]
    var corpse = chamber.corpses && chamber.corpses.find(function(c) { return c.id === corpseId })
    if (!corpse || corpse.goldTaken) return
    setPlayerGold(playerGold + corpse.gold)
    updateCorpse(corpseId, function(c) { return Object.assign({}, c, { goldTaken: true }) })
    setGreedScore(function(g) { return g + 1 })
  }

  // Take a specific item from opened corpse
  function handleTakeItem(corpseId, itemIndex) {
    var chamber = zone.chambers[zone.playerPosition]
    var corpse = chamber.corpses && chamber.corpses.find(function(c) { return c.id === corpseId })
    if (!corpse || !corpse.items[itemIndex]) return
    if (corpse.itemsTaken.indexOf(itemIndex) !== -1) return
    setPlayerInventory(function(prev) { return prev.concat([corpse.items[itemIndex]]) })
    updateCorpse(corpseId, function(c) {
      return Object.assign({}, c, { itemsTaken: c.itemsTaken.concat([itemIndex]) })
    })
    setGreedScore(function(g) { return g + 2 })
  }

  // Close the loot panel (walk away — greed reduction if left loot behind)
  function handleCloseLoot() {
    if (lootingCorpseId) {
      var chamber = zone.chambers[zone.playerPosition]
      var corpse = chamber.corpses && chamber.corpses.find(function(c) { return c.id === lootingCorpseId })
      if (corpse) {
        var hasUntakenGold = !corpse.goldTaken && corpse.gold > 0
        var hasUntakenItems = corpse.items && corpse.items.some(function(it, idx) { return corpse.itemsTaken.indexOf(idx) === -1 })
        if (hasUntakenGold || hasUntakenItems) {
          setGreedScore(function(g) { return Math.max(0, g - 2) })
        }
      }
    }
    setLootingCorpseId(null)
  }

  // === NPC INTERACTIONS (merchant/quest) ===
  function handleOpenNpc() {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.npc) return
    setLootingNpcId(chamber.npc.id)
    setShowInventoryPanel(false)
    setShowCharPanel(false)
  }

  function handleNpcBuy(item) {
    var chaModNpc = getModifier(character.stats.cha || 10)
    var basePriceNpc = item.buyPrice || item.cost || 0
    var price = Math.max(1, basePriceNpc - Math.max(0, Math.round(basePriceNpc * chaModNpc * 0.05)))
    if (playerGold < price) return
    setPlayerGold(playerGold - price)
    setPlayerInventory(function(prev) { return prev.concat([Object.assign({}, item)]) })
    updateNpc(function(n) {
      return Object.assign({}, n, { items: n.items.filter(function(it) { return it !== item }) })
    })
  }

  function handleNpcSellToggle() {
    updateNpc(function(n) { return Object.assign({}, n, { showSell: !n.showSell }) })
  }

  function handleNpcSell(itemIndex, sellPrice) {
    setPlayerGold(playerGold + sellPrice)
    setPlayerInventory(function(prev) {
      var next = prev.slice()
      next.splice(itemIndex, 1)
      return next
    })
  }

  function handleNpcHelp() {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.npc || chamber.npc.interacted) return
    if (chamber.npc.reward && chamber.npc.reward.gold) {
      setPlayerGold(playerGold + chamber.npc.reward.gold)
    }
    updateNpc(function(n) { return Object.assign({}, n, { interacted: true }) })
  }

  function handleCloseNpc() {
    setLootingNpcId(null)
    // Mark cleared
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
        return ch
      })
    })
    setZone(newZone)
    setChambersCleared(chambersCleared + 1)
    triggerSave()
  }

  function updateNpc(updater) {
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id !== zone.playerPosition || !ch.npc) return ch
        return Object.assign({}, ch, { npc: updater(ch.npc) })
      })
    })
    setZone(newZone)
  }

  // === CHEST INTERACTIONS (loot/hidden chambers) ===
  function handleOpenChest() {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.chest) return
    setLootingChestId(chamber.chest.id)
    setShowInventoryPanel(false)
    setShowCharPanel(false)
    updateChest(function(c) { return Object.assign({}, c, { opened: true }) })
  }

  function handleTakeChestGold() {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.chest || chamber.chest.goldTaken) return
    setPlayerGold(playerGold + chamber.chest.gold)
    updateChest(function(c) { return Object.assign({}, c, { goldTaken: true }) })
  }

  function handleTakeChestItem(itemIndex) {
    var chamber = zone.chambers[zone.playerPosition]
    if (!chamber.chest || !chamber.chest.items[itemIndex]) return
    if (chamber.chest.itemsTaken.indexOf(itemIndex) !== -1) return
    setPlayerInventory(function(prev) { return prev.concat([chamber.chest.items[itemIndex]]) })
    updateChest(function(c) {
      return Object.assign({}, c, { itemsTaken: c.itemsTaken.concat([itemIndex]) })
    })
  }

  function handleCloseChest() {
    setLootingChestId(null)
    // Mark chamber cleared + chest fully looted to prevent re-opening
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id !== zone.playerPosition) return ch
        var updatedChest = ch.chest ? Object.assign({}, ch.chest, { goldTaken: true }) : ch.chest
        return Object.assign({}, ch, { cleared: true, chest: updatedChest })
      })
    })
    setZone(newZone)
    setChambersCleared(chambersCleared + 1)
  }

  function updateChest(updater) {
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id !== zone.playerPosition || !ch.chest) return ch
        return Object.assign({}, ch, { chest: updater(ch.chest) })
      })
    })
    setZone(newZone)
  }

  // Helper: update a single corpse in zone state
  function updateCorpse(corpseId, updater) {
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id !== zone.playerPosition) return ch
        return Object.assign({}, ch, {
          corpses: ch.corpses.map(function(c) {
            if (c.id !== corpseId) return c
            return updater(c)
          })
        })
      })
    })
    setZone(newZone)
  }

  // ============================================================
  // RENDER
  // ============================================================

  // Floor-themed mottled pixel background
  // Each floor has 4-5 very dark colours that get scattered as a tileable pixel grid
  var FLOOR_BG_PALETTES = {
    grounds:     ['#121810','#161e14','#131a11','#1a2218','#111610','#181f15','#141c12'],
    underground: ['#181410','#1c1812','#1a1611','#1e1a14','#161310','#1b1713','#191511'],
    underbelly:  ['#101418','#12181c','#11161a','#141a1e','#101316','#13171b','#111519'],
    quarters:    ['#181018','#1c121c','#1a111a','#1e141e','#161016','#1b131b','#191119'],
    works:       ['#1a1210','#1e1412','#1c1311','#201614','#181110','#1d1513','#1b1211'],
    deep:        ['#101018','#12121c','#11111a','#14141e','#101016','#13131b','#111119'],
  }

  function generateMottledBg(floorId, chamberId) {
    var palette = FLOOR_BG_PALETTES[floorId] || FLOOR_BG_PALETTES.grounds
    var gridSize = 8  // 8x8 pixel tile
    var pxSize = 6    // each pixel = 6px on screen
    var seed = (chamberId || 0) * 7 + 13
    var rects = ''
    for (var gy = 0; gy < gridSize; gy++) {
      for (var gx = 0; gx < gridSize; gx++) {
        seed = (seed * 31 + 17) & 0xffff
        var col = palette[seed % palette.length]
        rects += '<rect x="' + (gx * pxSize) + '" y="' + (gy * pxSize) + '" width="' + pxSize + '" height="' + pxSize + '" fill="' + col + '"/>'
      }
    }
    var totalSize = gridSize * pxSize
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + totalSize + '" height="' + totalSize + '">' + rects + '</svg>'
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'
  }

  var mottledBg = generateMottledBg(
    zone ? zone.floorId : 'grounds',
    currentChamber ? currentChamber.id : 0
  )
  var roomBgStyle = { backgroundImage: mottledBg, backgroundRepeat: 'repeat' }

  // Wall colours from door theme — used for room border
  var doorThemeId = zone ? (zone.doorTheme || 'garden') : 'garden'
  var doorThemeColours = themeData.doorThemes[doorThemeId] || themeData.doorThemes.garden
  var wallColor = doorThemeColours.wall
  var wallHiColor = doorThemeColours.wallHi
  var floorBorderColor = wallColor  // used by interaction overlays

  // Generate stone wall texture — grey brick with moss, tileable SVG, 3px pixels to match doors
  function generateWallTexture() {
    // Grey brick with green moss highlights
    var colours = ['#3a3a3a','#4a4a4a','#3a3a3a','#555','#3a3a3a','#4a4a4a','#4a5a3a','#3a3a3a','#555','#3a3a3a','#5a6a4a','#4a4a4a']
    var gridW = 8, gridH = 4, px = 3
    var seed = 41
    var rects = ''
    for (var wy = 0; wy < gridH; wy++) {
      for (var wx = 0; wx < gridW; wx++) {
        seed = (seed * 37 + 11) & 0xffff
        rects += '<rect x="' + (wx * px) + '" y="' + (wy * px) + '" width="' + px + '" height="' + px + '" fill="' + colours[seed % colours.length] + '"/>'
      }
    }
    var tw = gridW * px, th = gridH * px
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + tw + '" height="' + th + '">' + rects + '</svg>'
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'
  }
  var wallTexture = generateWallTexture()
  var wallStyle = { backgroundImage: wallTexture, backgroundRepeat: 'repeat' }

  // === GIFT PICKER OVERLAY — single-screen table layout ===
  if (showGiftPicker && unlockedGifts.length > 0) {
    var giftColors = { petal: 'green-400', stone: 'blue-400', bile: 'yellow-400', blood: 'red-400', ember: 'orange-400', void: 'purple-400' }
    var giftLabels = { petal: 'Petal', stone: 'Stone', bile: 'Bile', blood: 'Blood', ember: 'Ember', void: 'Void' }
    var slotNames = ['body', 'mind', 'weapon', 'shield']

    function getOptionsForSlotGift(slot, giftId) {
      if (!giftId) return []
      var def = getGiftDef(giftId)
      if (!def) return []
      if (slot === 'weapon') {
        if (Array.isArray(def.weapon)) return def.weapon
        var wt = character.equipped && character.equipped.weapon ? character.equipped.weapon.weaponType : 'fists'
        return def.weapon[wt] ? [def.weapon[wt]] : []
      }
      return def[slot] || []
    }

    // Count filled slots vs available (available = number of unlocked gifts)
    var filledSlotCount = slotNames.filter(function(s) { return giftSlots[s] }).length
    var maxSlots = unlockedGifts.length

    return (
      <div className="h-full flex flex-col bg-bg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <span className="font-display text-lg text-gold">Montor's Gifts</span>
            <span className="text-ink-dim text-xs font-sans ml-2">{filledSlotCount}/{maxSlots} slots</span>
          </div>
          <button onClick={handleGiftPickerClose}
            className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">Done</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {/* Unlocked gifts */}
          <div className="flex justify-center gap-1.5 mb-3">
            {['petal', 'stone', 'bile', 'blood', 'ember', 'void'].map(function(gId) {
              var isUnlocked = unlockedGifts.indexOf(gId) !== -1
              var gc = giftColors[gId] || 'ink'
              return (
                <span key={gId} className={'text-[9px] font-display px-1.5 py-0.5 rounded ' + (isUnlocked ? 'text-' + gc + ' bg-' + gc + '/10 border border-' + gc + '/30' : 'text-ink-faint bg-surface border border-border opacity-30')}>
                  {giftLabels[gId]}
                </span>
              )
            })}
          </div>

          {/* Slot cards */}
          <div className="flex flex-col gap-2">
            {slotNames.map(function(slot) {
              var current = giftSlots[slot]
              var slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1)
              var selectedGiftForSlot = giftPickerSlot === slot ? giftPickerGift : (current ? current.giftId : '')
              var powerOptions = getOptionsForSlotGift(slot, selectedGiftForSlot)
              var isExpanded = giftPickerSlot === slot
              var slotTextColors = { body: 'text-red-400', mind: 'text-blue', weapon: 'text-amber-400', shield: 'text-emerald-400' }
              var isLocked = !current && filledSlotCount >= maxSlots

              return (
                <div key={slot} className={'rounded-lg border overflow-hidden ' + (isLocked ? 'border-border opacity-40' : 'border-border-hl')}>
                  {/* Slot header — tappable */}
                  <div className={'flex items-center justify-between px-3 py-2.5 ' + (isLocked ? '' : 'cursor-pointer hover:bg-surface/50')}
                    onClick={isLocked ? undefined : function() { setGiftPickerSlot(isExpanded ? null : slot); setGiftPickerGift(selectedGiftForSlot || null) }}>
                    <div className="flex items-center gap-2">
                      <span className={'font-display text-sm ' + (slotTextColors[slot] || 'text-ink')}>{slotLabel}</span>
                      {current && (
                        <span className={'text-[10px] font-sans text-' + (giftColors[current.giftId] || 'ink')}>
                          {giftLabels[current.giftId]} — {current.name}
                        </span>
                      )}
                      {!current && !isLocked && <span className="text-ink-faint text-[10px]">Empty</span>}
                      {isLocked && <span className="text-ink-faint text-[10px]">Locked — unlock more gifts</span>}
                    </div>
                    {!isLocked && <span className="text-ink-faint text-[10px]">{isExpanded ? '▲' : '▼'}</span>}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && !isLocked && (
                    <div className="px-3 pb-3 border-t border-border bg-bg/30">
                      {/* Gift selection */}
                      <div className="flex flex-wrap gap-1.5 py-2">
                        <button onClick={function() { setGiftPickerGift(null) }}
                          className={'px-2.5 py-1 rounded text-[10px] font-sans border transition-colors ' +
                            (!selectedGiftForSlot ? 'border-ink-faint text-ink bg-bg' : 'border-border text-ink-faint hover:text-ink cursor-pointer')}>
                          Clear
                        </button>
                        {unlockedGifts.map(function(gId) {
                          var gc = giftColors[gId] || 'ink'
                          var isSel = selectedGiftForSlot === gId
                          return (
                            <button key={gId} onClick={function() { setGiftPickerGift(gId) }}
                              className={'px-2.5 py-1 rounded text-[10px] font-display border transition-colors cursor-pointer ' +
                                (isSel ? 'border-' + gc + ' text-' + gc + ' bg-' + gc + '/15' : 'border-border text-ink-faint hover:text-' + gc)}>
                              {giftLabels[gId]}
                            </button>
                          )
                        })}
                      </div>
                      {/* Power options */}
                      {selectedGiftForSlot && powerOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {powerOptions.map(function(opt) {
                            var isActive = current && current.id === opt.id && current.giftId === selectedGiftForSlot
                            return (
                              <button key={opt.id}
                                onClick={function() { setGiftPickerGift(selectedGiftForSlot); handleGiftPickerApply(opt) }}
                                className={'p-2.5 rounded-lg border text-left transition-colors ' +
                                  (isActive ? 'border-gold bg-gold/10' : 'border-border hover:border-gold/50 cursor-pointer')}>
                                <div className="flex items-center gap-2">
                                  <span className={'text-sm font-semibold ' + (isActive ? 'text-gold' : 'text-ink')}>{opt.name}</span>
                                  {isActive && <span className="text-[9px] text-gold uppercase tracking-wide">Active</span>}
                                </div>
                                <p className="text-ink-dim text-xs mt-0.5">{opt.description}</p>
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {selectedGiftForSlot && powerOptions.length === 0 && (
                        <p className="text-ink-faint text-xs italic">No powers for this weapon type.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (!zone) {
    return (
      <div className="h-full flex items-center justify-center bg-raised">
        <span className="text-ink text-base">Entering the dungeon...</span>
      </div>
    )
  }

  // --- Floor transition ---
  if (gamePhase === 'floor_transition') {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <p className="text-ink text-lg italic max-w-sm" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
          {floor ? floor.transitionText : 'You descend deeper...'}
        </p>
        <button onClick={handleFloorTransitionContinue}
          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors">
          Continue
        </button>
      </div>
    )
  }

  // --- Safe room (Montor's audience chamber) ---
  if (gamePhase === 'safe_room') {
    var safeInteractionBg = {
      backgroundImage: 'repeating-conic-gradient(' + floorBorderColor + '18 0% 25%, transparent 0% 50%)',
      backgroundSize: '8px 8px',
    }

    // Arrival — base screen with stats and Montor quote
    if (safeRoomStep === 'arrival') {
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
          <h2 className="font-display text-2xl text-gold">{floor ? floor.floorName : 'Unknown Depth'}</h2>
          <div className="max-w-sm">
            <p className="text-ink text-base italic mb-4" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
              You enter a chamber of worked stone. Torchlight flickers. The air is warm. You are safe here — for now.
            </p>
            <p className="text-purple-400 text-sm font-display">
              "{getSafeRoomMontor()}"
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs text-sm text-ink-dim">
            <p>HP: <span className="text-ink">{playerHp}/{character.maxHp}</span></p>
            <p>Gold: <span className="text-gold">{playerGold}</span></p>
            <p>Items: <span className="text-emerald-400">{playerInventory.length}</span></p>
            <p>Chambers cleared: <span className="text-ink">{chambersCleared}</span></p>
            <p>XP: <span className="text-ink">{totalXp}</span></p>
          </div>
          {safeRoomGift ? (
            <button onClick={function() {
              if (hasGroqKey() && safeRoomGift) {
                // Start AI negotiation
                setSafeRoomStep('negotiate')
                setNegotiationStep('loading')
                setNegotiationRound(1)
                setNegotiationHistory([])
                var ctx = { mood: getMontorMood(), tidiness: getTidinessSummary().label, greedScore: greedScore, floorName: floor ? floor.floorName : 'unknown', personality: montorPersonality }
                generateTreasureReaction(ctx, safeRoomGift.name).then(function(result) {
                  if (result && result.montor) {
                    setNegotiationMontor(result.montor)
                    setNegotiationOptions(result.options || [])
                    setNegotiationStep(result.done ? 'done' : 'talking')
                    setNegotiationHistory([{ role: 'montor', text: result.montor }])
                  } else {
                    // API failed — fall back to static
                    setSafeRoomStep('offering')
                    setNegotiationStep(null)
                  }
                })
              } else {
                setSafeRoomStep('offering')
              }
            }}
              className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors">
              Montor eyes your bag...
            </button>
          ) : (
            <button onClick={handleSafeRoomContinue}
              className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors">
              Continue
            </button>
          )}
        </div>
      )
    }

    // Offering — Montor reacts to the treasure, offer smash or keep
    // AI Treasure negotiation — Montor argues with the player
    if (safeRoomStep === 'negotiate' && safeRoomGift) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={safeInteractionBg}>
          <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-5">
            <h2 className="font-display text-2xl text-gold">{safeRoomGift.name}</h2>

            {/* Loading state */}
            {negotiationStep === 'loading' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-purple-400 text-sm font-display animate-pulse">Montor stirs...</p>
              </div>
            )}

            {/* Montor's line */}
            {(negotiationStep === 'talking' || negotiationStep === 'done') && (
              <div className="max-w-sm">
                <p className="text-purple-400 text-base font-display text-center">
                  "{negotiationMontor}"
                </p>
              </div>
            )}

            {/* Conversation history (faded) */}
            {negotiationHistory.length > 1 && (
              <div className="max-w-sm space-y-1">
                {negotiationHistory.slice(0, -1).map(function(entry, hi) {
                  return (
                    <p key={hi} className={'text-[10px] text-center ' + (entry.role === 'montor' ? 'text-purple-400/40 font-display' : 'text-ink-faint font-sans italic')}>
                      {entry.role === 'montor' ? '"' + entry.text + '"' : '> ' + entry.text}
                    </p>
                  )
                })}
              </div>
            )}

            {/* Player options (if Montor still arguing) */}
            {negotiationStep === 'talking' && (function() {
              function sendPlayerChoice(text) {
                var nextRound = negotiationRound + 1
                var historyText = negotiationHistory.map(function(h) { return (h.role === 'montor' ? 'Montor: ' : 'Player: ') + h.text }).join(' | ')
                var newHistory = negotiationHistory.concat([{ role: 'player', text: text }])
                setNegotiationHistory(newHistory)
                setNegotiationStep('loading')
                setNegotiationRound(nextRound)
                setShowNegotiationFreeText(false)
                setNegotiationFreeText('')
                var ctx = { mood: getMontorMood(), tidiness: getTidinessSummary().label, greedScore: greedScore, floorName: floor ? floor.floorName : 'unknown', personality: montorPersonality }
                generateTreasureFollowUp(ctx, safeRoomGift.name, text, historyText, nextRound).then(function(result) {
                  if (result && result.montor) {
                    setNegotiationMontor(result.montor)
                    setNegotiationOptions(result.options || [])
                    setNegotiationHistory(newHistory.concat([{ role: 'montor', text: result.montor }]))
                    var isDone = result.done || nextRound >= 4
                    setNegotiationStep(isDone ? 'done' : 'talking')
                    if (isDone && result.impression) setNegotiationImpression(result.impression)
                  } else {
                    setNegotiationStep('done')
                    setNegotiationMontor('...')
                  }
                })
              }
              return (
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {!showNegotiationFreeText && negotiationOptions.length > 0 && negotiationOptions.map(function(opt, oi) {
                  return (
                    <button key={oi} onClick={function() { sendPlayerChoice(opt) }}
                      className="py-2.5 px-4 rounded-lg bg-surface border border-border text-ink text-sm font-sans hover:border-gold hover:text-gold transition-colors text-left">
                      "{opt}"
                    </button>
                  )
                })}
                {/* Free text option */}
                {!showNegotiationFreeText && (
                  <button onClick={function() { setShowNegotiationFreeText(true) }}
                    className="py-1.5 px-4 rounded-lg border border-purple-400/30 text-purple-400 text-xs font-sans hover:border-purple-400 transition-colors">
                    Say something else...
                  </button>
                )}
                {showNegotiationFreeText && (
                  <div className="flex flex-col gap-2" onClick={function(e) { e.stopPropagation() }}>
                    <input type="text" value={negotiationFreeText}
                      onChange={function(e) { setNegotiationFreeText(e.target.value) }}
                      onKeyDown={function(e) { if (e.key === 'Enter' && negotiationFreeText.trim()) sendPlayerChoice(negotiationFreeText.trim()) }}
                      placeholder="Speak to Montor..."
                      maxLength={80}
                      autoFocus
                      className="bg-bg border border-purple-400/30 rounded px-3 py-2 text-sm text-ink font-sans w-full" />
                    <div className="flex gap-2">
                      <button onClick={function() { if (negotiationFreeText.trim()) sendPlayerChoice(negotiationFreeText.trim()) }}
                        disabled={!negotiationFreeText.trim()}
                        className="flex-1 py-1.5 rounded border border-purple-400/40 text-purple-400 text-xs font-sans hover:border-purple-400 transition-colors">
                        Send
                      </button>
                      <button onClick={function() { setShowNegotiationFreeText(false); setNegotiationFreeText('') }}
                        className="flex-1 py-1.5 rounded border border-border text-ink-dim text-xs font-sans hover:text-ink transition-colors">
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )
            })()}

            {/* Smash / Keep (when Montor is done arguing) */}
            {negotiationStep === 'done' && (
              <div className="flex flex-col items-center gap-3 mt-2">
                {/* Impression feedback */}
                {negotiationImpression >= 8 && (
                  <p className="text-green-400 text-xs font-sans italic">Montor seems... impressed.</p>
                )}
                {negotiationImpression >= 5 && negotiationImpression < 8 && (
                  <p className="text-ink-faint text-xs font-sans italic">Montor considers your words.</p>
                )}
                {negotiationImpression < 5 && (
                  <p className="text-red-400 text-xs font-sans italic">Montor is not amused.</p>
                )}
                <div className="flex gap-4">
                  <button onClick={function() { setNegotiationStep(null); handleSmashGift() }}
                    className="py-3 px-8 rounded-lg border-2 border-red-400/50 bg-red-400/5 text-red-400 font-display text-lg hover:border-red-400 transition-colors">
                    Smash it
                  </button>
                  <button onClick={function() {
                    // High impression + keep = Montor rewards restraint
                    if (negotiationImpression >= 7) {
                      var bonusStat = montorTaste.favours
                      character.stats[bonusStat] = (character.stats[bonusStat] || 10) + 1
                    }
                    setNegotiationStep(null)
                    handleSafeRoomContinue()
                  }}
                    className="py-3 px-8 rounded-lg border border-gold/40 bg-gold/10 text-gold font-sans text-base hover:border-gold transition-colors">
                    Keep it
                  </button>
                </div>
                {negotiationImpression >= 7 && (
                  <p className="text-gold text-[10px] font-sans">Montor may reward your restraint...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (safeRoomStep === 'offering' && safeRoomGift) {
      var giftDef = getGiftDef(safeRoomGift.gift)
      return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={safeInteractionBg}>
          <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-6">
            <h2 className="font-display text-2xl text-gold">{safeRoomGift.name}</h2>
            <p className="text-ink text-base italic text-center max-w-sm">
              {safeRoomGift.description}
            </p>
            <p className="text-purple-400 text-sm font-display text-center max-w-sm">
              "{giftDef && giftDef.montorFind ? giftDef.montorFind : 'Put that down.'}"
            </p>
            <p className="text-ink-dim text-xs text-center max-w-sm">
              Sacrifice this treasure to Montor? Its power will be bound to one of your slots — body, mind, weapon, or shield.
            </p>
            <div className="flex gap-4 mt-2">
              <button onClick={handleSmashGift}
                className="py-3 px-8 rounded-lg border-2 border-red-400/50 bg-red-400/5 text-red-400 font-display text-lg hover:border-red-400 transition-colors">
                Smash it
              </button>
              <button onClick={handleSafeRoomContinue}
                className="py-3 px-8 rounded-lg border border-border bg-surface text-ink-dim font-sans text-base hover:text-ink transition-colors">
                Keep it
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Pick slot — body, mind, weapon, or shield
    if (safeRoomStep === 'pick_slot' && safeRoomGift) {
      var giftDef2 = getGiftDef(safeRoomGift.gift)
      var hasShield = character.equipped && character.equipped.offhand && character.equipped.offhand.slot === 'offhand'
      var weaponType = character.equipped && character.equipped.weapon ? character.equipped.weapon.weaponType : 'fists'
      var slots = [
        { id: 'body', label: 'Body', desc: giftDef2 ? giftDef2.body.length + ' options' : '', taken: !!giftSlots.body },
        { id: 'mind', label: 'Mind', desc: giftDef2 ? giftDef2.mind.length + ' options' : '', taken: !!giftSlots.mind },
        { id: 'weapon', label: 'Weapon (' + weaponType + ')', desc: giftDef2 && giftDef2.weapon[weaponType] ? giftDef2.weapon[weaponType].name : 'No effect for this weapon', taken: !!giftSlots.weapon },
      ]
      if (hasShield) {
        slots.push({ id: 'shield', label: 'Shield', desc: giftDef2 ? giftDef2.shield.length + ' options' : '', taken: !!giftSlots.shield })
      } else {
        slots.push({ id: 'shield', label: 'Shield', desc: 'Equip a shield to unlock', taken: false, locked: true })
      }
      return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={safeInteractionBg}>
          <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80">
            <span className="font-display text-lg text-gold">Choose a slot</span>
            <button onClick={function() { setSafeRoomStep('offering') }}
              className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
              Back
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <p className="text-ink-dim text-sm italic text-center mb-2">Where will you bind {safeRoomGift.name}'s power?</p>
            {slots.map(function(s) {
              var isWeaponNoEffect = s.id === 'weapon' && giftDef2 && !giftDef2.weapon[weaponType]
              return (
                <button key={s.id}
                  onClick={function() { if (!s.taken && !isWeaponNoEffect && !s.locked) handlePickGiftSlot(s.id) }}
                  disabled={s.taken || isWeaponNoEffect || s.locked}
                  className={'p-4 rounded-lg border-2 text-left transition-all ' +
                    (s.taken ? 'border-border opacity-40' :
                     isWeaponNoEffect || s.locked ? 'border-border opacity-40' :
                     'border-gold/40 bg-gold/5 hover:border-gold cursor-pointer')}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg text-gold">{s.label}</span>
                    {s.taken && <span className="text-ink-faint text-xs">Occupied</span>}
                  </div>
                  <p className="text-ink-dim text-sm font-sans mt-1">{s.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    // Pick option — show options for the chosen slot
    if (safeRoomStep === 'pick_option' && safeRoomGift && safeRoomSlotChoice) {
      var giftDef3 = getGiftDef(safeRoomGift.gift)
      var options = []
      if (safeRoomSlotChoice === 'body' && giftDef3) options = giftDef3.body
      else if (safeRoomSlotChoice === 'mind' && giftDef3) options = giftDef3.mind
      else if (safeRoomSlotChoice === 'shield' && giftDef3) options = giftDef3.shield
      else if (safeRoomSlotChoice === 'weapon' && giftDef3) {
        if (Array.isArray(giftDef3.weapon)) {
          // Universal weapon gifts (Stone/Bile/Blood/Ember/Void)
          options = giftDef3.weapon
        } else {
          // Class-specific weapon gifts (Petal)
          var wt2 = character.equipped && character.equipped.weapon ? character.equipped.weapon.weaponType : 'fists'
          var wEffect = giftDef3.weapon[wt2]
          if (wEffect) options = [wEffect]
        }
      }
      var typeColors = { defence: 'border-blue/50 bg-blue/5', attack: 'border-red-400/50 bg-red-400/5', other: 'border-amber-400/50 bg-amber-400/5' }
      var typeLabels = { defence: 'Defence', attack: 'Attack', other: 'Utility' }
      return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={safeInteractionBg}>
          <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80">
            <span className="font-display text-lg text-gold">{safeRoomSlotChoice.charAt(0).toUpperCase() + safeRoomSlotChoice.slice(1)} — Pick a power</span>
            <button onClick={function() { setSafeRoomStep('pick_slot') }}
              className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
              Back
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {options.map(function(opt) {
              var tc = typeColors[opt.type] || typeColors.other
              return (
                <button key={opt.id}
                  onClick={function() { handleApplyGiftOption(opt) }}
                  className={'p-4 rounded-lg border-2 text-left transition-all cursor-pointer hover:border-gold ' + tc}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display text-lg text-ink">{opt.name}</span>
                    {opt.type && <span className={'text-xs font-sans ' + (opt.type === 'defence' ? 'text-blue' : opt.type === 'attack' ? 'text-red-400' : 'text-amber-400')}>{typeLabels[opt.type] || ''}</span>}
                  </div>
                  <p className="text-ink-dim text-sm font-sans">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    // Smashed — show the result
    if (safeRoomStep === 'smashed') {
      var giftDef4 = getGiftDef(safeRoomGift ? safeRoomGift.gift : null)
      var appliedSlot = giftSlots[safeRoomSlotChoice]
      return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={safeInteractionBg}>
          <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-6">
            <p className="text-ink text-base italic text-center max-w-sm" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
              {giftDef4 ? giftDef4.smashText : 'The treasure shatters.'}
            </p>
            <p className="text-purple-400 text-sm font-display text-center max-w-sm">
              "{giftDef4 ? giftDef4.montorSmash : '...'}"
            </p>
            {appliedSlot && (
              <div className="p-4 rounded-lg border-2 border-gold/60 bg-gold/10 text-center max-w-sm w-full">
                <p className="text-gold font-display text-xl">{appliedSlot.name}</p>
                <p className="text-ink-dim text-sm font-sans mt-1">{appliedSlot.description}</p>
                <p className="text-ink-faint text-xs font-sans mt-2">Bound to {safeRoomSlotChoice}</p>
              </div>
            )}
            <button onClick={handleSafeRoomContinue}
              className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors mt-4">
              Continue
            </button>
          </div>
        </div>
      )
    }

    // Reward choice — tonic, item, or Montor's choice
    if (safeRoomStep === 'reward_choice') {
      var tidiness3 = getTidinessSummary()
      var mood3 = getMontorMood()
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
          <p className="text-purple-400 text-sm font-display">
            "{getSafeRoomMontor()}"
          </p>
          <div className="bg-surface border border-border rounded-lg p-3 w-full max-w-xs">
            <p className={'text-xs font-sans ' + tidiness3.colour}>Floor tidiness: {tidiness3.label}</p>
            <p className="text-ink-faint text-[10px] mt-0.5">{tidiness3.desc}</p>
          </div>
          <p className="text-gold font-display text-lg">Montor offers a reward</p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button onClick={function() { handleRewardChoice('tonic') }}
              className="py-3 px-6 rounded-lg bg-green-500/10 border border-green-500/40 text-green-400 font-sans text-sm hover:border-green-400 transition-colors">
              Tonic — {mood3 === 'happy' ? 'Pick ' + (greedScore < 10 ? '2' : '1') + ' stat' + (greedScore < 10 ? 's' : '') : mood3 === 'neutral' ? 'Pick 1 stat' : 'Montor chooses'}
            </button>
            <button onClick={function() { handleRewardChoice('item') }}
              className="py-3 px-6 rounded-lg bg-blue-500/10 border border-blue-500/40 text-blue-400 font-sans text-sm hover:border-blue-400 transition-colors">
              Item — {mood3 === 'happy' ? 'Rare quality' : mood3 === 'neutral' ? 'Uncommon quality' : 'Common quality'}
            </button>
            <button onClick={function() { handleRewardChoice('montor') }}
              className="py-3 px-6 rounded-lg bg-purple-500/10 border border-purple-500/40 text-purple-400 font-sans text-sm hover:border-purple-400 transition-colors">
              Montor's Choice — ???
            </button>
          </div>
        </div>
      )
    }

    // Item reward — show what Montor gave
    if (safeRoomStep === 'reward_item' || safeRoomStep === 'reward_montor') {
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
          <p className="text-purple-400 text-sm font-display">
            {safeRoomStep === 'reward_montor' ? '"I choose for you."' : '"Take it. Before I change my mind."'}
          </p>
          {safeRoomRewardItem ? (
            <div className={'p-4 rounded-lg border-2 w-full max-w-xs ' + rarityCol(safeRoomRewardItem.rarity).border + ' ' + rarityCol(safeRoomRewardItem.rarity).bg}>
              <p className={rarityCol(safeRoomRewardItem.rarity).text + ' font-display text-xl'}>{safeRoomRewardItem.name}</p>
              <p className={rarityCol(safeRoomRewardItem.rarity).text + ' text-xs uppercase mt-1'}>{rarityCol(safeRoomRewardItem.rarity).label}</p>
              <p className="text-ink text-sm italic mt-2">{safeRoomRewardItem.description || ''}</p>
            </div>
          ) : (
            <p className="text-ink-dim text-sm">Montor rummages... finds nothing.</p>
          )}
          <button onClick={handleSafeRoomContinue}
            className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors mt-2">
            Continue
          </button>
        </div>
      )
    }

    // Tonic pick — player chooses stat(s)
    if (safeRoomStep === 'tonic_pick' && safeRoomTonic && safeRoomTonic.playerChooses) {
      var tonicStats = STAT_ORDER.map(function(s) { return s.id })
      var tidiness = getTidinessSummary()
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
          <p className="text-purple-400 text-sm font-display">
            "{getSafeRoomMontor()}"
          </p>
          <div className="bg-surface border border-border rounded-lg p-3 w-full max-w-xs">
            <p className={'text-xs font-sans ' + tidiness.colour}>Floor tidiness: {tidiness.label}</p>
            <p className="text-ink-faint text-[10px] mt-0.5">{tidiness.desc}</p>
          </div>
          <p className="text-gold font-display text-xl">Montor's Tonic</p>
          <p className="text-ink text-sm">He offers a reward for your restraint.</p>
          <p className="text-ink-faint text-xs">{safeRoomTonic.count} pick{safeRoomTonic.count > 1 ? 's' : ''} remaining</p>
          <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
            {tonicStats.map(function(stat) {
              var isFavoured = montorTaste.favours === stat
              return (
                <button key={stat} onClick={function() { handleTonicPick(stat) }}
                  className={'py-2 px-3 rounded-lg border text-sm font-sans transition-colors ' +
                    (isFavoured ? 'border-gold/60 bg-gold/10 text-gold hover:border-gold' : 'border-border bg-surface text-ink hover:border-ink-faint')}>
                  {stat.toUpperCase()} ({character.stats[stat] || 10})
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    // Tonic done — show what was picked with continue button
    if (safeRoomStep === 'tonic_done') {
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
          <p className="text-purple-400 text-sm font-display">
            "{getSafeRoomMontor()}"
          </p>
          <p className="text-gold font-display text-xl">Tonic Applied</p>
          <div className="flex flex-col gap-1">
            {tonicPicks.map(function(stat, i) {
              return <p key={i} className="text-green-400 font-display text-lg">+1 {stat.toUpperCase()}</p>
            })}
          </div>
          <button onClick={function() { setTonicPicks([]); handleSafeRoomContinue() }}
            className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors mt-2">
            Continue
          </button>
        </div>
      )
    }

    // Tonic — Montor's choice or nothing (auto-apply Montor's pick)
    if (safeRoomStep === 'tonic') {
      if (safeRoomTonic && safeRoomTonic.montorPick && !safeRoomTonic._applied) {
        character.stats[safeRoomTonic.montorPick] = (character.stats[safeRoomTonic.montorPick] || 10) + 1
        safeRoomTonic._applied = true
      }
      var tidiness2 = getTidinessSummary()
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
          <p className="text-purple-400 text-sm font-display">
            "{getSafeRoomMontor()}"
          </p>
          <div className="bg-surface border border-border rounded-lg p-3 w-full max-w-xs">
            <p className={'text-xs font-sans ' + tidiness2.colour}>Floor tidiness: {tidiness2.label}</p>
            <p className="text-ink-faint text-[10px] mt-0.5">{tidiness2.desc}</p>
          </div>
          {safeRoomTonic ? (
            <>
              <p className="text-gold font-display text-xl">Montor's Tonic</p>
              <p className="text-ink text-sm">He chooses for you.</p>
              <p className="text-green-400 font-display text-lg">+1 {(safeRoomTonic.montorPick || 'str').toUpperCase()}</p>
            </>
          ) : (
            <>
              <p className="text-red-400/80 font-display text-lg">Nothing offered.</p>
              <p className="text-ink-faint text-sm">{tidiness2.desc}</p>
            </>
          )}
          <button onClick={handleSafeRoomContinue}
            className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors mt-2">
            Continue
          </button>
        </div>
      )
    }

    // Fallback
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <button onClick={handleSafeRoomContinue}
          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base">
          Continue
        </button>
      </div>
    )
  }

  // --- Defeat ---
  if (gamePhase === 'defeat') {
    return (
      <div onClick={function() { if (isGuarded()) return; writeRunLog('defeat'); onEndRun({ victory: false, chambersCleared: chambersCleared, xp: Math.round(totalXp * 0.5), gold: 0 }) }}
        className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised cursor-pointer">
        <h1 className="font-display text-4xl text-red-400">Defeated</h1>
        <p className="text-ink text-lg italic">Darkness swallows you whole.</p>
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
          <p className="text-ink text-sm">Chambers cleared: {chambersCleared}</p>
          <p className="text-ink text-sm mt-1">XP earned: <span className="text-gold">{Math.round(totalXp * 0.5)}</span></p>
        </div>
        <p className="text-ink-faint text-xs font-sans">Tap anywhere to return</p>
      </div>
    )
  }

  // --- Doors view (first-person: positional door layout with centre content) ---
  if (gamePhase === 'doors') {
    var currentChamber = zone.chambers[zone.playerPosition]
    var doors = getAvailableDoors()
    var doorMap = {}
    doors.forEach(function(d) { doorMap[d.dir] = d })

    // What to show in the centre of the room
    var centreIconKey = getChamberIconKey(currentChamber.type)
    var showCentre = currentChamber.cleared && centreIconKey

    // Door button renderer
    function renderDoor(dir) {
      var door = doorMap[dir]
      if (!door) return <div className="invisible" />

      var targetChamber = zone.chambers[door.targetId]
      if (!targetChamber) return <div className="invisible" />
      var isVisited = targetChamber.visited
      var isCleared = targetChamber.cleared

      return (
        <button
          onClick={function() { handlePickDoor(door.targetId) }}
          className="block transition-all cursor-pointer active:scale-95"
          style={{ lineHeight: 0 }}
        >
          <div style={isVisited ? { background: '#000' } : {}}>
            <DoorSprite theme={zone.doorTheme || 'garden'} scale={3} open={isVisited} />
          </div>
        </button>
      )
    }

    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 overflow-hidden" style={roomBgStyle}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="text-gold text-xs font-display">{zone.floorName}</span><span className="text-ink-dim text-[10px] font-sans ml-1">— {zone.zoneName}</span>
            <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">{currentChamber.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={function() { setShowCharPanel(!showCharPanel); if (!showCharPanel) setShowInventoryPanel(false) }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showCharPanel ? 'border-blue text-blue' : 'border-border text-ink-dim hover:text-ink')}>
              Stats
            </button>
            <button onClick={function() { setShowInventoryPanel(!showInventoryPanel); if (!showInventoryPanel) setShowCharPanel(false) }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showInventoryPanel ? 'border-emerald-400 text-emerald-400' : 'border-border text-ink-dim hover:text-ink')}>
              Bag
            </button>
            <span className="text-gold text-xs font-sans">{playerGold}g</span>
          </div>
        </div>

        {/* Character stats panel — full screen overlay */}
        {showCharPanel && (function() {
          var mod = function(v) { var m = Math.floor(((v || 10) - 10) / 2); return m >= 0 ? '+' + m : '' + m }
          var statRows = STAT_ORDER
          var w = character.equipped && character.equipped.weapon
          var a = character.equipped && character.equipped.armour
          var o = character.equipped && character.equipped.offhand
          var h = character.equipped && character.equipped.helmet
          var bt = character.equipped && character.equipped.boots
          var am = character.equipped && character.equipped.amulet

          // Compute effective stats from ALL equipment
          var equipBonuses = {}
          // DEF bonuses from armour, shield, helmet, boots
          if (a && a.defBonus) equipBonuses.def = (equipBonuses.def || 0) + a.defBonus
          if (o && o.defBonus) equipBonuses.def = (equipBonuses.def || 0) + o.defBonus
          if (h && h.defBonus) equipBonuses.def = (equipBonuses.def || 0) + h.defBonus
          if (bt && bt.defBonus) equipBonuses.def = (equipBonuses.def || 0) + bt.defBonus
          // AGI penalties/bonuses from weapon, armour, offhand, helmet, boots
          if (w && w.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + w.agiPenalty
          if (a && a.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + a.agiPenalty
          if (o && o.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + o.agiPenalty
          if (h && h.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + h.agiPenalty
          if (bt && bt.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + bt.agiPenalty
          if (bt && bt.agiBonus) equipBonuses.agi = (equipBonuses.agi || 0) + bt.agiBonus
          if (bt && bt.strBonus) equipBonuses.str = (equipBonuses.str || 0) + bt.strBonus
          // Passive stat bonuses from relics, rings, amulets (str_bonus, def_bonus, lck_bonus, per_bonus)
          var passiveItems = getAllPassiveItems(character.equipped)
          for (var pi2 = 0; pi2 < passiveItems.length; pi2++) {
            var pe = passiveItems[pi2].passiveEffect
            var pv = passiveItems[pi2].passiveValue || 0
            if (pe === 'str_bonus') equipBonuses.str = (equipBonuses.str || 0) + pv
            if (pe === 'def_bonus') equipBonuses.def = (equipBonuses.def || 0) + pv
            if (pe === 'lck_bonus') equipBonuses.lck = (equipBonuses.lck || 0) + pv
            if (pe === 'per_bonus') equipBonuses.per = (equipBonuses.per || 0) + pv
          }
          // Set bonuses
          var setBonusEffects = getSetBonuses(character.equipped)
          for (var sbi = 0; sbi < setBonusEffects.length; sbi++) {
            var sbe = setBonusEffects[sbi]
            if (sbe.passiveEffect === 'str_bonus') equipBonuses.str = (equipBonuses.str || 0) + (sbe.passiveValue || 0)
            if (sbe.passiveEffect === 'def_bonus') equipBonuses.def = (equipBonuses.def || 0) + (sbe.passiveValue || 0)
            if (sbe.secondEffect === 'crit_bonus') equipBonuses.lck = (equipBonuses.lck || 0) + (sbe.secondValue || 0)
          }
          // Active buff bonuses
          for (var bi = 0; bi < activeBuffs.length; bi++) {
            var b = activeBuffs[bi]
            if (b.stat && b.value) equipBonuses[b.stat] = (equipBonuses[b.stat] || 0) + b.value
          }

          var totalDef = (character.stats.def || 10) + (equipBonuses.def || 0)

          return (
            <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-display text-lg text-gold">{character.name}</span>
                <button onClick={function() { setShowCharPanel(false) }}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {/* Level + XP bar */}
                {(function() {
                  var nextThreshold = XP_THRESHOLDS[runLevel]
                  var prevXp = runLevel > 0 ? XP_THRESHOLDS[runLevel - 1].xp : 0
                  var nextXp = nextThreshold ? nextThreshold.xp : prevXp
                  var xpProgress = nextThreshold ? Math.min(1, (totalXp - prevXp) / Math.max(1, nextXp - prevXp)) : 1
                  var isMaxLevel = !nextThreshold
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gold font-display text-base">Level {runLevel + 1} Knight</span>
                        <span className="text-ink-dim text-xs font-sans">{isMaxLevel ? 'Max Level' : totalXp + ' / ' + nextXp + ' XP'}</span>
                      </div>
                      <div className="w-full bg-bg rounded-full h-2 border border-border">
                        <div className={'rounded-full h-full transition-all duration-300 ' + (isMaxLevel ? 'bg-gold' : 'bg-blue')}
                          style={{ width: Math.round(xpProgress * 100) + '%' }} />
                      </div>
                    </div>
                  )
                })()}
                {/* HP bar */}
                {(function() {
                  var hpPercent = playerHp / character.maxHp
                  var hpColor = hpPercent > 0.6 ? 'bg-green-500' : hpPercent > 0.3 ? 'bg-yellow-400' : 'bg-red-500'
                  var hpTextColor = hpPercent > 0.6 ? 'text-green-400' : hpPercent > 0.3 ? 'text-yellow-400' : 'text-red-400'
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={hpTextColor + ' font-display text-base'}>{playerHp} / {character.maxHp} HP</span>
                        <span className="text-ink-dim text-xs font-sans">Regen {1 + Math.max(0, getModifier(character.stats.end || 10)) + getPassiveTotal(character.equipped, 'regen_per_chamber')}/room</span>
                      </div>
                      <div className="w-full bg-bg rounded-full h-2 border border-border">
                        <div className={hpColor + ' rounded-full h-full transition-all duration-300'} style={{ width: Math.round(hpPercent * 100) + '%' }} />
                      </div>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4">
                  <div className="text-xs font-sans"><span className="text-ink-dim">Gold:</span> <span className="text-gold">{playerGold}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">DEF total:</span> <span className="text-ink">{totalDef} (reduces {Math.floor(totalDef / 2)})</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Dodge:</span> <span className="text-ink">{Math.round(Math.max(0, getModifier(character.stats.agi || 10) * 0.02 + getPassiveTotal(character.equipped, 'dodge_chance')) * 100)}%</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Crit:</span> <span className="text-ink">{critThreshold}+ (nat d20)</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Weapon:</span> <span className="text-ink">{w ? w.name : 'None'}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Armour:</span> <span className="text-ink">{a ? a.name : 'None'}</span></div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {statRows.map(function(s) {
                    var base = character.stats[s.id] || 0
                    var bonus = equipBonuses[s.id] || 0
                    var effective = base + bonus
                    var color = bonus > 0 ? 'text-green-400' : bonus < 0 ? 'text-red-400' : 'text-ink'
                    return (
                      <div key={s.id} className="flex flex-col items-center p-2 rounded bg-raised border border-border">
                        <span className="text-ink text-[10px] uppercase font-sans">{s.label}</span>
                        <span className={color + ' font-display text-base'}>{effective}</span>
                        {bonus !== 0 && <span className={bonus > 0 ? 'text-green-400 text-[8px]' : 'text-red-400 text-[8px]'}>{bonus > 0 ? '+' + bonus : bonus} gear</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-ink-faint text-[9px] text-center mt-2 font-sans">
                  {statRows.map(function(s) { return s.label + ': ' + s.hint }).join(' · ')}
                </p>

                {/* Active buffs */}
                {activeBuffs.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <span className="text-ink-dim text-[10px] uppercase tracking-wide font-sans">Active Effects</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activeBuffs.map(function(b, i) {
                        return (
                          <span key={i} className="text-green-400 text-[10px] font-sans bg-green-400/10 border border-green-400/20 rounded px-1.5 py-0.5">
                            +{b.value} {(b.stat || '').toUpperCase()} ({b.turnsRemaining}t)
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Gift slots */}
                <div className="mt-4 border-t border-border pt-3">
                  <span className="text-ink-dim text-[10px] uppercase tracking-wide font-sans">Montor's Gifts</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['body', 'mind', 'weapon', 'shield'].map(function(slot) {
                      var g = giftSlots[slot]
                      var slotColors = { body: 'border-red-400/30 bg-red-400/5', mind: 'border-blue/30 bg-blue/5', weapon: 'border-amber-400/30 bg-amber-400/5', shield: 'border-emerald-400/30 bg-emerald-400/5' }
                      var slotTextColors = { body: 'text-red-400', mind: 'text-blue', weapon: 'text-amber-400', shield: 'text-emerald-400' }
                      return (
                        <div key={slot} className={'p-2 rounded-lg border ' + (g ? slotColors[slot] : 'border-border bg-raised')}>
                          <span className={(g ? slotTextColors[slot] : 'text-ink-faint') + ' text-[9px] uppercase tracking-wide font-sans'}>{slot}</span>
                          {g ? (
                            <div className="mt-0.5">
                              <span className="text-ink text-xs font-display block">{g.name}</span>
                              <span className="text-ink-dim text-[9px] font-sans">{g.description}</span>
                            </div>
                          ) : (
                            <span className="text-ink-faint text-[9px] block mt-0.5">Empty</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Condition resistances */}
                {(function() {
                  var condIds = ['BLEED', 'POISON', 'BURN', 'FROST', 'FEAR', 'DAZE']
                  var condColors = { BLEED: 'text-red-400', POISON: 'text-green-500', BURN: 'text-orange-400', FROST: 'text-cyan-400', FEAR: 'text-purple-400', DAZE: 'text-yellow-300' }
                  var resistItems = getAllPassiveItems(character.equipped)
                  var resists = {}
                  for (var cri = 0; cri < resistItems.length; cri++) {
                    var ri = resistItems[cri]
                    if (ri.passiveEffect === 'condition_immunity' && ri.passiveCondition) resists[ri.passiveCondition] = 'IMMUNE'
                    if (ri.passiveEffect === 'condition_resist' && ri.passiveCondition) resists[ri.passiveCondition] = Math.min(100, Math.round(((resists[ri.passiveCondition] || 0) === 'IMMUNE' ? 100 : (resists[ri.passiveCondition] || 0)) + (ri.passiveValue || 0) * 100))
                    if (ri.passiveEffect === 'condition_resist_multi' && ri.passiveConditions) {
                      for (var crmi = 0; crmi < ri.passiveConditions.length; crmi++) {
                        var cid = ri.passiveConditions[crmi]
                        if (resists[cid] !== 'IMMUNE') resists[cid] = Math.min(100, (resists[cid] || 0) + Math.round((ri.passiveValue || 0) * 100))
                      }
                    }
                    if (ri.passiveEffect === 'condition_resist_all') {
                      for (var crai = 0; crai < condIds.length; crai++) {
                        if (resists[condIds[crai]] !== 'IMMUNE') resists[condIds[crai]] = Math.min(100, (resists[condIds[crai]] || 0) + Math.round((ri.passiveValue || 0) * 100))
                      }
                    }
                  }
                  var activeResists = condIds.filter(function(c) { return resists[c] })
                  if (activeResists.length === 0) return null
                  return (
                    <div className="mt-3 border-t border-border pt-2">
                      <span className="text-ink-dim text-[10px] uppercase tracking-wide font-sans">Condition Resist</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {activeResists.map(function(c) {
                          var val = resists[c]
                          return (
                            <span key={c} className={(condColors[c] || 'text-ink') + ' text-[9px] font-sans bg-surface border border-border rounded px-1.5 py-0.5'}>
                              {c} {val === 'IMMUNE' ? '∞' : val + '%'}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {/* Inventory panel — full screen overlay */}
        {showInventoryPanel && (function() {
          var tabs = [
            { id: 'equipped',    label: 'Worn',    types: [] },
            { id: 'gear',        label: 'Gear',    types: ['weapon', 'armour'] },
            { id: 'accessories', label: 'Equip',   types: ['relic', 'ring', 'amulet'] },
            { id: 'consumables', label: 'Items',   types: ['consumable'] },
            { id: 'junk',        label: 'Junk',    types: ['junk'] },
          ]
          var activeTab = tabs.find(function(t) { return t.id === inventoryTab }) || tabs[0]
          var filteredRaw = []
          for (var fi = 0; fi < playerInventory.length; fi++) {
            var invItem = playerInventory[fi]
            if (activeTab.types.indexOf(invItem.type) === -1) continue
            filteredRaw.push({ item: invItem, idx: fi })
          }
          // Stack identical items by ID
          var filteredItems = []
          var stackMap = {}
          for (var si = 0; si < filteredRaw.length; si++) {
            var itemId = filteredRaw[si].item.id
            if (stackMap[itemId] !== undefined) {
              filteredItems[stackMap[itemId]].count++
            } else {
              stackMap[itemId] = filteredItems.length
              filteredItems.push({ item: filteredRaw[si].item, idx: filteredRaw[si].idx, count: 1 })
            }
          }

          // Sort items
          var rarityRank = { heirloom: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 }
          filteredItems.sort(function(a, b) {
            if (inventorySort === 'rarity') {
              return (rarityRank[b.item.rarity] || 0) - (rarityRank[a.item.rarity] || 0)
            }
            if (inventorySort === 'damage') {
              return (b.item.damageDie || b.item.die || 0) - (a.item.damageDie || a.item.die || 0)
            }
            if (inventorySort === 'def') {
              return (b.item.defBonus || 0) - (a.item.defBonus || 0)
            }
            if (inventorySort === 'name') {
              return (a.item.name || '').localeCompare(b.item.name || '')
            }
            return 0
          })

          // Count items per tab for badges
          var tabCounts = {}
          for (var ci = 0; ci < tabs.length; ci++) {
            var tabId = tabs[ci].id
            tabCounts[tabId] = 0
            if (tabId === 'junk') {
              tabCounts[tabId] = playerJunkBag.filter(function(j) { return !j.consumable }).reduce(function(s, j) { return s + j.count }, 0)
            } else if (tabId === 'consumables') {
              // Regular consumables from inventory + consumable junk
              for (var pi2 = 0; pi2 < playerInventory.length; pi2++) {
                if (playerInventory[pi2].type === 'consumable') tabCounts[tabId]++
              }
              tabCounts[tabId] += playerJunkBag.filter(function(j) { return j.consumable }).reduce(function(s, j) { return s + j.count }, 0)
            } else {
              for (var pi = 0; pi < playerInventory.length; pi++) {
                var countItem = playerInventory[pi]
                if (tabs[ci].types.indexOf(countItem.type) === -1) continue
                tabCounts[tabId]++
              }
            }
          }

          return (
            <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col overflow-hidden">
              {/* Header with weight bar */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display text-lg text-gold">Inventory</span>
                  <button onClick={function() { setShowInventoryPanel(false); setSelectedItemIdx(null) }}
                    className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                    Close
                  </button>
                </div>
                {(function() {
                  var endMod = Math.max(0, Math.floor(((character.stats.end || 10) - 10) / 2))
                  var capacity = 10 + (endMod * 3)
                  var carried = playerInventory.reduce(function(sum, it) { return sum + (it.weight || 0) }, 0)
                  carried += playerJunkBag.reduce(function(sum, j) { return sum + (j.count || 0) }, 0)
                  var pct = Math.min(100, Math.round((carried / capacity) * 100))
                  var barColour = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                  return (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-bg rounded-full h-1.5">
                        <div className={barColour + ' rounded-full h-1.5 transition-all duration-300'} style={{ width: pct + '%' }} />
                      </div>
                      <span className={'text-[10px] font-sans ' + (pct >= 100 ? 'text-red-400' : pct >= 75 ? 'text-amber-400' : 'text-ink-dim')}>{carried}/{capacity}</span>
                    </div>
                  )
                })()}
              </div>
              {/* Tab bar */}
              <div className="flex border-b border-border">
                {tabs.map(function(tab) {
                  var isActive = tab.id === activeTab.id
                  return (
                    <button key={tab.id}
                      onClick={function() { setInventoryTab(tab.id); setSelectedItemIdx(null) }}
                      className={'flex-1 py-2.5 text-sm font-sans transition-colors ' +
                        (isActive ? 'text-gold border-b-2 border-gold bg-raised' : 'text-ink-dim hover:text-ink')}>
                      {tab.label}
                      {tabCounts[tab.id] > 0 && (
                        <span className="ml-1 text-xs opacity-70">({tabCounts[tab.id]})</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Sort toggle */}
              {(activeTab.id === 'gear' || activeTab.id === 'accessories' || activeTab.id === 'consumables') && (
                <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border">
                  <span className="text-ink-faint text-[10px] font-sans mr-1">Sort:</span>
                  {['rarity', activeTab.id === 'gear' ? 'damage' : null, activeTab.id === 'gear' ? 'def' : null, 'name'].filter(Boolean).map(function(s) {
                    return (
                      <button key={s} onClick={function() { setInventorySort(s) }}
                        className={'text-[10px] font-sans px-2 py-0.5 rounded transition-colors ' +
                          (inventorySort === s ? 'bg-gold/20 text-gold' : 'text-ink-dim hover:text-ink')}>
                        {s === 'damage' ? 'DMG' : s === 'def' ? 'DEF' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Equipped tab — all worn gear in one view */}
              {activeTab.id === 'equipped' && (
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="flex flex-col gap-1.5">
                    {/* Weapon */}
                    <div className="p-2 rounded bg-gold/10 border border-gold/20 text-sm font-sans flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gold uppercase">Weapon: </span>
                        <span className={character.equipped && character.equipped.weapon ? rarityCol(character.equipped.weapon.rarity).text : 'text-ink-faint'}>{character.equipped && character.equipped.weapon ? character.equipped.weapon.name : 'Fists'}</span>
                        {character.equipped && character.equipped.weapon && <span className="text-ink-faint text-[10px] ml-1">d{character.equipped.weapon.damageDie || character.equipped.weapon.die}</span>}
                      </div>
                      {canEquipNow && character.equipped && character.equipped.weapon && (
                        <button onClick={handleUnequipWeapon} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>
                      )}
                    </div>
                    {/* Offhand */}
                    {character.equipped && character.equipped.offhand && (
                      <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-sm font-sans flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-blue-400 uppercase">{character.equipped.offhand.type === 'weapon' ? 'Off-hand: ' : 'Shield: '}</span>
                          <span className={rarityCol(character.equipped.offhand.rarity).text}>{character.equipped.offhand.name}</span>
                        </div>
                        {canEquipNow && <button onClick={handleUnequipOffhand} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                      </div>
                    )}
                    {/* Armour */}
                    {character.equipped && character.equipped.armour && (
                      <div className="p-2 rounded bg-surface border border-border text-sm font-sans flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-ink-dim uppercase">Armour: </span>
                          <span className={rarityCol(character.equipped.armour.rarity).text}>{character.equipped.armour.name}</span>
                          <span className="text-ink-faint text-[10px] ml-1">+{character.equipped.armour.defBonus || 0} DEF</span>
                        </div>
                        {canEquipNow && <button onClick={handleUnequipArmour} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                      </div>
                    )}
                    {/* Helmet */}
                    {character.equipped && character.equipped.helmet && (
                      <div className="p-2 rounded bg-surface border border-border text-sm font-sans flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-ink-dim uppercase">Helmet: </span>
                          <span className={rarityCol(character.equipped.helmet.rarity).text}>{character.equipped.helmet.name}</span>
                        </div>
                        {canEquipNow && <button onClick={handleUnequipHelmet} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                      </div>
                    )}
                    {/* Boots */}
                    {character.equipped && character.equipped.boots && (
                      <div className="p-2 rounded bg-surface border border-border text-sm font-sans flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-ink-dim uppercase">Boots: </span>
                          <span className={rarityCol(character.equipped.boots.rarity).text}>{character.equipped.boots.name}</span>
                        </div>
                        {canEquipNow && <button onClick={handleUnequipBoots} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                      </div>
                    )}
                    {/* Amulet */}
                    {character.equipped && character.equipped.amulet && (
                      <div className="p-2 rounded bg-surface border border-border text-sm font-sans flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-ink-dim uppercase">Amulet: </span>
                          <span className={rarityCol(character.equipped.amulet.rarity).text}>{character.equipped.amulet.name}</span>
                        </div>
                        {canEquipNow && <button onClick={handleUnequipAmulet} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                      </div>
                    )}
                    {/* Rings */}
                    {character.equipped && character.equipped.rings && character.equipped.rings.map(function(ring, ri) {
                      return (
                        <div key={'ring-' + ri} className="p-2 rounded bg-amber-400/5 border border-amber-400/20 text-sm font-sans flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-amber-400 uppercase">Ring: </span>
                            <span className={rarityCol(ring.rarity).text}>{ring.name}</span>
                          </div>
                          {canEquipNow && <button onClick={function() { handleUnequipRing(ri) }} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                        </div>
                      )
                    })}
                    {/* Relics */}
                    {character.equipped && character.equipped.relics && character.equipped.relics.map(function(rel, rli) {
                      return (
                        <div key={'relic-' + rli} className="p-2 rounded bg-purple-400/5 border border-purple-400/20 text-sm font-sans flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-purple-400 uppercase">Relic: </span>
                            <span className={rarityCol(rel.rarity).text}>{rel.name}</span>
                          </div>
                          {canEquipNow && <button onClick={function() { handleUnequipRelic(rli) }} className="text-[10px] text-ink-dim border border-border px-2 py-0.5 rounded hover:text-ink">Unequip</button>}
                        </div>
                      )
                    })}
                    {/* Empty slots hint */}
                    {(!character.equipped || (!character.equipped.weapon && !character.equipped.armour && !character.equipped.offhand)) && (
                      <p className="text-ink-faint text-xs italic text-center py-4">No equipment. Check Gear and Equip tabs.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Equipped sections moved to Worn tab */}
              {activeTab.id === '_disabled_gear' && character.equipped && (
                <div className="mx-3 mt-2 flex flex-col gap-1">
                  <div className="p-2 rounded bg-gold/10 border border-gold/20 text-sm font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gold uppercase tracking-wide">Main Hand</span>
                        {character.equipped.weapon ? (
                          <>
                            <span className={rarityCol(character.equipped.weapon.rarity).text}>{character.equipped.weapon.name}</span>
                            <span className="text-ink-faint text-[10px]">d{character.equipped.weapon.damageDie || character.equipped.weapon.die} dmg ({character.equipped.weapon.weaponType || 'weapon'})</span>
                          </>
                        ) : (
                          <>
                            <span className="text-ink">Fists</span>
                            <span className="text-ink-faint text-[10px]">d4 dmg, -1 accuracy, 2x STR bonus (unarmed)</span>
                          </>
                        )}
                      </div>
                      {canEquipNow && character.equipped.weapon && (
                        <button onClick={handleUnequipWeapon}
                          className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors">
                          Unequip
                        </button>
                      )}
                    </div>
                  </div>
                  {character.equipped.offhand && (
                    <div className={'p-2 rounded text-sm font-sans ' + (character.equipped.offhand.type === 'weapon' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-blue-500/10 border border-blue-500/20')}>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={'text-[10px] uppercase tracking-wide ' + (character.equipped.offhand.type === 'weapon' ? 'text-emerald-400' : 'text-blue-400')}>
                            {character.equipped.offhand.type === 'weapon' ? 'Off Hand (Dual Wield)' : 'Shield'}
                          </span>
                          <span className="text-ink">{character.equipped.offhand.name}</span>
                          <span className="text-ink-faint text-[10px]">
                            {character.equipped.offhand.type === 'weapon'
                              ? 'd' + (character.equipped.offhand.damageDie || character.equipped.offhand.die) + ' dmg, -2 accuracy, no crits'
                              : '+' + character.equipped.offhand.defBonus + ' DEF, ' + Math.round((character.equipped.offhand.passiveValue || 0) * 100) + '% block'}
                          </span>
                        </div>
                        {canEquipNow && (
                          <button onClick={handleUnequipOffhand}
                            className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors">
                            Unequip
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab.id === '_disabled_gear2' && (
                <div className="mx-3 mt-2 flex flex-col gap-1">
                  {character.equipped && character.equipped.armour && (
                    <div className="p-2 rounded bg-gold/10 border border-gold/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gold uppercase tracking-wide">Armour</span>
                          <span className={rarityCol(character.equipped.armour.rarity).text}>{character.equipped.armour.name}</span>
                          <span className="text-ink-faint text-[10px]">+{character.equipped.armour.defBonus || 0} DEF{character.equipped.armour.agiPenalty ? ', ' + character.equipped.armour.agiPenalty + ' AGI' : ''}</span>
                        </div>
                        {canEquipNow && (
                          <button onClick={handleUnequipArmour}
                            className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors">
                            Unequip
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {character.equipped && character.equipped.helmet && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-amber-400 uppercase tracking-wide">Helmet</span>
                          <span className={rarityCol(character.equipped.helmet.rarity).text}>{character.equipped.helmet.name}</span>
                          <span className="text-ink-faint text-[10px]">+{character.equipped.helmet.defBonus || 0} DEF{character.equipped.helmet.agiPenalty ? ', ' + character.equipped.helmet.agiPenalty + ' AGI' : ''}</span>
                        </div>
                        {canEquipNow && (
                          <button onClick={handleUnequipHelmet}
                            className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors">
                            Unequip
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {character.equipped && character.equipped.boots && (
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-emerald-400 uppercase tracking-wide">Boots</span>
                          <span className={rarityCol(character.equipped.boots.rarity).text}>{character.equipped.boots.name}</span>
                          <span className="text-ink-faint text-[10px]">{character.equipped.boots.agiBonus ? '+' + character.equipped.boots.agiBonus + ' AGI' : ''}{character.equipped.boots.defBonus ? (character.equipped.boots.agiBonus ? ', ' : '') + '+' + character.equipped.boots.defBonus + ' DEF' : ''}{character.equipped.boots.initBonus ? ', +' + character.equipped.boots.initBonus + ' initiative' : ''}</span>
                        </div>
                        {canEquipNow && (
                          <button onClick={handleUnequipBoots}
                            className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors">
                            Unequip
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {character.equipped && character.equipped.amulet && (
                    <div className="p-2 rounded bg-violet-500/10 border border-violet-500/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-violet-400 uppercase tracking-wide">Amulet</span>
                          <span className={rarityCol(character.equipped.amulet.rarity).text}>{character.equipped.amulet.name}</span>
                          <span className="text-ink-faint text-[10px]">{character.equipped.amulet.description}</span>
                        </div>
                        {canEquipNow && (
                          <button onClick={handleUnequipAmulet}
                            className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors">
                            Unequip
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {character.equipped && character.equipped.rings && character.equipped.rings.length > 0 && (
                    <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-sm font-sans">
                      <span className="text-[10px] text-cyan-400 uppercase tracking-wide">Rings ({character.equipped.rings.length}/2)</span>
                      {character.equipped.rings.map(function(ring, ri) {
                        return (
                          <div key={ri} className="flex items-center justify-between mt-1">
                            <div className="flex flex-col">
                              <span className="text-ink text-xs">{ring.name}</span>
                              <span className="text-ink-faint text-[10px]">{ring.description}</span>
                            </div>
                            {canEquipNow && (
                              <button onClick={function() { handleUnequipRing(ri) }}
                                className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors shrink-0 ml-2">
                                Unequip
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {activeTab.id === '_disabled_accessories' && (
                <div className="mx-3 mt-2 flex flex-col gap-1">
                  {character.equipped && character.equipped.relics && (function() {
                    var isResist = function(r) { return r.passiveEffect === 'condition_resist' || r.passiveEffect === 'condition_immunity' || r.passiveEffect === 'condition_resist_multi' || r.passiveEffect === 'condition_resist_all' }
                    var resistRelics = []
                    var utilityRelics = []
                    character.equipped.relics.forEach(function(r, i) {
                      if (isResist(r)) resistRelics.push({ relic: r, idx: i })
                      else utilityRelics.push({ relic: r, idx: i })
                    })
                    return (
                      <>
                        {resistRelics.length > 0 && (
                          <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-sm font-sans">
                            <span className="text-[10px] text-purple-400 uppercase tracking-wide">Wards ({resistRelics.length}/3)</span>
                            {resistRelics.map(function(entry) {
                              return (
                                <div key={entry.idx} className="flex items-center justify-between mt-1">
                                  <div className="flex flex-col">
                                    <span className="text-ink text-xs">{entry.relic.name}</span>
                                    <span className="text-ink-faint text-[10px]">{entry.relic.description}</span>
                                  </div>
                                  {canEquipNow && (
                                    <button onClick={function() { handleUnequipRelic(entry.idx) }}
                                      className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors shrink-0 ml-2">
                                      Unequip
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {utilityRelics.length > 0 && (
                          <div className="p-2 rounded bg-gold/10 border border-gold/20 text-sm font-sans">
                            <span className="text-[10px] text-gold uppercase tracking-wide">Relics</span>
                            {utilityRelics.map(function(entry) {
                              return (
                                <div key={entry.idx} className="flex items-center justify-between mt-1">
                                  <div className="flex flex-col">
                                    <span className="text-ink text-xs">{entry.relic.name}</span>
                                    <span className="text-ink-faint text-[10px]">{entry.relic.description}</span>
                                  </div>
                                  {canEquipNow && (
                                    <button onClick={function() { handleUnequipRelic(entry.idx) }}
                                      className="text-[10px] text-ink-dim border border-border px-2 py-1 rounded hover:text-ink hover:border-ink-dim transition-colors shrink-0 ml-2">
                                      Unequip
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Bag contents for active tab (not on equipped tab) */}
              {activeTab.id !== 'equipped' && <div className="p-3 flex-1 overflow-y-auto">
                {filteredItems.length === 0 && (
                  <p className="text-ink-faint text-xs text-center py-2">Nothing here.</p>
                )}

                {/* Item detail panel */}
                {selectedItemIdx !== null && playerInventory[selectedItemIdx] && (function() {
                  var detailItem = playerInventory[selectedItemIdx]
                  var isEquippable = detailItem.type === 'weapon' || detailItem.type === 'armour' || detailItem.type === 'relic' || detailItem.type === 'ring' || detailItem.type === 'amulet'
                  var isConsumable = detailItem.type === 'consumable'
                  return (
                    <div className={'mb-2 p-4 rounded-lg border-2 ' + rarityCol(detailItem.rarity).border + ' ' + rarityCol(detailItem.rarity).bg}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={rarityCol(detailItem.rarity).text + ' font-display text-lg'}>{detailItem.name}</span>
                        <span className={rarityCol(detailItem.rarity).text + ' text-xs uppercase font-sans'}>{rarityCol(detailItem.rarity).label}</span>
                      </div>
                      <p className="text-ink text-sm italic mb-3">{detailItem.description || ''}</p>
                      <div className="flex flex-col gap-1.5 text-xs text-ink mb-3">
                        {detailItem.type === 'weapon' && <span>Type: {detailItem.weaponType || 'weapon'} | Damage: d{detailItem.damageDie || detailItem.die}{detailItem.hand ? ' | ' + detailItem.hand : ''}</span>}
                        {detailItem.type === 'weapon' && detailItem.defIgnore > 0 && <span>Ignores {Math.round(detailItem.defIgnore * 100)}% of enemy DEF</span>}
                        {detailItem.type === 'weapon' && detailItem.doubleStrikeBase > 0 && <span>{Math.round(detailItem.doubleStrikeBase * 100)}% double strike chance (scales with AGI)</span>}
                        {detailItem.conditionOnHit && <span>Applies {detailItem.conditionOnHit} on hit</span>}
                        {detailItem.type === 'armour' && <span>{detailItem.slot === 'helmet' ? 'Helmet' : detailItem.slot === 'boots' ? 'Boots' : detailItem.slot === 'offhand' ? 'Shield' : 'Armour'}{detailItem.defBonus ? ' | DEF: +' + detailItem.defBonus : ''}{detailItem.agiBonus ? ' | AGI: +' + detailItem.agiBonus : ''}{detailItem.agiPenalty ? ' | AGI: ' + detailItem.agiPenalty : ''}{detailItem.initBonus ? ' | Init: +' + detailItem.initBonus : ''}</span>}
                        {detailItem.type === 'ring' && <span>Ring</span>}
                        {detailItem.type === 'amulet' && <span>Amulet{detailItem.twinFangsGrant ? ' | Grants Twin Fangs' : ''}</span>}
                        {detailItem.setId && <span>Set: {detailItem.setId === 'sunday_best' ? "Montor's Sunday Best" : detailItem.setId === 'peaky' ? "Montor's Peaky Set" : detailItem.setId}</span>}
                        {detailItem.passiveEffect && (function() {
                          var peLabels = {
                            hp_bonus: '+' + detailItem.passiveValue + ' max HP',
                            regen_per_chamber: 'Heal ' + detailItem.passiveValue + ' HP per room',
                            lck_bonus: '+' + detailItem.passiveValue + ' LCK',
                            str_bonus: '+' + detailItem.passiveValue + ' STR',
                            def_bonus: '+' + detailItem.passiveValue + ' DEF',
                            per_bonus: '+' + detailItem.passiveValue + ' PER',
                            init_bonus: '+' + detailItem.passiveValue + ' initiative',
                            crit_bonus: 'Crit threshold -' + detailItem.passiveValue,
                            lifesteal: Math.round(detailItem.passiveValue * 100) + '% lifesteal',
                            dodge_chance: Math.round(detailItem.passiveValue * 100) + '% dodge chance',
                            damage_reflect: 'Reflects ' + detailItem.passiveValue + ' damage to attackers',
                            block_chance: Math.round((detailItem.passiveValue || 0) * 100) + '% block chance',
                            d20_nudge: '+' + detailItem.passiveValue + ' to all d20 rolls',
                            reroll_ones: 'Reroll 1s on damage dice',
                            see_enemy_hp_exact: 'See exact enemy HP',
                            condition_resist: detailItem.passiveCondition + ' resist ' + Math.round(detailItem.passiveValue * 100) + '%',
                            condition_immunity: detailItem.passiveCondition + ' immune',
                            condition_resist_all: 'All conditions resist ' + Math.round(detailItem.passiveValue * 100) + '%',
                            condition_resist_multi: (detailItem.passiveConditions || []).join('+') + ' resist ' + Math.round(detailItem.passiveValue * 100) + '%',
                            gold_bonus: '+' + Math.round(detailItem.passiveValue * 100) + '% gold',
                            search_bonus: '+' + detailItem.passiveValue + ' search rolls',
                            flat_damage_bonus: '+' + detailItem.passiveValue + ' damage on all hits',
                            damage_multiplier: detailItem.passiveValue + 'x weapon damage',
                          }
                          var label = peLabels[detailItem.passiveEffect]
                          if (!label) return null
                          return <span className="text-emerald-400">{label}</span>
                        })()}
                        {detailItem.buyPrice && <span>Value: {detailItem.sellPrice || Math.round(detailItem.buyPrice * 0.4)}g</span>}
                      </div>
                      {/* Comparison to equipped (or empty slot) */}
                      {detailItem.type === 'weapon' && (function() {
                        var eq = character.equipped && character.equipped.weapon
                        var newDie = detailItem.damageDie || detailItem.die || 0
                        var eqDie = eq ? (eq.damageDie || eq.die || 0) : 4 // fists = d4
                        var newAcc = detailItem.accuracyBonus || 0
                        var eqAcc = eq ? (eq.accuracyBonus || 0) : -1 // fists = -1
                        return (
                          <div className="mb-3 p-2 rounded bg-bg border border-border text-[10px] font-sans">
                            <p className="text-ink-faint mb-1">vs {eq ? '' : 'empty: '}<span className={eq ? rarityCol(eq.rarity).text : 'text-ink-faint'}>{eq ? eq.name : 'Fists'}</span></p>
                            <div className="flex gap-3">
                              <span className={newDie > eqDie ? 'text-green-400' : newDie < eqDie ? 'text-red-400' : 'text-ink-dim'}>DMG d{newDie} {newDie > eqDie ? '\u25B2' : newDie < eqDie ? '\u25BC' : '='}</span>
                              <span className={newAcc > eqAcc ? 'text-green-400' : newAcc < eqAcc ? 'text-red-400' : 'text-ink-dim'}>ACC {newAcc >= 0 ? '+' : ''}{newAcc} {newAcc > eqAcc ? '\u25B2' : newAcc < eqAcc ? '\u25BC' : '='}</span>
                            </div>
                          </div>
                        )
                      })()}
                      {detailItem.type === 'armour' && detailItem.slot !== 'offhand' && (function() {
                        var slotMap = { armour: 'armour', helmet: 'helmet', boots: 'boots' }
                        var slotLabels = { armour: 'Armour', helmet: 'Helmet', boots: 'Boots' }
                        var eqSlot = slotMap[detailItem.slot] || 'armour'
                        var eq = character.equipped && character.equipped[eqSlot]
                        var newDef = detailItem.defBonus || 0
                        var eqDef = eq ? (eq.defBonus || 0) : 0
                        var newAgi = (detailItem.agiBonus || 0) + (detailItem.agiPenalty || 0)
                        var eqAgi = eq ? ((eq.agiBonus || 0) + (eq.agiPenalty || 0)) : 0
                        return (
                          <div className="mb-3 p-2 rounded bg-bg border border-border text-[10px] font-sans">
                            <p className="text-ink-faint mb-1">vs {eq ? '' : 'empty: '}<span className={eq ? rarityCol(eq.rarity).text : 'text-ink-faint'}>{eq ? eq.name : 'No ' + (slotLabels[eqSlot] || 'item')}</span></p>
                            <div className="flex gap-3">
                              <span className={newDef > eqDef ? 'text-green-400' : newDef < eqDef ? 'text-red-400' : 'text-ink-dim'}>DEF +{newDef} {newDef > eqDef ? '\u25B2' : newDef < eqDef ? '\u25BC' : '='}</span>
                              {(newAgi !== 0 || eqAgi !== 0) && <span className={newAgi > eqAgi ? 'text-green-400' : newAgi < eqAgi ? 'text-red-400' : 'text-ink-dim'}>AGI {newAgi >= 0 ? '+' : ''}{newAgi} {newAgi > eqAgi ? '\u25B2' : newAgi < eqAgi ? '\u25BC' : '='}</span>}
                            </div>
                          </div>
                        )
                      })()}
                      {detailItem.type === 'armour' && detailItem.slot === 'offhand' && (function() {
                        var eq = character.equipped && character.equipped.offhand
                        var newDef = detailItem.defBonus || 0
                        var eqDef = eq ? (eq.defBonus || 0) : 0
                        var newBlock = Math.round((detailItem.passiveValue || 0) * 100)
                        var eqBlock = eq ? Math.round((eq.passiveValue || 0) * 100) : 0
                        return (
                          <div className="mb-3 p-2 rounded bg-bg border border-border text-[10px] font-sans">
                            <p className="text-ink-faint mb-1">vs {eq ? '' : 'empty: '}<span className={eq ? rarityCol(eq.rarity).text : 'text-ink-faint'}>{eq ? eq.name : 'No shield'}</span></p>
                            <div className="flex gap-3">
                              <span className={newDef > eqDef ? 'text-green-400' : newDef < eqDef ? 'text-red-400' : 'text-ink-dim'}>DEF +{newDef} {newDef > eqDef ? '\u25B2' : newDef < eqDef ? '\u25BC' : '='}</span>
                              <span className={newBlock > eqBlock ? 'text-green-400' : newBlock < eqBlock ? 'text-red-400' : 'text-ink-dim'}>Block {newBlock}% {newBlock > eqBlock ? '\u25B2' : newBlock < eqBlock ? '\u25BC' : '='}</span>
                            </div>
                          </div>
                        )
                      })()}
                      <div className="flex gap-2">
                        {isEquippable && canEquipNow && (
                          <button onClick={function() { handleEquipItem(selectedItemIdx); setSelectedItemIdx(null) }}
                            className="flex-1 text-xs text-gold border border-gold/40 py-1 rounded hover:border-gold transition-colors">
                            Equip
                          </button>
                        )}
                        {isConsumable && canEquipNow && !(gamePhase === 'doors' && (detailItem.effect === 'damage_all_enemies' || detailItem.effect === 'condition_all_enemies' || detailItem.effect === 'damage_and_condition_all' || detailItem.effect === 'condition_one_enemy' || detailItem.effect === 'condition_multi_enemies' || detailItem.effect === 'damage_multi_enemies' || detailItem.effect === 'timed_bomb' || detailItem.effect === 'reflect_next_attack' || detailItem.effect === 'wet_all_and_heal' || detailItem.effect === 'risky_throw' || detailItem.effect === 'damage_and_condition_one' || detailItem.effect === 'debuff_all_enemies' || detailItem.effect === 'summon_ally')) && (
                          <button onClick={function() { handleUseItem(selectedItemIdx); setSelectedItemIdx(null) }}
                            className="flex-1 text-xs text-emerald-400 border border-emerald-500/40 py-1 rounded hover:border-emerald-400 transition-colors">
                            {gamePhase === 'combat' ? 'Use' : 'Consume'}
                          </button>
                        )}
                        <button onClick={function() { setSelectedItemIdx(null) }}
                          className="flex-1 text-xs text-ink-dim border border-border py-1 rounded hover:text-ink transition-colors">
                          Back
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {selectedItemIdx === null && activeTab.id !== 'junk' && (
                  <div className="flex flex-col gap-1">
                    {filteredItems.map(function(entry) {
                      var item = entry.item
                      var idx = entry.idx
                      return (
                        <button key={idx} onClick={function() { setSelectedItemIdx(idx) }}
                          className={'flex items-center justify-between p-3 rounded-lg bg-raised text-sm font-sans hover:border-gold border transition-colors text-left cursor-pointer ' + rarityCol(item.rarity).border}>
                          <div className="flex flex-col">
                            <span className={rarityCol(item.rarity).text + ' font-medium'}>{item.name}</span>
                            <span className="text-ink-dim text-xs">
                              {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' ' + (item.weaponType || '') :
                               item.type === 'armour' && item.slot === 'offhand' ? '+' + item.defBonus + ' DEF, ' + Math.round((item.passiveValue || 0) * 100) + '% block' :
                               item.type === 'armour' && item.slot === 'helmet' ? 'helmet' + (item.defBonus ? ', +' + item.defBonus + ' DEF' : '') :
                               item.type === 'armour' && item.slot === 'boots' ? 'boots' + (item.agiBonus ? ', +' + item.agiBonus + ' AGI' : '') + (item.defBonus ? ', +' + item.defBonus + ' DEF' : '') :
                               item.type === 'armour' ? '+' + (item.defBonus || 0) + ' DEF' :
                               item.type === 'ring' ? 'ring' :
                               item.type === 'amulet' ? 'amulet' :
                               item.type === 'relic' ? (item.passiveEffect || '').replace(/_/g, ' ') :
                               item.effect === 'heal' ? 'Heal ' + item.effectValue :
                               item.effect === 'random_effect' ? '???' :
                               item.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.count > 1 && <span className="text-gold text-xs font-display">x{entry.count}</span>}
                            <span className="text-ink-faint text-[10px]">{'>'}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Consumables tab — potions + consumable junk */}
                {activeTab.id === 'consumables' && (
                  <div className="flex flex-col gap-1">
                    {/* Consume result banner */}
                    {consumeResult && (
                      <div onClick={function() { setConsumeResult(null) }}
                        className={'p-3 rounded-lg border text-center cursor-pointer mb-1 ' +
                          (consumeResult.success ? 'border-green-400/40 bg-green-400/5' : 'border-red-400/40 bg-red-400/5')}>
                        <p className={'text-sm font-display ' + (consumeResult.success ? 'text-green-400' : 'text-red-400')}>
                          {consumeResult.junkName}
                        </p>
                        <p className={'text-xs font-sans mt-1 ' + (consumeResult.success ? 'text-green-300' : 'text-red-300')}>
                          {consumeResult.narrative}
                        </p>
                        <p className="text-ink-faint text-[9px] mt-1">Tap to dismiss</p>
                      </div>
                    )}

                    {/* Consumable junk from junk bag — sorted by risk if PER can tell */}
                    {playerJunkBag.filter(function(j) { return j.consumable }).sort(function(a, b) {
                      return (a.consumeRisk || 3) - (b.consumeRisk || 3)
                    }).map(function(junk) {
                      var hint = inspectJunkItem(junk, character.stats.per || 6)
                      var isExpanded = expandedJunkId === junk.id
                      var riskColour = !junk.consumeRisk ? 'border-border' :
                        junk.consumeRisk <= 2 ? 'border-green-400/30' :
                        junk.consumeRisk <= 3 ? 'border-amber-400/30' :
                        'border-red-400/30'
                      return (
                        <div key={junk.id} className={'rounded-lg bg-raised text-sm font-sans ' + riskColour + ' border'}>
                          <button onClick={function() { setExpandedJunkId(isExpanded ? null : junk.id) }}
                            className="flex items-center justify-between w-full p-3 text-left">
                            <div className="flex flex-col">
                              <span className="text-ink">{junk.name} {junk.count > 1 ? <span className="text-gold text-xs">×{junk.count}</span> : ''}</span>
                              <span className="text-ink-dim text-[10px] italic">{hint}</span>
                            </div>
                            <span className="text-ink-faint text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 flex flex-col gap-2">
                              <p className="text-ink-faint text-[10px]">Sell: {junk.sellPrice}g</p>
                              {junk.consumable && (gamePhase === 'doors' || (canEquipNow && gamePhase === 'combat')) && (
                                <button onClick={function() {
                                  var consumeTarget = junk
                                  // Green Patience (mind gift): reduce consume risk
                                  if (giftSlots.mind && giftSlots.mind.effect === 'junk_risk_reduction') {
                                    consumeTarget = Object.assign({}, junk, { consumeRisk: Math.max(1, (junk.consumeRisk || 3) - giftSlots.mind.value) })
                                  }
                                  var result = consumeJunk(consumeTarget, character.stats.lck || 10)
                                  if (!result) return
                                  setPlayerJunkBag(function(bag) {
                                    return bag.map(function(j) {
                                      if (j.id !== junk.id) return j
                                      return Object.assign({}, j, { count: j.count - 1 })
                                    }).filter(function(j) { return j.count > 0 })
                                  })
                                  if (result.success && result.effect) {
                                    if (result.effect.effect === 'heal') {
                                      setPlayerHp(function(hp) { return Math.min(hp + result.effect.value, character.maxHp) })
                                    } else if (result.effect.effect === 'stat_buff') {
                                      setActiveBuffs(function(prev) { return prev.concat([{ stat: result.effect.stat, value: result.effect.value, turnsRemaining: result.effect.turns || 3 }]) })
                                    }
                                  } else if (!result.success && result.effect && result.effect.effect === 'condition') {
                                    // Bad outcome — apply condition in combat, or small HP loss in exploration
                                    if (battle) {
                                      var condId = result.effect.condition
                                      setBattle(function(prev) {
                                        if (!prev) return prev
                                        var newPlayers = {}
                                        Object.keys(prev.players).forEach(function(uid) {
                                          var p = prev.players[uid]
                                          newPlayers[uid] = Object.assign({}, p, {
                                            statusEffects: applyConditionToEffects(p.statusEffects || [], condId, 'junk_consumable')
                                          })
                                        })
                                        return Object.assign({}, prev, { players: newPlayers })
                                      })
                                    } else {
                                      // Out of combat — minor HP loss instead of condition
                                      var junkDmg = Math.max(1, Math.floor(Math.random() * 4) + 1) // 1-4 HP
                                      setPlayerHp(function(hp) { return Math.max(1, hp - junkDmg) })
                                    }
                                  }
                                  setConsumeResult({ success: result.success, narrative: result.narrative, junkName: junk.name })
                                  setExpandedJunkId(null)
                                }}
                                  className={'py-2 px-4 rounded-lg border text-xs font-sans transition-colors ' +
                                    (junk.consumeRisk >= 4 ? 'border-red-400/50 text-red-400 hover:border-red-400' :
                                     junk.consumeRisk >= 3 ? 'border-amber-400/50 text-amber-400 hover:border-amber-400' :
                                     'border-green-400/50 text-green-400 hover:border-green-400')}>
                                  {junk.consumeRisk >= 4 ? 'Consume (risky!)' : junk.consumeRisk >= 3 ? 'Consume (50/50)' : 'Consume'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {playerJunkBag.filter(function(j) { return j.consumable }).length === 0 &&
                     filteredItems.length === 0 && (
                      <p className="text-ink-faint text-xs italic text-center p-4">No consumables. Search junk piles to find some.</p>
                    )}
                  </div>
                )}

                {/* Junk bag tab — sell-only trash */}
                {activeTab.id === 'junk' && (
                  <div className="flex flex-col gap-1">
                    {playerJunkBag.length === 0 && (
                      <p className="text-ink-faint text-xs italic text-center p-4">No junk collected yet. Search piles in rooms to find junk.</p>
                    )}
                    {playerJunkBag.filter(function(j) { return !j.consumable }).map(function(junk) {
                      return (
                        <div key={junk.id} className="flex items-center justify-between p-3 rounded-lg text-sm font-sans border bg-raised border-border">
                          <div className="flex flex-col">
                            <span className="text-ink">{junk.name}</span>
                            {junk.isTreasure && junk.description && <span className="text-ink-dim text-[9px] italic">{junk.description}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {!junk.isTreasure && <span className="text-gold text-xs font-display">x{junk.count}</span>}
                            {!junk.isTreasure && <span className="text-ink-faint text-[10px]">{junk.sellPrice}g ea</span>}
                          </div>
                        </div>
                      )
                    })}
                    {playerJunkBag.filter(function(j) { return j.consumable }).length > 0 && (
                      <p className="text-ink-faint text-[10px] text-center mt-2 italic">Consumable junk is in the Consumables tab</p>
                    )}
                    {playerJunkBag.length > 0 && (
                      <p className="text-ink-faint text-[10px] text-center mt-1">
                        Total: {playerJunkBag.reduce(function(s, j) { return s + j.count }, 0)} items
                        ({playerJunkBag.reduce(function(s, j) { return s + (j.count * j.sellPrice) }, 0)}g sell value)
                      </p>
                    )}
                  </div>
                )}
              </div>}
            </div>
          )
        })()}

        {/* Room layout — walls as border strips, doors overlaid on walls */}
        <div className="flex-1 min-h-0 relative" style={{ padding: '12px' }}>
          {/* Four wall strips — absolutely positioned, consistent thickness */}
          <div style={Object.assign({ position: 'absolute', top: 0, left: 0, right: 0, height: '12px' }, wallStyle)} />
          <div style={Object.assign({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '12px' }, wallStyle)} />
          <div style={Object.assign({ position: 'absolute', top: 0, bottom: 0, left: 0, width: '12px' }, wallStyle)} />
          <div style={Object.assign({ position: 'absolute', top: 0, bottom: 0, right: 0, width: '12px' }, wallStyle)} />

          {/* Doors — centred on each wall edge */}
          {doorMap.N && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>{renderDoor('N')}</div>}
          {doorMap.S && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>{renderDoor('S')}</div>}
          {doorMap.W && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 5 }}>{renderDoor('W')}</div>}
          {doorMap.E && <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 5 }}>{renderDoor('E')}</div>}

          {/* Centre content */}
            <div className="h-full flex flex-col items-center justify-center gap-3 px-2 relative" style={{ zIndex: 1 }}>
              {/* Montor whisper */}
              {montorWhisper && (
                <p className="text-purple-400 text-lg text-center max-w-xs mb-3 font-display">
                  "{montorWhisper}"
                </p>
              )}

              {/* Old keystone rooms now just empty */}

              {/* Zone door (locked/unlocked) */}
              {currentChamber.isZoneDoor && (function() {
                var doorUnlocked = zone.zoneDoorUnlocked
                var canOpen = doorUnlocked || hasZoneKey
                return (
                  <div className="flex flex-col items-center gap-3">
                    <ChamberIcon iconKey="stairs_down" theme={zone.doorTheme || 'garden'} scale={4} />
                    {doorUnlocked ? (
                      <>
                        <p className="text-ink text-sm italic">The heavy door stands open.</p>
                        <button onClick={handleOpenZoneDoor}
                          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-base">
                          Pass Through
                        </button>
                      </>
                    ) : hasZoneKey ? (
                      <>
                        <p className="text-ink text-sm italic">A heavy door. Your key fits the lock.</p>
                        <button onClick={handleOpenZoneDoor}
                          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-base">
                          Open Door
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-ink text-sm italic">A heavy door, locked and cold.</p>
                        <p className="text-red-400 text-xs font-sans">Find the key to proceed.</p>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Stairwell descent (locked until terminal activated + boss defeated) */}
              {currentChamber.type === 'stairwell_descent' && !currentChamber.cleared && (function() {
                var bossCleared = zone.chambers.every(function(ch) { return ch.type !== 'boss' || ch.cleared })
                var terminalActivated = zone.terminalFound || zone.chambers.some(function(ch) {
                  return ch.terminalRevealed || (ch.junkPiles && ch.junkPiles.some(function(p) { return p.terminalRevealed }))
                })
                var canDescend = terminalActivated && bossCleared
                return (
                  <div className="flex flex-col items-center gap-3">
                    <ChamberIcon iconKey="stairs_down" theme={zone.doorTheme || 'garden'} scale={4} />
                    {canDescend ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-gold text-sm italic">The terminal hums. The way down is open.</p>
                        <button onClick={handleDescendStairwell}
                          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-lg">
                          Descend
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-ink text-sm italic">Stone steps spiral downward. The way is sealed.</p>
                        {!terminalActivated && (function() {
                          var floorHints = {
                            grounds: 'The steps are buried under rotting leaves and garden debris. If someone cleared this mess, perhaps a way down could be found.',
                            underground: 'Broken crates and spoiled provisions choke the landing. Somewhere beneath the filth, there must be a way through.',
                            underbelly: 'The stairwell reeks. Rusted pipes and slime cover everything. Clean enough away and something might reveal itself.',
                            quarters: 'Moth-eaten curtains and shattered furniture block the descent. The clutter hides more than it should.',
                            works: 'Slag and bent tools are piled waist-high on the steps. Dig through the worst of it and the way might open.',
                            deep: 'Dust and silence. The steps vanish into debris so old it has turned to stone. Something must be uncovered first.'
                          }
                          var floorId = zone ? zone.floorId : 'grounds'
                          return <p className="text-ink-dim text-xs font-sans italic">{floorHints[floorId] || floorHints.grounds}</p>
                        })()}
                        {terminalActivated && !bossCleared && <p className="text-red-400 text-xs font-sans">The guardian still blocks the way.</p>}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Rest point */}
              {currentChamber.restAvailable && !currentChamber.restUsed && (
                <div className="flex flex-col items-center gap-3">
                  <ChamberIcon iconKey="shrine" theme={zone.doorTheme || 'garden'} scale={4} />
                  <p className="text-ink-dim text-xs italic text-center">{currentChamber.restDescription || 'A sheltered space. The air is still.'}</p>
                  <button onClick={handleRest}
                    className="py-3 px-8 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 font-sans text-base">
                    Rest (+{Math.round((currentChamber.restHealPercent || 0.25) * 100)}% HP)
                  </button>
                </div>
              )}
              {currentChamber.restUsed && (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey="shrine" theme={zone.doorTheme || 'garden'} scale={4} />
                  <p className="text-green-400 text-sm font-sans">Rested. Healed {currentChamber.restHealed} HP.</p>
                </div>
              )}

              {/* Terminal in room — revealed after clearing a junk pile */}
              {currentChamber.terminalRevealed && !currentChamber.terminalActivated && (
                <div className="flex flex-col items-center gap-2">
                  <button onClick={function() {
                    setZone(function(prevZone) {
                      return Object.assign({}, prevZone, {
                        terminalFound: true,
                        chambers: prevZone.chambers.map(function(ch) {
                          if (ch.id !== zone.playerPosition) return ch
                          return Object.assign({}, ch, { terminalActivated: true })
                        })
                      })
                    })
                  }}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-purple-400/50 bg-purple-400/10 cursor-pointer hover:border-purple-400 transition-all animate-pulse"
                  >
                    <ChamberIcon iconKey="shrine" theme={zone.doorTheme || 'garden'} scale={4} />
                    <span className="text-purple-400 text-xs font-display">TERMINAL</span>
                    <span className="text-purple-300 text-[9px] font-sans">Tap to activate</span>
                  </button>
                  <p className="text-purple-300 text-xs italic text-center max-w-xs">Something hums beneath the debris. Ancient power stirs.</p>
                </div>
              )}
              {currentChamber.terminalActivated && (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey="shrine" theme={zone.doorTheme || 'garden'} scale={4} />
                  <p className="text-purple-400 text-sm font-display">Terminal Active</p>
                  <p className="text-purple-300 text-xs italic">The stairwell is unlocked.</p>
                  {unlockedGifts.length > 0 && (
                    <button onClick={function() { setShowGiftPicker(true); setGiftPickerSlot(null); setGiftPickerGift(null) }}
                      className="mt-2 py-2 px-6 rounded-lg bg-purple-500/20 border border-purple-400/40 text-purple-300 font-sans text-sm hover:border-purple-400 transition-colors">
                      Manage Gifts
                    </button>
                  )}
                </div>
              )}

              {/* NPC in room (merchant/quest) */}
              {currentChamber.npc && !lootingNpcId && !lootingChestId && !lootingCorpseId ? (function() {
                var npc = currentChamber.npc
                return (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleOpenNpc}
                      className="flex flex-col items-center gap-1 p-3 rounded-lg border border-blue/40 bg-blue/5 cursor-pointer hover:border-blue transition-all"
                    >
                      <ChamberIcon iconKey={'npc_' + (npc.vendorType || 'tailor') + '_' + (zone.floorId || 'garden')} theme={zone.doorTheme || 'garden'} scale={3} />
                      <span className="text-blue text-[9px] font-sans font-bold">
                        {npc.vendorType === 'tailor' ? 'TRADE' : 'BUY'}
                      </span>
                    </button>
                    <p className="text-ink-dim text-xs italic text-center max-w-xs">{npc.description}</p>
                  </div>
                )
              })() : lootingNpcId && currentChamber.npc ? (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey={'npc_' + (currentChamber.npc.vendorType || 'tailor') + '_' + (zone.floorId || 'garden')} theme={zone.doorTheme || 'garden'} scale={3} />
                  <span className="text-ink-faint text-[10px] font-sans">{currentChamber.npc.name}</span>
                </div>
              )

              : /* Chest in room (loot/hidden chambers) — trigger button */
              currentChamber.chest && !lootingChestId && !lootingCorpseId ? (function() {
                var chest = currentChamber.chest
                var isFullyLooted = chest.goldTaken && (chest.items.length === 0 || chest.items.length === chest.itemsTaken.length)
                return (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={function() { if (!isFullyLooted) handleOpenChest() }}
                      disabled={isFullyLooted}
                      className={
                        'flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ' +
                        (isFullyLooted
                          ? 'border-border opacity-30'
                          : chest.opened
                            ? 'border-gold/30 bg-surface cursor-pointer hover:border-gold'
                            : 'border-gold/40 bg-gold-glow cursor-pointer hover:border-gold animate-pulse')
                      }
                    >
                      <ChamberIcon iconKey="chest" theme="garden" scale={4} />
                      {isFullyLooted ? (
                        <span className="text-ink-faint text-[9px] font-sans">empty</span>
                      ) : chest.opened ? (
                        <span className="text-gold text-[9px] font-sans">search</span>
                      ) : (
                        <span className="text-gold text-[9px] font-sans font-bold">OPEN</span>
                      )}
                    </button>
                  </div>
                )
              })() : lootingChestId && currentChamber.chest ? (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey="chest" theme="garden" scale={4} />
                  <span className="text-ink-faint text-[10px] font-sans">Searching...</span>
                </div>
              )

              : /* Lootable corpses from combat */
              currentChamber.corpses && currentChamber.corpses.length > 0 && !lootingCorpseId ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    {currentChamber.corpses.map(function(corpse) {
                      var corpseIcon = 'corpse_' + corpse.archetypeKey
                      var isFullyLooted = corpse.goldTaken && corpse.items.length === corpse.itemsTaken.length
                      return (
                        <button key={corpse.id}
                          onClick={function() { if (!isFullyLooted) handleOpenCorpse(corpse.id) }}
                          disabled={isFullyLooted}
                          className={
                            'flex flex-col items-center gap-1 p-2 transition-all ' +
                            (isFullyLooted
                              ? 'opacity-30'
                              : corpse.opened
                                ? 'cursor-pointer'
                                : 'cursor-pointer animate-pulse')
                          }
                        >
                          <ChamberIcon iconKey={corpseIcon} theme="garden" scale={5} />
                          {isFullyLooted ? (
                            <span className="text-ink-faint text-[8px] font-sans">looted</span>
                          ) : corpse.opened ? (
                            <span className="text-gold text-[8px] font-sans">search</span>
                          ) : (
                            <span className="text-gold text-[8px] font-sans font-bold">LOOT</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : lootingCorpseId && currentChamber.corpses ? (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey="corpse_orc" theme="garden" scale={4} />
                  <span className="text-ink-faint text-[10px] font-sans">Looting...</span>
                </div>
              ) : showCentre ? (
                <div className="flex flex-col items-center gap-2">
                  <ChamberIcon iconKey={centreIconKey} theme="garden" scale={4} />
                  <span className="text-ink-faint text-[10px] font-sans uppercase">
                    {currentChamber.label}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <PlayerSprite classKey="knight" scale={3} />
                  <span className="text-ink-faint text-[10px] font-sans uppercase">you are here</span>
                </div>
              )}

              <p className="text-ink-dim text-xs italic text-center max-w-xs">
                {currentChamber.id === 0
                  ? 'The entrance to the garden. Overgrown walls rise on all sides.'
                  : (currentChamber.hasTerminal && (character.stats.per || 10) >= 12 ? 'Something hums faintly beneath the debris. ' : 'The chamber is still. ') + doors.length + (doors.length === 1 ? ' door leads onward.' : ' doors lead onward.')}
              </p>

              {/* Junk piles rendered as corner overlays (see below) */}

              {/* Search choose rendered as overlay below */}

              {/* Search overlay rendered below as fixed overlay */}
            </div>

          {/* Junk piles — corner-hugging triangles, absolutely positioned */}
          {/* Base sprite is bottom-left orientation (flat bottom + flat left). CSS transform flips for other corners. */}
          {currentChamber.junkPiles && currentChamber.junkPiles.length > 0 && !searchPhase && (function() {
            var activePiles = currentChamber.junkPiles.filter(function(p) { return !p.depleted })
            if (activePiles.length === 0) return null
            // TODO: add hi-res themed junk sprites per floor — for now all use garden shape
            var floorTheme = 'garden'
            // Corner positions with CSS transform to flip the base sprite
            // Base sprite: right-angle at bottom-left (flat bottom, flat left)
            // Corners positioned flush against the walls (12px wall thickness)
            var corners = [
              { style: { bottom: '12px', left: '12px' }, transform: 'none' },           // bottom-left: as-is
              { style: { bottom: '12px', right: '12px' }, transform: 'scaleX(-1)' },    // bottom-right: mirror horizontal
              { style: { top: '12px', right: '12px' }, transform: 'scale(-1,-1)' },     // top-right: mirror both
            ]
            var allPiles = currentChamber.junkPiles
            return activePiles.map(function(pile) {
              var originalIndex = allPiles.indexOf(pile)
              var corner = corners[originalIndex % corners.length]
              var visibleSize = pile.layersRemaining || pile.size
              var spriteKey = 'junk_' + floorTheme + '_' + visibleSize
              var spriteScale = 5
              return (
                <button key={pile.id}
                  onClick={function() { handleInspectPile(pile.id) }}
                  className="absolute z-10 cursor-pointer transition-all active:scale-95"
                  style={corner.style}
                >
                  <div style={{ transform: corner.transform }}>
                    <ChamberIcon iconKey={spriteKey} theme={zone.doorTheme || 'garden'} scale={spriteScale} />
                  </div>
                </button>
              )
            })
          })()}
        </div>

        {/* Interaction overlays — merchant, quest NPC, chest, corpse */}
        {lootingNpcId && currentChamber.npc && (function() {
          var npc = currentChamber.npc
          var interactionBg = {
            backgroundImage: 'repeating-conic-gradient(' + floorBorderColor + '18 0% 25%, transparent 0% 50%)',
            backgroundSize: '8px 8px',
          }
          // Shared vendor UI for both tailor and peddler
          var vendorAccent = npc.vendorType === 'tailor' ? 'gold' : 'emerald-400'
          var vendorLabel = npc.vendorType === 'tailor' ? 'TRADE' : 'BUY'
          var npcChaMod = getModifier(character.stats.cha || 10)
          var playerCha = character.stats.cha || 10

          return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={interactionBg}>
              <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80">
                <div className="flex flex-col">
                  <span className={'font-display text-lg text-' + vendorAccent}>{npc.name}</span>
                  {npc.role && <span className="text-ink-dim text-[10px] font-sans italic">{npc.role}</span>}
                  <span className="text-gold text-xs font-sans">{playerGold} gold</span>
                </div>
                <button onClick={handleCloseNpc}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Leave
                </button>
              </div>
              <div className="flex gap-2 px-4 pt-3">
                <button onClick={function() { updateNpc(function(n) { return Object.assign({}, n, { showSell: false }) }) }}
                  className={'px-4 py-1.5 rounded text-sm font-sans border transition-colors ' +
                    (!npc.showSell ? 'border-' + vendorAccent + ' text-' + vendorAccent + ' bg-' + vendorAccent + '/10' : 'border-border text-ink-dim hover:text-ink')}>
                  Buy
                </button>
                {playerInventory.length > 0 && (
                  <button onClick={handleNpcSellToggle}
                    className={'px-4 py-1.5 rounded text-sm font-sans border transition-colors ' +
                      (npc.showSell ? 'border-gold text-gold bg-gold/10' : 'border-border text-ink-dim hover:text-ink')}>
                    Sell
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {!npc.showSell && npc.items.map(function(item, i) {
                  var npcBasePr = item.buyPrice || item.cost || 0
                  var price = Math.max(1, npcBasePr - Math.max(0, Math.round(npcBasePr * npcChaMod * 0.05)))
                  var canAfford = playerGold >= price
                  var isPremium = item.premium
                  var chaLocked = isPremium && playerCha < 12
                  return (
                    <div key={'buy-' + i} className={'flex items-center justify-between p-4 rounded-lg border text-sm font-sans ' +
                      (isPremium ? 'border-amber-400/40 bg-amber-400/5' : 'border-border-hl bg-surface')}>
                      <div className="flex flex-col items-start flex-1 mr-3">
                        <div className="flex items-center gap-2">
                          <span className={'text-base ' + (isPremium ? 'text-amber-300' : rarityCol(item.rarity).text)}>{item.name}</span>
                          {isPremium && <span className="text-[9px] text-amber-400 uppercase tracking-wide border border-amber-400/30 px-1 rounded">Premium</span>}
                        </div>
                        <span className="text-ink-faint text-xs">
                          {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg (' + (item.weaponType || 'weapon') + ')' :
                           item.type === 'armour' && item.slot === 'helmet' ? 'helmet, +' + (item.defBonus || 0) + ' DEF' :
                           item.type === 'armour' && item.slot === 'boots' ? 'boots' + (item.agiBonus ? ', +' + item.agiBonus + ' AGI' : '') + (item.defBonus ? ', +' + item.defBonus + ' DEF' : '') :
                           item.type === 'armour' && item.slot === 'offhand' ? '+' + item.defBonus + ' DEF, ' + Math.round((item.passiveValue || 0) * 100) + '% block' :
                           item.type === 'armour' ? '+' + (item.defBonus || 0) + ' DEF' :
                           item.type === 'ring' ? 'ring' :
                           item.type === 'amulet' ? 'amulet' :
                           item.description || item.type}
                        </span>
                        {item.description && (item.type === 'weapon' || item.type === 'armour') && <span className="text-ink-faint text-[10px] italic mt-0.5">{item.description}</span>}
                        {(function() {
                          // Quick upgrade/downgrade marker vs equipped
                          var eq = character.equipped || {}
                          if (item.type === 'weapon') {
                            var eqDie = eq.weapon ? (eq.weapon.damageDie || eq.weapon.die || 4) : 4
                            var newDie = item.damageDie || item.die || 0
                            if (newDie > eqDie) return <span className="text-green-400 text-[10px]">{'\u25B2'} upgrade</span>
                            if (newDie < eqDie) return <span className="text-red-400 text-[10px]">{'\u25BC'} downgrade</span>
                          }
                          if (item.type === 'armour') {
                            var slotKey = item.slot === 'offhand' ? 'offhand' : item.slot === 'helmet' ? 'helmet' : item.slot === 'boots' ? 'boots' : 'armour'
                            var eqItem = eq[slotKey]
                            var eqDef = eqItem ? (eqItem.defBonus || 0) : 0
                            var newDef = item.defBonus || 0
                            if (newDef > eqDef) return <span className="text-green-400 text-[10px]">{'\u25B2'} upgrade</span>
                            if (newDef < eqDef) return <span className="text-red-400 text-[10px]">{'\u25BC'} downgrade</span>
                          }
                          return null
                        })()}
                      </div>
                      {chaLocked ? (
                        <span className="text-amber-400/60 text-[10px] font-sans text-right leading-tight">Requires<br/>CHA 12+</span>
                      ) : (
                        <button onClick={function() { if (canAfford) handleNpcBuy(item) }}
                          disabled={!canAfford}
                          className={'text-sm px-4 py-1.5 rounded border transition-colors ' +
                            (canAfford ? 'text-gold border-gold/40 hover:border-gold cursor-pointer' : 'text-ink-faint border-border opacity-50')}>
                          {price}g
                        </button>
                      )}
                    </div>
                  )
                })}
                {!npc.showSell && npc.items.length === 0 && (
                  <p className="text-ink-faint text-sm italic text-center py-4">Sold out.</p>
                )}
                {npc.showSell && playerInventory.map(function(item, i) {
                  var baseSellNpc = item.sellPrice || Math.max(1, Math.round((item.buyPrice || 10) * 0.4))
                  var sellPrice = Math.max(1, baseSellNpc + Math.max(0, Math.round(baseSellNpc * npcChaMod * 0.05)))
                  return (
                    <div key={'sell-' + i} className={'flex items-center justify-between p-4 rounded-lg border bg-surface text-sm font-sans ' + rarityCol(item.rarity).border}>
                      <div className="flex flex-col items-start">
                        <span className={rarityCol(item.rarity).text + ' text-base'}>{item.name}</span>
                        <span className="text-ink-faint text-xs">
                          {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                           item.type === 'armour' ? '+' + (item.defBonus || 0) + ' DEF' :
                           item.description || item.type}
                        </span>
                      </div>
                      <button onClick={function() { handleNpcSell(i, sellPrice) }}
                        className="text-sm text-gold px-4 py-1.5 rounded border border-gold/40 hover:border-gold cursor-pointer transition-colors">
                        Sell {sellPrice}g
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Chest looting overlay */}
        {lootingChestId && currentChamber.chest && (function() {
          var chest = currentChamber.chest
          var interactionBg = {
            backgroundImage: 'repeating-conic-gradient(' + floorBorderColor + '18 0% 25%, transparent 0% 50%)',
            backgroundSize: '8px 8px',
          }
          return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={interactionBg}>
              <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80">
                <span className="font-display text-lg text-gold">{chest.label || 'Chest'}</span>
                <button onClick={handleCloseChest}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  {chest.goldTaken || chest.itemsTaken.length > 0 ? 'Done' : 'Leave it'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {chest.gold > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gold/30 bg-surface text-base font-sans">
                    <span className="text-gold text-lg font-display">{chest.gold} gold</span>
                    {chest.goldTaken ? (
                      <span className="text-ink-faint text-sm">taken</span>
                    ) : (
                      <button onClick={handleTakeChestGold}
                        className="text-sm text-gold border border-gold/40 px-4 py-1.5 rounded hover:border-gold transition-colors">
                        Take
                      </button>
                    )}
                  </div>
                )}
                {chest.items.map(function(item, idx) {
                  var taken = chest.itemsTaken.indexOf(idx) !== -1
                  return (
                    <div key={idx} className={'flex items-center justify-between p-4 rounded-lg border bg-surface text-sm font-sans ' + rarityCol(item.rarity).border}>
                      <div className="flex flex-col">
                        <span className={rarityCol(item.rarity).text + ' text-base'}>{item.name}</span>
                        <span className="text-ink-faint text-xs">
                          {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                           item.type === 'armour' ? '+' + (item.defBonus || 0) + ' DEF' :
                           item.description || item.type}
                        </span>
                      </div>
                      {taken ? (
                        <span className="text-ink-faint text-sm">taken</span>
                      ) : (
                        <button onClick={function() { handleTakeChestItem(idx) }}
                          className="text-sm text-emerald-400 border border-emerald-500/40 px-4 py-1.5 rounded hover:border-emerald-400 transition-colors">
                          Take
                        </button>
                      )}
                    </div>
                  )
                })}
                {chest.items.length === 0 && chest.gold === 0 && (
                  <p className="text-ink-faint text-sm italic text-center py-4">Empty.</p>
                )}
              </div>
            </div>
          )
        })()}

        {/* Corpse looting overlay */}
        {lootingCorpseId && currentChamber.corpses && (function() {
          var corpse = currentChamber.corpses.find(function(c) { return c.id === lootingCorpseId })
          if (!corpse) return null
          var interactionBg = {
            backgroundImage: 'repeating-conic-gradient(' + floorBorderColor + '18 0% 25%, transparent 0% 50%)',
            backgroundSize: '8px 8px',
          }
          return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={interactionBg}>
              <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80">
                <span className="font-display text-lg text-ink">{corpse.name}</span>
                <button onClick={handleCloseLoot}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  {corpse.goldTaken || corpse.itemsTaken.length > 0 ? 'Done' : 'Leave it'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {corpse.gold > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gold/30 bg-surface text-base font-sans">
                    <span className="text-gold text-lg font-display">{corpse.gold} gold</span>
                    {corpse.goldTaken ? (
                      <span className="text-ink-faint text-sm">taken</span>
                    ) : (
                      <button onClick={function() { handleTakeGold(corpse.id) }}
                        className="text-sm text-gold border border-gold/40 px-4 py-1.5 rounded hover:border-gold transition-colors">
                        Take
                      </button>
                    )}
                  </div>
                )}
                {corpse.items.map(function(item, idx) {
                  var taken = corpse.itemsTaken.indexOf(idx) !== -1
                  return (
                    <div key={idx} className={'flex items-center justify-between p-4 rounded-lg border bg-surface text-sm font-sans ' + rarityCol(item.rarity).border}>
                      <div className="flex flex-col">
                        <span className={rarityCol(item.rarity).text + ' text-base'}>{item.name}</span>
                        <span className="text-ink-faint text-xs">
                          {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                           item.type === 'armour' ? '+' + (item.defBonus || 0) + ' DEF' :
                           item.description || item.type}
                        </span>
                      </div>
                      {taken ? (
                        <span className="text-ink-faint text-sm">taken</span>
                      ) : (
                        <button onClick={function() { handleTakeItem(corpse.id, idx) }}
                          className="text-sm text-emerald-400 border border-emerald-500/40 px-4 py-1.5 rounded hover:border-emerald-400 transition-colors">
                          Take
                        </button>
                      )}
                    </div>
                  )
                })}
                {corpse.items.length === 0 && !corpse.gold && (
                  <p className="text-ink-faint text-sm italic text-center py-4">Nothing here.</p>
                )}
              </div>
            </div>
          )
        })()}

        {/* Search: Choose clean level — full screen overlay */}
        {searchPhase === 'choose' && (function() {
          var ch2 = zone.chambers[zone.playerPosition]
          var pile = ch2.junkPiles && ch2.junkPiles.find(function(p) { return p.id === searchingPileId })
          if (!pile) return null
          var sizeLabel = pile.size === 3 ? 'Mound' : pile.size === 2 ? 'Heap' : 'Scraps'
          var levels = getAvailableCleanLevels(pile)
          var riskLabels = { 1: 'Low risk', 2: 'Medium risk', 3: 'High risk' }
          var riskDetail = {
            1: 'Removes 1 layer. Quiet — low chance of trouble. Modest finds.',
            2: 'Removes 2 layers. Noisier — enemies may notice. Better loot.',
            3: 'Removes all layers. Loud and reckless — high danger, best rewards. Can reveal terminals.',
          }
          var interactionBg = {
            backgroundImage: 'repeating-conic-gradient(' + floorBorderColor + '18 0% 25%, transparent 0% 50%)',
            backgroundSize: '8px 8px',
          }
          return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={interactionBg}>
              <div className="fixed inset-0 bg-bg/90" style={{ zIndex: -1 }} />
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg/80">
                <span className="font-display text-lg text-gold">{sizeLabel}</span>
                <button onClick={handleCancelSearch}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Leave it
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
                <p className="text-ink-dim text-sm italic text-center mb-1">{pile.inspectHint || pile.description}</p>
                <p className="text-ink-faint text-xs mb-6">{pile.layersRemaining} {pile.layersRemaining === 1 ? 'layer' : 'layers'} remaining</p>
                <div className="flex flex-col gap-3 w-full max-w-sm">
                  {levels.map(function(lvl) {
                    var c = CLEAN_CONFIG[lvl]
                    var borderColour = lvl === 3 ? 'border-red-400' : lvl === 2 ? 'border-amber-400' : 'border-green-400'
                    var textColour = lvl === 3 ? 'text-red-400' : lvl === 2 ? 'text-amber-400' : 'text-green-400'
                    var bgColour = lvl === 3 ? 'bg-red-400/5' : lvl === 2 ? 'bg-amber-400/5' : 'bg-green-400/5'
                    return (
                      <button key={lvl}
                        onClick={function() { handleChooseCleanLevel(lvl) }}
                        className={'p-4 rounded-lg border-2 transition-all cursor-pointer text-left ' + borderColour + '/50 hover:' + borderColour + ' ' + bgColour}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={'font-display text-lg ' + textColour}>{c.label}</span>
                          <span className={'text-sm font-sans font-bold ' + textColour}>{riskLabels[lvl]}</span>
                        </div>
                        <p className="text-ink-dim text-sm font-sans">{riskDetail[lvl]}</p>
                        <p className="text-ink-faint text-xs font-sans mt-1">Uses {c.layersCost} {c.layersCost === 1 ? 'layer' : 'layers'}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Search overlay — covers everything during search phases */}
        {(searchPhase === 'rolling' || searchPhase === 'landed' || searchPhase === 'save_rolling' || searchPhase === 'save_landed' || searchPhase === 'reveal') && (function() {
          var actionText = searchResult && searchResult.cleanLevel === 3
            ? 'tears through' : searchResult && searchResult.cleanLevel === 2
            ? 'rummages through' : 'carefully sifts through'
          var ch3 = zone.chambers[zone.playerPosition]
          var pile3 = ch3.junkPiles && ch3.junkPiles.find(function(p) { return p.id === searchingPileId })
          var pileDesc = pile3 ? pile3.description.toLowerCase() : 'the pile'

          var qc = searchResult ? (
            searchResult.quality === 'excellent' ? 'text-gold border-gold bg-gold/10' :
            searchResult.quality === 'good' ? 'text-green-400 border-green-400 bg-green-400/10' :
            searchResult.quality === 'decent' ? 'text-ink border-border-hl bg-surface' :
            searchResult.quality === 'poor' ? 'text-ink-dim border-border bg-bg' :
            'text-red-400 border-red-400 bg-red-400/10'
          ) : ''
          var ql = { excellent: 'EXCELLENT!', good: 'Good find!', decent: 'Decent.', poor: 'Poor...', fumble: 'FUMBLE!' }

          return (
            <div className="fixed inset-0 z-40 bg-bg/95 flex flex-col items-center justify-center px-6 overflow-y-auto py-8"
              style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(40,35,25,0.4) 0%, transparent 70%)' }}>
              {/* Emergency close */}
              <button onClick={handleDismissSearch}
                className="absolute top-3 right-3 text-ink-faint text-xs border border-border px-2 py-1 rounded hover:text-ink z-50">
                X
              </button>

              {/* Search screen (rolling → landed → save) */}
              {searchPhase !== 'reveal' && (
                <div className="flex flex-col items-center gap-5 max-w-sm w-full">
                  {/* Action narrative */}
                  <p className="text-ink-dim text-sm text-center font-sans">
                    {character.name} {actionText} {pileDesc}...
                  </p>

                  {/* Dice — rolling */}
                  {searchPhase === 'rolling' && (
                    <div className="rounded-xl flex items-center justify-center font-display text-4xl border-2 border-gold/50 bg-gold/10 text-gold animate-pulse"
                      style={{ width: '5rem', height: '5rem' }}>
                      {searchDiceDisplay || '?'}
                    </div>
                  )}

                  {/* Dice — landed */}
                  {(searchPhase === 'landed' || searchPhase === 'save_rolling' || searchPhase === 'save_landed') && searchResult && (
                    <>
                      <div className={'rounded-xl flex items-center justify-center font-display text-4xl border-2 ' + qc}
                        style={{ width: '5rem', height: '5rem' }}>
                        {searchResult.natRoll}
                      </div>
                      <p className={'font-display text-2xl ' + qc.split(' ')[0]}>{ql[searchResult.quality]}</p>
                    </>
                  )}

                  {/* Save roll — rolling */}
                  {searchPhase === 'save_rolling' && searchResult && (
                    <div className="flex flex-col items-center gap-3 mt-2 p-4 rounded-lg border border-red-400/30 bg-red-400/5 w-full">
                      <p className="text-red-400 font-display text-lg">
                        {searchResult.dangerType === 'enemy' ? 'Something stirs!' : 'TRAP!'}
                      </p>
                      <div className="rounded-xl flex items-center justify-center font-display text-3xl border-2 border-red-400/50 bg-red-400/10 text-red-400 animate-pulse"
                        style={{ width: '4rem', height: '4rem' }}>
                        {searchSaveDiceDisplay || '?'}
                      </div>
                      <p className="text-ink-faint text-xs font-sans">
                        {searchResult.dangerType === 'enemy' ? 'PER save' : 'AGI save'}
                      </p>
                    </div>
                  )}

                  {/* Save roll — landed */}
                  {searchPhase === 'save_landed' && searchResult && (function() {
                    var saved = searchResult.dangerType === 'enemy' ? searchResult.perSaved : searchResult.agiSaved
                    var sc = saved ? 'border-green-400/30 bg-green-400/5' : 'border-red-400/30 bg-red-400/5'
                    var saveRoll = searchResult.dangerType === 'enemy' ? searchResult.perSaveRoll : searchResult.agiSaveRoll
                    return (
                      <div className={'flex flex-col items-center gap-3 mt-2 p-4 rounded-lg border w-full ' + sc}>
                        <p className={'font-display text-lg ' + (saved ? 'text-green-400' : 'text-red-400')}>
                          {saved
                            ? (searchResult.dangerType === 'enemy' ? 'Spotted — it retreats!' : 'Dodged!')
                            : (searchResult.dangerType === 'enemy'
                              ? (searchResult.enemy === 'ambush' ? 'AMBUSH!' : 'Something emerges!')
                              : 'TRAP: ' + searchResult.condition + '!')}
                        </p>
                        <div className={'rounded-xl flex items-center justify-center font-display text-3xl border-2 ' +
                          (saved ? 'border-green-400 bg-green-400/10 text-green-400' : 'border-red-400 bg-red-400/10 text-red-400')}
                          style={{ width: '4rem', height: '4rem' }}>
                          {saveRoll}
                        </div>
                        {searchResult.trapDamage > 0 && !saved && (
                          <p className="text-red-400 font-display text-base">-{searchResult.trapDamage} HP</p>
                        )}
                      </div>
                    )
                  })()}

                  {/* Tap to continue */}
                  {(searchPhase === 'landed' || searchPhase === 'save_landed') && (
                    <button onClick={handleSearchTapContinue}
                      className="mt-4 py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm hover:border-gold transition-colors">
                      Continue
                    </button>
                  )}
                </div>
              )}

              {/* Screen 2: Loot reveal */}
              {searchPhase === 'reveal' && searchResult && (
                <div className="flex flex-col items-center gap-4 max-w-sm w-full">
                  <p className="text-gold text-lg font-display">Discovered</p>

                  <div className="flex flex-col gap-3 w-full">
                    {/* DANGER FIRST — traps and enemies at the top */}
                    {searchResult.trapImmune && (
                      <div className="p-3 rounded-lg border-2 border-green-400/40 bg-green-400/5 text-center">
                        <p className="text-green-400 font-display text-lg">
                          {searchResult.trapResistType === 'immune' ? 'Trap Immune!' : 'Trap Resisted!'}
                        </p>
                      </div>
                    )}

                    {searchResult.condition && searchResult.agiSaved && (
                      <div className="p-3 rounded-lg border-2 border-green-400/40 bg-green-400/5 text-center">
                        <p className="text-green-400 font-display text-xl">Trap Dodged!</p>
                      </div>
                    )}

                    {searchResult.enemy && (
                      <div className="p-3 rounded-lg border-2 border-red-400/50 bg-red-400/5 text-center">
                        <p className="text-red-400 font-display text-xl">
                          {searchResult.perSaved ? 'Spotted — it slinks away.' :
                           searchResult.enemy === 'ambush' ? 'AMBUSH!' : 'Something emerges!'}
                        </p>
                        <p className="text-red-300 text-xs font-sans mt-1">
                          {searchResult.perSaved ? 'Your sharp eyes scared it off.' :
                           searchResult.enemy === 'ambush' ? 'Enemies strike first after this.' : 'Combat after this.'}
                        </p>
                      </div>
                    )}

                    {/* LOOT — gold, items, junk */}
                    {(searchResult.gold > 0 || searchResult.xp > 0) && (
                      <div className="flex items-center justify-center gap-6 p-3 rounded-lg border border-gold/20 bg-gold/5">
                        {searchResult.gold > 0 && <span className="text-gold font-display text-xl">+{searchResult.gold}g</span>}
                        {searchResult.xp > 0 && <span className="text-blue font-display text-xl">+{searchResult.xp} XP</span>}
                      </div>
                    )}

                    {searchResult.item && (
                      <div className="p-4 rounded-lg border-2 border-amber-400/50 bg-amber-400/5 text-center">
                        <p className={rarityCol(searchResult.item.rarity).text + ' font-display text-xl'}>{searchResult.item.name}</p>
                        <p className="text-ink-dim text-xs font-sans mt-1">{searchResult.item.description || ''}</p>
                      </div>
                    )}

                    {searchResult.junk && (
                      <div className="p-2 rounded-lg border border-border bg-surface text-center">
                        <p className="text-ink text-sm font-sans">{searchResult.junk.name}</p>
                        {searchResult.junk.consumable && <p className="text-amber-400 text-[10px] font-sans">Consumable</p>}
                      </div>
                    )}

                    {/* DISCOVERIES — terminal, treasure */}
                    {searchResult.terminal && (
                      <div className="p-3 rounded-lg border-2 border-purple-400/50 bg-purple-400/5 text-center">
                        <p className="text-purple-400 font-display text-xl">Terminal Found</p>
                        <p className="text-purple-300 text-xs font-sans mt-1">Something hums beneath the junk...</p>
                      </div>
                    )}

                    {searchResult.treasure && (
                      <div className="p-3 rounded-lg border-2 border-gold/50 bg-gold/5 text-center">
                        <p className="text-gold font-display text-xl">{searchResult.treasure.name}</p>
                        <p className="text-ink-dim text-xs font-sans mt-1 italic">{searchResult.treasure.description}</p>
                      </div>
                    )}

                    {searchResult.narrative.slice(1).filter(function(line) {
                      // Suppress positive flavour when there's a trap
                      if (searchResult.condition && !searchResult.agiSaved) {
                        if (line.indexOf('Lucky') !== -1 || line.indexOf('Almost missed') !== -1 || line.indexOf('keen eye') !== -1) return false
                      }
                      // Suppress trap narrative lines (already shown in card above)
                      if (line.indexOf('TRAP!') !== -1) return false
                      return true
                    }).map(function(line, i) {
                      return <p key={i} className="text-ink-faint text-sm italic text-center font-sans">{line}</p>
                    })}
                  </div>

                  <button onClick={handleDismissSearch}
                    className="mt-4 py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-base hover:border-gold transition-colors">
                    Continue
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  // --- Entering chamber (transition) ---
  if (gamePhase === 'entering') {
    var enteringChamber = zone.chambers[zone.playerPosition]
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
        <p className="text-ink text-base italic">Something stirs...</p>
      </div>
    )
  }

  // --- Non-combat chamber ---
  if (gamePhase === 'chamber') {
    var chamberNow = zone.chambers[zone.playerPosition]
    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 overflow-hidden" style={roomBgStyle}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">{chamberNow.label}</span>
          <div className="flex items-center gap-2">
            <button onClick={function() { setShowCharPanel(!showCharPanel); if (!showCharPanel) setShowInventoryPanel(false) }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showCharPanel ? 'border-blue text-blue' : 'border-border text-ink-dim hover:text-ink')}>
              Stats
            </button>
            <button onClick={function() { setShowInventoryPanel(!showInventoryPanel); if (!showInventoryPanel) setShowCharPanel(false) }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showInventoryPanel ? 'border-emerald-400 text-emerald-400' : 'border-border text-ink-dim hover:text-ink')}>
              Bag
            </button>
            <span className="text-gold text-xs font-sans">{playerGold}g</span>
          </div>
        </div>

        {/* Character stats panel — full screen overlay (chamber) */}
        {showCharPanel && (function() {
          var mod = function(v) { var m = Math.floor(((v || 10) - 10) / 2); return m >= 0 ? '+' + m : '' + m }
          var statRows = STAT_ORDER
          var w = character.equipped && character.equipped.weapon
          var a = character.equipped && character.equipped.armour
          var o = character.equipped && character.equipped.offhand
          var h3 = character.equipped && character.equipped.helmet
          var bt3 = character.equipped && character.equipped.boots
          var equipBonuses = {}
          if (a && a.defBonus) equipBonuses.def = (equipBonuses.def || 0) + a.defBonus
          if (o && o.defBonus) equipBonuses.def = (equipBonuses.def || 0) + o.defBonus
          if (h3 && h3.defBonus) equipBonuses.def = (equipBonuses.def || 0) + h3.defBonus
          if (bt3 && bt3.defBonus) equipBonuses.def = (equipBonuses.def || 0) + bt3.defBonus
          if (w && w.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + w.agiPenalty
          if (a && a.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + a.agiPenalty
          if (o && o.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + o.agiPenalty
          if (h3 && h3.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + h3.agiPenalty
          if (bt3 && bt3.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + bt3.agiPenalty
          if (bt3 && bt3.agiBonus) equipBonuses.agi = (equipBonuses.agi || 0) + bt3.agiBonus
          if (bt3 && bt3.strBonus) equipBonuses.str = (equipBonuses.str || 0) + bt3.strBonus
          var passiveItems3 = getAllPassiveItems(character.equipped)
          for (var pi4 = 0; pi4 < passiveItems3.length; pi4++) {
            var pe3 = passiveItems3[pi4].passiveEffect
            var pv3 = passiveItems3[pi4].passiveValue || 0
            if (pe3 === 'str_bonus') equipBonuses.str = (equipBonuses.str || 0) + pv3
            if (pe3 === 'def_bonus') equipBonuses.def = (equipBonuses.def || 0) + pv3
            if (pe3 === 'lck_bonus') equipBonuses.lck = (equipBonuses.lck || 0) + pv3
            if (pe3 === 'per_bonus') equipBonuses.per = (equipBonuses.per || 0) + pv3
          }
          var setBonusEffects3 = getSetBonuses(character.equipped)
          for (var sbi3 = 0; sbi3 < setBonusEffects3.length; sbi3++) {
            var sbe3 = setBonusEffects3[sbi3]
            if (sbe3.passiveEffect === 'str_bonus') equipBonuses.str = (equipBonuses.str || 0) + (sbe3.passiveValue || 0)
            if (sbe3.passiveEffect === 'def_bonus') equipBonuses.def = (equipBonuses.def || 0) + (sbe3.passiveValue || 0)
            if (sbe3.secondEffect === 'crit_bonus') equipBonuses.lck = (equipBonuses.lck || 0) + (sbe3.secondValue || 0)
          }
          for (var bi = 0; bi < activeBuffs.length; bi++) {
            var b = activeBuffs[bi]
            if (b.stat && b.value) equipBonuses[b.stat] = (equipBonuses[b.stat] || 0) + b.value
          }
          var totalDef = (character.stats.def || 10) + (equipBonuses.def || 0)
          return (
            <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-display text-lg text-gold">{character.name}</span>
                <button onClick={function() { setShowCharPanel(false) }}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {(function() {
                  var nextT2 = XP_THRESHOLDS[runLevel]
                  var prevX2 = runLevel > 0 ? XP_THRESHOLDS[runLevel - 1].xp : 0
                  var nextX2 = nextT2 ? nextT2.xp : prevX2
                  var xpP2 = nextT2 ? Math.min(1, (totalXp - prevX2) / Math.max(1, nextX2 - prevX2)) : 1
                  var isMax2 = !nextT2
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gold font-display text-base">Level {runLevel + 1}</span>
                        <span className="text-ink-dim text-xs font-sans">{isMax2 ? 'Max Level' : totalXp + ' / ' + nextX2 + ' XP'}</span>
                      </div>
                      <div className="w-full bg-bg rounded-full h-2 border border-border">
                        <div className={'rounded-full h-full transition-all duration-300 ' + (isMax2 ? 'bg-gold' : 'bg-blue')} style={{ width: Math.round(xpP2 * 100) + '%' }} />
                      </div>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4 text-xs font-sans">
                  <div><span className="text-ink-dim">HP:</span> <span className="text-ink">{playerHp}/{character.maxHp}</span></div>
                  <div><span className="text-ink-dim">Gold:</span> <span className="text-gold">{playerGold}</span></div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {statRows.map(function(s) {
                    var base = character.stats[s.id] || 0
                    var bonus = equipBonuses[s.id] || 0
                    var effective = base + bonus
                    var color = bonus > 0 ? 'text-green-400' : bonus < 0 ? 'text-red-400' : 'text-ink'
                    return (
                      <div key={s.id} className="flex flex-col items-center p-2 rounded bg-raised border border-border">
                        <span className="text-ink text-[10px] uppercase font-sans">{s.label}</span>
                        <span className={color + ' font-display text-base'}>{effective}</span>
                        {bonus !== 0 && <span className={bonus > 0 ? 'text-green-400 text-[8px]' : 'text-red-400 text-[8px]'}>{bonus > 0 ? '+' + bonus : bonus} gear</span>}
                      </div>
                    )
                  })}
                </div>
                {/* Gift slots */}
                {(giftSlots.body || giftSlots.mind || giftSlots.weapon || giftSlots.shield) && (
                  <div className="mt-3 border-t border-border pt-2">
                    <span className="text-ink-dim text-[10px] uppercase tracking-wide font-sans">Montor's Gifts</span>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {['body', 'mind', 'weapon', 'shield'].map(function(slot) {
                        var g = giftSlots[slot]
                        if (!g) return null
                        return (
                          <div key={slot} className="p-1.5 rounded border border-border bg-raised">
                            <span className="text-ink-faint text-[8px] uppercase">{slot}</span>
                            <span className="text-ink text-[10px] font-display block">{g.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Chamber content */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <ChamberView
            chamber={chamberNow}
            content={chamberContent}
            playerState={{ gold: playerGold, currentHp: playerHp, maxHp: character.maxHp, inventory: playerInventory, cha: character.stats.cha || 10 }}
            onAction={handleChamberAction}
            onContinue={handleChamberContinue}
          />
        </div>

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  // --- Flee result ---
  if (gamePhase === 'flee_result' && fleeOutcome) {
    var fleeColour = fleeOutcome.tierName === 'crit_success' ? 'text-green-400'
      : fleeOutcome.tierName === 'success' ? 'text-amber-400'
      : fleeOutcome.tierName === 'failure' ? 'text-red-400'
      : 'text-crimson'

    var fleeTitle = fleeOutcome.tierName === 'crit_success' ? 'Clean Escape!'
      : fleeOutcome.tierName === 'success' ? 'Escaped!'
      : fleeOutcome.tierName === 'failure' ? 'Barely Escaped!'
      : 'Blocked!'

    return (
      <div onClick={handleFleeResultContinue} className="h-full flex flex-col items-center justify-center px-6 text-center gap-5 bg-raised cursor-pointer">
        <p className={'font-display text-2xl ' + fleeColour}>{fleeTitle}</p>
        <p className="text-ink text-base italic max-w-xs">{fleeOutcome.narrative}</p>

        {(fleeOutcome.hpLoss > 0 || fleeOutcome.goldLoss > 0) && (
          <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
            {fleeOutcome.hpLoss > 0 && (
              <p className="text-red-400 text-sm">-{fleeOutcome.hpLoss} HP</p>
            )}
            {fleeOutcome.goldLoss > 0 && (
              <p className="text-amber-400 text-sm">-{fleeOutcome.goldLoss} gold</p>
            )}
          </div>
        )}

        <p className="text-ink-faint text-xs font-sans">{fleeOutcome.fled ? 'Tap anywhere to continue' : 'Tap anywhere to return to fight'}</p>

        {renderPartyBar()}
      </div>
    )
  }

  // --- Combat ---
  if (gamePhase === 'combat') {
    // Combat victory — show doors after
    if (combatPhase === 'victory') {
      return (
        <div onClick={pendingLevelUp ? undefined : handleCombatVictoryToDoors}
          className={'h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised' + (pendingLevelUp ? '' : ' cursor-pointer')}>
          <h1 className="font-display text-4xl text-gold">Victory</h1>
          <p className="text-ink text-base italic">The chamber falls silent.</p>
          <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
            <p className="text-green-400 font-display text-lg">+{lastXpGained} XP</p>
            <p className="text-ink-dim text-sm mt-1">Total: {totalXp} XP</p>
            <p className="text-ink-dim text-sm mt-1">HP: {playerHp}/{character.maxHp}</p>
          </div>

          {/* Level up! */}
          {pendingLevelUp && (
            <div className="w-full max-w-xs" onClick={function(e) { e.stopPropagation() }}>
              <p className="text-gold font-display text-xl mb-2 text-center">Level Up!</p>
              {pendingLevelUp.hpGain > 0 && (
                <p className="text-green-400 text-sm mb-2 text-center">+{pendingLevelUp.hpGain} max HP</p>
              )}
              {pendingLevelUp.statPick ? (
                <StatPicker stats={character.stats} onPick={handleStatPick} mode="levelup" />
              ) : (
                <button onClick={handleLevelUpDismiss}
                  className="w-full py-2 px-6 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm">
                  Continue
                </button>
              )}
            </div>
          )}

          {!pendingLevelUp && (
            <p className="text-ink-faint text-xs font-sans">Tap anywhere to continue</p>
          )}
        </div>
      )
    }

    var enemyResult = enemyAttackInfo ? enemyAttackInfo.attackOut.result : null
    var combatChamber = zone.chambers[zone.playerPosition]

    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 overflow-hidden relative" style={roomBgStyle}>
        {/* Stats overlay (read-only during combat) */}
        {showCharPanel && (function() {
          var mod = function(v) { var m = Math.floor(((v || 10) - 10) / 2); return m >= 0 ? '+' + m : '' + m }
          var statRows = STAT_ORDER
          var w = character.equipped && character.equipped.weapon
          var a = character.equipped && character.equipped.armour
          var o = character.equipped && character.equipped.offhand

          var h2 = character.equipped && character.equipped.helmet
          var bt2 = character.equipped && character.equipped.boots
          var equipBonuses = {}
          if (a && a.defBonus) equipBonuses.def = (equipBonuses.def || 0) + a.defBonus
          if (o && o.defBonus) equipBonuses.def = (equipBonuses.def || 0) + o.defBonus
          if (h2 && h2.defBonus) equipBonuses.def = (equipBonuses.def || 0) + h2.defBonus
          if (bt2 && bt2.defBonus) equipBonuses.def = (equipBonuses.def || 0) + bt2.defBonus
          if (w && w.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + w.agiPenalty
          if (a && a.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + a.agiPenalty
          if (o && o.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + o.agiPenalty
          if (h2 && h2.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + h2.agiPenalty
          if (bt2 && bt2.agiPenalty) equipBonuses.agi = (equipBonuses.agi || 0) + bt2.agiPenalty
          if (bt2 && bt2.agiBonus) equipBonuses.agi = (equipBonuses.agi || 0) + bt2.agiBonus
          if (bt2 && bt2.strBonus) equipBonuses.str = (equipBonuses.str || 0) + bt2.strBonus
          var passiveItems2 = getAllPassiveItems(character.equipped)
          for (var pi3 = 0; pi3 < passiveItems2.length; pi3++) {
            var pe2 = passiveItems2[pi3].passiveEffect
            var pv2 = passiveItems2[pi3].passiveValue || 0
            if (pe2 === 'str_bonus') equipBonuses.str = (equipBonuses.str || 0) + pv2
            if (pe2 === 'def_bonus') equipBonuses.def = (equipBonuses.def || 0) + pv2
            if (pe2 === 'lck_bonus') equipBonuses.lck = (equipBonuses.lck || 0) + pv2
            if (pe2 === 'per_bonus') equipBonuses.per = (equipBonuses.per || 0) + pv2
          }
          var setBonusEffects2 = getSetBonuses(character.equipped)
          for (var sbi2 = 0; sbi2 < setBonusEffects2.length; sbi2++) {
            var sbe2 = setBonusEffects2[sbi2]
            if (sbe2.passiveEffect === 'str_bonus') equipBonuses.str = (equipBonuses.str || 0) + (sbe2.passiveValue || 0)
            if (sbe2.passiveEffect === 'def_bonus') equipBonuses.def = (equipBonuses.def || 0) + (sbe2.passiveValue || 0)
            if (sbe2.secondEffect === 'crit_bonus') equipBonuses.lck = (equipBonuses.lck || 0) + (sbe2.secondValue || 0)
          }
          for (var bi = 0; bi < activeBuffs.length; bi++) {
            var b = activeBuffs[bi]
            if (b.stat && b.value) equipBonuses[b.stat] = (equipBonuses[b.stat] || 0) + b.value
          }

          return (
            <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-display text-lg text-gold">{character.name}</span>
                <button onClick={function() { setShowCharPanel(false) }}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {(function() {
                  var nextT3 = XP_THRESHOLDS[runLevel]
                  var prevX3 = runLevel > 0 ? XP_THRESHOLDS[runLevel - 1].xp : 0
                  var nextX3 = nextT3 ? nextT3.xp : prevX3
                  var xpP3 = nextT3 ? Math.min(1, (totalXp - prevX3) / Math.max(1, nextX3 - prevX3)) : 1
                  var isMax3 = !nextT3
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gold font-display text-base">Level {runLevel + 1}</span>
                        <span className="text-ink-dim text-xs font-sans">{isMax3 ? 'Max Level' : totalXp + ' / ' + nextX3 + ' XP'}</span>
                      </div>
                      <div className="w-full bg-bg rounded-full h-2 border border-border">
                        <div className={'rounded-full h-full transition-all duration-300 ' + (isMax3 ? 'bg-gold' : 'bg-blue')} style={{ width: Math.round(xpP3 * 100) + '%' }} />
                      </div>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4 text-xs font-sans">
                  <div><span className="text-ink-dim">HP:</span> <span className="text-ink">{playerHp}/{character.maxHp}</span></div>
                  <div><span className="text-ink-dim">Gold:</span> <span className="text-gold">{playerGold}</span></div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {statRows.map(function(s) {
                    var base = character.stats[s.id] || 0
                    var bonus = equipBonuses[s.id] || 0
                    var effective = base + bonus
                    var color = bonus > 0 ? 'text-green-400' : bonus < 0 ? 'text-red-400' : 'text-ink'
                    return (
                      <div key={s.id} className="flex flex-col items-center p-2 rounded bg-raised border border-border">
                        <span className="text-ink text-[10px] uppercase font-sans">{s.label}</span>
                        <span className={color + ' font-display text-base'}>{effective}</span>
                        {bonus !== 0 && <span className={bonus > 0 ? 'text-green-400 text-[8px]' : 'text-red-400 text-[8px]'}>{bonus > 0 ? '+' + bonus : bonus} gear</span>}
                      </div>
                    )
                  })}
                </div>
                {activeBuffs.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <span className="text-ink-dim text-[10px] uppercase tracking-wide font-sans">Active Effects</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activeBuffs.map(function(b, i) {
                        return (
                          <span key={i} className="text-green-400 text-[10px] font-sans bg-green-400/10 border border-green-400/20 rounded px-1.5 py-0.5">
                            +{b.value} {(b.stat || '').toUpperCase()} ({b.turnsRemaining}t)
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {(giftSlots.body || giftSlots.mind || giftSlots.weapon || giftSlots.shield) && (
                  <div className="mt-3 border-t border-border pt-2">
                    <span className="text-ink-dim text-[10px] uppercase tracking-wide font-sans">Montor's Gifts</span>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {['body', 'mind', 'weapon', 'shield'].map(function(slot) {
                        var g = giftSlots[slot]
                        if (!g) return null
                        return (
                          <div key={slot} className="p-1.5 rounded border border-border bg-raised">
                            <span className="text-ink-faint text-[8px] uppercase">{slot}</span>
                            <span className="text-ink text-[10px] font-display block">{g.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Combat inventory — glanceable status card */}
        {showInventoryPanel && (function() {
          var eq = character.equipped || {}
          var consumableCount = playerInventory.filter(function(i) { return i.type === 'consumable' }).length
          var throwableCount = playerInventory.filter(function(i) {
            return i.type === 'consumable' && (i.effect === 'damage_all_enemies' || i.effect === 'condition_all_enemies' || i.effect === 'damage_and_condition_all' || i.effect === 'condition_one_enemy' || i.effect === 'condition_multi_enemies' || i.effect === 'damage_multi_enemies' || i.effect === 'timed_bomb' || i.effect === 'reflect_next_attack' || i.effect === 'wet_all_and_heal' || i.effect === 'risky_throw' || i.effect === 'damage_and_condition_one' || i.effect === 'debuff_all_enemies' || i.effect === 'summon_ally')
          }).length
          var usableCount = consumableCount - throwableCount
          var gearCount = playerInventory.filter(function(i) { return i.type === 'weapon' || i.type === 'armour' }).length
          var junkCount = playerJunkBag.reduce(function(s, j) { return s + j.count }, 0)
          return (
            <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-display text-lg text-gold">Combat Status</span>
                <button onClick={function() { setShowInventoryPanel(false) }}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {/* Equipped gear */}
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-[10px] text-gold uppercase tracking-wide font-sans mb-2">Equipped</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-sans">
                    <span className="text-ink-dim">Weapon</span>
                    <span className={eq.weapon ? rarityCol(eq.weapon.rarity).text : 'text-ink-faint'}>{eq.weapon ? eq.weapon.name : 'Fists'}</span>
                    {eq.offhand && <><span className="text-ink-dim">Off-hand</span><span className={rarityCol(eq.offhand.rarity).text}>{eq.offhand.name}</span></>}
                    {eq.armour && <><span className="text-ink-dim">Armour</span><span className={rarityCol(eq.armour.rarity).text}>{eq.armour.name}</span></>}
                    {eq.helmet && <><span className="text-ink-dim">Helmet</span><span className={rarityCol(eq.helmet.rarity).text}>{eq.helmet.name}</span></>}
                    {eq.boots && <><span className="text-ink-dim">Boots</span><span className={rarityCol(eq.boots.rarity).text}>{eq.boots.name}</span></>}
                    {eq.amulet && <><span className="text-ink-dim">Amulet</span><span className={rarityCol(eq.amulet.rarity).text}>{eq.amulet.name}</span></>}
                  </div>
                  {eq.relics && eq.relics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {eq.relics.map(function(r, ri) {
                        return <span key={ri} className="text-[10px] text-purple-400 bg-purple-400/10 border border-purple-400/20 px-1.5 py-0.5 rounded">{r.name}</span>
                      })}
                    </div>
                  )}
                  {eq.rings && eq.rings.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {eq.rings.map(function(r, ri) {
                        return <span key={ri} className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">{r.name}</span>
                      })}
                    </div>
                  )}
                </div>

                {/* Active conditions */}
                {battle && battle.players[user.uid] && battle.players[user.uid].statusEffects.length > 0 && (
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-red-400 uppercase tracking-wide font-sans mb-2">Active Conditions</p>
                    <div className="flex flex-wrap gap-2">
                      {battle.players[user.uid].statusEffects.map(function(c, ci) {
                        var label = c.stacks > 1 ? 'x' + c.stacks : c.turnsRemaining ? c.turnsRemaining + 't' : '~'
                        return (
                          <div key={ci} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                            <ConditionIcon conditionId={c.id} scale={2} />
                            <span className="text-[10px] text-red-300 font-sans">{c.name} {label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Item counts */}
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-[10px] text-ink-dim uppercase tracking-wide font-sans mb-2">Carrying</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-sans">
                    {usableCount > 0 && <><span className="text-emerald-400">Usable items</span><span className="text-ink">{usableCount}</span></>}
                    {throwableCount > 0 && <><span className="text-red-400">Throwables</span><span className="text-ink">{throwableCount}</span></>}
                    {gearCount > 0 && <><span className="text-ink-dim">Spare gear</span><span className="text-ink">{gearCount}</span></>}
                    {junkCount > 0 && <><span className="text-amber-400">Junk</span><span className="text-ink">{junkCount}</span></>}
                  </div>
                </div>

                <p className="text-ink-faint text-[10px] font-sans italic text-center">Use items via the Use Item / Throw buttons during your turn.</p>
              </div>
            </div>
          )
        })()}

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col items-start">
            <span className="text-gold text-xs font-display">{zone.floorName}</span><span className="text-ink-dim text-[10px] font-sans ml-1">— {zone.zoneName}</span>
            <span className="text-ink-dim text-xs uppercase tracking-widest">{combatChamber.label} -- Round {battle.round}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={function() { setShowCharPanel(!showCharPanel); if (!showCharPanel) { setShowInventoryPanel(false); setCombatItemPhase(null) } }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showCharPanel ? 'border-blue text-blue' : 'border-border text-ink-dim hover:text-ink')}>
              Stats
            </button>
            <button onClick={function() { setShowInventoryPanel(!showInventoryPanel); if (!showInventoryPanel) { setShowCharPanel(false); setCombatItemPhase(null) } }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showInventoryPanel ? 'border-emerald-400 text-emerald-400' : 'border-border text-ink-dim hover:text-ink')}>
              Bag
            </button>
          </div>
        </div>

        {/* Enemies — compact when 3+ */}
        {(function() {
          var livingEnemies = battle.enemies.filter(function(e) { return !e.isDown })
          var compact = battle.enemies.length >= 3
          return (
            <div className={'flex flex-wrap justify-center gap-1.5 mb-2' + (compact ? ' gap-1' : '')}>
              {battle.enemies.map(function(enemy) {
                var isTarget = selectedTarget === enemy.id
                var isDead = enemy.isDown
                var isActing = activeEnemyId === enemy.id
                return (
                  <button key={enemy.id}
                    onClick={function() {
                      if (isDead || !isPlayerTurn || pendingAttackResult) return
                      if (isTarget) {
                        handlePlayerAttackDirect(enemy.id)
                      } else {
                        handleSelectTarget(enemy.id)
                      }
                    }}
                    disabled={isDead || !isPlayerTurn}
                    className={
                      (compact
                        ? 'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border-2 transition-all '
                        : 'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ') +
                      (isDead ? 'opacity-20 border-transparent' :
                       isActing ? 'border-red-400 bg-red-400/10 scale-105' :
                       isTarget ? 'border-gold bg-gold-glow' :
                       isPlayerTurn ? 'border-border-hl hover:border-ink-faint cursor-pointer' :
                       'border-border')
                    }>
                    <SpriteRenderer spriteKey={enemy.archetypeKey} tierKey={enemy.tierKey} scale={compact ? 2 : 3} />
                    {compact ? (
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-display text-xs text-ink truncate">{enemy.name}</span>
                        <div className="w-16 bg-bg rounded-full h-1.5">
                          <div className="bg-red-500 rounded-full h-1.5 transition-all duration-300"
                            style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-ink text-[9px] font-sans">{enemy.currentHp}/{enemy.maxHp}</span>
                          {enemy.statusEffects && enemy.statusEffects.map(function(c, ci) {
                            var label = c.stacks > 1 ? 'x' + c.stacks : c.turnsRemaining || '~'
                            return (
                              <div key={ci} className="flex items-center gap-0" title={c.name}>
                                <ConditionIcon conditionId={c.id} scale={2} />
                                <span className="text-[7px] font-sans text-red-300">{label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="font-display text-sm text-ink">{enemy.name}</span>
                        <div className="w-20 bg-bg rounded-full h-2">
                          <div className="bg-red-500 rounded-full h-2 transition-all duration-300"
                            style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }} />
                        </div>
                        <span className="text-ink text-xs font-sans">{enemy.currentHp}/{enemy.maxHp}</span>
                        <div className="flex gap-2 text-[10px] font-sans">
                          <span className={enemy._baseStats && enemy.stats.str > enemy._baseStats.str ? 'text-green-400' : enemy._baseStats && enemy.stats.str < enemy._baseStats.str ? 'text-red-400' : 'text-ink-dim'}>STR {enemy.stats.str}</span>
                          <span className={enemy._baseStats && enemy.stats.def > enemy._baseStats.def ? 'text-green-400' : enemy._baseStats && enemy.stats.def < enemy._baseStats.def ? 'text-red-400' : 'text-ink-dim'}>DEF {enemy.stats.def}</span>
                        </div>
                        {enemy.statusEffects && enemy.statusEffects.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-0.5 items-center">
                            {enemy.statusEffects.map(function(c, ci) {
                              var label = c.stacks > 1 ? 'x' + c.stacks : c.turnsRemaining ? c.turnsRemaining + 't' : '~'
                              return (
                                <div key={ci} className="flex items-center gap-0.5 px-1 rounded bg-red-500/20" title={c.name}>
                                  <ConditionIcon conditionId={c.id} scale={2} />
                                  <span className="text-[8px] font-sans text-red-300">{label}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Last action — replaces scrolling combat log */}
        {combatLog.length > 0 && (
          <div className="mb-2 shrink-0">
            {combatLog.slice(-4).map(function(entry, i) {
              var logColour = 'text-ink-dim'
              if (entry.tier === 'crit') logColour = 'text-crimson'
              else if (entry.tier === 'hit') logColour = 'text-amber-500'
              else if (entry.tier === 'glancing') logColour = 'text-yellow-400/80'
              else if (entry.tier === 'miss') logColour = 'text-ink-faint'
              return <p key={i} className={'text-xs text-center leading-relaxed ' + logColour}>{entry.text}</p>
            })}
          </div>
        )}

        {/* Action area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">
          {combatPhase === 'enemyWindup' && (
            <div className="flex flex-col items-center gap-2 p-3 border-2 border-red-400/30 rounded-lg bg-red-400/5">
              <p className="text-red-400 text-xs font-sans uppercase tracking-wide">Enemy Turn</p>
              {enemyBehaviourMsg ? (
                <>
                  <p className="text-red-400 text-lg font-display">{enemyBehaviourMsg.name}</p>
                  <p className="text-ink text-sm italic">{enemyBehaviourMsg.text}</p>
                </>
              ) : enemyConditionMsg ? (
                <>
                  <p className="text-red-400 text-lg font-display">{enemyConditionMsg.name}</p>
                  <p className="text-amber-400 text-sm italic">{enemyConditionMsg.text}</p>
                </>
              ) : enemyResult ? (
                <>
                  <p className="text-red-400 text-lg font-display">{enemyResult.attacker}</p>
                  <p className="text-ink text-sm italic">prepares to strike...</p>
                </>
              ) : (
                <p className="text-ink text-sm italic">prepares to strike...</p>
              )}
            </div>
          )}

          {combatPhase === 'enemyRolling' && enemyResult && (
            <div className="flex flex-col items-center gap-2">
              <CombatRoller
                key={'enemy-' + enemyRollerKey}
                onAttackRoll={handleEnemyRollForRoller}
                onComplete={handleEnemyComplete}
                attackMod={enemyResult.attackRoll.modifier}
                damageDie={battle.enemies.find(function(e) { return e.id === enemyResult.attackerId }).weaponDie || 4}
                damageMod={enemyResult.attackRoll.modifier}
                colour="red"
                buttonLabel=""
                autoRoll={true}
                resolvedDamage={enemyResult.damage}
                damageBreakdown={enemyAttackInfo.attackOut.result.damageBreakdown}
                attackerName={enemyResult.attacker}
                targetName={enemyResult.target}
              />
            </div>
          )}

          {/* Use Item picker — consumables (heals, cures, tonics) */}
          {isPlayerTurn && combatItemPhase === 'use' && (
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <div className="flex items-center justify-between w-full">
                <p className="text-ink text-sm font-sans">Use an item:</p>
                <button onClick={function() { setCombatItemPhase(null) }}
                  className="text-ink-dim text-xs border border-border px-2 py-1 rounded hover:text-ink transition-colors">
                  Cancel
                </button>
              </div>
              <div className="flex flex-col gap-2 w-full max-h-48 overflow-y-auto">
                {playerInventory.map(function(item, idx) {
                  if (item.type !== 'consumable') return null
                  var isThrowable = item.effect === 'damage_all_enemies' || item.effect === 'condition_all_enemies' || item.effect === 'damage_and_condition_all' || item.effect === 'condition_one_enemy' || item.effect === 'condition_multi_enemies' || item.effect === 'damage_multi_enemies' || item.effect === 'timed_bomb' || item.effect === 'reflect_next_attack' || item.effect === 'wet_all_and_heal' || item.effect === 'risky_throw' || item.effect === 'damage_and_condition_one' || item.effect === 'debuff_all_enemies' || item.effect === 'summon_ally'
                  if (isThrowable) return null
                  return (
                    <button key={idx}
                      onClick={function() { setCombatItemPhase(null); handleUseItem(idx) }}
                      className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-surface text-sm font-sans text-ink hover:border-emerald-400 cursor-pointer transition-colors"
                    >
                      <div className="flex flex-col items-start">
                        <span>{item.name}</span>
                        <span className="text-ink-faint text-xs">{item.description || ''}</span>
                      </div>
                    </button>
                  )
                })}
                {/* Junk consumables — last resort gamble */}
                {playerJunkBag.filter(function(j) { return j.consumable && j.count > 0 }).length > 0 && (
                  <div className="border-t border-border pt-2 mt-1">
                    <p className="text-ink-faint text-[10px] uppercase tracking-wide mb-1">Junk (risky)</p>
                    {playerJunkBag.map(function(junk, ji) {
                      if (!junk.consumable || junk.count <= 0) return null
                      return (
                        <button key={'junk-' + ji}
                          onClick={function() {
                            setCombatItemPhase(null)
                            var result = consumeJunk(junk, character.stats.lck || 10)
                            if (result) {
                              addLog({ type: result.success ? 'player' : 'enemy', text: junk.name + ': ' + result.narrative, tier: result.success ? 'hit' : 'miss' })
                              if (result.effect) {
                                if (result.effect.effect === 'heal' && result.effect.value) {
                                  setPlayerHp(function(hp) { return Math.min(hp + result.effect.value, character.maxHp) })
                                }
                                if (result.effect.effect === 'condition' && result.effect.condition && battle) {
                                  var junkPlayers = {}
                                  Object.keys(battle.players).forEach(function(uid) {
                                    var p = battle.players[uid]
                                    junkPlayers[uid] = Object.assign({}, p, { statusEffects: applyConditionToEffects(p.statusEffects || [], result.effect.condition, 'junk') })
                                  })
                                  setBattle(Object.assign({}, battle, { players: junkPlayers }))
                                }
                                if (result.effect.effect === 'stat_buff' && result.effect.stat) {
                                  setActiveBuffs(function(prev) { return prev.concat([{ stat: result.effect.stat, value: result.effect.value, turnsRemaining: result.effect.duration || 3 }]) })
                                }
                              }
                              setPlayerJunkBag(function(bag) {
                                return bag.map(function(j) {
                                  if (j.id === junk.id) return Object.assign({}, j, { count: j.count - 1 })
                                  return j
                                }).filter(function(j) { return j.count > 0 })
                              })
                            }
                          }}
                          className="flex items-center justify-between p-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-sm font-sans text-ink hover:border-amber-400 cursor-pointer transition-colors w-full mb-1"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-amber-400 text-xs">{junk.name} x{junk.count}</span>
                            <span className="text-ink-faint text-[10px]">Risky — tap to consume</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Throw picker — AoE damage/conditions */}
          {isPlayerTurn && combatItemPhase === 'throw' && (
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <div className="flex items-center justify-between w-full">
                <p className="text-ink text-sm font-sans">Throw something:</p>
                <button onClick={function() { setCombatItemPhase(null) }}
                  className="text-ink-dim text-xs border border-border px-2 py-1 rounded hover:text-ink transition-colors">
                  Cancel
                </button>
              </div>
              <div className="flex flex-col gap-2 w-full max-h-48 overflow-y-auto">
                {playerInventory.map(function(item, idx) {
                  if (item.type !== 'consumable') return null
                  var isThrowable = item.effect === 'damage_all_enemies' || item.effect === 'condition_all_enemies' || item.effect === 'damage_and_condition_all' || item.effect === 'condition_one_enemy' || item.effect === 'condition_multi_enemies' || item.effect === 'damage_multi_enemies' || item.effect === 'timed_bomb' || item.effect === 'reflect_next_attack' || item.effect === 'wet_all_and_heal' || item.effect === 'risky_throw' || item.effect === 'damage_and_condition_one' || item.effect === 'debuff_all_enemies' || item.effect === 'summon_ally'
                  if (!isThrowable) return null
                  return (
                    <button key={idx}
                      onClick={function() { setCombatItemPhase(null); handleUseItem(idx) }}
                      className="flex items-center justify-between p-3 rounded-lg border border-red-500/30 bg-surface text-sm font-sans text-ink hover:border-red-400 cursor-pointer transition-colors"
                    >
                      <div className="flex flex-col items-start">
                        <span>{item.name}</span>
                        <span className="text-ink-faint text-xs">{item.description || ''}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {combatPhase === 'playerSkipped' && (
            <div onClick={handleSkippedTap} className="p-4 border-2 border-red-500/40 rounded-lg bg-red-500/10 text-center cursor-pointer">
              <p className="text-red-400 text-xl font-display">Turn Lost!</p>
              <div className="mt-2 space-y-1">
                {combatLog.slice(-3).map(function(entry, i) {
                  return <p key={i} className="text-ink text-sm">{entry.text}</p>
                })}
              </div>
              <p className="text-ink-faint text-[10px] mt-2">Tap to continue</p>
            </div>
          )}

          {/* Your Turn + condition tap-through */}
          {combatPhase === 'playerTurn' && playerTurnAnnounced && !playerConditionTicked && playerConditionMessages.length > 0 && (
            <div onClick={handleConditionTap} className="p-4 border-2 border-gold/40 rounded-lg bg-gold-glow text-center cursor-pointer">
              {playerConditionIndex < 0 ? (
                <p className="text-gold text-lg font-display">Your Turn</p>
              ) : (
                <p className={'text-base font-display ' + (playerConditionMessages[playerConditionIndex].tier === 'crit' ? 'text-crimson' : playerConditionMessages[playerConditionIndex].tier === 'miss' ? 'text-red-400' : playerConditionMessages[playerConditionIndex].tier === 'hit' ? 'text-amber-500' : 'text-yellow-400')}>
                  {playerConditionMessages[playerConditionIndex].text}
                </p>
              )}
            </div>
          )}

          {isPlayerTurn && !combatItemPhase && !selectedTarget && (
            <div className="p-4 border-2 border-gold/40 rounded-lg bg-gold-glow text-center">
              <p className="text-gold text-lg font-display">Your Turn</p>
              <p className="text-ink text-sm">Choose an enemy above to attack</p>
            </div>
          )}

          {isPlayerTurn && !combatItemPhase && selectedTarget && (function() {
            var targetEnemy = battle.enemies.find(function(e) { return e.id === selectedTarget })
            var weaponDie = (character.equipped && character.equipped.weapon) ? (character.equipped.weapon.damageDie || character.equipped.weapon.die || 8) : 8
            return (
              <div className="flex flex-col items-center gap-3">
                <CombatRoller
                  key={'player-' + selectedTarget}
                  onAttackRoll={handlePlayerAttackRoll}
                  onComplete={handlePlayerComplete}
                  attackMod={strMod}
                  damageDie={weaponDie}
                  damageMod={strMod}
                  colour="gold"
                  buttonLabel={'Attack ' + targetEnemy.name}
                  resolvedDamage={pendingAttackResult ? pendingAttackResult.result.damage - (pendingAttackResult.result.doubleStrikeDamage || 0) - (pendingAttackResult.result.offhandDamage || 0) : null}
                  damageBreakdown={pendingAttackResult ? pendingAttackResult.result.damageBreakdown : null}
                  doubleStrike={pendingAttackResult ? pendingAttackResult.result.doubleStrike : false}
                  doubleStrikeDamage={pendingAttackResult ? pendingAttackResult.result.doubleStrikeDamage : 0}
                  offhandHit={pendingAttackResult ? pendingAttackResult.result.offhandHit : false}
                  offhandDamage={pendingAttackResult ? pendingAttackResult.result.offhandDamage : 0}
                  attackerName={character.name}
                  targetName={targetEnemy.name}
                />
              </div>
            )
          })()}

          {/* Use Item / Throw / Flee — visible on player turn unless mid-roll or picking item */}
          {isPlayerTurn && !combatItemPhase && !pendingAttackResult && (function() {
            var playerEffects = (battle && battle.players[user.uid]) ? battle.players[user.uid].statusEffects : []
            var fleeBlocked = isFleeBlocked(playerEffects)
            var itemsBlocked = areItemsBlocked(playerEffects)
            var hasUsables = playerInventory.some(function(it) {
              if (it.type !== 'consumable') return false
              var isThrow = it.effect === 'damage_all_enemies' || it.effect === 'condition_all_enemies' || it.effect === 'damage_and_condition_all' || it.effect === 'condition_one_enemy' || it.effect === 'condition_multi_enemies' || it.effect === 'damage_multi_enemies' || it.effect === 'timed_bomb' || it.effect === 'reflect_next_attack' || it.effect === 'wet_all_and_heal' || it.effect === 'risky_throw' || it.effect === 'damage_and_condition_one' || it.effect === 'debuff_all_enemies' || it.effect === 'summon_ally'
              return !isThrow
            })
            var hasThrowables = playerInventory.some(function(it) {
              if (it.type !== 'consumable') return false
              return it.effect === 'damage_all_enemies' || it.effect === 'condition_all_enemies' || it.effect === 'damage_and_condition_all' || it.effect === 'condition_one_enemy' || it.effect === 'condition_multi_enemies' || it.effect === 'damage_multi_enemies' || it.effect === 'timed_bomb' || it.effect === 'reflect_next_attack' || it.effect === 'wet_all_and_heal' || it.effect === 'risky_throw' || it.effect === 'damage_and_condition_one' || it.effect === 'debuff_all_enemies' || it.effect === 'summon_ally'
            })
            return (
              <div className="flex gap-2 mt-1 flex-wrap justify-center">
                {hasUsables && !itemsBlocked && (
                  <button onClick={function() { setCombatItemPhase('use') }}
                    className="py-1.5 px-4 rounded-lg bg-surface border border-emerald-500/40 text-emerald-400 font-sans text-xs hover:border-emerald-400 transition-colors">
                    Use Item
                  </button>
                )}
                {hasThrowables && !itemsBlocked && (
                  <button onClick={function() { setCombatItemPhase('throw') }}
                    className="py-1.5 px-4 rounded-lg bg-surface border border-red-500/40 text-red-400 font-sans text-xs hover:border-red-400 transition-colors">
                    Throw
                  </button>
                )}
                {itemsBlocked && (
                  <span className="py-1.5 px-4 text-ink-faint font-sans text-xs italic">Items blocked</span>
                )}
                {!fleeBlocked ? (
                  <button onClick={handleFlee}
                    className="py-1.5 px-4 rounded-lg bg-surface border border-border-hl text-ink-dim font-sans text-xs hover:text-ink hover:border-ink-faint transition-colors">
                    Flee
                  </button>
                ) : (
                  <span className="py-1.5 px-4 text-red-400 font-sans text-xs italic">Can't flee</span>
                )}
              </div>
            )
          })()}

          {/* Fallback: if no action rendered (stuck state), let player recover */}
          {!isPlayerTurn && combatPhase !== 'enemyWindup' && combatPhase !== 'enemyRolling' && combatPhase !== 'playerSkipped' && !(combatPhase === 'playerTurn' && playerConditionMessages.length > 0 && !playerConditionTicked) && (
            <div className="p-4 border-2 border-border rounded-lg bg-surface text-center">
              <p className="text-ink-dim text-sm">Waiting...</p>
              <button onClick={function() {
                var nextB = advanceTurn(battle)
                setBattle(nextB)
                var nextA = getActor(nextB, getCurrentTurnId(nextB))
                guardedSetCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
              }} className="mt-2 py-1.5 px-4 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-xs">
                Continue
              </button>
            </div>
          )}
        </div>

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  // Fallback: if no phase matched, force back to doors (prevents black screen)
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4 bg-raised">
      <p className="text-ink-dim text-sm">Something went wrong (phase: {gamePhase})</p>
      <button onClick={function() { setGamePhase('doors') }}
        className="py-2 px-6 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm">
        Return to Doors
      </button>
    </div>
  )

  // ============================================================
  // Shared party bar
  // ============================================================
  function renderPartyBar() {
    var allStunned = allEnemiesStunned

    return (
      <div className="shrink-0 bg-surface border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <PlayerSprite classKey="knight" scale={2} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-display text-sm text-ink truncate">{character.name}</span>
                {battle && battle.players[user.uid] && battle.players[user.uid].statusEffects.length > 0 && (
                  <div className="flex gap-0.5 items-center">
                    {battle.players[user.uid].statusEffects.map(function(c, ci) {
                      var label = c.stacks > 1 ? 'x' + c.stacks : c.turnsRemaining ? c.turnsRemaining + 't' : '~'
                      return (
                        <div key={ci} className="flex items-center gap-0.5 px-1 rounded bg-amber-500/20" title={c.name}>
                          <ConditionIcon conditionId={c.id} scale={2} />
                          <span className="text-[8px] font-sans text-amber-300">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <span className="text-ink text-xs font-sans shrink-0">{playerHp}/{character.maxHp}</span>
            </div>
            <div className="w-full bg-bg rounded-full h-2 mt-1">
              <div className={'rounded-full h-2 transition-all duration-500 ' +
                  (playerHp / character.maxHp > 0.5 ? 'bg-green-500' :
                   playerHp / character.maxHp > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: Math.max(0, (playerHp / character.maxHp) * 100) + '%' }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex gap-2 text-[10px] font-sans text-ink-dim">
                {character.equipped && (
                  <span className="text-ink">{character.equipped.weapon ? character.equipped.weapon.name : 'Fists'}</span>
                )}
                {character.equipped && character.equipped.armour && (
                  <span>+{character.equipped.armour.defBonus} DEF</span>
                )}
                {character.equipped && character.equipped.offhand && (
                  <span>{character.equipped.offhand.type === 'weapon' ? 'Dual' : 'Shield'}</span>
                )}
              </div>
              <span className="text-gold text-[10px] font-sans">{playerGold}g</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Game
