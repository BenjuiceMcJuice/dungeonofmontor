// Dungeon grid generation
// Each zone is a 4x4 grid of 16 chambers connected by a maze algorithm.
// All 16 chambers are always reachable. Doors generated randomly but fully connected.

import { generateCombatEnemies, generateBoss } from './enemies.js'
import { getMerchantItems, generateChestLoot } from './loot.js'

// --- Chamber template pool for Montor's Garden (Floor 0) ---

var GARDEN_TEMPLATES = [
  { type: 'stairwell_entry', label: 'Entrance',           safe: true,  icon: '▽' },
  { type: 'rest',            label: 'Ruined Gazebo',       safe: true,  icon: '△' },
  { type: 'combat_standard', label: 'Overgrown Path',      safe: false, icon: '⚔' },
  { type: 'combat_standard', label: 'Tangled Clearing',    safe: false, icon: '⚔' },
  { type: 'combat_standard', label: 'Broken Fountain',     safe: false, icon: '⚔' },
  { type: 'combat_standard', label: 'Hedge Corridor',      safe: false, icon: '⚔' },
  { type: 'combat_standard', label: 'Crumbling Wall',      safe: false, icon: '⚔' },
  { type: 'combat_elite',    label: 'Thorn Thicket',       safe: false, icon: '⚔' },
  { type: 'mini_boss',       label: 'Topiary Guardian',    safe: false, icon: '☠' },
  { type: 'merchant',        label: 'Wandering Vendor',    safe: true,  icon: '⚒' },
  { type: 'quest_npc',       label: 'Wounded Traveller',   safe: true,  icon: '?' },
  { type: 'trap',            label: 'Overgrown Tripwires', safe: false, icon: '!' },
  { type: 'loot',            label: 'Hidden Cache',        safe: true,  icon: '◆' },
  { type: 'event',           label: 'Strange Presence',    safe: true,  icon: '✦' },
  { type: 'hidden',          label: 'Behind the Foliage',  safe: true,  icon: '◇' },
  { type: 'stairwell_descent', label: 'Stairwell Down',    safe: true,  icon: '▼' },
]

// --- Maze generation (randomised DFS — all 16 cells reachable) ---

// Directions: N, S, E, W with row/col deltas
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

// Generate a perfect maze on a 4x4 grid using randomised DFS
// Returns doors object per cell index: { 0: { N: false, S: true, E: true, W: false }, ... }
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

  // Add a few extra random doors for loops (makes navigation less frustrating)
  var extraDoors = 3 + Math.floor(Math.random() * 3) // 3-5 extra connections
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

// --- Zone generation ---

// Place stairwell_entry at a fixed position (top-left corner, index 0)
// Place stairwell_descent at a fixed position (bottom-right corner, index 15)
// Shuffle the remaining 14 templates into the remaining 14 slots
function generateGardenZone() {
  var templates = GARDEN_TEMPLATES.slice()

  // Pull out entry and descent
  var entry = null
  var descent = null
  var rest = []
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].type === 'stairwell_entry') entry = templates[i]
    else if (templates[i].type === 'stairwell_descent') descent = templates[i]
    else rest.push(templates[i])
  }

  // Shuffle the middle 14
  rest = shuffle(rest)

  // Build chamber array: entry at 0, descent at 15, rest shuffled into 1-14
  var chambers = new Array(16)
  chambers[0] = entry
  chambers[15] = descent
  for (var j = 0; j < rest.length; j++) {
    chambers[j + 1] = rest[j]
  }

  // Generate maze doors
  var doors = generateMaze()

  // Build the zone state
  var zone = {
    floorId: 'grounds',
    floorName: 'The Grounds',
    zoneId: 'montors_garden',
    zoneName: "Montor's Garden",
    gridSize: 4,
    chambers: [],
    playerPosition: 0,
  }

  for (var k = 0; k < 16; k++) {
    var template = chambers[k]
    zone.chambers.push({
      id: k,
      row: Math.floor(k / 4),
      col: k % 4,
      type: template.type,
      label: template.label,
      icon: template.icon,
      safe: template.safe,
      doors: doors[k],
      visited: k === 0,       // entry is visited from the start
      cleared: k === 0,       // entry is cleared from the start
      revealed: k === 0,      // for future fog of war — only entry revealed
      breadcrumbed: false,     // for future stale loaf mechanic
      lootClaimed: false,
      enemies: null,           // generated on chamber entry
      encounterLevel: null,
    })
  }

  return zone
}

// --- Chamber content generation (called when player enters a chamber) ---

function generateChamberContent(chamber, difficulty) {
  if (chamber.cleared) return null

  var content = { type: chamber.type }

  if (chamber.type === 'combat_standard') {
    content.enemies = generateCombatEnemies(difficulty, 1)
    content.description = 'Creatures stir in the undergrowth ahead.'
  } else if (chamber.type === 'combat_elite') {
    content.enemies = generateCombatEnemies(difficulty, 2)
    content.description = 'Something dangerous lurks here. The air feels wrong.'
  } else if (chamber.type === 'mini_boss') {
    content.enemies = generateCombatEnemies(difficulty, 3)
    content.description = 'A hulking shape blocks the path. It has been waiting.'
  } else if (chamber.type === 'rest') {
    content.hpRecovery = 0.25 // 25% of max HP restored
    content.description = 'A crumbling gazebo offers shelter. The air is still.'
  } else if (chamber.type === 'merchant') {
    content.items = getMerchantItems()
    content.description = 'A hooded figure sits cross-legged beside a threadbare mat of wares.'
  } else if (chamber.type === 'loot') {
    var chestLoot = generateChestLoot(10)
    content.gold = chestLoot.gold
    content.item = chestLoot.item
    content.description = 'A rotting chest sits half-buried in the soil.'
  } else if (chamber.type === 'trap') {
    content.damage = 3 + Math.floor(Math.random() * 5) // 3-7 damage
    content.description = 'The ground shifts underfoot. Something clicks.'
  } else if (chamber.type === 'quest_npc') {
    content.description = 'A wounded figure leans against a moss-covered wall. They raise a hand weakly.'
    content.npcName = 'Wounded Traveller'
    content.reward = { gold: 10 }
  } else if (chamber.type === 'event') {
    content.description = 'The air thickens. You feel watched. The garden itself seems to breathe.'
  } else if (chamber.type === 'hidden') {
    var hiddenLoot = generateChestLoot(10)
    content.gold = hiddenLoot.gold + 5 // hidden always gives a bit extra
    content.item = hiddenLoot.item
    content.description = 'Behind the foliage, a narrow gap reveals a forgotten alcove.'
  } else if (chamber.type === 'stairwell_entry') {
    content.description = 'The entrance to the garden. Overgrown walls rise on all sides. There is no going back.'
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

export {
  GARDEN_TEMPLATES,
  generateGardenZone,
  generateChamberContent,
  getAdjacentChambers,
  getDoorDirection,
  DIRS,
}
