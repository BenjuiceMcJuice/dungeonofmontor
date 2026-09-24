// Builds the palette-encoded sprite set the Descent engine expects from the
// live grids in lib/sprites.js, so the platformer uses the same art as the Crawl.
import { SPRITES, PLAYER_SPRITES, CLASS_COLOURS, TIERS, CHAMBER_ICONS, DOOR_SPRITE, DOOR_SPRITE_OPEN, DOOR_THEMES, CONDITION_ICONS } from '../lib/sprites.js'

var ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function encode(sprite, map) {
  var pal = [], rows = []
  for (var r = 0; r < sprite.rows; r++) {
    var row = sprite.grid[r] || [], out = ''
    for (var c = 0; c < sprite.cols; c++) {
      var v = row[c]
      if (v === null || v === undefined) { out += '.'; continue }
      var hex = v === '#000000' ? '#000000' : (map[v] !== undefined ? map[v] : v)
      var i = pal.indexOf(hex)
      if (i < 0) { pal.push(hex); i = pal.length - 1 }
      out += ALPHA.charAt(i)
    }
    rows.push(out)
  }
  return { w: sprite.cols, h: sprite.rows, pal: pal, rows: rows }
}

function tierMap(tier) { return { C: TIERS[tier].hex, S: TIERS[tier].shadow } }

function buildDescentAssets(theme) {
  var dt = DOOR_THEMES[theme || 'garden'] || DOOR_THEMES.garden
  var icon = { W: dt.wall, H: dt.wallHi, D: dt.door, G: dt.door, V: dt.wallHi, C: '#888888', S: '#555555' }
  var out = {}
  out.knight = encode(PLAYER_SPRITES.knight, { C: CLASS_COLOURS.knight.hex, S: CLASS_COLOURS.knight.shadow })
  out.rat = encode(SPRITES.rat, tierMap('dust'))
  out.slug = encode(SPRITES.slug, tierMap('slate'))
  out.bat = encode(SPRITES.bat, tierMap('dust'))
  out.corpse_rat = encode(CHAMBER_ICONS.corpse_rat, { C: TIERS.dust.hex, S: TIERS.dust.shadow })
  var keys = ['junk_garden_1', 'junk_garden_2', 'junk_garden_3', 'chest', 'trap', 'stairs_down']
  for (var i = 0; i < keys.length; i++) out[keys[i]] = encode(CHAMBER_ICONS[keys[i]], icon)
  out.door = encode(DOOR_SPRITE, icon)
  out.door_open = encode(DOOR_SPRITE_OPEN, icon)
  out.cond_WET = encode(CONDITION_ICONS.WET, {})
  return out
}

export { buildDescentAssets }
