import { useState, useEffect, useRef } from 'react'
import { getModifier } from '../lib/classes.js'
import { d20Attack, d20Flee } from '../lib/dice.js'
import { generateGardenZone, generateFloor, generateChamberContent, getAdjacentChambers, getDoorDirection, ZONES, FLOORS } from '../lib/dungeon.js'
import { db } from '../lib/firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { generateCombatLoot, generateChestLoot, getMerchantItems, getItem, applyConsumable } from '../lib/loot.js'
import { createBattleState, getCurrentTurnId, getActor, tickTurnStart, resolvePlayerAttack, resolveEnemyAttack, advanceTurn, checkBattleEnd, calculateXp } from '../lib/combat.js'
import { isFleeBlocked, areItemsBlocked } from '../lib/conditions.js'
import SpriteRenderer from '../components/SpriteRenderer.jsx'
import PlayerSprite from '../components/PlayerSprite.jsx'
import CombatRoller from '../components/CombatRoller.jsx'
import ChamberView from '../components/ChamberView.jsx'
import DoorSprite from '../components/DoorSprite.jsx'
import ChamberIcon from '../components/ChamberIcon.jsx'

var MAX_LOG_ENTRIES = 6

// Direction labels
var DIR_LABELS = { N: 'North', S: 'South', E: 'East', W: 'West' }

