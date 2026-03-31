// Sprite grid system — all enemies as 2D arrays
// Cell values: null (transparent), K (black outline), C (tier colour), S (shadow)
var K = '#000000'
var _ = null
var C = 'C'
var S = 'S'

var TIERS = {
  dust:    { name: 'Dust',    hex: '#d4c8a0', shadow: '#9a8e6a' },  // pale sandy — weak, forgettable
  slate:   { name: 'Slate',   hex: '#5b8dd9', shadow: '#2e5a9a' },  // blue steel — a step up, noticeable
  iron:    { name: 'Iron',    hex: '#8b5e3c', shadow: '#5a3420' },   // dark bronze — serious, battle-worn
  crimson: { name: 'Crimson', hex: '#cc2222', shadow: '#7a0a0a' },   // blood red — danger, unmistakable
  void:    { name: 'Void',    hex: '#9b59b6', shadow: '#5b2a7a' },   // deep purple — otherworldly, boss
}

// Dark tiers need a bg pad so sprites read against black background
var DARK_TIERS = { void: true }

var SPRITES = {
  rat: {
    name: 'Rat', cols: 16, rows: 14, grid: [
      [_,_,K,K,_,_,_,_,_,_,_,K,K,_,_,_],
      [_,K,C,C,K,_,_,_,_,_,K,C,C,K,_,_],
      [_,K,C,C,K,K,K,K,K,K,K,C,C,K,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,K,C,S,K,C,C,S,S,C,C,K,C,K,K,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,K,C,K],
      [K,C,C,C,K,K,C,C,C,C,K,K,C,C,K,K],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_],
      [K,C,C,S,C,C,C,C,C,C,C,C,S,C,K,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,C,K,K,_,_,_,_,K,K,C,K,_,_],
      [_,_,K,K,K,_,_,_,_,_,_,K,K,K,_,_],
    ],
  },
  orc: {
    name: 'Orc', cols: 18, rows: 24, grid: [
      [_,_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,C,S,S,C,C,C,C,C,C,S,S,C,K,_,_],
      [_,_,K,C,S,S,K,C,C,C,C,K,S,S,C,K,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,C,C,C,S,S,S,S,S,S,C,C,C,K,_,_],
      [_,_,K,C,C,C,C,K,K,K,K,C,C,C,C,K,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,C,K,C,C,C,C,C,C,C,C,K,C,K,_,_],
      [_,_,K,C,K,C,K,K,K,K,K,K,C,K,C,K,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,_,_,_,K,K,C,C,C,C,C,C,K,K,_,_,_,_],
      [_,K,K,K,K,C,C,C,C,C,C,C,C,K,K,K,K,_],
      [K,C,C,C,K,S,C,C,C,C,C,C,S,K,C,C,C,K],
      [K,C,C,C,K,C,C,S,C,C,S,C,C,K,C,C,C,K],
      [K,C,C,C,K,C,C,C,C,C,C,C,C,K,C,C,C,K],
      [K,C,C,K,K,C,C,C,C,C,C,C,C,K,K,C,C,K],
      [K,C,C,K,_,K,C,C,C,C,C,C,K,_,K,C,C,K],
      [K,K,C,K,_,K,C,C,C,C,C,C,K,_,K,C,K,K],
      [_,K,K,_,_,K,K,C,C,C,C,K,K,_,_,K,K,_],
      [_,_,_,_,_,K,C,C,K,K,C,C,K,_,_,_,_,_],
      [_,_,_,_,_,K,C,S,K,K,S,C,K,_,_,_,_,_],
      [_,_,_,_,K,K,K,K,_,_,K,K,K,K,_,_,_,_],
    ],
  },
  rock: {
    name: 'Rock Monster', cols: 20, rows: 22, grid: [
      [_,_,_,K,K,K,K,K,K,K,K,K,K,K,_,_,_,_,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,C,K,K,_,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,K,C,S,C,C,S,C,C,C,C,S,C,C,S,C,K,_,_,_],
      [_,K,C,C,C,K,C,C,S,S,C,C,K,C,C,C,K,_,_,_],
      [_,K,C,C,C,C,C,S,C,C,S,C,C,C,C,C,K,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,K,C,S,C,C,C,K,K,K,K,C,C,C,S,C,K,_,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_,_],
      [K,K,K,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_,_,_],
      [C,C,K,C,C,C,C,C,C,C,C,C,C,C,C,K,K,K,_,_],
      [C,C,K,S,C,C,C,C,C,C,C,C,C,S,C,C,C,K,_,_],
      [C,C,K,C,C,C,S,C,C,C,C,S,C,C,C,C,C,K,_,_],
      [K,K,K,C,C,C,C,C,C,C,C,C,C,C,C,C,K,K,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [K,C,K,C,S,C,C,C,C,C,C,C,C,S,C,K,C,K,_,_],
      [K,C,K,C,C,C,C,C,C,C,C,C,C,C,C,K,C,K,_,_],
      [K,K,K,K,C,C,C,C,C,C,C,C,C,C,K,K,K,K,_,_],
      [_,_,_,K,C,C,K,K,_,_,K,K,C,C,K,_,_,_,_,_],
      [_,_,_,K,C,S,K,_,_,_,_,K,S,C,K,_,_,_,_,_],
      [_,_,_,K,C,C,K,_,_,_,_,K,C,C,K,_,_,_,_,_],
      [_,_,K,K,K,K,K,_,_,_,_,K,K,K,K,K,_,_,_,_],
    ],
  },
  slug: {
    name: 'Slug', cols: 22, rows: 12, grid: [
      [_,_,K,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,K,C,C,K,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,K,K,C,K,C,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,K,C,C,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,K,C,C,C,C,K,K,K,K,K,K,K,K,K,K,K,K,K,_,_,_],
      [K,C,C,S,C,C,C,C,S,C,C,S,C,C,S,C,C,S,C,C,K,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_],
      [K,C,S,C,C,C,C,S,C,C,C,C,S,C,C,C,S,C,C,K,K,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_,_],
      [_,_,K,K,C,C,C,C,C,C,C,C,C,C,K,K,_,_,_,_,_,_],
      [_,_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_,_,_,_,_,_],
    ],
  },
  wraith: {
    name: 'Wraith', cols: 16, rows: 24, grid: [
      [_,_,_,_,_,K,K,K,K,_,_,_,_,_,_,_],
      [_,_,_,_,K,C,C,C,C,K,_,_,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,K,_,_,_,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,K,_,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [K,C,C,C,S,C,C,C,C,C,S,C,C,K,_,_],
      [K,C,C,K,K,K,K,K,K,K,K,K,C,K,_,_],
      [K,C,C,K,_,_,_,_,_,_,_,K,C,K,_,_],
      [K,C,C,K,_,_,_,_,_,_,_,K,C,K,_,_],
      [K,C,C,K,_,_,_,_,_,_,_,K,C,K,_,_],
      [K,C,C,C,K,K,K,K,K,K,K,C,C,K,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [K,C,C,S,C,C,C,C,C,C,S,C,C,K,_,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [K,C,S,C,C,C,C,C,C,C,C,C,S,K,_,_],
      [C,K,_,S,C,C,C,C,C,C,C,S,_,C,K,_],
      [K,_,_,_,K,C,C,C,C,C,K,_,_,_,K,_],
      [_,_,_,_,K,C,S,C,C,S,K,_,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,K,_,_,_,_],
      [_,_,_,K,S,C,C,C,C,C,S,K,_,_,_,_],
      [_,_,K,K,C,S,C,C,C,S,C,K,K,_,_,_],
      [_,K,K,_,K,K,K,K,K,K,K,_,K,K,_,_],
    ],
  },
}

// Player class sprites — same grid system, custom colours
var PLAYER_SPRITES = {
  knight: {
    name: 'Knight', cols: 18, rows: 24, grid: [
      [_,_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_,_],  // helm crest
      [_,_,_,_,_,K,C,C,C,C,C,C,K,_,_,_,_,_],
      [_,_,_,_,K,C,C,C,C,C,C,C,C,K,_,_,_,_],  // helm widens
      [_,_,_,_,K,C,S,S,S,S,S,S,C,K,_,_,_,_],  // visor slit — horizontal shadow band
      [_,_,_,_,K,C,C,C,C,C,C,C,C,K,_,_,_,_],  // below visor
      [_,_,_,_,_,K,C,S,S,S,S,C,K,_,_,_,_,_],  // chin / breath guard
      [_,_,_,_,_,_,K,C,C,C,C,K,_,_,_,_,_,_],  // gorget (neck armour)
      [_,_,K,K,K,K,K,C,C,C,C,K,K,K,K,K,_,_],  // wide pauldrons
      [_,K,S,C,C,K,C,C,C,C,C,C,K,C,C,S,K,_],  // shoulder plates
      [_,K,C,C,C,K,S,C,C,C,C,S,K,C,C,C,K,_],  // upper chest — armour shadow
      [_,K,C,C,C,K,C,C,S,S,C,C,K,C,C,C,K,_],  // chest plate — central ridge
      [_,K,C,C,C,K,C,S,C,C,S,C,K,C,C,C,K,_],  // lower chest
      [_,_,K,C,C,K,C,C,C,C,C,C,K,C,C,K,_,_],  // waist / belt
      [_,_,K,C,K,_,K,S,S,S,S,K,_,K,C,K,_,_],  // belt buckle + arms
      [_,_,K,C,K,_,K,C,C,C,C,K,_,K,C,K,_,_],  // gauntlets
      [_,_,K,K,K,_,K,C,C,C,C,K,_,K,K,K,_,_],  // fists
      [_,_,_,_,_,_,K,C,C,C,C,K,_,_,_,_,_,_],  // tabard
      [_,_,_,_,_,K,C,C,K,K,C,C,K,_,_,_,_,_],  // upper legs
      [_,_,_,_,_,K,C,S,K,K,S,C,K,_,_,_,_,_],  // greaves — shadow detail
      [_,_,_,_,_,K,C,C,K,K,C,C,K,_,_,_,_,_],  // lower greaves
      [_,_,_,_,_,K,C,C,K,K,C,C,K,_,_,_,_,_],  // shin guards
      [_,_,_,_,K,C,S,C,K,K,C,S,C,K,_,_,_,_],  // ankle plates
      [_,_,_,K,K,C,C,K,_,_,K,C,C,K,K,_,_,_],  // boots
      [_,_,_,K,K,K,K,K,_,_,K,K,K,K,K,_,_,_],  // soles — planted
    ],
  },
}

// Class colour schemes — main colour + shadow
var CLASS_COLOURS = {
  knight: { hex: '#9ca3af', shadow: '#6b7280' },  // steel grey
  // Future classes:
  // ranger:    { hex: '#4ade80', shadow: '#16a34a' },
  // mage:      { hex: '#818cf8', shadow: '#4f46e5' },
  // rogue:     { hex: '#a78bfa', shadow: '#7c3aed' },
  // cleric:    { hex: '#fbbf24', shadow: '#d97706' },
}

// Draw a player sprite with class colours
function drawPlayerSprite(canvas, classKey, scale) {
  var sprite = PLAYER_SPRITES[classKey]
  var colours = CLASS_COLOURS[classKey]
  if (!sprite || !colours) return

  var px = scale || 3
  canvas.width = sprite.cols * px
  canvas.height = sprite.rows * px
  canvas.style.imageRendering = 'pixelated'

  var ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  for (var r = 0; r < sprite.rows; r++) {
    for (var c = 0; c < sprite.cols; c++) {
      var v = sprite.grid[r][c]
      if (v === null) continue
      if (v === K) ctx.fillStyle = '#000000'
      else if (v === C) ctx.fillStyle = colours.hex
      else if (v === S) ctx.fillStyle = colours.shadow
      else ctx.fillStyle = v
      ctx.fillRect(c * px, r * px, px, px)
    }
  }
}

// Draw an enemy sprite onto a canvas element
function drawSprite(canvas, spriteKey, tierKey, scale) {
  var sprite = SPRITES[spriteKey]
  var tier = TIERS[tierKey]
  if (!sprite || !tier) return

  var px = scale || 4
  var isDark = DARK_TIERS[tierKey]

  canvas.width = sprite.cols * px
  canvas.height = sprite.rows * px
  canvas.style.imageRendering = 'pixelated'

  var ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  // Dark tiers get a bg pad so sprite reads
  if (isDark) {
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  for (var r = 0; r < sprite.rows; r++) {
    for (var c = 0; c < sprite.cols; c++) {
      var v = sprite.grid[r][c]
      if (v === null) continue
      if (v === K) ctx.fillStyle = '#000000'
      else if (v === C) ctx.fillStyle = tier.hex
      else if (v === S) ctx.fillStyle = tier.shadow
      else ctx.fillStyle = v
      ctx.fillRect(c * px, r * px, px, px)
    }
  }
}

// --- Door sprites (stone arch, 12x16) ---
// D = door wood colour, W = wall stone colour, H = highlight
var D = 'D'
var W = 'W'
var H = 'H'

var DOOR_SPRITE = {
  cols: 12, rows: 16, grid: [
    [_,_,K,K,K,K,K,K,K,K,_,_],  // arch top
    [_,K,W,W,W,W,W,W,W,W,K,_],
    [K,W,W,H,_,_,_,_,H,W,W,K],  // arch opening
    [K,W,_,_,_,_,_,_,_,_,W,K],
    [K,W,_,_,K,K,K,K,_,_,W,K],  // door top
    [K,W,_,K,D,D,D,D,K,_,W,K],
    [K,W,_,K,D,D,D,D,K,_,W,K],
    [K,W,_,K,D,H,D,D,K,_,W,K],  // door handle
    [K,W,_,K,D,D,D,D,K,_,W,K],
    [K,W,_,K,D,D,D,D,K,_,W,K],
    [K,W,_,K,D,D,D,D,K,_,W,K],
    [K,W,_,K,D,D,D,D,K,_,W,K],
    [K,W,_,K,K,K,K,K,K,_,W,K],  // door frame bottom
    [K,W,W,W,W,W,W,W,W,W,W,K],
    [K,W,W,W,W,W,W,W,W,W,W,K],  // floor stones
    [K,K,K,K,K,K,K,K,K,K,K,K],
  ],
}

// Zone-themed door colours
var DOOR_THEMES = {
  garden:  { wall: '#5a6e4a', wallHi: '#7a9060', door: '#6b4e2e', doorHi: '#c8a050' },
  dungeon: { wall: '#4a4a52', wallHi: '#6a6a72', door: '#5a3a1e', doorHi: '#b89040' },
}

function drawDoorSprite(canvas, theme, scale) {
  var colours = DOOR_THEMES[theme] || DOOR_THEMES.dungeon
  var px = scale || 3
  var sprite = DOOR_SPRITE

  canvas.width = sprite.cols * px
  canvas.height = sprite.rows * px
  canvas.style.imageRendering = 'pixelated'

  var ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  for (var r = 0; r < sprite.rows; r++) {
    for (var c = 0; c < sprite.cols; c++) {
      var v = sprite.grid[r][c]
      if (v === null) continue
      if (v === K) ctx.fillStyle = '#000000'
      else if (v === W) ctx.fillStyle = colours.wall
      else if (v === H) ctx.fillStyle = colours.wallHi
      else if (v === D) ctx.fillStyle = colours.door
      else ctx.fillStyle = v
      ctx.fillRect(c * px, r * px, px, px)
    }
  }
}

// --- Chamber content sprites (small icons, 10x10) ---

var CHAMBER_ICONS = {
  chest: {
    cols: 10, rows: 8, grid: [
      [_,K,K,K,K,K,K,K,K,_],
      [K,D,D,D,D,D,D,D,D,K],
      [K,D,D,D,H,H,D,D,D,K],  // latch
      [K,K,K,K,K,K,K,K,K,K],
      [K,D,D,D,D,D,D,D,D,K],
      [K,D,D,D,D,D,D,D,D,K],
      [K,D,D,D,D,D,D,D,D,K],
      [K,K,K,K,K,K,K,K,K,K],
    ],
  },
  corpse: {
    cols: 12, rows: 6, grid: [
      [_,_,_,K,K,_,_,_,_,_,_,_],
      [_,_,K,C,C,K,K,K,K,_,_,_],
      [_,K,C,C,C,C,C,C,C,K,K,_],
      [_,_,K,C,C,C,C,C,C,C,K,_],
      [_,_,_,K,K,_,K,K,_,K,K,_],
      [_,_,_,_,_,_,_,_,_,_,_,_],
    ],
  },
  // Archetype-specific corpse sprites
  corpse_rat: {
    cols: 10, rows: 6, grid: [
      [_,_,_,_,_,_,_,_,_,_],
      [_,_,K,K,_,_,_,_,_,_],
      [_,K,'#8b2020','#aa3030','#8b2020',K,K,_,_,_],
      [K,'#aa3030','#cc4040','#aa3030','#cc4040','#8b2020','#aa3030',K,_,_],
      [_,K,'#8b2020','#661515','#aa3030','#661515','#8b2020',K,K,_],
      [_,_,K,K,K,K,K,K,_,_],
    ],
  },
  corpse_orc: {
    cols: 12, rows: 7, grid: [
      [_,_,_,_,K,K,_,_,_,_,_,_],
      [_,_,K,K,'#556644','#556644',K,K,_,_,_,_],
      [_,K,'#445533','#8b2020','#aa3030','#8b2020','#445533',K,_,_,_,_],
      [K,'#445533','#aa3030','#661515','#cc4040','#661515','#aa3030','#445533',K,K,_,_],
      [K,'#556644','#8b2020','#aa3030','#8b2020','#aa3030','#8b2020','#556644',K,_,_,_],
      [_,K,'#445533','#445533',K,K,'#445533','#445533',K,_,_,_],
      [_,_,K,K,_,_,_,K,K,_,_,_],
    ],
  },
  corpse_slug: {
    cols: 12, rows: 5, grid: [
      [_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,K,K,K,K,K,K,K,_,_,_],
      [_,K,'#44664a','#55885a','#668866','#55885a','#44664a','#55885a',K,_,_,_],
      [K,'#55885a','#44664a','#55885a','#44664a','#668866','#44664a','#55885a','#44664a',K,_,_],
      [_,K,K,K,K,K,K,K,K,K,_,_],
    ],
  },
  corpse_wraith: {
    cols: 10, rows: 6, grid: [
      [_,_,_,_,_,_,_,_,_,_],
      [_,_,_,K,K,K,_,_,_,_],
      [_,_,K,'#333340','#444455','#333340',K,_,_,_],
      [_,K,'#444455','#555566','#333340','#555566','#444455',K,_,_],
      [K,'#333340','#444455','#333340','#444455','#333340','#444455','#333340',K,_],
      [_,K,K,K,K,K,K,K,_,_],
    ],
  },
  corpse_rock: {
    cols: 12, rows: 6, grid: [
      [_,_,_,_,K,_,_,_,_,_,_,_],
      [_,_,K,K,'#666660','#555550',K,_,_,_,_,_],
      [_,K,'#777770','#666660','#555550','#777770',K,K,_,_,_,_],
      [K,'#555550','#666660','#777770','#666660','#555550','#777770','#555550',K,_,_,_],
      [_,K,'#666660','#555550','#666660',K,'#555550','#666660',K,_,_,_],
      [_,_,K,K,K,_,_,K,K,_,_,_],
    ],
  },
  npc: {
    cols: 10, rows: 14, grid: [
      [_,_,_,K,K,K,K,_,_,_],
      [_,_,K,C,C,C,C,K,_,_],  // head
      [_,_,K,C,K,K,C,K,_,_],  // eyes
      [_,_,K,C,C,C,C,K,_,_],
      [_,_,_,K,C,C,K,_,_,_],  // neck
      [_,K,K,K,C,C,K,K,K,_],  // shoulders
      [_,K,D,K,C,C,K,D,K,_],  // cloak
      [_,K,D,D,C,C,D,D,K,_],
      [_,_,K,D,C,C,D,K,_,_],
      [_,_,K,D,C,C,D,K,_,_],
      [_,_,_,K,C,C,K,_,_,_],  // legs
      [_,_,_,K,C,C,K,_,_,_],
      [_,_,K,K,_,_,K,K,_,_],  // boots
      [_,_,K,K,_,_,K,K,_,_],
    ],
  },
  shrine: {
    cols: 10, rows: 12, grid: [
      [_,_,_,_,K,K,_,_,_,_],
      [_,_,_,K,H,H,K,_,_,_],  // flame
      [_,_,_,_,K,K,_,_,_,_],
      [_,_,_,K,W,W,K,_,_,_],  // column top
      [_,_,_,K,W,W,K,_,_,_],
      [_,_,_,K,W,W,K,_,_,_],
      [_,_,_,K,W,W,K,_,_,_],
      [_,_,K,W,W,W,W,K,_,_],  // base widens
      [_,K,W,W,W,W,W,W,K,_],
      [K,W,W,W,W,W,W,W,W,K],  // base
      [K,W,H,W,W,W,W,H,W,K],
      [K,K,K,K,K,K,K,K,K,K],
    ],
  },
  trap: {
    cols: 10, rows: 6, grid: [
      [_,K,_,_,K,K,_,_,K,_],
      [_,_,K,_,_,_,_,K,_,_],  // spikes
      [K,K,K,K,K,K,K,K,K,K],
      [K,H,K,H,K,K,H,K,H,K],  // pressure plate
      [K,K,K,K,K,K,K,K,K,K],
      [_,_,_,_,_,_,_,_,_,_],
    ],
  },
  stairs_down: {
    cols: 10, rows: 10, grid: [
      [K,K,K,K,K,K,K,K,K,K],
      [K,W,W,W,W,W,W,W,W,K],
      [_,K,W,W,W,W,W,W,K,_],
      [_,K,H,H,H,H,H,H,K,_],  // first step
      [_,_,K,W,W,W,W,K,_,_],
      [_,_,K,H,H,H,H,K,_,_],  // second step
      [_,_,_,K,W,W,K,_,_,_],
      [_,_,_,K,H,H,K,_,_,_],  // third step
      [_,_,_,_,K,K,_,_,_,_],
      [_,_,_,_,K,K,_,_,_,_],  // darkness below
    ],
  },
}

function drawChamberIcon(canvas, iconKey, theme, scale) {
  var sprite = CHAMBER_ICONS[iconKey]
  if (!sprite) return
  var colours = DOOR_THEMES[theme] || DOOR_THEMES.dungeon
  var pxSize = scale || 3

  canvas.width = sprite.cols * pxSize
  canvas.height = sprite.rows * pxSize
  canvas.style.imageRendering = 'pixelated'

  var ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  for (var r = 0; r < sprite.rows; r++) {
    for (var c = 0; c < sprite.cols; c++) {
      var v = sprite.grid[r][c]
      if (v === null) continue
      if (v === K) ctx.fillStyle = '#000000'
      else if (v === W) ctx.fillStyle = colours.wall
      else if (v === H) ctx.fillStyle = colours.wallHi
      else if (v === D) ctx.fillStyle = colours.door
      else if (v === C) ctx.fillStyle = '#888888'
      else if (v === S) ctx.fillStyle = '#555555'
      else ctx.fillStyle = v  // direct hex colours (corpse sprites use these)
      ctx.fillRect(c * pxSize, r * pxSize, pxSize, pxSize)
    }
  }
}

export { SPRITES, PLAYER_SPRITES, CLASS_COLOURS, TIERS, DARK_TIERS, drawSprite, drawPlayerSprite, DOOR_SPRITE, DOOR_THEMES, drawDoorSprite, CHAMBER_ICONS, drawChamberIcon }
