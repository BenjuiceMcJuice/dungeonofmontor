// Dungeon grid generation — data-driven, supports multiple floors and zones
// Each zone is a 4x4 grid of 16 chambers connected by a maze algorithm.
// All 16 chambers are always reachable. Doors generated randomly but fully connected.

import { generateCombatEnemies, generateBoss } from './enemies.js'
import { getMerchantItems, generateChestLoot } from './loot.js'

// ============================================================
// FLOOR & ZONE DEFINITIONS
// ============================================================
// Until migrated to Firestore, all content data lives here.
// Each zone has: 16 chamber templates, enemy roster, boss, theme.

var FLOORS = {
  grounds: {
    id: 'grounds', name: 'The Grounds', order: 0,
    zones: ['montors_garden'],
    transitionText: 'You step through the gates. They close behind you.',
    montorLine: 'Welcome to my garden. Mind the flowers — they bite.',
  },
  underground: {
    id: 'underground', name: 'The Underground', order: -1,
    zones: ['great_hall', 'kitchen'],
    transitionText: 'The stone steps wind downward. The air grows cold and damp.',
    montorLine: 'You made it past the garden. How... persistent. Down here, things are less polite.',
  },
}

var ZONES = {
  montors_garden: {
    id: 'montors_garden', name: "Montor's Garden", floorId: 'grounds',
    doorTheme: 'garden',
    enemyTypes: ['rat', 'slug'], enemyTiers: ['dust'],
    bossType: 'slug', bossTier: 'slate', bossName: 'The Overgrowth',
    encounterPools: {
      1: { types: ['rat', 'slug'], tiers: ['dust'], count: [1, 1] },
      2: { types: ['rat', 'slug', 'rat'], tiers: ['dust'], count: [1, 2] },
      3: { types: ['rat', 'slug'], tiers: ['slate'], count: [1, 1] },
    },
    templates: [
      { type: 'stairwell_entry', label: 'Entrance',           safe: true,  icon: '▽' },
      { type: 'rest',            label: 'Ruined Gazebo',       safe: true,  icon: '△' },
      { type: 'combat_standard', label: 'Overgrown Path',      safe: false, icon: '⚔' },
      { type: 'combat_standard', label: 'Tangled Clearing',    safe: false, icon: '⚔' },
      { type: 'combat_standard', label: 'Broken Fountain',     safe: false, icon: '⚔' },
      { type: 'combat_standard', label: 'Hedge Corridor',      safe: false, icon: '⚔' },
      { type: 'combat_elite',    label: 'Thorn Thicket',       safe: false, icon: '⚔' },
      { type: 'mini_boss',       label: 'Topiary Guardian',    safe: false, icon: '☠' },
      { type: 'keystone',        label: 'Stone Pedestal',      safe: true,  icon: '⚷' },
      { type: 'merchant',        label: 'Wandering Vendor',    safe: true,  icon: '⚒' },
      { type: 'quest_npc',       label: 'Wounded Traveller',   safe: true,  icon: '?' },
      { type: 'trap',            label: 'Overgrown Tripwires', safe: false, icon: '!' },
      { type: 'loot',            label: 'Hidden Cache',        safe: true,  icon: '◆' },
      { type: 'hidden',          label: 'Behind the Foliage',  safe: true,  icon: '◇' },
      { type: 'boss',            label: 'Stairwell Guardian',  safe: false, icon: '☠' },
      { type: 'stairwell_descent', label: 'Stairwell Down',    safe: true,  icon: '▼' },
    ],
  },
  great_hall: {
    id: 'great_hall', name: 'The Great Hall', floorId: 'underground',
    doorTheme: 'dungeon',
    enemyTypes: ['rat', 'orc'], enemyTiers: ['dust', 'slate'],
    bossType: 'orc', bossTier: 'slate', bossName: 'Ironjaw',
    encounterPools: {
      1: { types: ['rat', 'orc'], tiers: ['dust'], count: [1, 2] },
      2: { types: ['rat', 'orc'], tiers: ['dust', 'slate'], count: [2, 3] },
      3: { types: ['orc'], tiers: ['slate'], count: [1, 2] },
    },
    templates: [
      { type: 'stairwell_entry',  label: 'Landing',             safe: true,  icon: '▽' },
      { type: 'rest',             label: 'Alcove',               safe: true,  icon: '△' },
      { type: 'combat_standard',  label: 'Long Table',           safe: false, icon: '⚔' },
      { type: 'combat_standard',  label: 'Collapsed Pillar',     safe: false, icon: '⚔' },
      { type: 'combat_standard',  label: 'Armoury Ruin',         safe: false, icon: '⚔' },
      { type: 'combat_standard',  label: 'Shattered Throne',     safe: false, icon: '⚔' },
      { type: 'combat_elite',     label: 'Guard Post',           safe: false, icon: '⚔' },
      { type: 'mini_boss',        label: 'Warden Chamber',       safe: false, icon: '☠' },
      { type: 'keystone',         label: 'Ancient Lever',        safe: true,  icon: '⚷' },
      { type: 'merchant',         label: 'Scavenger',            safe: true,  icon: '⚒' },
      { type: 'quest_npc',        label: 'Imprisoned Scholar',   safe: true,  icon: '?' },
      { type: 'trap',             label: 'Pressure Plate',       safe: false, icon: '!' },
      { type: 'loot',             label: 'Weapon Rack',          safe: true,  icon: '◆' },
      { type: 'hidden',           label: 'Behind the Tapestry',  safe: true,  icon: '◇' },
      { type: 'zone_door',        label: 'Iron Door',            safe: true,  icon: '▣' },
      { type: 'combat_standard',  label: 'Servants Passage',     safe: false, icon: '⚔' },
    ],
  },
  kitchen: {
    id: 'kitchen', name: 'The Kitchen', floorId: 'underground',
    doorTheme: 'dungeon',
    enemyTypes: ['rat', 'orc', 'slug'], enemyTiers: ['dust', 'slate'],
    bossType: 'orc', bossTier: 'iron', bossName: 'The Kitchen Brute',
    encounterPools: {
      1: { types: ['rat', 'slug'], tiers: ['dust', 'slate'], count: [1, 2] },
      2: { types: ['rat', 'orc', 'slug'], tiers: ['slate'], count: [2, 3] },
      3: { types: ['orc'], tiers: ['slate', 'iron'], count: [1, 2] },
    },
    templates: [
      { type: 'stairwell_entry',  label: 'Side Entrance',        safe: true,  icon: '▽' },
      { type: 'rest',             label: 'Cold Pantry',           safe: true,  icon: '△' },
      { type: 'combat_standard',  label: 'Cauldron Room',         safe: false, icon: '⚔' },
      { type: 'combat_standard',  label: 'Meat Locker',           safe: false, icon: '⚔' },
      { type: 'combat_standard',  label: 'Scullery',              safe: false, icon: '⚔' },
      { type: 'combat_standard',  label: 'Hearth',                safe: false, icon: '⚔' },
      { type: 'combat_elite',     label: 'Head Chef Station',     safe: false, icon: '⚔' },
      { type: 'mini_boss',        label: 'Larder Keeper',         safe: false, icon: '☠' },
      { type: 'keystone',         label: 'Rusty Winch',           safe: true,  icon: '⚷' },
      { type: 'merchant',         label: 'Rat Trader',            safe: true,  icon: '⚒' },
      { type: 'trap',             label: 'Grease Trap',           safe: false, icon: '!' },
      { type: 'trap',             label: 'Scalding Vent',         safe: false, icon: '!' },
      { type: 'loot',             label: 'Provisions Crate',      safe: true,  icon: '◆' },
      { type: 'hidden',           label: 'Behind the Furnace',    safe: true,  icon: '◇' },
      { type: 'zone_door',        label: 'Service Hatch',         safe: true,  icon: '▣' },
      { type: 'combat_standard',  label: 'Drain Grate',           safe: false, icon: '⚔' },
    ],
  },
}

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
    if (t.type === 'stairwell_entry' && isFirstZone) { entry = t }
    else if (t.type === 'stairwell_entry' && !isFirstZone) { rest.push(t) } // non-first zones use entry as a normal room
    else if (t.type === 'stairwell_descent' && hasStairwell) { descent = t }
    else if (t.type === 'stairwell_descent' && !hasStairwell) {
      // Replace stairwell with an extra combat room if this zone doesn't have it
      rest.push({ type: 'combat_standard', label: zoneDef.templates[2].label, safe: false, icon: '⚔' })
    }
    else if (t.type === 'boss' && hasStairwell) { boss = t }
    else if (t.type === 'boss' && !hasStairwell) {
      // Replace boss with extra loot if no stairwell in this zone
      rest.push({ type: 'loot', label: 'Abandoned Stash', safe: true, icon: '◆' })
    }
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
      chest: null,
      corpses: null,
      npc: null,
    })
  }

  return zone
}

