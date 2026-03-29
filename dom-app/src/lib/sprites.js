// Sprite grid system — all enemies as 2D arrays
// Cell values: null (transparent), K (black outline), C (tier colour), S (shadow)
var K = '#000000'
var _ = null
var C = 'C'
var S = 'S'

var TIERS = {
  dust:    { name: 'Dust',    hex: '#c8c8c8', shadow: '#888888' },
  slate:   { name: 'Slate',   hex: '#6a8fa8', shadow: '#3a5a70' },
  iron:    { name: 'Iron',    hex: '#4a4e52', shadow: '#222428' },
  crimson: { name: 'Crimson', hex: '#6b1a1a', shadow: '#3a0a0a' },
  void:    { name: 'Void',    hex: '#111111', shadow: '#000000' },
}

// Dark tiers need a bg pad so sprites read against black background
var DARK_TIERS = { iron: true, crimson: true, void: true }

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

export { SPRITES, PLAYER_SPRITES, CLASS_COLOURS, TIERS, DARK_TIERS, drawSprite, drawPlayerSprite }
