// Sprite grid system — all enemies as 2D arrays
// Cell values: null (transparent), K (black outline), C (tier colour), S (shadow)
// Theme data loaded from JSON — see src/data/themes.json
import themeData from '../data/themes.json'

var K = '#000000'
var _ = null
var C = 'C'
var S = 'S'

var TIERS = themeData.tiers

// Dark tiers need a bg pad so sprites read against black background
var DARK_TIERS = {}
for (var i = 0; i < themeData.darkTiers.length; i++) DARK_TIERS[themeData.darkTiers[i]] = true

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
    name: 'Orc', cols: 18, rows: 22, grid: [
      [_,_,_,_,_,K,K,K,K,K,K,K,_,_,_,_,_,_],
      [_,_,_,_,K,C,C,C,C,C,C,C,K,_,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,C,C,K,_,_,_,_],
      [_,_,_,K,C,S,K,C,C,C,K,S,C,K,_,_,_,_],
      [_,_,_,K,C,C,C,C,S,C,C,C,C,K,_,_,_,_],
      [_,_,K,C,K,C,C,C,C,C,C,C,K,C,K,_,_,_],
      [_,_,K,K,C,C,S,K,K,K,S,C,C,K,K,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,C,C,K,_,_,_,_],
      [_,_,_,_,K,K,C,C,C,C,C,K,K,_,_,_,_,_],
      [_,K,K,K,C,C,C,C,C,C,C,C,C,K,K,K,_,_],
      [K,C,C,C,K,C,C,C,C,C,C,C,K,C,C,C,K,_],
      [K,S,C,C,C,K,S,C,C,C,S,K,C,C,C,S,K,_],
      [K,C,C,C,C,K,C,C,C,C,C,K,C,C,C,C,K,_],
      [_,K,C,C,C,K,C,S,S,S,C,K,C,C,C,K,_,_],
      [_,K,C,C,C,K,C,C,C,C,C,K,C,C,C,K,_,_],
      [_,_,K,C,K,_,K,C,C,C,K,_,K,C,K,_,_,_],
      [_,_,K,C,K,_,K,C,C,C,K,_,K,C,K,_,_,_],
      [_,_,K,C,K,_,K,S,C,S,K,_,K,C,K,_,_,_],
      [_,_,K,S,K,_,K,C,C,C,K,_,K,S,K,_,_,_],
      [_,K,K,C,K,_,_,K,K,K,_,_,K,C,K,K,_,_],
      [_,K,C,C,K,_,_,_,_,_,_,_,K,C,C,K,_,_],
      [_,K,K,K,K,_,_,_,_,_,_,_,K,K,K,K,_,_],
    ],
  },
  rock: {
    name: 'Rock Monster', cols: 18, rows: 18, grid: [
      [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_,_,_],
      [_,_,K,K,S,C,S,C,C,S,C,S,K,K,_,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [K,S,C,C,C,C,C,C,C,C,C,C,C,C,S,K,_,_],
      [K,C,C,K,K,C,C,S,S,C,C,K,K,C,C,K,_,_],
      [K,C,C,C,C,C,S,C,C,S,C,C,C,C,C,K,_,_],
      [K,S,C,C,C,C,C,C,C,C,C,C,C,C,S,K,_,_],
      [K,C,C,C,K,K,K,K,K,K,K,K,C,C,C,K,_,_],
      [K,C,S,C,C,C,C,C,C,C,C,C,C,S,C,K,_,_],
      [K,K,C,C,C,C,C,C,C,C,C,C,C,C,K,K,_,_],
      [K,C,K,C,C,S,C,C,C,C,S,C,C,K,C,K,_,_],
      [K,C,C,K,C,C,C,C,C,C,C,C,K,C,C,K,_,_],
      [K,S,C,C,K,C,C,S,S,C,C,K,C,C,S,K,_,_],
      [K,C,C,C,C,K,K,C,C,K,K,C,C,C,C,K,_,_],
      [_,K,C,C,C,C,K,C,C,K,C,C,C,C,K,_,_,_],
      [_,_,K,C,S,K,_,K,K,_,K,S,C,K,_,_,_,_],
      [_,_,K,K,K,K,_,_,_,_,K,K,K,K,_,_,_,_],
      [_,K,K,_,_,_,_,_,_,_,_,_,_,K,K,_,_,_],
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
    name: 'Wraith', cols: 16, rows: 20, grid: [
      [_,_,_,_,_,_,K,K,K,_,_,_,_,_,_,_],
      [_,_,_,_,K,K,C,C,C,K,K,_,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,K,_,_,_,_],
      [_,_,K,C,C,K,K,C,K,K,C,C,K,_,_,_],
      [_,_,K,C,C,_,K,C,K,_,C,C,K,_,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,_,_,K,C,C,S,S,S,C,C,K,_,_,_,_],
      [_,_,K,S,C,C,C,C,C,C,C,S,K,_,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [K,C,S,C,C,S,C,C,C,S,C,C,S,C,K,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_],
      [_,K,C,C,S,C,C,C,C,C,S,C,C,K,_,_],
      [_,K,S,C,C,C,S,C,S,C,C,C,S,K,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,_,_,K,S,C,C,C,C,C,S,K,_,_,_,_],
      [_,_,_,K,_,C,S,C,S,C,_,K,_,_,_,_],
      [_,_,_,_,K,_,C,C,C,_,K,_,_,_,_,_],
      [_,_,_,_,_,K,_,S,_,K,_,_,_,_,_,_],
      [_,_,_,_,_,_,K,_,K,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,K,_,_,_,_,_,_,_,_],
    ],
  },
  spider: {
    name: 'Spider', cols: 20, rows: 14, grid: [
      [K,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,K],
      [_,K,K,_,_,_,_,K,K,K,K,K,K,_,_,_,_,K,K,_],
      [_,_,K,K,_,_,K,C,C,C,C,C,C,K,_,_,K,K,_,_],
      [_,_,_,K,K,K,C,C,S,K,K,S,C,C,K,K,K,_,_,_],
      [_,K,K,_,K,C,C,C,C,C,C,C,C,C,C,K,_,K,K,_],
      [K,C,K,_,K,C,S,C,C,C,C,C,C,S,C,K,_,K,C,K],
      [_,K,_,K,C,C,C,C,C,C,C,C,C,C,C,C,K,_,K,_],
      [K,C,K,_,K,C,C,S,C,C,C,C,S,C,C,K,_,K,C,K],
      [_,K,_,_,_,K,C,C,C,C,C,C,C,C,K,_,_,_,K,_],
      [K,K,_,_,_,_,K,C,C,S,S,C,C,K,_,_,_,_,K,K],
      [_,_,_,_,_,_,K,C,C,C,C,C,C,K,_,_,_,_,_,_],
      [_,_,_,_,_,K,C,K,C,C,C,C,K,C,K,_,_,_,_,_],
      [_,_,_,_,K,K,_,_,K,K,K,K,_,_,K,K,_,_,_,_],
      [_,_,_,K,K,_,_,_,_,_,_,_,_,_,_,K,K,_,_,_],
    ],
  },
  mimic: {
    name: 'Mimic', cols: 18, rows: 16, grid: [
      [_,_,K,K,K,K,K,K,K,K,K,K,K,K,K,K,_,_],
      [_,K,S,C,S,C,S,C,S,C,S,C,S,C,S,C,K,_],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K],
      [K,C,S,C,C,C,C,C,K,K,C,C,C,C,C,S,C,K],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
      [K,_,C,_,C,_,_,_,_,_,_,_,_,C,_,C,_,K],
      [K,C,_,C,_,_,_,_,_,_,_,_,_,_,C,_,C,K],
      [K,_,_,_,K,_,S,_,_,_,_,S,_,K,_,_,_,K],
      [K,C,_,_,_,K,_,_,_,_,_,_,K,_,_,_,C,K],
      [K,_,C,_,_,_,K,_,_,_,_,K,_,_,_,C,_,K],
      [K,C,_,C,_,C,_,K,K,K,K,_,C,_,C,_,C,K],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K],
      [K,C,S,C,C,S,C,C,C,C,C,C,S,C,C,S,C,K],
      [K,C,C,C,C,C,C,S,C,C,S,C,C,C,C,C,C,K],
      [_,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,_],
    ],
  },
  bat: {
    name: 'Bat', cols: 22, rows: 12, grid: [
      [_,_,_,_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_,_,_,_],
      [K,K,_,_,_,_,_,_,K,C,S,S,C,K,_,_,_,_,_,_,K,K],
      [K,C,K,_,_,_,_,K,C,C,K,K,C,C,K,_,_,_,_,K,C,K],
      [K,C,C,K,_,_,K,C,C,C,C,C,C,C,C,K,_,_,K,C,C,K],
      [K,C,S,C,K,K,C,C,S,C,C,C,C,S,C,C,K,K,C,S,C,K],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_],
      [_,_,K,C,C,C,S,C,C,C,C,C,C,C,C,S,C,C,C,K,_,_],
      [_,_,_,K,C,C,C,C,C,S,S,S,S,C,C,C,C,C,K,_,_,_],
      [_,_,_,_,K,C,C,C,K,C,C,C,C,K,C,C,C,K,_,_,_,_],
      [_,_,_,_,_,K,C,K,_,K,C,C,K,_,K,C,K,_,_,_,_,_],
      [_,_,_,_,_,_,K,_,_,_,K,K,_,_,_,K,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    ],
  },
  moth: {
    name: 'Moth', cols: 18, rows: 14, grid: [
      [_,_,_,_,K,_,_,_,_,_,_,_,_,K,_,_,_,_],
      [_,_,_,K,S,K,_,_,_,_,_,_,K,S,K,_,_,_],
      [_,_,_,_,K,_,_,K,K,K,K,_,_,K,_,_,_,_],
      [_,K,K,_,_,_,K,C,S,S,C,K,_,_,_,K,K,_],
      [K,C,S,K,_,K,C,C,C,C,C,C,K,_,K,S,C,K],
      [K,C,C,C,K,C,C,S,C,C,S,C,C,K,C,C,C,K],
      [K,S,C,C,C,C,C,C,K,K,C,C,C,C,C,C,S,K],
      [K,C,C,S,C,C,C,C,C,C,C,C,C,C,S,C,C,K],
      [_,K,C,C,C,C,S,C,C,C,C,S,C,C,C,C,K,_],
      [_,K,C,C,C,K,C,C,S,S,C,C,K,C,C,C,K,_],
      [_,_,K,C,K,_,K,C,C,C,C,K,_,K,C,K,_,_],
      [_,_,K,C,K,_,_,K,K,K,K,_,_,K,C,K,_,_],
      [_,K,S,C,K,_,_,_,_,_,_,_,_,K,C,S,K,_],
      [_,K,K,K,_,_,_,_,_,_,_,_,_,_,K,K,K,_],
    ],
  },
  hound: {
    name: 'Hound', cols: 22, rows: 14, grid: [
      [_,_,_,K,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,K,C,C,K,_,_,_,_,_,_,_,_,_,_,_,_,K,K,_,_],
      [_,K,C,S,C,C,K,K,K,K,K,K,K,K,_,_,_,K,C,C,K,_],
      [_,K,C,K,S,C,C,C,C,C,C,C,C,C,K,K,K,C,C,S,K,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_],
      [_,_,K,C,C,C,S,C,C,C,C,C,C,S,C,C,C,C,S,K,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,_,_,K,C,S,C,C,S,C,C,S,C,C,S,C,C,K,_,_,_,_],
      [_,_,_,_,K,C,C,C,C,C,C,C,C,C,C,C,K,_,_,_,_,_],
      [_,_,_,_,K,C,K,C,C,C,C,C,C,K,C,K,_,_,_,_,_,_],
      [_,_,_,_,K,C,K,C,_,_,_,_,C,K,C,K,_,_,_,_,_,_],
      [_,_,_,_,K,S,K,K,_,_,_,_,K,K,S,K,_,_,_,_,_,_],
      [_,_,_,K,K,C,K,_,_,_,_,_,_,K,C,K,K,_,_,_,_,_],
      [_,_,_,K,K,K,_,_,_,_,_,_,_,_,K,K,K,_,_,_,_,_],
    ],
  },
  automaton: {
    name: 'Automaton', cols: 16, rows: 20, grid: [
      [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
      [_,_,_,K,S,C,C,C,C,C,C,S,K,_,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,C,K,K,C,C,C,C,K,K,C,K,_,_],
      [_,_,K,C,K,S,K,C,C,K,S,K,C,K,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,C,C,K,K,K,K,K,K,C,C,K,_,_],
      [_,_,_,K,C,C,C,C,C,C,C,C,K,_,_,_],
      [_,_,_,K,K,K,C,C,C,C,K,K,K,_,_,_],
      [_,_,K,C,C,K,C,C,C,C,K,C,C,K,_,_],
      [_,K,C,C,C,K,S,C,C,S,K,C,C,C,K,_],
      [_,K,C,S,C,K,C,C,C,C,K,C,S,C,K,_],
      [_,K,C,C,C,K,C,S,S,C,K,C,C,C,K,_],
      [_,K,K,C,K,K,C,C,C,C,K,K,C,K,K,_],
      [_,_,K,C,K,_,K,C,C,K,_,K,C,K,_,_],
      [_,_,K,C,K,_,K,C,C,K,_,K,C,K,_,_],
      [_,_,K,C,K,_,K,C,C,K,_,K,C,K,_,_],
      [_,_,K,S,K,_,K,S,S,K,_,K,S,K,_,_],
      [_,K,K,C,K,_,K,C,C,K,_,K,C,K,K,_],
      [_,K,K,K,K,_,K,K,K,K,_,K,K,K,K,_],
    ],
  },
  shade: {
    name: 'Shade', cols: 14, rows: 20, grid: [
      [_,_,_,_,_,K,K,K,K,_,_,_,_,_],
      [_,_,_,_,K,C,C,C,C,K,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,K,_,_,_],
      [_,_,K,C,C,S,C,C,S,C,C,K,_,_],
      [_,_,K,C,K,K,C,C,K,K,C,K,_,_],
      [_,_,K,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,_,K,C,C,S,S,C,C,K,_,_,_],
      [_,_,_,_,K,C,C,C,C,K,_,_,_,_],
      [_,_,_,K,C,C,C,C,C,C,K,_,_,_],
      [_,_,K,C,C,S,C,C,S,C,C,K,_,_],
      [_,K,C,C,C,C,C,C,C,C,C,C,K,_],
      [K,C,S,C,C,C,C,C,C,C,C,S,C,K],
      [K,C,C,C,C,C,C,C,C,C,C,C,C,K],
      [_,K,C,C,S,C,C,C,C,S,C,C,K,_],
      [_,_,K,C,C,C,C,C,C,C,C,K,_,_],
      [_,_,K,S,C,C,C,C,C,C,S,K,_,_],
      [_,_,_,K,C,S,C,C,S,C,K,_,_,_],
      [_,_,_,_,K,_,S,S,_,K,_,_,_,_],
      [_,_,_,_,K,_,_,_,_,K,_,_,_,_],
      [_,_,_,_,_,K,_,_,K,_,_,_,_,_],
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

var CLASS_COLOURS = themeData.classColours

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

// G = gate iron (uses door colour), V = vine/leaf accent (uses wallHi)
var G = 'G'
var V = 'V'

// Garden gate — iron bars between stone pillars, vine on top
var DOOR_SPRITE = {
  cols: 12, rows: 14, grid: [
    [_,_,_,V,_,V,V,_,V,_,_,_],  // vine tendrils above
    [_,K,K,K,K,K,K,K,K,K,K,_],  // crossbar top
    [K,W,W,K,G,K,G,K,G,W,W,K],  // pillars + bars
    [K,W,_,K,G,K,G,K,G,_,W,K],
    [K,W,_,K,G,K,G,K,G,_,W,K],
    [K,W,_,K,G,H,G,K,G,_,W,K],  // latch/handle
    [K,W,_,K,G,K,G,K,G,_,W,K],
    [K,W,_,K,G,K,G,K,G,_,W,K],
    [K,W,_,K,G,K,G,K,G,_,W,K],
    [K,W,_,K,G,K,G,K,G,_,W,K],
    [K,W,_,K,K,K,K,K,K,_,W,K],  // crossbar bottom
    [K,W,W,W,W,W,W,W,W,W,W,K],  // stone base
    [K,W,H,W,W,W,W,W,H,W,W,K],
    [K,K,K,K,K,K,K,K,K,K,K,K],
  ],
}

// Open gate — swung inward, bars visible on edge, passage open
var DOOR_SPRITE_OPEN = {
  cols: 12, rows: 14, grid: [
    [_,_,_,V,_,_,_,_,V,_,_,_],  // vine tendrils
    [_,K,K,K,K,K,K,K,K,K,K,_],  // crossbar top
    [K,W,W,_,_,_,_,_,K,G,W,K],  // open — gate swung right
    [K,W,_,_,_,_,_,_,K,G,W,K],
    [K,W,_,_,_,_,_,_,K,G,W,K],
    [K,W,_,_,_,_,_,_,K,H,W,K],  // latch on edge
    [K,W,_,_,_,_,_,_,K,G,W,K],
    [K,W,_,_,_,_,_,_,K,G,W,K],
    [K,W,_,_,_,_,_,_,K,G,W,K],
    [K,W,_,_,_,_,_,_,K,G,W,K],
    [K,W,_,_,_,_,_,_,K,K,W,K],  // crossbar bottom
    [K,W,W,W,W,W,W,W,W,W,W,K],  // stone base
    [K,W,H,W,W,W,W,W,H,W,W,K],
    [K,K,K,K,K,K,K,K,K,K,K,K],
  ],
}

var DOOR_THEMES = themeData.doorThemes

function drawDoorSprite(canvas, theme, scale, open) {
  var colours = DOOR_THEMES[theme] || DOOR_THEMES.dungeon
  var px = scale || 3
  var sprite = open ? DOOR_SPRITE_OPEN : DOOR_SPRITE

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
      else if (v === G) ctx.fillStyle = colours.door
      else if (v === V) ctx.fillStyle = colours.wallHi
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
  corpse_spider: {
    cols: 12, rows: 5, grid: [
      [_,K,_,_,_,_,_,_,_,_,K,_],
      [K,'#443322',K,K,'#553322','#663322',K,K,'#443322',K,_,_],
      [_,K,'#553322','#8b2020','#aa3030','#8b2020','#aa3030','#553322',K,_,_,_],
      [K,'#443322',K,'#663322','#553322','#663322','#443322',K,'#443322',K,_,_],
      [_,K,_,_,K,K,K,K,_,_,K,_],
    ],
  },
  corpse_mimic: {
    cols: 12, rows: 6, grid: [
      [_,K,K,K,K,K,K,K,K,K,K,_],
      [K,'#554433','#665544','#554433','#8b2020','#aa3030','#554433','#665544','#554433',K,_,_,_],
      [K,'#665544','#8b2020','#554433','#665544','#554433','#8b2020','#554433','#665544',K,_,_,_],
      [K,'#554433','#665544','#554433','#665544','#554433','#665544','#554433',K,_,_,_,_],
      [_,K,'#554433','#665544','#554433','#665544','#554433',K,_,_,_,_,_],
      [_,_,K,K,K,K,K,K,_,_,_,_,_],
    ],
  },
  corpse_bat: {
    cols: 12, rows: 4, grid: [
      [_,_,_,_,_,_,_,_,_,_,_,_],
      [K,K,'#332233','#443344','#332233','#443344','#332233','#443344','#332233',K,K,_],
      [_,K,'#443344','#8b2020','#332233','#aa3030','#332233','#8b2020','#443344',K,_,_],
      [_,_,K,K,K,K,K,K,K,K,_,_],
    ],
  },
  corpse_moth: {
    cols: 10, rows: 5, grid: [
      [_,_,_,_,_,_,_,_,_,_],
      [_,K,K,'#776655','#887766','#776655',K,K,_,_],
      [K,'#887766','#776655','#8b2020','#aa3030','#8b2020','#776655','#887766',K,_],
      [_,K,'#776655','#887766','#776655','#887766','#776655',K,_,_],
      [_,_,K,K,K,K,K,K,_,_],
    ],
  },
  corpse_hound: {
    cols: 12, rows: 5, grid: [
      [_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,K,K,'#554433',K,_,_,_,_,_,_],
      [_,K,'#665544','#8b2020','#aa3030','#8b2020','#665544','#554433',K,K,_,_],
      [K,'#554433','#665544','#8b2020','#665544','#8b2020','#554433','#665544','#554433',K,_,_],
      [_,K,K,K,K,_,K,K,_,K,K,_],
    ],
  },
  corpse_automaton: {
    cols: 12, rows: 6, grid: [
      [_,_,_,K,K,K,K,_,_,_,_,_],
      [_,_,K,'#556666','#667777','#556666',K,_,_,_,_,_],
      [_,K,'#667777','#556666','#778888','#556666','#667777',K,K,_,_,_],
      [K,'#556666','#667777','#8b2020','#556666','#8b2020','#667777','#556666',K,_,_,_],
      [_,K,'#667777','#556666',K,K,'#556666','#667777',K,_,_,_],
      [_,_,K,K,_,_,_,K,K,_,_,_],
    ],
  },
  corpse_shade: {
    cols: 10, rows: 5, grid: [
      [_,_,_,_,_,_,_,_,_,_],
      [_,_,K,'#222233','#333344',K,_,_,_,_],
      [_,K,'#333344','#222233','#333344','#222233',K,_,_,_],
      [K,'#222233','#333344','#222233','#333344','#222233','#333344',K,_,_],
      [_,K,K,'#222233',K,K,'#222233',K,K,_],
    ],
  },
  // Safe room — Montor's parlour: dark purple walls, portrait, candelabra, bookshelf, armchair
  safe_room: {
    cols: 40, rows: 30, grid: [
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
      ['#1a1520','#1a1520','#1a1520','#2a1a20','#1a1520','#1a1520','#1a1520','#1a1520','#2a1a20','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#2a1a20','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#2a1a20','#1a1520','#1a1520','#1a1520','#1a1520','#2a1a20','#1a1520','#1a1520','#1a1520','#1a1520','#1a1520','#2a1a20','#1a1520','#1a1520','#1a1520','#1a1520'],
      ['#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,K,K,K,K,K,K,'#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#3a2a20','#3a2a20','#3a2a20','#3a2a20','#3a2a20',K,'#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#2a1a10','#2a1a10','#4a2a4a','#2a1a10','#2a1a10',K,'#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#2a1a10','#44cc44',K,'#44cc44','#2a1a10',K,'#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#2a1a10','#2a1a10','#2a1a10','#2a1a10','#2a1a10',K,'#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,K,K,K,K,K,K,'#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#c8a84a','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,K,K,K,K,K,K,K,K,K,'#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#ff8844','#c8a84a','#c8a84a','#c8a84a','#ff8844','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#8b4513','#5a3a1e','#8b4513','#5a3a1e','#8b4513','#5a3a1e','#8b4513','#5a3a1e',K,'#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#c8a84a','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#aa3333','#3a5a8a','#aa3333','#6a8a3a','#3a5a8a','#aa3333','#6a8a3a','#3a5a8a',K,'#1e1428'],
      ['#1e1428','#1e1428','#221630','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#c8a84a','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#5a3a1e','#8b4513','#5a3a1e','#8b4513','#5a3a1e','#8b4513','#5a3a1e','#8b4513',K,'#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#c8a84a','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,'#3a5a8a','#6a8a3a','#aa3333','#3a5a8a','#aa3333','#6a8a3a','#3a5a8a','#aa3333',K,'#1e1428'],
      ['#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#c8a84a','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428','#1e1428',K,K,K,K,K,K,K,K,K,K,'#1e1428'],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
      ['#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e','#4a3a2e','#3a2a1e','#3a2a1e','#3a2a1e'],
      ['#3a2a1e','#3a2a1e','#4a3a2e',K,K,K,K,K,'#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e'],
      ['#3a2a1e','#3a2a1e','#3a2a1e',K,'#6a2a2a','#8a3a3a','#6a2a2a',K,'#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e'],
      [K,'#3a2a1e','#3a2a1e',K,'#8a3a3a','#6a2a2a','#8a3a3a',K,'#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e'],
      [K,'#4a3a2e','#3a2a1e',K,'#6a2a2a','#8a3a3a','#6a2a2a',K,'#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e','#3a2a1e'],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
      ['#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222'],
      ['#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a'],
      ['#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#3a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a','#1a1a1a'],
      ['#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a'],
      ['#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222','#1a1a1a','#222222'],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
    ],
  },
  npc: {
    cols: 10, rows: 14, grid: [
      [_,_,_,K,K,K,K,_,_,_],
      [_,_,K,C,C,C,C,K,_,_],
      [_,_,K,C,K,K,C,K,_,_],
      [_,_,K,C,C,C,C,K,_,_],
      [_,_,_,K,C,C,K,_,_,_],
      [_,K,K,K,C,C,K,K,K,_],
      [_,K,D,K,C,C,K,D,K,_],
      [_,K,D,D,C,C,D,D,K,_],
      [_,_,K,D,C,C,D,K,_,_],
      [_,_,K,D,C,C,D,K,_,_],
      [_,_,_,K,C,C,K,_,_,_],
      [_,_,_,K,C,C,K,_,_,_],
      [_,_,K,K,_,_,K,K,_,_],
      [_,_,K,K,_,_,K,K,_,_],
    ],
  },
  // Garden Tailor — Keith: hunched groundskeeper in brown cloak, glowing eyes, brighter for contrast
  npc_tailor_grounds: {
    cols: 24, rows: 26, grid: [
      [_,_,_,_,_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,K,'#6b5a3a','#7a6a4a','#7a6a4a','#7a6a4a','#6b5a3a',K,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,K,'#6b5a3a','#7a6a4a','#8a7a5a','#8a7a5a','#7a6a4a','#6b5a3a',K,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,K,'#6a4a3a','#6a4a3a','#6a4a3a','#6a4a3a','#6a4a3a','#6a4a3a',K,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,K,'#6a4a3a','#44ee44',K,K,'#44ee44','#6a4a3a',K,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,K,'#6a4a3a','#6a4a3a','#8a5a3a','#6a4a3a','#6a4a3a','#6a4a3a',K,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,K,K,'#6a4a3a','#6a4a3a',K,K,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,K,K,K,'#5a4a2a','#6b5a3a','#6b5a3a','#5a4a2a',K,K,K,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,K,'#6a4a3a',K,'#5a4a2a','#6b5a3a','#7a6a4a','#7a6a4a','#6b5a3a','#5a4a2a',K,'#6a4a3a',K,_,_,_,_,_,_,_],
      [_,_,_,_,_,K,'#6a4a3a',K,'#5a4a2a','#6b5a3a','#7a6a4a','#7a6a4a','#6b5a3a','#5a4a2a',K,'#6a4a3a',K,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,K,_,K,'#5a4a2a','#6b5a3a','#6b5a3a','#5a4a2a',K,_,K,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,K,'#4a3a2a','#4a3a2a','#4a3a2a','#4a3a2a',K,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,K,'#4a3a2a','#4a3a2a','#4a3a2a','#4a3a2a',K,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,K,K,'#3a2a1a','#3a2a1a',K,K,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,_],
      [K,'#5a3a1e','#6b4e2e','#5a3a1e','#6b4e2e','#5a3a1e',K,'#8b6639',K,'#5a7a3a',K,'#8b6639',K,'#4a6a2a',K,'#8b6639','#5a3a1e','#6b4e2e','#5a3a1e','#6b4e2e','#5a3a1e','#6b4e2e','#5a3a1e',K],
      [K,'#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e',K],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
      [K,'#3d2b1a',K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#3d2b1a',K],
      [K,'#3d2b1a',K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#3d2b1a',K],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    ],
  },
  // Garden Peddler — shifty hooded figure with bright cloak, glowing red eyes, dark cart
  npc_peddler_grounds: {
    cols: 24, rows: 24, grid: [
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,K,K,K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#5a3a5a','#6a4a6a','#5a3a5a',K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#5a3a5a','#6a4a6a','#6a4a6a','#5a3a5a',K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#6a4a3a','#6a4a3a','#6a4a3a','#6a4a3a',K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#6a4a3a','#ff4444',K,'#ff4444',K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#6a4a3a','#6a4a3a','#6a4a3a','#6a4a3a',K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,K,'#6a4a3a',K,K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,K,K,'#6a4a6a','#5a3a5a','#5a3a5a','#6a4a6a',K,K,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,K,'#6a4a3a',K,'#6a4a6a','#5a3a5a','#5a3a5a','#6a4a6a',K,'#6a4a3a',K,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,K,K,'#5a3a5a','#5a3a5a','#5a3a5a','#5a3a5a',K,K,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,'#4a3a2a','#4a3a2a','#4a3a2a','#4a3a2a',K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_,_],
      [_,K,K,K,K,K,K,K,K,K,K,K,K,K,_,_,_,_,_,_,_,_,_,_],
      [K,'#3a2a3a','#5a3a1e','#3a2a3a','#5a3a1e','#3a2a3a','#5a3a1e','#3a2a3a','#5a3a1e','#3a2a3a','#5a3a1e','#3a2a3a',K,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#4a7a2a','#aa3333','#c8a84a','#5a8a3a','#7a3a9a','#8b6639','#4a7a2a','#aa3333','#c8a84a','#5a8a3a','#7a3a9a',K,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#aa3333','#5a8a3a','#7a3a9a','#c8a84a','#4a7a2a','#aa3333','#8b6639','#5a8a3a','#7a3a9a','#c8a84a','#4a7a2a',K,_,_,_,_,_,_,_,_,_,_,_],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,K,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,K,'#5a3a1e','#5a3a1e',K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,K,'#3d2b1a','#5a3a1e','#5a3a1e','#3d2b1a',K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,K,K,K,K,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
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

  // === JUNK PILE SPRITES — Garden theme ===
  // Base orientation: flat bottom + flat left (bottom-left corner). CSS flips for others.
  // Each size has a DIFFERENT silhouette shape (not all triangles!)

  // --- Size 1: Scraps — low wide lumpy, broken pot + leaves (20x10 at scale 3 = 60x30px) ---
  junk_garden_1: {
    cols: 20, rows: 10, grid: [
      [K,K,_,_,_,_,_,_,_,_,_,_,_,'#4a6a2a','#4a6a2a',_,_,_,_,_],
      [K,'#5a3a1e',K,K,_,_,_,_,_,_,_,_,'#4a6a2a','#7a9a4a','#5a7a3a','#4a6a2a',_,_,_,_],
      [K,'#6b4e2e','#8b6639','#5a3a1e',K,K,_,_,_,_,K,K,'#c47a3a','#c47a3a',K,'#7a9a4a',K,_,_,_],
      [K,'#8b6639','#5a3a1e','#6b4e2e','#8b6639','#5a3a1e',K,K,K,K,'#c47a3a','#d4854a','#aa6633','#c47a3a','#5a7a3a','#5a7a3a','#4a6a2a',K,_,_],
      [K,'#5a3a1e','#6b4e2e','#8b6639','#5a3a1e','#8b4513','#6b4e2e','#8b6639','#aa6633','#c47a3a','#d4854a','#c47a3a','#8b6639','#6b4e2e','#8b6639','#5a7a3a','#4a6a2a',K,_,_],
      [K,'#6b4e2e','#8b4513','#5a3a1e','#6b4e2e','#8b6639','#5a3a1e','#aa6633','#c47a3a','#8b6639','#6b4e2e','#aa6633','#5a3a1e','#8b6639','#6b4e2e','#5a3a1e','#5a7a3a',K,_,_],
      [K,'#5a3a1e','#6b4e2e','#8b6639','#5a3a1e','#6b4e2e','#8b4513','#6b4e2e','#5a3a1e','#6b4e2e','#8b6639','#5a3a1e','#6b4e2e','#5a3a1e','#8b6639','#6b4e2e','#5a3a1e','#4a6a2a',K,_],
      [K,'#3d2b1a','#5a3a1e','#6b4e2e','#3d2b1a','#5a3a1e','#6b4e2e','#3d2b1a','#6b4e2e','#5a3a1e','#3d2b1a','#6b4e2e','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#6b4e2e','#5a3a1e',K,_],
      [K,'#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#3d2b1a',K],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,K],
    ],
  },

  // --- Size 2: Heap — tall spiky, fork handle + plank jutting up (14x23 at scale 3) ---
  junk_garden_2: {
    cols: 14, rows: 23, grid: [
      [_,_,'#8b4513',_,_,_,_,_,_,_,_,_,_,_],
      [_,_,'#8b4513',_,_,_,_,_,_,_,_,_,_,_],
      [_,_,'#8b4513',_,_,_,_,_,'#9b7653',_,_,_,_,_],
      [_,_,K,_,_,_,_,_,'#9b7653',_,_,_,_,_],
      [_,_,K,_,_,_,_,'#9b7653','#8b4513',_,_,_,_,_],
      [K,K,'#5a7a3a',K,_,_,_,'#8b4513',K,_,_,_,_,_],
      [K,'#5a7a3a','#7a9a4a','#4a6a2a',K,_,'#8b4513',K,_,_,_,_,_,_],
      [K,'#aa6633','#c47a3a','#5a7a3a','#7a9a4a',K,K,_,_,_,_,_,_,_],
      [K,'#c47a3a','#d4854a','#aa6633','#c47a3a',K,_,_,_,_,_,_,_,_],
      [K,'#8b6639','#aa6633','#c47a3a','#8b6639',K,_,_,_,_,_,_,_,_],
      [K,'#6b4e2e','#8b6639','#666','#888','#666',K,_,_,_,_,_,_,_],
      [K,'#8b4513','#6b4e2e','#888','#666','#888','#5a7a3a',K,_,_,_,_,_,_],
      [K,'#5a3a1e','#8b4513','#6b4e2e','#8b6639','#6b4e2e','#4a6a2a',K,_,_,_,_,_,_],
      [K,'#6b4e2e','#5a3a1e','#c47a3a','#aa6633','#8b6639','#5a7a3a','#4a6a2a',K,_,_,_,_,_],
      [K,'#8b6639','#6b4e2e','#5a3a1e','#8b4513','#aa6633','#6b4e2e','#5a7a3a',K,_,_,_,_,_],
      [K,'#5a3a1e','#8b6639','#6b4e2e','#8b6639','#5a3a1e','#8b4513','#6b4e2e','#4a6a2a',K,_,_,_,_],
      [K,'#6b4e2e','#5a3a1e','#8b4513','#5a3a1e','#6b4e2e','#8b6639','#5a3a1e','#5a7a3a',K,_,_,_,_],
      [K,'#5a3a1e','#6b4e2e','#8b6639','#6b4e2e','#5a3a1e','#6b4e2e','#8b6639','#6b4e2e','#4a6a2a',K,_,_,_],
      [K,'#3d2b1a','#5a3a1e','#6b4e2e','#5a3a1e','#6b4e2e','#5a3a1e','#5a3a1e','#8b6639','#5a3a1e',K,_,_,_],
      [K,'#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#6b4e2e','#3d2b1a','#5a3a1e','#6b4e2e','#5a3a1e',K,_,_],
      [K,'#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a',K,_],
      [K,'#3d2b1a','#3d2b1a','#3d2b1a','#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a',K],
      [K,K,K,K,K,K,K,K,K,K,K,K,K],
    ],
  },

  // --- Size 3: Mound — big dome, wheelbarrow, pots, weeds (22x18 at scale 3) ---
  junk_garden_3: {
    cols: 22, rows: 18, grid: [
      [K,K,K,_,_,_,_,_,_,_,_,_,_,_,_,'#4a6a2a','#7a9a4a',_,_,_,_,_],
      [K,'#5a7a3a','#4a6a2a',K,K,_,_,_,_,_,_,_,_,'#4a6a2a','#7a9a4a','#5a7a3a','#4a6a2a',_,_,_,_,_],
      [K,'#7a9a4a','#5a7a3a','#c47a3a','#aa6633',K,K,_,_,_,_,_,K,'#888',K,'#7a9a4a','#5a7a3a',K,_,_,_,_],
      [K,'#c47a3a','#d4854a','#aa6633','#c47a3a','#8b6639',K,K,_,'#888','#666','#888','#666',K,'#888',K,_,_,_,_,_,_],
      [K,'#aa6633','#c47a3a','#8b6639','#d4854a','#5a7a3a','#6b4e2e',K,K,'#666',_,'#888',K,_,_,_,_,_,_,_,_,_],
      [K,'#8b6639','#6b4e2e','#aa6633','#c47a3a','#8b6639','#5a7a3a','#4a6a2a','#888',K,_,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#6b4e2e','#9b7653','#8b6639','#aa6633','#6b4e2e','#c47a3a','#5a7a3a',K,_,_,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#8b4513','#6b4e2e','#9b7653','#8b6639','#aa6633','#8b6639','#6b4e2e','#4a6a2a',K,_,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#9b7653','#8b6639','#6b4e2e','#c47a3a','#9b7653','#6b4e2e','#8b4513','#5a7a3a',K,_,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#6b4e2e','#c47a3a','#8b4513','#8b6639','#6b4e2e','#aa6633','#9b7653','#6b4e2e','#7a9a4a',K,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#5a3a1e','#9b7653','#6b4e2e','#aa6633','#8b6639','#5a3a1e','#c47a3a','#8b6639','#5a7a3a',K,_,_,_,_,_,_,_,_,_,_,_],
      [K,'#8b4513','#5a3a1e','#8b6639','#6b4e2e','#c47a3a','#8b4513','#6b4e2e','#aa6633','#6b4e2e','#4a6a2a',K,_,_,_,_,_,_,_,_,_,_],
      [K,'#6b4e2e','#8b6639','#5a3a1e','#8b4513','#6b4e2e','#9b7653','#8b6639','#5a3a1e','#8b4513','#5a7a3a',K,_,_,_,_,_,_,_,_,_,_],
      [K,'#5a3a1e','#6b4e2e','#8b6639','#6b4e2e','#5a3a1e','#6b4e2e','#5a3a1e','#8b6639','#6b4e2e','#5a3a1e','#4a6a2a',K,_,_,_,_,_,_,_,_,_],
      [K,'#3d2b1a','#5a3a1e','#6b4e2e','#5a3a1e','#8b4513','#5a3a1e','#6b4e2e','#5a3a1e','#8b6639','#6b4e2e','#5a3a1e',K,_,_,_,_,_,_,_,_,_],
      [K,'#3d2b1a','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#6b4e2e','#3d2b1a','#5a3a1e','#6b4e2e','#5a3a1e','#6b4e2e','#5a3a1e',K,_,_,_,_,_,_,_,_],
      [K,'#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#5a3a1e','#3d2b1a','#6b4e2e','#5a3a1e','#3d2b1a','#5a3a1e',K,_,_,_,_,_,_,_],
      [K,K,K,K,K,K,K,K,K,K,K,K,K,K,K,_,_,_,_,_,_,_],
    ],
  },

  // All non-garden themes use programmatic palette swap of the garden shapes
  // Generated at runtime via drawChamberIcon fallback — if sprite not found, uses garden shape
}

function drawChamberIcon(canvas, iconKey, theme, scale) {
  var sprite = CHAMBER_ICONS[iconKey]
  // Fallback: floor-specific NPC → generic NPC
  if (!sprite && iconKey.indexOf('npc_') === 0) sprite = CHAMBER_ICONS.npc
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

// --- Condition icons (tiny 6x6 sprites) ---
var CONDITION_ICONS = {
  BLEED: {
    cols: 6, rows: 6, grid: [
      [_,_,'#cc2222',_,_,_],
      [_,'#cc2222','#ff4444','#cc2222',_,_],
      [_,'#cc2222','#ff4444','#cc2222',_,_],
      [_,_,'#cc2222','#ff4444','#cc2222',_],
      [_,_,_,'#cc2222','#cc2222',_],
      [_,_,_,_,'#cc2222',_],
    ],
  },
  POISON: {
    cols: 6, rows: 6, grid: [
      [_,_,K,K,_,_],
      [_,K,'#44aa44','#44aa44',K,_],
      [K,'#44aa44','#66cc66','#44aa44','#44aa44',K],
      [K,'#44aa44','#44aa44','#66cc66','#44aa44',K],
      [_,K,'#44aa44','#44aa44',K,_],
      [_,_,K,K,_,_],
    ],
  },
  BURN: {
    cols: 6, rows: 6, grid: [
      [_,_,'#ff6600',_,_,_],
      [_,'#ff6600','#ffaa00','#ff6600',_,_],
      ['#ff4400','#ffaa00','#ffcc00','#ffaa00','#ff6600',_],
      [_,'#ff4400','#ffaa00','#ffcc00','#ff6600',_],
      [_,_,'#ff4400','#ff6600',_,_],
      [_,_,_,'#cc2200',_,_],
    ],
  },
  FROST: {
    cols: 6, rows: 6, grid: [
      [_,_,'#88ccff',_,_,_],
      [_,'#88ccff',_,'#88ccff',_,_],
      ['#88ccff',_,'#aaddff',_,'#88ccff',_],
      [_,'#88ccff',_,'#88ccff',_,_],
      [_,_,'#88ccff',_,_,_],
      [_,_,_,_,_,_],
    ],
  },
  NAUSEA: {
    cols: 6, rows: 6, grid: [
      [_,'#88aa44','#88aa44',_,_,_],
      ['#88aa44','#aacc66','#88aa44',_,_,_],
      [_,'#88aa44',_,'#88aa44',_,_],
      [_,_,'#88aa44','#aacc66','#88aa44',_],
      [_,_,_,'#88aa44','#aacc66','#88aa44'],
      [_,_,_,_,'#88aa44','#88aa44'],
    ],
  },
  SLUGGISH: {
    cols: 6, rows: 6, grid: [
      [_,_,_,_,_,_],
      [_,K,K,K,K,_],
      [K,'#887766','#aa9988',K,_,_],
      [K,'#aa9988','#887766','#aa9988',K,_],
      [_,K,'#887766','#aa9988',K,_],
      [_,_,K,K,K,_],
    ],
  },
  FEAR: {
    cols: 6, rows: 6, grid: [
      [_,'#cc44cc',_,_,_,_],
      ['#cc44cc','#ee66ee','#cc44cc',_,_,_],
      ['#cc44cc','#ee66ee','#cc44cc',_,_,_],
      [_,'#cc44cc',_,_,_,_],
      [_,_,_,_,_,_],
      [_,'#cc44cc',_,_,_,_],
    ],
  },
  FRENZY: {
    cols: 6, rows: 6, grid: [
      [_,'#ff4444',_,'#ff4444',_,_],
      ['#ff4444','#ff6666','#ff4444','#ff6666','#ff4444',_],
      [_,'#ff4444','#ff6666','#ff4444',_,_],
      ['#ff4444','#ff6666','#ff4444','#ff6666','#ff4444',_],
      [_,'#ff4444',_,'#ff4444',_,_],
      [_,_,_,_,_,_],
    ],
  },
  CHARM: {
    cols: 6, rows: 6, grid: [
      [_,'#ff66aa',_,'#ff66aa',_,_],
      ['#ff66aa','#ff88cc','#ff88cc','#ff88cc','#ff66aa',_],
      ['#ff66aa','#ff88cc','#ffaadd','#ff88cc','#ff66aa',_],
      [_,'#ff66aa','#ff88cc','#ff66aa',_,_],
      [_,_,'#ff66aa',_,_,_],
      [_,_,_,_,_,_],
    ],
  },
  DAZE: {
    cols: 6, rows: 6, grid: [
      [_,'#ffcc00',_,_,'#ffcc00',_],
      [_,_,'#ffcc00',_,_,_],
      ['#ffcc00',_,_,'#ffcc00',_,_],
      [_,_,'#ffcc00',_,_,'#ffcc00'],
      [_,'#ffcc00',_,_,'#ffcc00',_],
      [_,_,_,_,_,_],
    ],
  },
  BORED: {
    cols: 6, rows: 6, grid: [
      [_,_,_,_,_,_],
      [_,K,K,K,K,_],
      [K,_,_,_,_,K],
      [K,_,K,K,_,K],
      [_,K,K,K,K,_],
      [_,_,_,_,_,_],
    ],
  },
  SAD: {
    cols: 6, rows: 6, grid: [
      [_,_,'#5588cc',_,_,_],
      [_,'#5588cc','#77aaee','#5588cc',_,_],
      [_,_,'#5588cc',_,_,_],
      [_,'#5588cc',_,'#5588cc',_,_],
      ['#5588cc',_,_,_,'#5588cc',_],
      [_,_,_,_,_,_],
    ],
  },
  BLIND: {
    cols: 6, rows: 6, grid: [
      [_,K,K,K,K,_],
      [K,'#444444','#444444','#444444','#444444',K],
      [K,'#444444','#222222','#222222','#444444',K],
      [K,'#444444','#222222','#222222','#444444',K],
      [K,'#444444','#444444','#444444','#444444',K],
      [_,K,K,K,K,_],
    ],
  },
  BLOODLUST: {
    cols: 6, rows: 6, grid: [
      [_,'#cc2222',_,'#cc2222',_,_],
      ['#cc2222','#ff4444','#ff4444','#ff4444','#cc2222',_],
      ['#cc2222','#ff4444','#ff6666','#ff4444','#cc2222',_],
      [_,'#cc2222','#ff4444','#cc2222',_,_],
      [_,_,'#cc2222',_,_,_],
      [_,_,'#880000',_,_,_],
    ],
  },
  WET: {
    cols: 6, rows: 6, grid: [
      [_,_,'#4488cc',_,_,_],
      [_,'#4488cc','#66aaee','#4488cc',_,_],
      [_,_,'#4488cc',_,_,_],
      [_,'#4488cc',_,'#4488cc',_,_],
      ['#4488cc','#66aaee','#4488cc','#66aaee','#4488cc',_],
      [_,'#4488cc',_,'#4488cc',_,_],
    ],
  },
  CHARGED: {
    cols: 6, rows: 6, grid: [
      [_,_,'#ffee44',_,_,_],
      [_,'#ffee44','#ffff88',_,_,_],
      [_,'#ffee44','#ffff88','#ffee44',_,_],
      [_,_,'#ffee44','#ffff88',_,_],
      [_,_,_,'#ffee44',_,_],
      [_,_,'#ffee44',_,_,_],
    ],
  },
  ADRENALINE: {
    cols: 6, rows: 6, grid: [
      [_,_,'#44dd44',_,_,_],
      [_,'#44dd44','#66ff66',_,_,_],
      ['#44dd44','#66ff66','#44dd44','#44dd44',_,_],
      [_,'#44dd44','#66ff66','#44dd44',_,_],
      [_,_,'#44dd44',_,_,_],
      [_,_,'#22aa22',_,_,_],
    ],
  },
  ADRENALINE_CRASH: {
    cols: 6, rows: 6, grid: [
      [_,_,'#aa4444',_,_,_],
      [_,'#aa4444','#cc6666',_,_,_],
      ['#aa4444','#cc6666','#aa4444','#aa4444',_,_],
      [_,'#aa4444','#cc6666','#aa4444',_,_],
      [_,_,'#aa4444',_,_,_],
      [_,_,'#882222',_,_,_],
    ],
  },
}

function drawConditionIcon(canvas, conditionId, scale) {
  var sprite = CONDITION_ICONS[conditionId]
  if (!sprite) { canvas.width = 0; canvas.height = 0; return }
  var px = scale || 3
  canvas.width = sprite.cols * px
  canvas.height = sprite.rows * px
  canvas.style.imageRendering = 'pixelated'
  var ctx = canvas.getContext('2d')
  for (var r = 0; r < sprite.rows; r++) {
    for (var c = 0; c < sprite.cols; c++) {
      var v = sprite.grid[r][c]
      if (v === null) continue
      ctx.fillStyle = v
      ctx.fillRect(c * px, r * px, px, px)
    }
  }
}

export { SPRITES, PLAYER_SPRITES, CLASS_COLOURS, TIERS, DARK_TIERS, drawSprite, drawPlayerSprite, DOOR_SPRITE, DOOR_THEMES, drawDoorSprite, CHAMBER_ICONS, drawChamberIcon, CONDITION_ICONS, drawConditionIcon }
