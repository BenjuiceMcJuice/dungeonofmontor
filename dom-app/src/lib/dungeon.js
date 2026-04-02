// Dungeon grid generation — data-driven, supports multiple floors and zones
// Data loaded from JSON — see src/data/zones.json for floor and zone definitions

import { generateCombatEnemies, generateBoss } from './enemies.js'
import { getMerchantItems } from './loot.js'
import { generateJunkPiles, placeTerminal, placeTreasure } from './junkpiles.js'
import zoneData from '../data/zones.json'

var FLOORS = zoneData.floors
var ZONES = zoneData.zones

// ============================================================
// MAZE GENERATION
// ============================================================

var DIRS = [
  { key: 'N', dr: -1, dc: 0, opposite: 'S' },
  { key: 'S', dr: 1,  dc: 0, opposite: 'N' },
  { key: 'E', dr: 0,  dc: 1, opposite: 'W' },
  { key: 'W', dr: 0,  dc: -1, opposite: 'E' },
]

function shuffle(arr) {
  var a = arr.slice()
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

function generateMaze() {
  var SIZE = 4
  var visited = {}
  var doors = {}

  for (var i = 0; i < SIZE * SIZE; i++) {
    doors[i] = { N: false, S: false, E: false, W: false }
  }

  function idx(r, c) { return r * SIZE + c }

  function dfs(r, c) {
    visited[idx(r, c)] = true
    var shuffled = shuffle(DIRS)
    for (var d = 0; d < shuffled.length; d++) {
      var dir = shuffled[d]
      var nr = r + dir.dr
      var nc = c + dir.dc
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !visited[idx(nr, nc)]) {
        doors[idx(r, c)][dir.key] = true
        doors[idx(nr, nc)][dir.opposite] = true
        dfs(nr, nc)
      }
    }
  }

  dfs(0, 0)

  // Extra random doors for loops
  var extraDoors = 3 + Math.floor(Math.random() * 3)
  var attempts = 0
  while (extraDoors > 0 && attempts < 50) {
    attempts++
    var r = Math.floor(Math.random() * SIZE)
    var c = Math.floor(Math.random() * SIZE)
    var dir = DIRS[Math.floor(Math.random() * DIRS.length)]
    var nr = r + dir.dr
    var nc = c + dir.dc
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !doors[idx(r, c)][dir.key]) {
      doors[idx(r, c)][dir.key] = true
      doors[idx(nr, nc)][dir.opposite] = true
      extraDoors--
    }
  }

  return doors
}

// ============================================================
// ZONE GENERATION — generic, works for any zone definition
// ============================================================

function generateZone(zoneId, options) {
  var zoneDef = ZONES[zoneId]
  if (!zoneDef) return null

  var floorDef = FLOORS[zoneDef.floorId]
  var templates = zoneDef.templates.slice()
  var hasStairwell = options && options.hasStairwell
  var isFirstZone = options && options.isFirstZone

  // Pull out fixed-position templates
  var entry = null
  var descent = null
  var boss = null
  var rest = []

  for (var i = 0; i < templates.length; i++) {
    var t = templates[i]
    if (t.type === 'stairwell_entry') { entry = t }
    else if (t.type === 'stairwell_descent') { descent = t }
    else if (t.type === 'boss') { boss = t }
    else { rest.push(t) }
  }

  // Shuffle non-fixed templates
  rest = shuffle(rest)

  // Build 16-chamber array
  var chambers = new Array(16)

  // Entry at 0 (if first zone)
  if (entry) {
    chambers[0] = entry
  } else {
    chambers[0] = rest.shift() || { type: 'stairwell_entry', label: 'Entrance', safe: true, icon: '▽' }
  }

  // Boss + stairwell at end (if this zone has it)
  if (descent && boss) {
    chambers[14] = boss
    chambers[15] = descent
  } else {
    // Fill 14 and 15 from rest
    chambers[14] = rest.pop() || chambers[0]
    chambers[15] = rest.pop() || chambers[0]
  }

  // Fill remaining slots
  var slot = 1
  for (var j = 0; j < rest.length && slot < 16; j++) {
    while (slot < 16 && chambers[slot] !== undefined) slot++
    if (slot < 16) chambers[slot] = rest[j]
    slot++
  }

  // Generate maze doors
  var doors = generateMaze()

  // Build the zone state
  var zone = {
    floorId: zoneDef.floorId,
    floorName: floorDef ? floorDef.name : zoneDef.floorId,
    zoneId: zoneDef.id,
    zoneName: zoneDef.name,
    doorTheme: zoneDef.doorTheme || 'dungeon',
    gridSize: 4,
    chambers: [],
    playerPosition: 0,
    keystonePressed: false,
    stairwellUnlocked: false,
    hasStairwell: !!hasStairwell,
    zoneDoorUnlocked: false,
  }

  for (var k = 0; k < 16; k++) {
    var template = chambers[k]
    // Encounter level scales with distance from entry (manhattan distance)
    var row = Math.floor(k / 4)
    var col = k % 4
    var dist = row + col
    var encLevel = dist <= 2 ? 1 : dist <= 4 ? 2 : 3

    zone.chambers.push({
      id: k,
      row: row,
      col: col,
      type: template.type,
      label: template.label,
      icon: template.icon,
      safe: template.safe,
      doors: doors[k],
      visited: k === 0,
      cleared: k === 0,
      revealed: k === 0,
      breadcrumbed: false,
      lootClaimed: false,
      enemies: null,
      encounterLevel: encLevel,
      corpses: null,
      npc: null,
      junkPiles: generateJunkPiles({ type: template.type }, zoneDef.floorId),
      hasTerminal: false,
    })
  }

  // Place one terminal per zone (hidden in a medium/large pile)
  placeTerminal(zone.chambers)

  // Place floor treasure in a junk pile (if not already collected)
  placeTreasure(zone.chambers, zoneDef.floorId, options.collectedTreasures || [])

  return zone
}