// Montor whispers — random flavour text between rooms
// Stage 1: scripted pool. Stage 4: AI-generated based on mood/state.
var MONTOR_WHISPERS = [
  "You're still here? Interesting.",
  "The walls remember your footsteps.",
  "I can smell your fear. It's... adequate.",
  "Every door you open was already open. I left them that way.",
  "The garden grows tired of you.",
  "Take your time. I have forever.",
  "That last fight was disappointing. I expected more.",
  "You remind me of someone. They didn't make it either.",
  "The deeper you go, the more I see.",
  "Your gold won't help you where you're headed.",
  "I wonder — do you loot because you need to, or because you can't help yourself?",
  "The rats speak of you. Not kindly.",
  "Something watches from the hedgerows. Not me. Something else.",
  "You're braver than you look. That's not a compliment.",
  "Keep going. I'm curious how far you'll get.",
  "The flowers lean toward you. That's not a good sign.",
  "I could close these doors any time. Remember that.",
  "Your heartbeat echoes through my garden. It's... rhythmic.",
  "The last adventurer made it further than this. Just saying.",
  "Don't trust the merchant. Actually, don't trust anyone.",
  null, null, null, null, null, null, null, null, null, null,
  null, null, null, null, null,
]

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

  // XP thresholds for in-run levelling
  var XP_THRESHOLDS = [
    { xp: 50,  hpGain: 5, statPick: false },
    { xp: 120, hpGain: 0, statPick: true },
    { xp: 250, hpGain: 5, statPick: true },
    { xp: 400, hpGain: 0, statPick: true },
  ]

  function checkLevelUp(newXp) {
    if (runLevel >= XP_THRESHOLDS.length) return false
    var threshold = XP_THRESHOLDS[runLevel]
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

  // --- Debug helpers (call from browser console: window.domDebug.xxx()) ---
  useEffect(function() {
    window.domDebug = {
      giveItems: function() {
        var debugItems = [
          { id: 'health_potion', name: 'Health Potion', type: 'consumable', rarity: 'common', effect: 'heal', effectValue: 15, buyPrice: 10, sellPrice: 4, description: 'Tastes foul. Works fast.' },
          { id: 'health_potion', name: 'Health Potion', type: 'consumable', rarity: 'common', effect: 'heal', effectValue: 15, buyPrice: 10, sellPrice: 4, description: 'Tastes foul. Works fast.' },
          { id: 'rage_draught', name: 'Rage Draught', type: 'consumable', rarity: 'uncommon', effect: 'stat_buff', effectStat: 'str', effectValue: 4, effectDuration: 3, buyPrice: 18, sellPrice: 7, description: 'Thick, red, tastes of iron.' },
          { id: 'smoke_bomb', name: 'Smoke Bomb', type: 'consumable', rarity: 'common', effect: 'flee_guaranteed', effectValue: 1, buyPrice: 12, sellPrice: 5, description: 'Crack it. Run.' },
          { id: 'dagger_common', name: 'Dagger', type: 'weapon', slot: 'weapon', rarity: 'common', damageDie: 4, attackStat: 'str', buyPrice: 8, sellPrice: 3, description: 'Quick and light.' },
          { id: 'shortsword_common', name: 'Shortsword', type: 'weapon', slot: 'weapon', rarity: 'common', damageDie: 6, attackStat: 'str', buyPrice: 15, sellPrice: 6, description: 'A reliable blade.' },
          { id: 'leather_common', name: 'Leather Armour', type: 'armour', slot: 'armour', rarity: 'common', defBonus: 2, agiPenalty: 0, buyPrice: 12, sellPrice: 5, description: 'Supple hide.' },
          { id: 'ring_of_vitality', name: 'Ring of Vitality', type: 'relic', slot: 'relic', rarity: 'uncommon', passiveEffect: 'hp_bonus', passiveValue: 5, buyPrice: 35, sellPrice: 14, description: 'A warm band of copper.' },
          { id: 'lucky_coin', name: 'Lucky Coin', type: 'relic', slot: 'relic', rarity: 'uncommon', passiveEffect: 'lck_bonus', passiveValue: 2, buyPrice: 30, sellPrice: 12, description: 'Heads you win.' },
        ]
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
  var godModeRef = useRef(false)
  var [lootingCorpseId, setLootingCorpseId] = useState(null)
  var [lootingChestId, setLootingChestId] = useState(null)
  var [lootingNpcId, setLootingNpcId] = useState(null)
  var [montorWhisper, setMontorWhisper] = useState(null)
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
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
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

    // Montor whisper — random chance on entering a new room
    var whisper = MONTOR_WHISPERS[Math.floor(Math.random() * MONTOR_WHISPERS.length)]
    setMontorWhisper(whisper)
    if (whisper) {
      setTimeout(function() { setMontorWhisper(null) }, 4000)
    }

    var chamber = newZone.chambers[targetId]

    // If already cleared, just show doors again (backtracking)
    if (chamber.cleared) {
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
    setGamePhase('floor_transition')
  }

  // --- Floor transition: move to next floor or victory ---
  function handleFloorTransitionContinue() {
    // Determine next floor
    var floorOrder = ['grounds', 'underground']  // expand as floors are added
    var currentIdx = floorOrder.indexOf(floor.floorId)
    var nextFloorId = floorOrder[currentIdx + 1]

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
    setGamePhase('safe_room')
  }

  // --- Safe room: Montor's audience chamber ---
  function handleSafeRoomContinue() {
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
      var price = data.buyPrice || data.cost || 0
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
        setTimeout(function() { setGamePhase('defeat') }, 500)
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
    setCombatPhase(firstActor && firstActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
  }

  // === ENEMY TURN ===
  useEffect(function() {
    if (combatPhase !== 'enemyWindup' || !battle || gamePhase !== 'combat') return
    var currentId = getCurrentTurnId(battle)

    // Tick conditions on enemy's turn start
    var tickResult = tickTurnStart(battle, currentId)
    var tickedBattle = tickResult.newBattle
    if (tickResult.damage > 0) {
      addLog({ type: 'condition', text: tickResult.narrative, tier: 'glancing' })
    }
    if (tickResult.died) {
      setBattle(tickedBattle)
      var endCheck = checkBattleEnd(tickedBattle)
      if (endCheck === 'victory') {
        var xpGained = calculateXp(tickedBattle)
        var newXp = totalXp + xpGained
        setTotalXp(newXp)
        checkLevelUp(newXp)
        setCombatPhase('victory')
        return
      }
      // Enemy died from conditions — skip their turn
      var nextB = advanceTurn(tickedBattle)
      setBattle(nextB)
      var nextA = getActor(nextB, getCurrentTurnId(nextB))
      setCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
      return
    }
    if (tickResult.skipped) {
      addLog({ type: 'condition', text: tickResult.narrative, tier: 'miss' })
      var nextB2 = advanceTurn(tickedBattle)
      setBattle(nextB2)
      var nextA2 = getActor(nextB2, getCurrentTurnId(nextB2))
      setCombatPhase(nextA2 && nextA2.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
      return
    }

    var attackOut = resolveEnemyAttack(tickedBattle, currentId)
    if (attackOut) {
      setEnemyAttackInfo({ attackOut: attackOut })
      setEnemyRollerKey(function(k) { return k + 1 })
    }
    var timeout = setTimeout(function() { setCombatPhase('enemyRolling') }, 800)
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
    addLog({ type: 'enemy', text: logEntry.text, tier: logEntry.tier })

    // Log condition applied
    if (r.conditionApplied) {
      addLog({ type: 'condition', text: r.target + ' is now ' + r.conditionApplied + '!', tier: 'hit' })
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
      setGamePhase('defeat')
      return
    }

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)
    setEnemyAttackInfo(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
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
    if (tickResult.damage > 0 || tickResult.narrative) {
      addLog({ type: 'condition', text: tickResult.narrative, tier: 'glancing' })
    }
    setBattle(tickResult.newBattle)
    setPlayerHp(tickResult.newBattle.players[playerUid].currentHp)

    if (tickResult.died) {
      setPlayerHp(0)
      setGamePhase('defeat')
      return
    }
    if (tickResult.skipped) {
      var nextB = advanceTurn(tickResult.newBattle)
      setBattle(nextB)
      var nextA = getActor(nextB, getCurrentTurnId(nextB))
      setCombatPhase(nextA && nextA.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
      setPlayerConditionTicked(false)
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
  var currentTurnId = battle ? getCurrentTurnId(battle) : null
  var isPlayerTurn = currentTurnId === user.uid && combatPhase === 'playerTurn'
  var activeEnemyId = enemyAttackInfo ? enemyAttackInfo.attackOut.result.attackerId : null

  function handlePlayerAttackRoll() {
    var rollResult = d20Attack(strMod, 20)
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
    if (!pendingAttackResult) return
    var attackOut = pendingAttackResult
    var r = attackOut.result
    var logEntry = formatAttackLog(r, 'player')
    addLog({ type: 'player', text: logEntry.text, tier: logEntry.tier })
    if (r.conditionApplied) {
      addLog({ type: 'condition', text: r.target + ' is now ' + r.conditionApplied + '!', tier: 'hit' })
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
      setCombatPhase('victory')
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

    var nextBattle = advanceTurn(updatedBattle)
    setBattle(nextBattle)

    // Keep target if still alive, otherwise clear
    var targetStillAlive = updatedBattle.enemies.some(function(e) { return e.id === selectedTarget && !e.isDown })
    if (!targetStillAlive) setSelectedTarget(null)

    var nextActor = getActor(nextBattle, getCurrentTurnId(nextBattle))
    setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
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
      setGamePhase('defeat')
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
    setGamePhase('flee_result')
  }

  function handleFleeResultContinue() {
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
      setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
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
      setCombatPhase(nextActor && nextActor.type === 'enemy' ? 'enemyWindup' : 'playerTurn')
    }
  }

  // === EQUIP ITEM (out of combat) ===
  function handleEquipItem(itemIndex) {
    var item = playerInventory[itemIndex]
    if (!item) return

    var newEquipped = Object.assign({}, character.equipped)
    var returnItem = null

    if (item.type === 'weapon' && item.slot === 'weapon') {
      returnItem = newEquipped.weapon
      newEquipped.weapon = item
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

    // Remove equipped item from inventory, add old item back
    setPlayerInventory(function(prev) {
      var next = prev.slice()
      next.splice(itemIndex, 1)
      if (returnItem) next.push(returnItem)
      return next
    })
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
    // Generate corpses with loot (gold + items array)
    var encounterLevel = chamberContent ? (chamberContent.type === 'combat_elite' ? 2 : chamberContent.type === 'mini_boss' ? 3 : 1) : 1
    var lckStat = character.stats.lck || 10
    var corpses = battle.enemies.filter(function(e) { return e.isDown }).map(function(e) {
      var currentFloorId = zone ? zone.floorId : 'grounds'
      var loot = generateCombatLoot(encounterLevel, lckStat, currentFloorId)
      // Build items array — stronger enemies can drop multiple items
      var items = []
      if (loot.item) items.push(loot.item)
      // Elite/boss: extra roll for a second item
      if (encounterLevel >= 2) {
        var loot2 = generateCombatLoot(encounterLevel, lckStat, currentFloorId)
        if (loot2.item) items.push(loot2.item)
      }
      return {
        id: e.id, name: e.name, archetypeKey: e.archetypeKey, tierKey: e.tierKey,
        gold: Math.max(1, loot.gold + Math.round(e.xp * 0.2)),
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

    // Store corpses on the chamber in zone state
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { corpses: corpses })
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
  }

  function handleNpcBuy(item) {
    var price = item.buyPrice || item.cost || 0
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
    // Mark chamber cleared when closing chest
    var newZone = Object.assign({}, zone, {
      chambers: zone.chambers.map(function(ch) {
        if (ch.id === zone.playerPosition) return Object.assign({}, ch, { cleared: true })
        return ch
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
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <p className="text-ink text-lg italic max-w-sm" style={{ fontFamily: "'Sorts Mill Goudy', serif" }}>
          {floor ? floor.transitionText : 'You descend deeper...'}
        </p>
        <button onClick={handleFloorTransitionContinue}
          className="py-3 px-8 rounded-lg bg-surface border border-border text-ink font-sans text-base hover:border-gold transition-colors">
          Continue
        </button>
      </div>
    )
  }

  // --- Safe room (Montor's audience chamber) ---
  if (gamePhase === 'safe_room') {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-8 bg-raised">
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
        <button onClick={handleSafeRoomContinue}
          className="py-3 px-8 rounded-lg bg-gold/20 border border-gold/40 text-gold font-display text-lg hover:border-gold transition-colors">
          Enter {floor ? floor.floorName : 'the depths'}
        </button>
      </div>
    )
  }

  // --- Defeat ---
  if (gamePhase === 'defeat') {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
        <h1 className="font-display text-4xl text-red-400">Defeated</h1>
        <p className="text-ink text-lg italic">Darkness swallows you whole.</p>
        <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
          <p className="text-ink text-sm">Chambers cleared: {chambersCleared}</p>
          <p className="text-ink text-sm mt-1">XP earned: <span className="text-gold">{Math.round(totalXp * 0.5)}</span></p>
        </div>
        <button onClick={function() { writeRunLog('defeat'); onEndRun({ victory: false, chambersCleared: chambersCleared, xp: Math.round(totalXp * 0.5), gold: 0 }) }}
          className="py-3 px-8 rounded-lg bg-surface border border-border text-ink font-sans text-base">
          Return to Tavern
        </button>
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
          <span className="text-ink-dim text-xs uppercase tracking-widest font-sans">
            {currentChamber.label}
          </span>
          <div className="flex items-center gap-3">
            {playerInventory.length > 0 && (
              <button onClick={function() { setShowInventoryPanel(!showInventoryPanel) }}
                className={'text-xs font-sans px-2 py-1 rounded border transition-colors ' +
                  (showInventoryPanel ? 'border-emerald-400 text-emerald-400' : 'border-border text-ink-dim hover:text-ink')}>
                Bag ({playerInventory.length})
              </button>
            )}
            <span className="text-gold text-xs font-sans">{playerGold}g</span>
          </div>
        </div>

        {/* Inventory panel (out of combat) */}
        {showInventoryPanel && (
          <div className="mb-2 p-3 rounded-lg bg-surface border border-border max-h-48 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {playerInventory.map(function(item, idx) {
                var isEquippable = item.type === 'weapon' || item.type === 'armour' || item.type === 'relic'
                var isConsumable = item.type === 'consumable'
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-raised text-sm font-sans">
                    <div className="flex flex-col">
                      <span className="text-ink">{item.name}</span>
                      <span className="text-ink-faint text-[10px]">
                        {item.type === 'weapon' ? 'd' + (item.damageDie || item.die) + ' dmg' :
                         item.type === 'armour' ? '+' + item.defBonus + ' DEF' :
                         item.type === 'relic' ? item.description :
                         item.description || ''}
                      </span>
                    </div>
                    {isEquippable && gamePhase === 'doors' && (
                      <button onClick={function() { handleEquipItem(idx) }}
                        className="text-xs text-gold border border-gold/40 px-2 py-1 rounded hover:border-gold transition-colors">
                        Equip
                      </button>
                    )}
                    {isConsumable && gamePhase === 'doors' && (
                      <button onClick={function() { handleUseItem(idx) }}
                        className="text-xs text-emerald-400 border border-emerald-500/40 px-2 py-1 rounded hover:border-emerald-400 transition-colors">
                        Use
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
                          var price = item.buyPrice || item.cost || 0
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
                          var sellPrice = item.sellPrice || Math.max(1, Math.round((item.buyPrice || 10) * 0.4))
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
                var isFullyLooted = chest.goldTaken && chest.items.length === chest.itemsTaken.length
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
            playerState={{ gold: playerGold, currentHp: playerHp, maxHp: character.maxHp, inventory: playerInventory }}
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
      <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-5 bg-raised">
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

        <button onClick={handleFleeResultContinue}
          className="py-3 px-8 rounded-lg bg-surface border border-border-hl text-ink font-sans text-base">
          {fleeOutcome.fled ? 'Continue' : 'Back to fight'}
        </button>

        {renderPartyBar()}
      </div>
    )
  }

  // --- Combat ---
  if (gamePhase === 'combat') {
    // Combat victory — show doors after
    if (combatPhase === 'victory') {
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-6 bg-raised">
          <h1 className="font-display text-4xl text-gold">Victory</h1>
          <p className="text-ink text-base italic">The chamber falls silent.</p>
          <div className="bg-surface border border-border rounded-lg p-4 w-full max-w-xs">
            <p className="text-ink text-sm">XP: <span className="text-gold font-display text-xl">{totalXp}</span></p>
            <p className="text-ink-dim text-sm mt-1">HP: {playerHp}/{character.maxHp}</p>
          </div>

          {/* Level up! */}
          {pendingLevelUp && (
            <div className="bg-surface border-2 border-gold rounded-lg p-5 w-full max-w-xs">
              <p className="text-gold font-display text-xl mb-2">Level Up!</p>
              {pendingLevelUp.hpGain > 0 && (
                <p className="text-green-400 text-sm mb-2">+{pendingLevelUp.hpGain} max HP</p>
              )}
              {pendingLevelUp.statPick ? (
                <div className="flex flex-col gap-2">
                  <p className="text-ink text-sm mb-1">Choose a stat to increase:</p>
                  {['str', 'def', 'agi', 'wis', 'int'].map(function(stat) {
                    return (
                      <button key={stat}
                        onClick={function() { handleStatPick(stat) }}
                        className="flex items-center justify-between p-2 rounded border border-border-hl bg-raised text-sm font-sans hover:border-gold transition-colors cursor-pointer"
                      >
                        <span className="text-ink uppercase font-semibold">{stat}</span>
                        <span className="text-ink-dim">{character.stats[stat]} → <span className="text-gold">{character.stats[stat] + 1}</span></span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <button onClick={handleLevelUpDismiss}
                  className="py-2 px-6 rounded-lg bg-gold/20 border border-gold/40 text-gold font-sans text-sm">
                  Continue
                </button>
              )}
            </div>
          )}

          {!pendingLevelUp && (
            <button onClick={handleCombatVictoryToDoors}
              className="py-3 px-8 rounded-lg bg-gold text-bg font-sans text-base font-semibold">
              Continue
            </button>
          )}
        </div>
      )
    }

    var enemyResult = enemyAttackInfo ? enemyAttackInfo.attackOut.result : null
    var combatChamber = zone.chambers[zone.playerPosition]

    return (
      <div className="h-full flex flex-col px-3 pt-2 pb-2 bg-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink-dim text-xs uppercase tracking-widest">{combatChamber.label} -- Round {battle.round}</span>
        </div>

        {/* Enemies */}
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {battle.enemies.map(function(enemy) {
            var isTarget = selectedTarget === enemy.id
            var isDead = enemy.isDown
            var isActing = activeEnemyId === enemy.id
            return (
              <button key={enemy.id}
                onClick={function() { if (!isDead && isPlayerTurn) handleSelectTarget(enemy.id) }}
                disabled={isDead || !isPlayerTurn}
                className={
                  'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ' +
                  (isDead ? 'opacity-20 border-transparent' :
                   isActing ? 'border-red-400 bg-red-400/10 scale-105' :
                   isTarget ? 'border-gold bg-gold-glow' :
                   isPlayerTurn ? 'border-border-hl hover:border-ink-faint cursor-pointer' :
                   'border-border')
                }>
                <SpriteRenderer spriteKey={enemy.archetypeKey} tierKey={enemy.tierKey} scale={3} />
                <span className="font-display text-sm text-ink">{enemy.name}</span>
                <div className="w-20 bg-bg rounded-full h-2">
                  <div className="bg-red-500 rounded-full h-2 transition-all duration-300"
                    style={{ width: Math.max(0, (enemy.currentHp / enemy.maxHp) * 100) + '%' }} />
                </div>
                <span className="text-ink text-xs font-sans">{enemy.currentHp}/{enemy.maxHp}</span>
                <div className="flex gap-2 text-[10px] font-sans text-ink-dim">
                  <span>STR {enemy.stats.str}</span>
                  <span>DEF {enemy.stats.def}</span>
                  <span>AGI {enemy.stats.agi}</span>
                </div>
                {enemy.statusEffects && enemy.statusEffects.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-0.5">
                    {enemy.statusEffects.map(function(c, ci) {
                      return <span key={ci} className="text-[8px] font-sans px-1 rounded bg-red-500/20 text-red-300">{c.name} ({c.turnsRemaining || '~'})</span>
                    })}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Combat log */}
        <div ref={logRef} data-scrollable className="bg-surface border border-border rounded-lg p-2 mb-2 max-h-24 overflow-y-auto shrink-0">
          {combatLog.length === 0 && <p className="text-ink-dim text-sm italic">The battle begins...</p>}
          {combatLog.map(function(entry, i) {
            var logColour = 'text-ink-dim'
            if (entry.tier === 'crit') logColour = 'text-crimson'
            else if (entry.tier === 'hit') logColour = 'text-amber-500'
            else if (entry.tier === 'glancing') logColour = 'text-yellow-400/80'
            else if (entry.tier === 'miss') logColour = 'text-ink-faint'
            return <p key={i} className={'text-xs leading-relaxed mb-1 ' + logColour}>{entry.text}</p>
          })}
        </div>

        {/* Action area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">
          {combatPhase === 'enemyWindup' && enemyResult && (
            <div className="flex flex-col items-center gap-2 p-3 border-2 border-red-400/30 rounded-lg bg-red-400/5">
              <p className="text-red-400 text-lg font-display">{enemyResult.attacker}</p>
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

          {isPlayerTurn && showInventoryPanel && (
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <p className="text-ink text-sm font-sans">Choose an item to use:</p>
              <div className="flex flex-col gap-2 w-full">
                {playerInventory.map(function(item, idx) {
                  if (item.type !== 'consumable') return null
                  return (
                    <button key={idx}
                      onClick={function() { handleUseItem(idx) }}
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
              <button onClick={function() { setShowInventoryPanel(false) }}
                className="text-ink-dim text-sm hover:text-ink transition-colors">
                Cancel
              </button>
            </div>
          )}

          {isPlayerTurn && !showInventoryPanel && !selectedTarget && (
            <div className="p-4 border-2 border-gold/40 rounded-lg bg-gold-glow text-center">
              <p className="text-gold text-lg font-display">Your Turn</p>
              <p className="text-ink text-sm">Choose an enemy above to attack</p>
            </div>
          )}

          {isPlayerTurn && !showInventoryPanel && selectedTarget && (function() {
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
                  resolvedDamage={pendingAttackResult ? pendingAttackResult.result.damage : null}
                  damageBreakdown={pendingAttackResult ? pendingAttackResult.result.damageBreakdown : null}
                  attackerName={character.name}
                  targetName={targetEnemy.name}
                />
              </div>
            )
          })()}

          {/* Use Item / Flee — always visible on player turn unless mid-roll or inventory open */}
          {isPlayerTurn && !showInventoryPanel && !pendingAttackResult && (function() {
            var playerEffects = (battle && battle.players[user.uid]) ? battle.players[user.uid].statusEffects : []
            var fleeBlocked = isFleeBlocked(playerEffects)
            var itemsBlocked = areItemsBlocked(playerEffects)
            return (
              <div className="flex gap-3 mt-1">
                {playerInventory.some(function(it) { return it.type === 'consumable' }) && !itemsBlocked && (
                  <button onClick={function() { setShowInventoryPanel(true) }}
                    className="py-2 px-5 rounded-lg bg-surface border border-emerald-500/40 text-emerald-400 font-sans text-sm hover:border-emerald-400 transition-colors">
                    Use Item
                  </button>
                )}
                {itemsBlocked && (
                  <span className="py-2 px-5 text-ink-faint font-sans text-sm italic">Items blocked</span>
                )}
                {!fleeBlocked ? (
                  <button onClick={handleFlee}
                    className="py-2 px-5 rounded-lg bg-surface border border-border-hl text-ink-dim font-sans text-sm hover:text-ink hover:border-ink-faint transition-colors">
                    Flee
                  </button>
                ) : (
                  <span className="py-2 px-5 text-red-400 font-sans text-sm italic">Can't flee</span>
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
    return (
      <div className="shrink-0 bg-surface border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <PlayerSprite classKey="knight" scale={2} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-sm text-ink truncate">{character.name}</span>
                <span className="text-[10px] font-sans text-ink-dim">
                  STR {character.stats.str} DEF {character.stats.def} AGI {character.stats.agi}
                </span>
                {battle && battle.players[user.uid] && battle.players[user.uid].statusEffects.length > 0 && (
                  <div className="flex gap-1">
                    {battle.players[user.uid].statusEffects.map(function(c, ci) {
                      return <span key={ci} className="text-[8px] font-sans px-1 rounded bg-amber-500/20 text-amber-300">{c.name} ({c.turnsRemaining || '~'})</span>
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
            <div className="flex gap-2 mt-1 text-[10px] font-sans text-ink-faint">
              {character.equipped && character.equipped.weapon && (
                <span>{character.equipped.weapon.name} (d{character.equipped.weapon.damageDie || character.equipped.weapon.die})</span>
              )}
              {character.equipped && character.equipped.armour && (
                <span>{character.equipped.armour.name} (+{character.equipped.armour.defBonus})</span>
              )}
              {playerInventory.length > 0 && (
                <span className="text-emerald-400">{playerInventory.length} items</span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Game
