import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Attack, d20Flee } from '../lib/dice.js'
import { generateGardenZone, generateFloor, generateChamberContent, getAdjacentChambers, getDoorDirection, ZONES, FLOORS } from '../lib/dungeon.js'
import { db } from '../lib/firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { generateCombatLoot, generateChestLoot, getMerchantItems, getItem, getItemsByType, applyConsumable, ITEMS } from '../lib/loot.js'
import { resolveSearch, applySearch, inspectPile, getAvailableCleanLevels, inspectJunkItem, consumeJunk, CLEAN_CONFIG } from '../lib/junkpiles.js'
import { createBattleState, getCurrentTurnId, getActor, tickTurnStart, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import { isFleeBlocked, areItemsBlocked, applyCondition as applyConditionToEffects } from '../lib/conditions.js'
import conditionsData from '../data/conditions.json'
import dialogueData from '../data/dialogue.json'
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

// Helper: get total passive value from equipped relics + armour
function getPassiveTotal(equipped, effectName) {
  var total = 0
  if (equipped && equipped.relics) {
    for (var i = 0; i < equipped.relics.length; i++) {
      if (equipped.relics[i].passiveEffect === effectName) total += (equipped.relics[i].passiveValue || 0)
    }
  }
  if (equipped && equipped.armour && equipped.armour.passiveEffect === effectName) {
    total += (equipped.armour.passiveValue || 0)
  }
  return total
}

// Helper: check if equipped relics block a condition (immunity or resist roll)
// Returns { blocked: bool, type: 'immune'|'resisted'|null }
function checkConditionResist(equipped, conditionId) {
  if (!equipped || !equipped.relics) return { blocked: false, type: null }
  var resistChance = 0
  for (var i = 0; i < equipped.relics.length; i++) {
    var r = equipped.relics[i]
    // Full immunity
    if (r.passiveEffect === 'condition_immunity' && r.passiveCondition === conditionId) {
      return { blocked: true, type: 'immune' }
    }
    // Single condition resist
    if (r.passiveEffect === 'condition_resist' && r.passiveCondition === conditionId) {
      resistChance = Math.max(resistChance, r.passiveValue || 0)
    }
    // Multi condition resist
    if (r.passiveEffect === 'condition_resist_multi' && r.passiveConditions && r.passiveConditions.indexOf(conditionId) !== -1) {
      resistChance = Math.max(resistChance, r.passiveValue || 0)
    }
    // All condition resist
    if (r.passiveEffect === 'condition_resist_all') {
      resistChance = Math.max(resistChance, r.passiveValue || 0)
    }
  }
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

function Game({ character, user, onEndRun }) {
  // --- Dungeon state ---
  var [floor, setFloor] = useState(null)
  var [zone, setZone] = useState(null)
  // Phases: doors | entering | chamber | combat | victory | defeat | safe_room | floor_transition
  var [gamePhase, setGamePhase] = useState('doors')
  var [chamberContent, setChamberContent] = useState(null)
  var [totalXp, setTotalXp] = useState(0)
  var [playerHp, setPlayerHp] = useState(character.maxHp)
  var [playerGold, setPlayerGold] = useState(character.gold || 0)
  var [chambersCleared, setChambersCleared] = useState(0)
  var [previousPosition, setPreviousPosition] = useState(null)
  var [playerInventory, setPlayerInventory] = useState(character.inventory ? character.inventory.slice() : [])
  var [activeBuffs, setActiveBuffs] = useState([])
  var [hasZoneKey, setHasZoneKey] = useState(false)
  var [floorsCompleted, setFloorsCompleted] = useState([])
  var [runLevel, setRunLevel] = useState(0)
  var [pendingLevelUp, setPendingLevelUp] = useState(null) // { hpGain, statPick } or null

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
  var [inventoryTab, setInventoryTab] = useState('weapons')
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
  var [enemyRollerKey, setEnemyRollerKey] = useState(0)
  var [lootableCorpses, setLootableCorpses] = useState([])
  var [lootingCorpseId, setLootingCorpseId] = useState(null)
  var [lootingChestId, setLootingChestId] = useState(null)
  var [lootingNpcId, setLootingNpcId] = useState(null)
  var [montorWhisper, setMontorWhisper] = useState(null)
  var [searchingPileId, setSearchingPileId] = useState(null)
  var [searchResult, setSearchResult] = useState(null)
  var [playerJunkBag, setPlayerJunkBag] = useState([])
  var logRef = useRef(null)

  // Init floor — start at Garden
  useEffect(function() {
    window.scrollTo(0, 0)
    var f = generateFloor('grounds')
    setFloor(f)
    setZone(f.zones[0])
    setHasZoneKey(false)
    setGamePhase('doors')
  }, [])

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
    setPreviousPosition(zone.playerPosition)
    setLootingCorpseId(null)
    setLootingChestId(null)
    setLootingNpcId(null)
    setShowInventoryPanel(false)

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
      var regenAmount = 1 + getPassiveTotal(character.equipped, 'regen_per_chamber')
      setPlayerHp(function(hp) { return Math.min(hp + regenAmount, character.maxHp) })
    }

    // Montor whisper — random chance on entering a new room
    var whisper = MONTOR_WHISPERS[Math.floor(Math.random() * MONTOR_WHISPERS.length)]
    setMontorWhisper(whisper)
    if (whisper) {
      setTimeout(function() { setMontorWhisper(null) }, 4000)
    }

    // If already cleared or has corpses (fought), just show doors (backtracking)
    if (chamber.cleared || chamber.corpses) {
      setGamePhase('doors')
      return
    }

    // If chest/npc already visited, show room without regenerating content
    if ((chamber.chest && chamber.chest.opened) || chamber.npc) {
      setChamberContent(null)
      setGamePhase('doors')
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
      var npc = {
        id: 'npc_' + targetId,
        type: chamber.type,
        name: chamber.type === 'merchant' ? 'Wandering Vendor' : (content.npcName || 'Stranger'),
        description: content.description,
        items: content.items || [],
        reward: content.reward || null,
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
  function handleChooseCleanLevel(level) {
    if (searchPhase !== 'choose') return
    var chamber = zone.chambers[zone.playerPosition]
    var pile = chamber.junkPiles && chamber.junkPiles.find(function(p) { return p.id === searchingPileId })
    if (!pile || pile.depleted) return

    var result = resolveSearch(pile, character.stats.per || 6, character.stats.agi || 10, character.stats.lck || 10, level)
    if (!result) return

    applySearch(pile, level)
    setSearchResult(result)
    setSearchPhase('rolling')

    // Dice roll animation — search roll
    var rollCount = 0
    searchDiceRef.current = setInterval(function() {
      setSearchDiceDisplay(Math.floor(Math.random() * 20) + 1)
      rollCount++
      if (rollCount > 12) {
        clearInterval(searchDiceRef.current)
        setSearchDiceDisplay(result.natRoll)
        setSearchPhase('landed')

        // After landing: if danger triggered, show save roll. Otherwise go to reveal.
        setTimeout(function() {
          if (result.dangerTriggered) {
            setSearchPhase('save_rolling')
            // Save dice animation
            var saveCount = 0
            searchDiceRef.current = setInterval(function() {
              setSearchSaveDiceDisplay(Math.floor(Math.random() * 20) + 1)
              saveCount++
              if (saveCount > 10) {
                clearInterval(searchDiceRef.current)
                var saveRoll = result.dangerType === 'enemy' ? result.perSaveRoll : result.agiSaveRoll
                setSearchSaveDiceDisplay(saveRoll || '?')
                setSearchPhase('save_landed')
                setTimeout(function() {
                  applySearchRewards(result)
                  setSearchPhase('reveal')
                }, 1200)
              }
            }, 80)
          } else {
            applySearchRewards(result)
            setSearchPhase('reveal')
          }
        }, 1200)
      }
    }, 80)
  }

  // Apply gold, xp, junk, items to player state
  function applySearchRewards(result) {
    if (result.gold > 0) setPlayerGold(function(g) { return g + result.gold })
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
    // Apply condition hazard — check immunity relics first, then DEF reduces physical damage
    if (result.condition && !result.agiSaved) {
      // Check condition resistance from relics (immunity, resist chance, multi, all)
      var resistResult = checkConditionResist(character.equipped, result.condition)
      if (resistResult.blocked) {
        result.trapImmune = true
        result.trapResistType = resistResult.type // 'immune' or 'resisted'
        result.condition = null // negated
      } else {
        var trapBaseDamage = { POISON: 6, NAUSEA: 3, BLIND: 2, DAZE: 2, SLUGGISH: 4, FEAR: 3, CHARM: 2, BURN: 10, FROST: 5, BLEED: 5, FRENZY: 4, BORED: 1, SAD: 2 }
        var baseDmg = trapBaseDamage[result.condition] || 3
        // DEF reduces physical trap damage (BLEED, BURN, FROST, POISON = physical; FEAR, CHARM, DAZE = mental, no DEF)
        var physicalTraps = ['POISON', 'BLEED', 'BURN', 'FROST', 'SLUGGISH', 'NAUSEA']
        var defReduction = 0
        if (physicalTraps.indexOf(result.condition) !== -1) {
          var totalDef = (character.stats.def || 10)
          if (character.equipped && character.equipped.armour) totalDef += character.equipped.armour.defBonus || 0
          if (character.equipped && character.equipped.offhand) totalDef += character.equipped.offhand.defBonus || 0
          defReduction = Math.floor(getModifier(totalDef))
        }
        var finalDmg = Math.max(1, baseDmg - defReduction)
        setPlayerHp(function(hp) { return Math.max(1, hp - finalDmg) })
        result.trapDamage = finalDmg
      }
    }
    setZone(Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id !== zone.playerPosition) return ch
        return Object.assign({}, ch, { junkPiles: ch.junkPiles.slice() })
      })
    }))
  }

  function handleDismissSearch() {
    if (searchDiceRef.current) clearInterval(searchDiceRef.current)
    setSearchResult(null)
    setSearchingPileId(null)
    setSearchPhase(null)
    setSearchDiceDisplay(null)
    setSearchSaveDiceDisplay(null)
  }

  function handleCancelSearch() {
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

  // --- Zone door ---
  function handleOpenZoneDoor() {
    if (!hasZoneKey) return
    if (!floor || !floor.zones) return
    // Move to next zone
    var nextZoneIndex = (floor.currentZoneIndex + 1) % floor.zones.length
    if (nextZoneIndex === floor.currentZoneIndex) return // only one zone
    var nextZone = floor.zones[nextZoneIndex]
    setFloor(Object.assign({}, floor, { currentZoneIndex: nextZoneIndex }))
    setZone(nextZone)
    setHasZoneKey(false)
    setPreviousPosition(null)
    setLootingCorpseId(null)
    setLootingChestId(null)
    setLootingNpcId(null)
  }

  // --- Stairwell descent --- triggers floor transition
  function handleDescendStairwell() {
    if (!zone.keystonePressed) return  // locked
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
    if (isGuarded()) return
    // Determine next floor from data
    var currentFloorDef = FLOORS[floor.floorId]
    var nextFloorId = currentFloorDef ? currentFloorDef.nextFloor : null

    if (!nextFloorId || !FLOORS[nextFloorId]) {
      // No more floors — victory!
      writeRunLog('victory')
      onEndRun({ victory: true, chambersCleared: chambersCleared, xp: totalXp, gold: playerGold, itemsFound: playerInventory.length, floorsCompleted: floorsCompleted.length + 1 })
      return
    }

    // Generate next floor
    var nextFloor = generateFloor(nextFloorId)
    setFloor(nextFloor)
    setZone(nextFloor.zones[0])
    setHasZoneKey(false)
    setPreviousPosition(null)
    setLootingCorpseId(null)
    setLootingChestId(null)
    setLootingNpcId(null)
    guardedSetPhase('safe_room')
  }

  // --- Safe room: Montor's audience chamber ---
  function handleSafeRoomContinue() {
    if (isGuarded()) return
    transitionGuardRef.current = Date.now()
    setGamePhase('doors')
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
    setBattle(bs)
    setSelectedTarget(null)
    setCombatLog([])
    setPendingAttackResult(null)
    setEnemyAttackInfo(null)
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

    // Split narrative into individual log lines
    if (tickResult.narrative) {
      var eParts = tickResult.narrative.split('. ').filter(function(s) { return s.trim() })
      for (var ei = 0; ei < eParts.length; ei++) {
        var ePart = eParts[ei].replace(/\.+$/, '')
        var eTier = 'glancing'
        if (ePart.indexOf('turn lost') !== -1 || ePart.indexOf('skip') !== -1) eTier = 'miss'
        addLog({ type: 'condition', text: ePart, tier: eTier })
      }
    }

    var hasEnemyConditionEffects = tickResult.damage > 0 || tickResult.narrative
    var enemyCondDelay = hasEnemyConditionEffects ? 1000 : 0

    if (tickResult.died) {
      var diedTimeout = setTimeout(function() {
        setBattle(tickedBattle)
        var endCheck = checkBattleEnd(tickedBattle)
        if (endCheck === 'victory') {
          var xpGained = calculateXp(tickedBattle)
          var newXp = totalXp + xpGained
          setTotalXp(newXp)
          checkLevelUp(newXp)
          transitionGuardRef.current = Date.now(); guardedSetCombatPhase('victory')
          return
        }
        // Enemy died from conditions — skip their turn
        var nextB = advanceTurn(tickedBattle)
        setBattle(nextB)
        var nextA = getActor(nextB, getCurrentTurnId(nextB))
        guardedSetCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
      }, enemyCondDelay)
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
      setEnemyAttackInfo({ attackOut: attackOut })
      setEnemyRollerKey(function(k) { return k + 1 })
    }
    var timeout = setTimeout(function() { guardedSetCombatPhase('enemyRolling') }, Math.max(800, enemyCondDelay))
    return function() { clearTimeout(timeout) }
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
    if (pState) setPlayerHp(pState.currentHp)

    // Track damage taken
    if (r.damage > 0) trackStat('damageTaken', r.damage)
    if (r.attackRoll && r.attackRoll.tierName === 'crit') trackStat('critsReceived', 1)

    var endResult = checkBattleEnd(updatedBattle)
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
  // Tick player conditions at turn start
  var [playerConditionTicked, setPlayerConditionTicked] = useState(false)
  useEffect(function() {
    if (combatPhase !== 'playerTurn' || !battle || playerConditionTicked) return
    var playerUid = user.uid
    var player = battle.players[playerUid]
    if (!player || !player.statusEffects || player.statusEffects.length === 0) {
      setPlayerConditionTicked(true)
      return
    }

    var tickResult = tickTurnStart(battle, playerUid)

    // Split narrative into individual lines for readable display
    if (tickResult.narrative) {
      var parts = tickResult.narrative.split('. ').filter(function(s) { return s.trim() })
      for (var ni = 0; ni < parts.length; ni++) {
        var part = parts[ni].replace(/\.+$/, '')
        // Colour-code: damage = yellow, skip = red, buffs = amber
        var logTier = 'glancing'
        if (part.indexOf('turn lost') !== -1 || part.indexOf('paralysed') !== -1 || part.indexOf('skip') !== -1) logTier = 'miss'
        else if (part.indexOf('ADRENALINE') !== -1) logTier = 'crit'
        addLog({ type: 'condition', text: part, tier: logTier })
      }
    }
    setBattle(tickResult.newBattle)
    setPlayerHp(tickResult.newBattle.players[playerUid].currentHp)

    if (tickResult.died) {
      setPlayerHp(0)
      guardedSetPhase('defeat')
      return
    }

    // Show condition effects for a beat before acting/skipping
    var hasConditionEffects = tickResult.damage > 0 || tickResult.narrative
    var conditionDisplayTime = hasConditionEffects ? 1200 : 0

    if (tickResult.skipped) {
      // Show condition effects first, then show skip banner
      setTimeout(function() {
        guardedSetCombatPhase('playerSkipped')
        setTimeout(function() {
          var nextB = advanceTurn(tickResult.newBattle)
          setBattle(nextB)
          var nextA = getActor(nextB, getCurrentTurnId(nextB))
          guardedSetCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
          setPlayerConditionTicked(false)
        }, 2000)
      }, conditionDisplayTime)
      return
    }
    setPlayerConditionTicked(true)
  }, [combatPhase, battle, playerConditionTicked])

  // Reset condition tick flag when combat phase changes away from playerTurn
  useEffect(function() {
    if (combatPhase !== 'playerTurn') setPlayerConditionTicked(false)
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
  var isPlayerTurn = currentTurnId === user.uid && combatPhase === 'playerTurn'
  var activeEnemyId = enemyAttackInfo ? enemyAttackInfo.attackOut.result.attackerId : null

  // Crit threshold: base 20, lowered by LCK modifier and crit_bonus relics
  var lckMod = getModifier(character.stats.lck || 10)
  var critThreshold = 20 - getPassiveTotal(character.equipped, 'crit_bonus') - lckMod

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
      addLog({ type: 'condition', text: 'ADRENALINE! Guaranteed crit!', tier: 'crit' })
    }
    if (r.doubleStrike) {
      addLog({ type: 'player', text: 'Double strike! ' + r.doubleStrikeDamage + ' bonus damage!', tier: 'crit' })
    }
    if (r.lifestealHeal) {
      addLog({ type: 'player', text: 'Lifesteal: healed ' + r.lifestealHeal + ' HP.', tier: 'hit' })
    }
    if (r.rerolled) {
      addLog({ type: 'player', text: 'Loaded Dice: rerolled a 1!', tier: 'hit' })
    }
    if (r.offhandHit) {
      addLog({ type: 'player', text: 'Off-hand strike! ' + r.offhandDamage + ' bonus damage!', tier: 'hit' })
    } else if (r.offhandMiss) {
      addLog({ type: 'player', text: 'Off-hand swings... misses.', tier: 'miss' })
    }
    if (r.offhandCondition) {
      addLog({ type: 'condition', text: r.target + ' is now ' + condName(r.offhandCondition) + '! (off-hand)', tier: 'hit' })
    }
    if (r.conditionApplied) {
      addLog({ type: 'condition', text: r.target + ' is now ' + condName(r.conditionApplied) + '!', tier: 'hit' })
    }
    if (r.doubleCondition) {
      addLog({ type: 'condition', text: 'Magnifying Glass: ' + condName(r.conditionApplied) + ' applied twice!', tier: 'crit' })
    }
    if (r.staggerApplied) {
      addLog({ type: 'condition', text: 'Stagger! ' + r.target + ' is Dazed!', tier: 'hit' })
    }
    // Lottery ticket — winning roll awards a random rare item
    if (r.lotteryWin) {
      var rareItems = Object.values(ITEMS).filter(function(it) { return it.rarity === 'rare' })
      if (rareItems.length > 0) {
        var prize = Object.assign({}, rareItems[Math.floor(Math.random() * rareItems.length)])
        setPlayerInventory(function(prev) { return prev.concat([prize]) })
        addLog({ type: 'player', text: 'JACKPOT! Rolled a ' + r.lotteryNumber + '! Won: ' + prize.name + '!', tier: 'crit' })
        // Remove the matched number so each number only wins once
        if (character.equipped && character.equipped.relics) {
          for (var lri = 0; lri < character.equipped.relics.length; lri++) {
            var lr = character.equipped.relics[lri]
            if (lr.passiveEffect === 'lottery' && lr.lotteryNumbers) {
              lr.lotteryNumbers = lr.lotteryNumbers.filter(function(n) { return n !== r.lotteryNumber })
            }
          }
        }
      }
    }
    setPendingAttackResult(null)

    // Track combat stats
    if (r.damage > 0) trackStat('damageDealt', r.damage)
    if (r.attackRoll && r.attackRoll.tierName === 'crit') trackStat('critsLanded', 1)
    if (r.enemyDefeated) trackStat('enemiesDefeated', 1)

    var updatedBattle = attackOut.newBattle
    var endResult = checkBattleEnd(updatedBattle)
    if (endResult === 'victory') {
      var xpGained = calculateXp(updatedBattle)
      var newXp = totalXp + xpGained
      setTotalXp(newXp)
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
      // Daggers can dual wield — if main hand already has a dagger and offhand is empty
      if (item.weaponType === 'dagger' && newEquipped.weapon && newEquipped.weapon.weaponType === 'dagger' && !newEquipped.offhand) {
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
    } else if (item.type === 'relic' && item.slot === 'relic') {
      if (!newEquipped.relics) newEquipped.relics = []
      if (newEquipped.relics.length < 3) {
        newEquipped.relics = newEquipped.relics.concat([item])
      } else {
        return // relics full
      }
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

    // Lottery ticket — scratch off and generate 2 winning numbers (2-20)
    if (item.passiveEffect === 'lottery' && !item.lotteryNumbers) {
      var n1 = 2 + Math.floor(Math.random() * 19) // 2-20
      var n2 = n1
      while (n2 === n1) n2 = 2 + Math.floor(Math.random() * 19)
      item.lotteryNumbers = [n1, n2].sort(function(a, b) { return a - b })
      addLog({ type: 'player', text: 'Scratched off Gran\'s ticket... lucky numbers: ' + item.lotteryNumbers[0] + ' and ' + item.lotteryNumbers[1] + '!', tier: 'crit' })
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
      return {
        id: e.id, name: e.name, archetypeKey: e.archetypeKey, tierKey: e.tierKey,
        gold: Math.max(1, loot.gold + Math.round(e.xp * (e.isBoss ? 0.5 : 0.2))),
        items: items,
        goldTaken: false,
        itemsTaken: [],    // indices of items already taken
        opened: false,     // has the player looked inside?
      }
    })

    // Mini-boss drops zone key
    if (chamberContent && (chamberContent.dropsZoneKey || chamberContent.isBoss)) {
      if (floor && floor.zones && floor.zones.length > 1 && !hasZoneKey) {
        setHasZoneKey(true)
      }
    }

    // Store corpses on the chamber in zone state + ensure cleared
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { corpses: corpses, cleared: true })
        return ch
      })
    })
    setZone(newZone)
    setBattle(null)
    setCombatLog([])
    setChamberContent(null)
    setGamePhase('doors')
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
  }

  // Close the loot panel (walk away)
  function handleCloseLoot() {
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
      <div onClick={handleFloorTransitionContinue} className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised cursor-pointer">
        <p className="text-ink text-lg italic max-w-sm" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
          {floor ? floor.transitionText : 'You descend deeper...'}
        </p>
        <p className="text-ink-faint text-xs font-sans">Tap anywhere to continue</p>
      </div>
    )
  }

  // --- Safe room (Montor's audience chamber) ---
  if (gamePhase === 'safe_room') {
    return (
      <div onClick={handleSafeRoomContinue} className="h-full flex flex-col items-center justify-center px-6 text-center gap-8 bg-raised cursor-pointer">
        <h2 className="font-display text-2xl text-gold">{floor ? floor.floorName : 'Unknown Depth'}</h2>
        <div className="max-w-sm">
          <p className="text-ink text-base italic mb-4" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
            You enter a chamber of worked stone. Torchlight flickers. The air is warm. You are safe here — for now.
          </p>
          <p className="text-ink-faint text-sm italic" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
            "{floor ? floor.montorLine : 'I see you.'}"
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs text-sm text-ink-dim">
          <p>HP: <span className="text-ink">{playerHp}/{character.maxHp}</span></p>
          <p>Gold: <span className="text-gold">{playerGold}</span></p>
          <p>Items: <span className="text-emerald-400">{playerInventory.length}</span></p>
          <p>Chambers cleared: <span className="text-ink">{chambersCleared}</span></p>
          <p>XP: <span className="text-ink">{totalXp}</span></p>
        </div>
        <p className="text-ink-faint text-xs font-sans">Tap anywhere to continue</p>
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
      var isVisited = targetChamber.visited
      var isCleared = targetChamber.cleared

      var subtextCol = isCleared ? 'text-ink-faint' : isVisited ? 'text-red-400/70' : 'text-ink-faint'
      var subtext = isCleared ? 'cleared' : isVisited ? 'unfinished' : ''

      return (
        <button
          onClick={function() { handlePickDoor(door.targetId) }}
          className={
            'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all cursor-pointer ' +
            'bg-surface hover:bg-raised hover:border-gold ' +
            (isCleared ? 'border-border' : 'border-border-hl')
          }
        >
          <DoorSprite theme="garden" scale={2} />
          <span className="text-ink font-display text-xs">{DIR_LABELS[dir]}</span>
          {subtext && <span className={subtextCol + ' text-[9px] font-sans'}>{subtext}</span>}
        </button>
      )
    }

    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <span className="text-ink-faint text-[9px] font-sans">{zone.floorName} — {zone.zoneName}</span>
            <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">{currentChamber.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={function() { setShowCharPanel(!showCharPanel); if (!showCharPanel) setShowInventoryPanel(false) }}
              className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                (showCharPanel ? 'border-blue text-blue' : 'border-border text-ink-dim hover:text-ink')}>
              Stats
            </button>
            {playerInventory.length > 0 && (
              <button onClick={function() { setShowInventoryPanel(!showInventoryPanel); if (!showInventoryPanel) setShowCharPanel(false) }}
                className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                  (showInventoryPanel ? 'border-emerald-400 text-emerald-400' : 'border-border text-ink-dim hover:text-ink')}>
                Bag ({playerInventory.length})
              </button>
            )}
            <span className="text-gold text-xs font-sans">{playerGold}g</span>
          </div>
        </div>

        {/* Character stats panel */}
        {showCharPanel && (function() {
          var mod = function(v) { var m = Math.floor(((v || 10) - 10) / 2); return m >= 0 ? '+' + m : '' + m }
          var statRows = [
            { id: 'str', label: 'STR', hint: 'Attack + damage' },
            { id: 'def', label: 'DEF', hint: 'Damage reduction' },
            { id: 'agi', label: 'AGI', hint: 'Initiative + dodge' },
            { id: 'vit', label: 'VIT', hint: 'Max HP' },
            { id: 'int', label: 'INT', hint: 'Conditions + enchant dmg' },
            { id: 'lck', label: 'LCK', hint: 'Crits + loot' },
            { id: 'per', label: 'PER', hint: 'Searching' },
            { id: 'end', label: 'END', hint: 'Carry capacity' },
            { id: 'wis', label: 'WIS', hint: 'Gift power' },
            { id: 'cha', label: 'CHA', hint: 'Prices' },
          ]
          var w = character.equipped && character.equipped.weapon
          var a = character.equipped && character.equipped.armour
          var o = character.equipped && character.equipped.offhand
          var totalDef = (character.stats.def || 10) + (a ? a.defBonus || 0 : 0) + (o ? o.defBonus || 0 : 0)
          return (
            <div className="mb-2 rounded-lg bg-surface border border-border overflow-hidden">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-base text-gold">{character.name}</span>
                  <span className="text-ink-dim text-xs font-sans">Level {character.level || 1} Knight</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
                  <div className="text-xs font-sans"><span className="text-ink-dim">HP:</span> <span className="text-ink">{playerHp}/{character.maxHp}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Gold:</span> <span className="text-gold">{playerGold}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">XP:</span> <span className="text-ink">{totalXp}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">DEF total:</span> <span className="text-ink">{totalDef} (reduces {Math.floor(totalDef / 2)})</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Weapon:</span> <span className="text-ink">{w ? w.name : 'None'}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Armour:</span> <span className="text-ink">{a ? a.name : 'None'}</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Crit:</span> <span className="text-ink">{critThreshold}+ (nat d20)</span></div>
                  <div className="text-xs font-sans"><span className="text-ink-dim">Dodge:</span> <span className="text-ink">{Math.round(Math.max(0, getModifier(character.stats.agi || 10) * 0.02 + getPassiveTotal(character.equipped, 'dodge_chance')) * 100)}%</span></div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {statRows.map(function(s) {
                    var val = character.stats[s.id] || 0
                    return (
                      <div key={s.id} className="flex flex-col items-center p-1.5 rounded bg-raised border border-border">
                        <span className="text-ink-faint text-[9px] uppercase">{s.label}</span>
                        <span className="text-ink font-display text-sm">{val}</span>
                        <span className="text-ink-dim text-[9px]">{mod(val)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Inventory panel — full screen overlay */}
        {showInventoryPanel && (function() {
          var tabs = [
            { id: 'weapons',     label: 'Arms',    types: ['weapon'] },
            { id: 'wearables',   label: 'Wear',    types: ['armour'] },
            { id: 'relics',      label: 'Relics',  types: ['relic'] },
            { id: 'consumables', label: 'Use',     types: ['consumable'] },
            { id: 'junk',        label: 'Junk',    types: ['junk'] },
          ]
          var activeTab = tabs.find(function(t) { return t.id === inventoryTab }) || tabs[0]
          var filteredRaw = []
          for (var fi = 0; fi < playerInventory.length; fi++) {
            if (activeTab.types.indexOf(playerInventory[fi].type) !== -1) {
              filteredRaw.push({ item: playerInventory[fi], idx: fi })
            }
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
                if (tabs[ci].types.indexOf(playerInventory[pi].type) !== -1) tabCounts[tabId]++
              }
            }
          }

          return (
            <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-display text-lg text-gold">Inventory</span>
                <button onClick={function() { setShowInventoryPanel(false); setSelectedItemIdx(null) }}
                  className="text-sm text-ink-dim border border-border px-3 py-1 rounded hover:text-ink transition-colors">
                  Close
                </button>
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

              {/* Currently equipped (weapons/armour tabs) */}
              {activeTab.id === 'weapons' && character.equipped && (
                <div className="mx-3 mt-2 flex flex-col gap-1">
                  <div className="p-2 rounded bg-gold/10 border border-gold/20 text-sm font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gold uppercase tracking-wide">Main Hand</span>
                        {character.equipped.weapon ? (
                          <>
                            <span className="text-ink">{character.equipped.weapon.name}</span>
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
                  {character.equipped.offhand && character.equipped.offhand.type === 'weapon' && (
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-emerald-400 uppercase tracking-wide">Off Hand (Dual Wield)</span>
                          <span className="text-ink">{character.equipped.offhand.name}</span>
                          <span className="text-ink-faint text-[10px]">d{character.equipped.offhand.damageDie || character.equipped.offhand.die} dmg, -2 accuracy, no crits</span>
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
              {(activeTab.id === 'wearables' || activeTab.id === 'relics') && (
                <div className="mx-3 mt-2 flex flex-col gap-1">
                  {character.equipped && character.equipped.armour && (
                    <div className="p-2 rounded bg-gold/10 border border-gold/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gold uppercase tracking-wide">Equipped Armour</span>
                          <span className="text-ink">{character.equipped.armour.name}</span>
                          <span className="text-ink-faint text-[10px]">+{character.equipped.armour.defBonus} DEF</span>
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
                  {character.equipped && character.equipped.offhand && (
                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-blue-400 uppercase tracking-wide">Offhand</span>
                          <span className="text-ink">{character.equipped.offhand.name}</span>
                          <span className="text-ink-faint text-[10px]">+{character.equipped.offhand.defBonus} DEF, {Math.round((character.equipped.offhand.passiveValue || 0) * 100)}% block</span>
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
                  {character.equipped && character.equipped.relics && character.equipped.relics.length > 0 && (
                    <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-sm font-sans">
                      <span className="text-[10px] text-purple-400 uppercase tracking-wide">Relics ({character.equipped.relics.length}/3)</span>
                      {character.equipped.relics.map(function(relic, ri) {
                        return (
                          <div key={ri} className="flex items-center justify-between mt-1">
                            <div className="flex flex-col">
                              <span className="text-ink text-xs">{relic.name}</span>
                              <span className="text-ink-faint text-[10px]">{relic.description}</span>
                            </div>
                            {canEquipNow && (
                              <button onClick={function() { handleUnequipRelic(ri) }}
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

              {/* Bag contents for active tab */}
              <div className="p-3 flex-1 overflow-y-auto">
                {filteredItems.length === 0 && (
                  <p className="text-ink-faint text-xs text-center py-2">Nothing here.</p>
                )}

                {/* Item detail panel */}
                {selectedItemIdx !== null && playerInventory[selectedItemIdx] && (function() {
                  var detailItem = playerInventory[selectedItemIdx]
                  var isEquippable = detailItem.type === 'weapon' || detailItem.type === 'armour' || detailItem.type === 'relic'
                  var isConsumable = detailItem.type === 'consumable'
                  return (
                    <div className="mb-2 p-4 rounded-lg bg-surface border-2 border-gold/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gold font-display text-lg">{detailItem.name}</span>
                        <span className="text-ink-dim text-xs uppercase">{detailItem.rarity || ''}</span>
                      </div>
                      <p className="text-ink text-sm italic mb-3">{detailItem.description || ''}</p>
                      <div className="flex flex-col gap-1.5 text-xs text-ink mb-3">
                        {detailItem.type === 'weapon' && <span>Type: {detailItem.weaponType || 'weapon'} | Damage: d{detailItem.damageDie || detailItem.die}{detailItem.hand ? ' | ' + detailItem.hand : ''}</span>}
                        {detailItem.type === 'weapon' && detailItem.defIgnore > 0 && <span>Ignores {Math.round(detailItem.defIgnore * 100)}% of enemy DEF</span>}
                        {detailItem.type === 'weapon' && detailItem.doubleStrikeBase > 0 && <span>{Math.round(detailItem.doubleStrikeBase * 100)}% double strike chance (scales with AGI)</span>}
                        {detailItem.conditionOnHit && <span>Applies {detailItem.conditionOnHit} on hit</span>}
                        {detailItem.type === 'armour' && <span>DEF: +{detailItem.defBonus}{detailItem.agiPenalty ? ' | AGI: ' + detailItem.agiPenalty : ''}</span>}
                        {detailItem.passiveEffect && <span>Passive: {detailItem.passiveEffect}{detailItem.passiveValue ? ' (' + detailItem.passiveValue + ')' : ''}{detailItem.passiveCondition ? ' — ' + detailItem.passiveCondition : ''}</span>}
                        {detailItem.giftPower && <span>Gift: {Array.isArray(detailItem.giftPower) ? detailItem.giftPower.join(' + ') : detailItem.giftPower}</span>}
                        {detailItem.effect === 'heal' && <span>Heals {detailItem.effectValue} HP</span>}
                        {detailItem.effect === 'stat_buff' && <span>+{detailItem.effectValue} {(detailItem.effectStat || '').toUpperCase()} for {detailItem.effectDuration} turns</span>}
                        {detailItem.effect === 'random_effect' && <span>Random effect — could be anything</span>}
                        {detailItem.effect === 'cure_body' && <span>Cures body conditions (BLEED, POISON, etc.)</span>}
                        {detailItem.effect === 'cure_mind' && <span>Cures mind conditions (FEAR, DAZE, etc.)</span>}
                        {detailItem.effect === 'damage_all_enemies' && <span>{detailItem.effectValue} damage to all enemies</span>}
                        {detailItem.effect === 'flee_guaranteed' && <span>Guaranteed escape from combat</span>}
                        {detailItem.buyPrice && <span>Value: {detailItem.sellPrice || Math.round(detailItem.buyPrice * 0.4)}g</span>}
                      </div>
                      <div className="flex gap-2">
                        {isEquippable && canEquipNow && (
                          <button onClick={function() { handleEquipItem(selectedItemIdx); setSelectedItemIdx(null) }}
                            className="flex-1 text-xs text-gold border border-gold/40 py-1 rounded hover:border-gold transition-colors">
                            Equip
                          </button>
                        )}
                        {isConsumable && canEquipNow && (
                          <button onClick={function() { handleUseItem(selectedItemIdx); setSelectedItemIdx(null) }}
                            className="flex-1 text-xs text-emerald-400 border border-emerald-500/40 py-1 rounded hover:border-emerald-400 transition-colors">
                            Use
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
                          className="flex items-center justify-between p-3 rounded-lg bg-raised text-sm font-sans hover:border-gold border border-border transition-colors text-left cursor-pointer">
                          <div className="flex flex-col">
                            <span className="text-ink font-medium">{item.name}</span>
                            <span className="text-ink-dim text-xs">
                              {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' ' + (item.weaponType || '') :
                               item.type === 'armour' && item.slot === 'offhand' ? '+' + item.defBonus + ' DEF, ' + Math.round((item.passiveValue || 0) * 100) + '% block' :
                               item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
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
                              {canEquipNow && (
                                <button onClick={function() {
                                  var result = consumeJunk(junk, character.stats.lck || 10)
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
                        <div key={junk.id} className="flex items-center justify-between p-3 rounded-lg bg-raised text-sm font-sans border border-border">
                          <span className="text-ink">{junk.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gold text-xs font-display">x{junk.count}</span>
                            <span className="text-ink-faint text-[10px]">{junk.sellPrice}g ea</span>
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
              </div>
            </div>
          )
        })()}

        {/* Room layout — doors on edges, content in centre */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* North door — pinned to top */}
          <div className="flex justify-center py-1">
            {doorMap.N ? renderDoor('N') : <div className="h-12" />}
          </div>

          {/* Middle area: West — Centre — East */}
          <div className="flex-1 flex items-center min-h-0">
            {/* West door — pinned left */}
            <div className="w-16 flex justify-center shrink-0">
              {doorMap.W ? renderDoor('W') : <div />}
            </div>

            {/* Centre content — large area */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-2">
              {/* Montor whisper */}
              {montorWhisper && (
                <p className="text-ink-faint text-xs italic text-center max-w-xs mb-2 animate-pulse"
                  style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
                  "{montorWhisper}"
                </p>
              )}

              {/* Keystone pedestal */}
              {currentChamber.isKeystone && !currentChamber.cleared && (
                <div className="flex flex-col items-center gap-3">
                  <ChamberIcon iconKey="shrine" theme={zone.doorTheme || 'garden'} scale={4} />
                  {zone.keystonePressed ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-gold text-sm font-sans">The keystone is pressed. Something shifts deep below.</p>
                      <button onClick={function() { handlePressKeystone() }}
                        className="py-2 px-6 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm">
                        Continue
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-ink text-sm italic">A stone pedestal. A carved slot awaits a heavy hand.</p>
                      <button onClick={function() { handlePressKeystone() }}
                        className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-base animate-pulse">
                        Press the Keystone
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Zone door (locked/unlocked) */}
              {currentChamber.isZoneDoor && !currentChamber.cleared && (
                <div className="flex flex-col items-center gap-3">
                  <ChamberIcon iconKey="stairs_down" theme={zone.doorTheme || 'garden'} scale={4} />
                  <p className="text-ink text-sm italic">A heavy door. {hasZoneKey ? 'Your key fits the lock.' : 'Locked. You need a key.'}</p>
                  {hasZoneKey ? (
                    <button onClick={handleOpenZoneDoor}
                      className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-base">
                      Open Door
                    </button>
                  ) : (
                    <p className="text-red-400 text-xs font-sans">Find the key to proceed.</p>
                  )}
                </div>
              )}

              {/* Stairwell descent (locked until keystone + boss) */}
              {currentChamber.type === 'stairwell_descent' && !currentChamber.cleared && (function() {
                var bossCleared = zone.chambers.every(function(ch) { return ch.type !== 'boss' || ch.cleared })
                var canDescend = zone.keystonePressed && bossCleared
                return (
                  <div className="flex flex-col items-center gap-3">
                    <ChamberIcon iconKey="stairs_down" theme={zone.doorTheme || 'garden'} scale={4} />
                    {canDescend ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-gold text-sm italic">The way down is open.</p>
                        <button onClick={handleDescendStairwell}
                          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-lg">
                          Descend
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-ink text-sm italic">Stone steps spiral downward. The way is sealed.</p>
                        {!zone.keystonePressed && <p className="text-red-400 text-xs font-sans">The keystone has not been pressed.</p>}
                        {zone.keystonePressed && !bossCleared && <p className="text-red-400 text-xs font-sans">The guardian still blocks the way.</p>}
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

              {/* NPC in room (merchant/quest) */}
              {currentChamber.npc && !lootingNpcId && !lootingChestId && !lootingCorpseId ? (function() {
                var npc = currentChamber.npc
                return (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleOpenNpc}
                      className="flex flex-col items-center gap-1 p-3 rounded-lg border border-blue/40 bg-blue/5 cursor-pointer hover:border-blue transition-all"
                    >
                      <ChamberIcon iconKey="npc" theme="garden" scale={4} />
                      <span className="text-blue text-[9px] font-sans font-bold">
                        {npc.type === 'merchant' ? 'TRADE' : 'TALK'}
                      </span>
                    </button>
                    <p className="text-ink-dim text-xs italic text-center max-w-xs">{npc.description}</p>
                  </div>
                )
              })() : lootingNpcId && currentChamber.npc ? (function() {
                var npc = currentChamber.npc

                // Merchant NPC
                if (npc.type === 'merchant') {
                  return (
                    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                      <p className="text-ink text-sm font-sans">{npc.name}</p>
                      <p className="text-gold text-xs font-sans">Your gold: {playerGold}</p>
                      <div className="flex gap-2">
                        <button onClick={function() { updateNpc(function(n) { return Object.assign({}, n, { showSell: false }) }) }}
                          className={'px-4 py-1 rounded text-xs font-sans border transition-colors ' +
                            (!npc.showSell ? 'border-gold text-gold' : 'border-border text-ink-dim hover:text-ink')}>
                          Buy
                        </button>
                        {playerInventory.length > 0 && (
                          <button onClick={handleNpcSellToggle}
                            className={'px-4 py-1 rounded text-xs font-sans border transition-colors ' +
                              (npc.showSell ? 'border-gold text-gold' : 'border-border text-ink-dim hover:text-ink')}>
                            Sell
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 w-full max-h-40 overflow-y-auto">
                        {!npc.showSell && npc.items.map(function(item, i) {
                          var npcBasePr = item.buyPrice || item.cost || 0
                          var npcChaMod = getModifier(character.stats.cha || 10)
                          var price = Math.max(1, npcBasePr - Math.max(0, Math.round(npcBasePr * npcChaMod * 0.05)))
                          var canAfford = playerGold >= price
                          return (
                            <div key={'buy-' + i} className="flex items-center justify-between p-3 rounded-lg border border-border-hl bg-surface text-sm font-sans">
                              <div className="flex flex-col items-start">
                                <span className="text-ink">{item.name}</span>
                                <span className="text-ink-faint text-[10px]">
                                  {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                                   item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                                   item.description || item.type}
                                </span>
                              </div>
                              <button onClick={function() { if (canAfford) handleNpcBuy(item) }}
                                disabled={!canAfford}
                                className={'text-xs px-3 py-1 rounded border transition-colors ' +
                                  (canAfford ? 'text-gold border-gold/40 hover:border-gold cursor-pointer' : 'text-ink-faint border-border opacity-50')}>
                                {price}g
                              </button>
                            </div>
                          )
                        })}
                        {!npc.showSell && npc.items.length === 0 && (
                          <p className="text-ink-faint text-xs italic text-center">Sold out.</p>
                        )}
                        {npc.showSell && playerInventory.map(function(item, i) {
                          var baseSellNpc = item.sellPrice || Math.max(1, Math.round((item.buyPrice || 10) * 0.4))
                          var sellChaMod = getModifier(character.stats.cha || 10)
                          var sellPrice = Math.max(1, baseSellNpc + Math.max(0, Math.round(baseSellNpc * sellChaMod * 0.05)))
                          return (
                            <div key={'sell-' + i} className="flex items-center justify-between p-3 rounded-lg border border-border-hl bg-surface text-sm font-sans">
                              <div className="flex flex-col items-start">
                                <span className="text-ink">{item.name}</span>
                                <span className="text-ink-faint text-[10px]">
                                  {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                                   item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                                   item.description || item.type}
                                </span>
                              </div>
                              <button onClick={function() { handleNpcSell(i, sellPrice) }}
                                className="text-xs text-gold px-3 py-1 rounded border border-gold/40 hover:border-gold cursor-pointer transition-colors">
                                Sell {sellPrice}g
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={handleCloseNpc}
                        className="py-2 px-6 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm hover:text-ink transition-colors">
                        Leave
                      </button>
                    </div>
                  )
                }

                // Quest NPC
                return (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <p className="text-ink text-sm font-sans">{npc.name}</p>
                    <p className="text-ink-dim text-xs italic text-center">{npc.description}</p>
                    {!npc.interacted ? (
                      <div className="flex flex-col gap-2 w-full">
                        <button onClick={handleNpcHelp}
                          className="w-full p-3 rounded-lg border border-blue/40 bg-surface text-sm font-sans text-blue hover:border-blue transition-colors">
                          Help them {npc.reward && npc.reward.gold ? '(reward: ' + npc.reward.gold + 'g)' : ''}
                        </button>
                        <button onClick={handleCloseNpc}
                          className="w-full p-3 rounded-lg border border-border bg-surface text-sm font-sans text-ink-dim hover:text-ink transition-colors">
                          Ignore and leave
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-blue text-sm">They thank you.</p>
                        {npc.reward && npc.reward.gold && (
                          <p className="text-gold text-sm">+{npc.reward.gold} gold</p>
                        )}
                        <button onClick={handleCloseNpc}
                          className="py-2 px-6 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm hover:text-ink transition-colors">
                          Continue
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()

              : /* Chest in room (loot/hidden chambers) */
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
              })() : lootingChestId && currentChamber.chest ? (function() {
                var chest = currentChamber.chest
                return (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <p className="text-ink text-sm font-sans">{chest.label}</p>
                    <div className="flex flex-col gap-2 w-full">
                      {chest.gold > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gold/30 bg-surface text-sm font-sans">
                          <span className="text-gold">{chest.gold} gold</span>
                          {chest.goldTaken ? (
                            <span className="text-ink-faint text-xs">taken</span>
                          ) : (
                            <button onClick={handleTakeChestGold}
                              className="text-xs text-gold border border-gold/40 px-3 py-1 rounded hover:border-gold transition-colors">
                              Take
                            </button>
                          )}
                        </div>
                      )}
                      {chest.items.map(function(item, idx) {
                        var taken = chest.itemsTaken.indexOf(idx) !== -1
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-surface text-sm font-sans">
                            <div className="flex flex-col">
                              <span className="text-ink">{item.name}</span>
                              <span className="text-ink-faint text-[10px]">
                                {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                                 item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                                 item.description || item.type}
                              </span>
                            </div>
                            {taken ? (
                              <span className="text-ink-faint text-xs">taken</span>
                            ) : (
                              <button onClick={function() { handleTakeChestItem(idx) }}
                                className="text-xs text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded hover:border-emerald-400 transition-colors">
                                Take
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {chest.items.length === 0 && chest.gold === 0 && (
                        <p className="text-ink-faint text-xs italic">Empty.</p>
                      )}
                    </div>
                    <button onClick={handleCloseChest}
                      className="py-2 px-6 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm hover:text-ink transition-colors">
                      {chest.goldTaken || chest.itemsTaken.length > 0 ? 'Done' : 'Leave it'}
                    </button>
                  </div>
                )
              })()

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
                            'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ' +
                            (isFullyLooted
                              ? 'border-border opacity-30'
                              : corpse.opened
                                ? 'border-gold/30 bg-surface cursor-pointer hover:border-gold'
                                : 'border-gold/40 bg-gold-glow cursor-pointer hover:border-gold animate-pulse')
                          }
                        >
                          <ChamberIcon iconKey={corpseIcon} theme="garden" scale={3} />
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
              ) : lootingCorpseId && currentChamber.corpses ? (function() {
                var corpse = currentChamber.corpses.find(function(c) { return c.id === lootingCorpseId })
                if (!corpse) return null
                var allItemsTaken = corpse.items.length === corpse.itemsTaken.length
                return (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <p className="text-ink text-sm font-sans">{corpse.name}</p>
                    <div className="flex flex-col gap-2 w-full">
                      {/* Gold */}
                      {corpse.gold > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gold/30 bg-surface text-sm font-sans">
                          <span className="text-gold">{corpse.gold} gold</span>
                          {corpse.goldTaken ? (
                            <span className="text-ink-faint text-xs">taken</span>
                          ) : (
                            <button onClick={function() { handleTakeGold(corpse.id) }}
                              className="text-xs text-gold border border-gold/40 px-3 py-1 rounded hover:border-gold transition-colors">
                              Take
                            </button>
                          )}
                        </div>
                      )}
                      {/* Items */}
                      {corpse.items.map(function(item, idx) {
                        var taken = corpse.itemsTaken.indexOf(idx) !== -1
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-surface text-sm font-sans">
                            <div className="flex flex-col">
                              <span className="text-ink">{item.name}</span>
                              <span className="text-ink-faint text-[10px]">
                                {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                                 item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                                 item.description || item.type}
                              </span>
                            </div>
                            {taken ? (
                              <span className="text-ink-faint text-xs">taken</span>
                            ) : (
                              <button onClick={function() { handleTakeItem(corpse.id, idx) }}
                                className="text-xs text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded hover:border-emerald-400 transition-colors">
                                Take
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {corpse.items.length === 0 && !corpse.gold && (
                        <p className="text-ink-faint text-xs italic text-center">Nothing here.</p>
                      )}
                    </div>
                    <button onClick={handleCloseLoot}
                      className="py-2 px-6 rounded-lg bg-surface border border-border text-ink-dim font-sans text-sm hover:text-ink transition-colors">
                      {corpse.goldTaken || corpse.itemsTaken.length > 0 ? 'Done' : 'Leave it'}
                    </button>
                  </div>
                )
              })() : showCentre ? (
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
                  : 'The chamber is still. ' + doors.length + (doors.length === 1 ? ' door leads onward.' : ' doors lead onward.')}
              </p>

              {/* Junk piles — shown when not mid-search */}
              {currentChamber.junkPiles && currentChamber.junkPiles.length > 0 && !searchPhase && (function() {
                var activePiles = currentChamber.junkPiles.filter(function(p) { return !p.depleted })
                if (activePiles.length === 0) return null
                return (
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {activePiles.map(function(pile) {
                      var sizeLabel = pile.size === 3 ? 'Mound' : pile.size === 2 ? 'Heap' : 'Scraps'
                      var sizeColour = pile.size === 3 ? 'border-gold/50 bg-gold/10' : pile.size === 2 ? 'border-amber-500/40 bg-amber-500/5' : 'border-border-hl bg-surface'
                      return (
                        <button key={pile.id}
                          onClick={function() { handleInspectPile(pile.id) }}
                          className={'flex flex-col items-center gap-0.5 p-2.5 rounded-lg border-2 transition-all cursor-pointer hover:border-gold hover:scale-105 ' + sizeColour}
                        >
                          <span className="text-ink text-sm font-display">{sizeLabel}</span>
                          <span className="text-ink-faint text-[9px] font-sans">{pile.layersRemaining} {pile.layersRemaining === 1 ? 'layer' : 'layers'}</span>
                          {pile.inspected && <span className="text-ink-dim text-[8px] italic">{pile.inspectHint}</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Search: Choose clean level */}
              {searchPhase === 'choose' && (function() {
                var ch2 = zone.chambers[zone.playerPosition]
                var pile = ch2.junkPiles && ch2.junkPiles.find(function(p) { return p.id === searchingPileId })
                if (!pile) return null
                var sizeLabel = pile.size === 3 ? 'Mound' : pile.size === 2 ? 'Heap' : 'Scraps'
                var levels = getAvailableCleanLevels(pile)
                return (
                  <div className="flex flex-col items-center gap-3 p-3 max-w-xs">
                    <p className="text-ink text-sm font-display">{sizeLabel}</p>
                    <p className="text-ink-dim text-xs italic text-center">{pile.inspectHint || pile.description}</p>
                    <p className="text-ink-faint text-[10px]">{pile.layersRemaining} {pile.layersRemaining === 1 ? 'layer' : 'layers'} remaining</p>
                    <div className="flex flex-col gap-2 w-full">
                      {levels.map(function(lvl) {
                        var c = CLEAN_CONFIG[lvl]
                        var lvlColour = lvl === 3 ? 'border-red-400/50 hover:border-red-400 text-red-400' :
                          lvl === 2 ? 'border-amber-400/50 hover:border-amber-400 text-amber-400' :
                          'border-green-400/50 hover:border-green-400 text-green-400'
                        return (
                          <button key={lvl}
                            onClick={function() { handleChooseCleanLevel(lvl) }}
                            className={'p-2.5 rounded-lg border-2 bg-surface transition-all cursor-pointer text-left ' + lvlColour}
                          >
                            <span className="font-display text-sm">{c.label}</span>
                            <span className="text-ink-dim text-xs font-sans ml-2">{c.description}</span>
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={handleCancelSearch} className="text-ink-faint text-[10px] hover:text-ink transition-colors">Leave it</button>
                  </div>
                )
              })()}

              {/* Search: Dice rolling (main search) */}
              {searchPhase === 'rolling' && (function() {
                var actionText = searchResult && searchResult.cleanLevel === 3
                  ? 'tears through' : searchResult && searchResult.cleanLevel === 2
                  ? 'rummages through' : 'carefully sifts through'
                var ch3 = zone.chambers[zone.playerPosition]
                var pile3 = ch3.junkPiles && ch3.junkPiles.find(function(p) { return p.id === searchingPileId })
                var pileDesc = pile3 ? pile3.description.toLowerCase() : 'the pile'
                return (
                  <div className="flex flex-col items-center gap-3 p-4">
                    <p className="text-ink text-sm italic text-center max-w-xs">
                      {character.name} {actionText} {pileDesc}...
                    </p>
                    <div className="rounded-xl flex items-center justify-center font-display text-3xl border-2 border-gold/50 bg-gold/10 text-gold animate-pulse"
                      style={{ width: '4.5rem', height: '4.5rem' }}>
                      {searchDiceDisplay || '?'}
                    </div>
                  </div>
                )
              })()}

              {/* Search: Dice landed (main search) */}
              {searchPhase === 'landed' && searchResult && (function() {
                var qc = searchResult.quality === 'excellent' ? 'text-gold border-gold bg-gold/10' :
                  searchResult.quality === 'good' ? 'text-green-400 border-green-400 bg-green-400/10' :
                  searchResult.quality === 'decent' ? 'text-ink border-border-hl bg-surface' :
                  searchResult.quality === 'poor' ? 'text-ink-dim border-border bg-bg' :
                  'text-red-400 border-red-400 bg-red-400/10'
                var ql = { excellent: 'EXCELLENT!', good: 'Good find!', decent: 'Decent.', poor: 'Poor...', fumble: 'FUMBLE!' }
                return (
                  <div className="flex flex-col items-center gap-3 p-4">
                    <p className="text-ink-dim text-xs italic">{character.name} rolls...</p>
                    <div className={'rounded-xl flex items-center justify-center font-display text-3xl border-2 ' + qc}
                      style={{ width: '4.5rem', height: '4.5rem' }}>
                      {searchResult.natRoll}
                    </div>
                    <p className={'text-xl font-display ' + qc.split(' ')[0]}>{ql[searchResult.quality]}</p>
                    {searchResult.dangerTriggered && (
                      <p className="text-red-400 text-xs animate-pulse">Wait... something's wrong...</p>
                    )}
                  </div>
                )
              })()}

              {/* Search: Save roll (PER for enemies, AGI for traps) */}
              {searchPhase === 'save_rolling' && searchResult && (
                <div className="flex flex-col items-center gap-3 p-4">
                  <p className="text-red-400 text-sm font-display">
                    {searchResult.dangerType === 'enemy' ? 'Something stirs in the pile!' : 'A trap triggers!'}
                  </p>
                  <p className="text-ink-dim text-xs italic">
                    {searchResult.dangerType === 'enemy'
                      ? character.name + ' tries to spot it...'
                      : character.name + ' tries to dodge...'}
                  </p>
                  <div className="rounded-xl flex items-center justify-center font-display text-3xl border-2 border-red-400/50 bg-red-400/10 text-red-400 animate-pulse"
                    style={{ width: '4.5rem', height: '4.5rem' }}>
                    {searchSaveDiceDisplay || '?'}
                  </div>
                </div>
              )}

              {/* Search: Save landed */}
              {searchPhase === 'save_landed' && searchResult && (function() {
                var saved = searchResult.dangerType === 'enemy' ? searchResult.perSaved : searchResult.agiSaved
                var saveColour = saved ? 'text-green-400 border-green-400 bg-green-400/10' : 'text-red-400 border-red-400 bg-red-400/10'
                var saveRoll = searchResult.dangerType === 'enemy' ? searchResult.perSaveRoll : searchResult.agiSaveRoll
                return (
                  <div className="flex flex-col items-center gap-3 p-4">
                    <p className="text-ink-dim text-xs italic">
                      {searchResult.dangerType === 'enemy'
                        ? (saved ? character.name + ' spots it in time!' : character.name + ' doesn\'t see it coming!')
                        : (saved ? character.name + ' leaps aside!' : character.name + ' is too slow!')}
                    </p>
                    <div className={'rounded-xl flex items-center justify-center font-display text-3xl border-2 ' + saveColour}
                      style={{ width: '4.5rem', height: '4.5rem' }}>
                      {saveRoll}
                    </div>
                    <p className={'text-lg font-display ' + saveColour.split(' ')[0]}>
                      {saved ? (searchResult.dangerType === 'enemy' ? 'Spotted it!' : 'Dodged!') :
                       (searchResult.dangerType === 'enemy' ? (searchResult.enemy === 'ambush' ? 'AMBUSH!' : 'Too late!') : 'Hit!')}
                    </p>
                  </div>
                )
              })()}

              {/* Search: Reveal */}
              {searchPhase === 'reveal' && searchResult && (
                <div onClick={handleDismissSearch} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gold/30 bg-surface cursor-pointer max-w-xs">
                  <p className={'text-base font-display ' + (
                    searchResult.quality === 'excellent' ? 'text-gold' :
                    searchResult.quality === 'good' ? 'text-green-400' :
                    searchResult.quality === 'decent' ? 'text-ink' :
                    searchResult.quality === 'poor' ? 'text-ink-dim' : 'text-red-400'
                  )}>
                    {searchResult.cleanLabel}
                  </p>
                  <div className="flex flex-col gap-1.5 text-sm font-sans text-center w-full">
                    {searchResult.gold > 0 && <p className="text-gold font-display">+{searchResult.gold}g</p>}
                    {searchResult.xp > 0 && <p className="text-blue text-xs">+{searchResult.xp} XP</p>}
                    {searchResult.junk && <p className="text-ink-dim text-xs">{searchResult.junk.name}</p>}
                    {searchResult.item && (
                      <div className="p-2 rounded border border-amber-400/40 bg-amber-400/5">
                        <p className="text-amber-400 font-display">{searchResult.item.name}</p>
                        <p className="text-ink-dim text-[10px]">{searchResult.item.description || ''}</p>
                      </div>
                    )}
                    {searchResult.trapImmune && (
                      <div className="p-2 rounded border border-green-400/40 bg-green-400/5">
                        <p className="text-green-400">
                          {searchResult.trapResistType === 'immune' ? 'Trap triggered — but you\'re immune!' : 'Trap triggered — resisted!'}
                        </p>
                      </div>
                    )}
                    {searchResult.condition && (
                      <div className="p-2 rounded border border-red-400/40 bg-red-400/5">
                        <p className="text-red-400">
                          {searchResult.agiSaved ? 'Trap dodged!' :
                           searchResult.condition + '! -' + (searchResult.trapDamage || 0) + ' HP'}
                        </p>
                      </div>
                    )}
                    {searchResult.enemy && (
                      <div className="p-2 rounded border border-red-400/40 bg-red-400/5">
                        <p className="text-red-400">
                          {searchResult.perSaved ? 'Spotted something — it backs away.' :
                           searchResult.enemy === 'ambush' ? 'AMBUSHED!' :
                           'Something bursts out!'}
                        </p>
                      </div>
                    )}
                    {searchResult.terminal && (
                      <div className="p-2 rounded border border-purple-400/40 bg-purple-400/5">
                        <p className="text-purple-400">A terminal hums beneath the junk...</p>
                      </div>
                    )}
                    {searchResult.narrative.slice(1).map(function(line, i) {
                      return <p key={i} className="text-ink-faint text-xs italic">{line}</p>
                    })}
                  </div>
                  <p className="text-ink-faint text-[9px] mt-1">Tap to continue</p>
                </div>
              )}
            </div>

            {/* East door — pinned right */}
            <div className="w-16 flex justify-center shrink-0">
              {doorMap.E ? renderDoor('E') : <div />}
            </div>
          </div>

          {/* South door — pinned to bottom */}
          <div className="flex justify-center py-1">
            {doorMap.S ? renderDoor('S') : <div className="h-12" />}
          </div>
        </div>

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
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">{chamberNow.label}</span>
          <span className="text-gold text-xs font-sans">{playerGold}g</span>
        </div>

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
            <p className="text-ink text-sm">XP: <span className="text-gold font-display text-xl">{totalXp}</span></p>
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
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Stats overlay (read-only during combat) */}
        {showCharPanel && (function() {
          var mod = function(v) { var m = Math.floor(((v || 10) - 10) / 2); return m >= 0 ? '+' + m : '' + m }
          var statRows = [
            { id: 'str', label: 'STR' }, { id: 'def', label: 'DEF' }, { id: 'agi', label: 'AGI' },
            { id: 'vit', label: 'VIT' }, { id: 'int', label: 'INT' }, { id: 'lck', label: 'LCK' },
            { id: 'per', label: 'PER' }, { id: 'end', label: 'END' }, { id: 'wis', label: 'WIS' }, { id: 'cha', label: 'CHA' },
          ]
          return (
            <div className="fixed inset-0 z-50 bg-bg/90 flex flex-col items-center justify-center p-4" onClick={function() { setShowCharPanel(false) }}>
              <div className="bg-surface border border-border rounded-lg p-4 max-w-xs w-full" onClick={function(e) { e.stopPropagation() }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-base text-gold">{character.name}</span>
                  <button onClick={function() { setShowCharPanel(false) }} className="text-ink-dim text-xs border border-border px-2 py-1 rounded">Close</button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3 text-xs font-sans">
                  <div><span className="text-ink-dim">HP:</span> <span className="text-ink">{playerHp}/{character.maxHp}</span></div>
                  <div><span className="text-ink-dim">Gold:</span> <span className="text-gold">{playerGold}</span></div>
                  <div><span className="text-ink-dim">XP:</span> <span className="text-ink">{totalXp}</span></div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {statRows.map(function(s) {
                    var val = character.stats[s.id] || 0
                    return (
                      <div key={s.id} className="flex flex-col items-center p-1.5 rounded bg-raised border border-border">
                        <span className="text-ink-faint text-[9px] uppercase">{s.label}</span>
                        <span className="text-ink font-display text-sm">{val}</span>
                        <span className="text-ink-dim text-[9px]">{mod(val)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col items-start">
            <span className="text-ink-faint text-[9px] font-sans">{zone.floorName} — {zone.zoneName}</span>
            <span className="text-ink-dim text-xs uppercase tracking-widest">{combatChamber.label} -- Round {battle.round}</span>
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
                        <div className="flex gap-2 text-[10px] font-sans text-ink-dim">
                          <span>STR {enemy.stats.str}</span>
                          <span>DEF {enemy.stats.def}</span>
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
              {enemyResult && (
                <p className="text-red-400 text-lg font-display">{enemyResult.attacker}</p>
              )}
              <p className="text-ink text-sm italic">prepares to strike...</p>
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
                  var isThrowable = item.effect === 'damage_all_enemies' || item.effect === 'condition_all_enemies' || item.effect === 'damage_and_condition_all'
                  if (isThrowable) return null // throwables go in the other list
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
                  var isThrowable = item.effect === 'damage_all_enemies' || item.effect === 'condition_all_enemies' || item.effect === 'damage_and_condition_all'
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
            <div className="p-4 border-2 border-red-500/40 rounded-lg bg-red-500/10 text-center">
              <p className="text-red-400 text-xl font-display animate-pulse">Turn Lost!</p>
              <div className="mt-2 space-y-1">
                {combatLog.slice(-3).map(function(entry, i) {
                  return <p key={i} className="text-ink text-sm">{entry.text}</p>
                })}
              </div>
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
              var isThrow = it.effect === 'damage_all_enemies' || it.effect === 'condition_all_enemies' || it.effect === 'damage_and_condition_all'
              return !isThrow
            })
            var hasThrowables = playerInventory.some(function(it) {
              if (it.type !== 'consumable') return false
              return it.effect === 'damage_all_enemies' || it.effect === 'condition_all_enemies' || it.effect === 'damage_and_condition_all'
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
        </div>

        {/* Party bar */}
        {renderPartyBar()}
      </div>
    )
  }

  return null

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
              <div className="flex items-center gap-1">
                <button onClick={function() { setShowCharPanel(!showCharPanel); if (!showCharPanel) { setShowInventoryPanel(false); setCombatItemPhase(null) } }}
                  className={'text-[9px] font-sans px-1.5 py-0.5 rounded border transition-colors ' +
                    (showCharPanel ? 'border-blue text-blue' : 'border-border text-ink-dim hover:text-ink')}>
                  Stats
                </button>
                <button onClick={function() { setShowInventoryPanel(!showInventoryPanel); if (!showInventoryPanel) { setShowCharPanel(false); setCombatItemPhase(null) } }}
                  className={'text-[9px] font-sans px-1.5 py-0.5 rounded border transition-colors ' +
                    (showInventoryPanel ? 'border-emerald-400 text-emerald-400' : 'border-border text-ink-dim hover:text-ink')}>
                  Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Game