// Convenience: generate Garden zone (backwards compat)
function generateGardenZone() {
  return generateZone('montors_garden', { hasStairwell: true, isFirstZone: true })
}

// ============================================================
// FLOOR GENERATION — creates all zones for a floor
// ============================================================

function generateFloor(floorId, collectedTreasures) {
  var floorDef = FLOORS[floorId]
  if (!floorDef) return null

  var zoneIds = floorDef.zones
  // Every zone now has stairwell + boss (self-contained)
  var zones = []
  for (var i = 0; i < zoneIds.length; i++) {
    var zone = generateZone(zoneIds[i], {
      hasStairwell: true,
      isFirstZone: i === 0,
      collectedTreasures: collectedTreasures || [],
    })
    if (zone) zones.push(zone)
  }

  return {
    floorId: floorDef.id,
    floorName: floorDef.name,
    order: floorDef.order,
    transitionText: floorDef.transitionText,
    montorLine: floorDef.montorLine,
    zones: zones,
    currentZoneIndex: 0,
    stairwellZoneIndex: stairwellZoneIndex,
  }
}

// ============================================================
// CHAMBER CONTENT GENERATION
// ============================================================

function generateChamberContent(chamber, difficulty, zoneDef) {
  if (chamber.cleared) return null

  var content = { type: chamber.type }
  var zd = zoneDef || ZONES.montors_garden
  var pool = zd.encounterPools || {}

  if (chamber.type === 'combat_standard') {
    var encLevel = chamber.encounterLevel || 1
    content.enemies = generateCombatEnemies(difficulty, encLevel, pool)
    content.description = 'Creatures stir ahead.'
  } else if (chamber.type === 'combat_elite') {
    content.enemies = generateCombatEnemies(difficulty, Math.max(2, chamber.encounterLevel || 2), pool)
    content.description = 'Something dangerous lurks here. The air feels wrong.'
  } else if (chamber.type === 'mini_boss') {
    content.enemies = generateCombatEnemies(difficulty, 3, pool)
    content.description = 'A hulking shape blocks the path. It has been waiting.'
    content.dropsZoneKey = true  // mini boss can drop zone door key
  } else if (chamber.type === 'boss') {
    // Zone boss — guards the stairwell. Uses zone-specific type/tier.
    var bossEnemy = generateBoss(difficulty, zd.bossType || 'orc', zd.bossTier || 'slate', zd.bossName || 'Guardian')
    content.enemies = [bossEnemy]
    content.description = 'A powerful creature guards the way deeper. It will not let you pass.'
    content.isBoss = true
  } else if (chamber.type === 'keystone') {
    content.description = 'A stone pedestal rises from the ground. A carved slot awaits a heavy hand.'
  } else if (chamber.type === 'zone_door') {
    content.description = 'A heavy door, locked and cold. Something lies beyond.'
  } else if (chamber.type === 'rest') {
    content.hpRecovery = 0.35
    content.description = 'A sheltered space. The air is still.'
  } else if (chamber.type === 'merchant') {
    content.items = getMerchantItems(zd.floorId)
    content.description = 'A hooded figure sits cross-legged beside a threadbare mat of wares.'
  } else if (chamber.type === 'empty') {
    content.description = 'A quiet space. Piles of junk litter the floor.'
  } else if (chamber.type === 'quest_npc') {
    content.description = 'A figure leans against the wall. They raise a hand weakly.'
    content.npcName = 'Wounded Traveller'
    content.reward = { gold: 10 }
  } else if (chamber.type === 'event') {
    content.description = 'The air thickens. You feel watched.'
  } else if (chamber.type === 'stairwell_entry') {
    content.description = 'The way you came in. There is no going back.'
  } else if (chamber.type === 'stairwell_descent') {
    content.description = 'Stone steps spiral downward into darkness. The way deeper.'
    content.isExit = true
  }

  return content
}

// --- Navigation helpers ---

function getAdjacentChambers(zone, chamberIndex) {
  var chamber = zone.chambers[chamberIndex]
  var adjacent = []
  if (chamber.doors.N) adjacent.push(chamberIndex - 4)
  if (chamber.doors.S) adjacent.push(chamberIndex + 4)
  if (chamber.doors.E) adjacent.push(chamberIndex + 1)
  if (chamber.doors.W) adjacent.push(chamberIndex - 1)
  return adjacent
}

function getDoorDirection(fromIndex, toIndex) {
  var diff = toIndex - fromIndex
  if (diff === -4) return 'N'
  if (diff === 4) return 'S'
  if (diff === 1) return 'E'
  if (diff === -1) return 'W'
  return null
}

// --- Exports ---

export {
  FLOORS,
  ZONES,
  generateZone,
  generateGardenZone,
  generateFloor,
  generateChamberContent,
  getAdjacentChambers,
  getDoorDirection,
  shuffle,
  DIRS,
}