// Convenience: generate Garden zone (backwards compat)
function generateGardenZone() {
  return generateZone('montors_garden', { hasStairwell: true, isFirstZone: true })
}

// ============================================================
// FLOOR GENERATION — creates all zones for a floor
// ============================================================

function generateFloor(floorId) {
  var floorDef = FLOORS[floorId]
  if (!floorDef) return null

  var zoneIds = floorDef.zones
  // Stairwell goes in one random zone
  var stairwellZoneIndex = Math.floor(Math.random() * zoneIds.length)

  var zones = []
  for (var i = 0; i < zoneIds.length; i++) {
    var zone = generateZone(zoneIds[i], {
      hasStairwell: i === stairwellZoneIndex,
      isFirstZone: i === 0,
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
    content.hpRecovery = 0.25
    content.description = 'A sheltered space. The air is still.'
  } else if (chamber.type === 'merchant') {
    content.items = getMerchantItems()
    content.description = 'A hooded figure sits cross-legged beside a threadbare mat of wares.'
  } else if (chamber.type === 'loot') {
    var chestLoot = generateChestLoot(10, zd.floorId)
    content.gold = chestLoot.gold
    content.item = chestLoot.item
    content.description = 'A rotting chest sits half-buried.'
  } else if (chamber.type === 'trap') {
    content.damage = 3 + Math.floor(Math.random() * 5)
    content.description = 'The ground shifts underfoot. Something clicks.'
  } else if (chamber.type === 'quest_npc') {
    content.description = 'A figure leans against the wall. They raise a hand weakly.'
    content.npcName = 'Wounded Traveller'
    content.reward = { gold: 10 }
  } else if (chamber.type === 'event') {
    content.description = 'The air thickens. You feel watched.'
  } else if (chamber.type === 'hidden') {
    var hiddenLoot = generateChestLoot(10, zd.floorId)
    content.gold = hiddenLoot.gold + 5
    content.item = hiddenLoot.item
    content.description = 'A narrow gap reveals a forgotten alcove.'
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
