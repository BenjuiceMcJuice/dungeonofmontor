import { useRef, useEffect, useState } from 'react'
import GroqKeyInput from './GroqKeyInput.jsx'
import PersonalityPicker from './PersonalityPicker.jsx'

var P = 3, W = 480, H = 340

function LandingScene({ onEnter }) {
  var canvasRef = useRef(null)
  var animRef = useRef(null)
  var [phase, setPhase] = useState('typing') // typing | ready | entering | name
  var [displayText, setDisplayText] = useState('')
  var [showButton, setShowButton] = useState(false)
  var [name, setName] = useState('')
  var typeState = useRef({ msgIdx: 0, charIdx: 0, timer: 0 })

  var messages = [
    "You have found the entrance.",
    "The door is open.",
    "It is always open.",
  ]

  // ── Drawing helpers ──
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x * P, y * P, w * P, h * P) }
  function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x * P, y * P, P, P) }
  function rowFn(ctx, y, xs, c) { ctx.fillStyle = c; for (var i = 0; i < xs.length; i++) ctx.fillRect(xs[i] * P, y * P, P, P) }
  function colFn(ctx, x, ys, c) { ctx.fillStyle = c; for (var i = 0; i < ys.length; i++) ctx.fillRect(x * P, ys[i] * P, P, P) }

  // ── Scene layers ──

  function drawSky(ctx, t) {
    var bands = [[0, 12, '#030509'], [12, 10, '#04060c'], [22, 10, '#050810'], [32, 8, '#060a0e'], [40, 8, '#07090c'], [48, 8, '#070a0a'], [56, 8, '#080c0a']]
    for (var i = 0; i < bands.length; i++) rect(ctx, 0, bands[i][0], 160, bands[i][1], bands[i][2])

    var stars = [[6, 2], [15, 5], [24, 3], [36, 7], [48, 2], [58, 6], [70, 4], [82, 2], [94, 7], [105, 3], [116, 5], [128, 2], [142, 6], [154, 4], [19, 9], [44, 8], [86, 10], [112, 8], [138, 9], [10, 11], [32, 12], [65, 11], [98, 12], [150, 10], [22, 14], [54, 13], [78, 15], [118, 13], [156, 14]]
    for (var s = 0; s < stars.length; s++) {
      var tw = Math.sin(t * 0.0008 + stars[s][0] * 0.4 + stars[s][1] * 0.6) * 0.5 + 0.5
      px(ctx, stars[s][0], stars[s][1], tw > 0.6 ? '#8899aa' : tw > 0.3 ? '#445566' : '#222233')
    }

    // Moon
    var mx = 126, my = 11
    ctx.fillStyle = 'rgba(80,70,20,0.18)'; ctx.beginPath(); ctx.arc(mx * P, my * P, 10 * P, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(100,90,25,0.12)'; ctx.beginPath(); ctx.arc(mx * P, my * P, 7 * P, 0, Math.PI * 2); ctx.fill()
    rect(ctx, mx - 3, my - 3, 6, 6, '#c4a81e'); rect(ctx, mx - 2, my - 4, 4, 2, '#c4a81e')
    rect(ctx, mx - 4, my - 2, 2, 4, '#c4a81e'); rect(ctx, mx + 2, my - 2, 2, 4, '#c4a81e')
    rect(ctx, mx - 2, my + 2, 4, 2, '#c4a81e')
    rect(ctx, mx + 1, my, 2, 2, '#a88c18'); rect(ctx, mx - 1, my - 1, 1, 1, '#a88c18')
  }

  function drawBuilding(ctx, t) {
    rect(ctx, 52, 8, 56, 46, '#050708')
    for (var bx = 52; bx < 108; bx += 5) { if (Math.floor(bx / 5) % 2 === 0) rect(ctx, bx, 4, 4, 5, '#050708') }
    rect(ctx, 20, 14, 18, 40, '#060809')
    for (var bx2 = 20; bx2 < 38; bx2 += 4) { if (Math.floor(bx2 / 4) % 2 === 0) rect(ctx, bx2, 10, 3, 5, '#060809') }
    rect(ctx, 24, 2, 8, 13, '#040607'); rect(ctx, 25, 0, 6, 3, '#040607'); rect(ctx, 27, -1, 2, 2, '#040607')
    rect(ctx, 122, 14, 18, 40, '#060809')
    for (var bx3 = 122; bx3 < 140; bx3 += 4) { if (Math.floor(bx3 / 4) % 2 === 0) rect(ctx, bx3, 10, 3, 5, '#060809') }
    rect(ctx, 128, 2, 8, 13, '#040607'); rect(ctx, 129, 0, 6, 3, '#040607'); rect(ctx, 131, -1, 2, 2, '#040607')
    rect(ctx, 74, 0, 12, 9, '#040607'); rect(ctx, 76, -1, 8, 2, '#030506')

    var wp = Math.sin(t * 0.002) * 0.3 + 0.7
    var wins = [[60, 18, 6, 8], [76, 18, 8, 8], [92, 18, 6, 8], [64, 30, 4, 6], [84, 30, 4, 6]]
    for (var wi = 0; wi < wins.length; wi++) {
      var ww = wins[wi]
      ctx.fillStyle = 'rgba(180,110,15,' + (0.12 * wp) + ')'; ctx.fillRect(ww[0] * P, ww[1] * P, ww[2] * P, ww[3] * P)
      rect(ctx, ww[0], ww[1], ww[2], ww[3], '#0a0700')
      ctx.fillStyle = 'rgba(200,130,20,' + (0.35 * wp) + ')'; ctx.fillRect((ww[0] + 1) * P, (ww[1] + 1) * P, (ww[2] - 2) * P, (ww[3] - 2) * P)
    }
    var rp = Math.sin(t * 0.003 + 1) * 0.4 + 0.6
    ctx.fillStyle = 'rgba(180,15,5,' + (0.35 * rp) + ')'; ctx.fillRect(25 * P, 18 * P, 4 * P, 6 * P)
    rect(ctx, 25, 18, 4, 6, '#080200')
    ctx.fillStyle = 'rgba(220,20,5,' + (0.55 * rp) + ')'; ctx.fillRect(26 * P, 19 * P, 2 * P, 4 * P)
    ctx.fillStyle = 'rgba(180,15,5,' + (0.35 * rp) + ')'; ctx.fillRect(131 * P, 18 * P, 4 * P, 6 * P)
    rect(ctx, 131, 18, 4, 6, '#080200')
    ctx.fillStyle = 'rgba(220,20,5,' + (0.55 * rp) + ')'; ctx.fillRect(132 * P, 19 * P, 2 * P, 4 * P)

    // Dead trees
    colFn(ctx, 16, [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63], '#060908')
    colFn(ctx, 17, [50, 51, 52, 53, 54, 55, 56, 57, 58], '#060908')
    rowFn(ctx, 52, [11, 12, 13, 14, 15], '#060908'); rowFn(ctx, 54, [10, 11, 12], '#060908')
    rowFn(ctx, 56, [12, 13, 14, 15, 16], '#060908'); rowFn(ctx, 58, [11, 12, 13], '#060908')
    rowFn(ctx, 60, [13, 14, 15, 16, 17], '#060908')
    colFn(ctx, 143, [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63], '#060908')
    colFn(ctx, 144, [50, 51, 52, 53, 54, 55, 56, 57], '#060908')
    rowFn(ctx, 52, [143, 144, 145, 146, 147], '#060908'); rowFn(ctx, 54, [146, 147, 148], '#060908')
    rowFn(ctx, 56, [142, 143, 144, 145], '#060908'); rowFn(ctx, 58, [145, 146, 147], '#060908')
    rowFn(ctx, 60, [141, 142, 143, 144], '#060908')
  }

  function drawGarden(ctx) {
    rect(ctx, 0, 54, 160, 20, '#0a1608')
    for (var gx = 0; gx < 160; gx += 3) rect(ctx, gx, 54, 2, 2, Math.sin(gx * 0.8) * 0.5 > 0 ? '#0c1a08' : '#081208')
    for (var gx2 = 1; gx2 < 160; gx2 += 5) rect(ctx, gx2, 60, 2, 1, '#081008')
    for (var gx3 = 0; gx3 < 160; gx3 += 4) rect(ctx, gx3, 66, 3, 2, '#0e1c0a')

    var flowers = [
      [4, 58, '#dd5577'], [9, 54, '#ee88aa'], [14, 60, '#bb3344'], [18, 56, '#eebb22'],
      [22, 62, '#ddddbb'], [3, 66, '#cc5566'], [12, 64, '#ee9933'], [20, 68, '#bbcc44'],
      [6, 70, '#dd6677'], [16, 70, '#eecc33'], [25, 58, '#ee7799'], [28, 64, '#ccddaa'],
      [136, 56, '#ee6688'], [140, 60, '#dd4466'], [145, 54, '#ffaacc'], [149, 62, '#eebb22'],
      [153, 58, '#ccddbb'], [137, 64, '#ee7722'], [143, 68, '#dd5577'], [150, 66, '#bbdd44'],
      [155, 70, '#eedd33'], [132, 62, '#cc4455'], [158, 56, '#ffcc44'], [130, 68, '#cceebb'],
    ]
    for (var f = 0; f < flowers.length; f++) {
      var fl = flowers[f]
      colFn(ctx, fl[0], [fl[1] + 1, fl[1] + 2, fl[1] + 3], '#173010')
      rect(ctx, fl[0] - 1, fl[1] - 1, 3, 1, fl[2]); rowFn(ctx, fl[1], [fl[0] - 1, fl[0], fl[0] + 1], fl[2])
      rect(ctx, fl[0], fl[1] - 2, 1, 1, fl[2]); px(ctx, fl[0], fl[1], '#991133')
    }
    rect(ctx, 32, 66, 2, 2, '#060408'); px(ctx, 31, 65, '#080208'); colFn(ctx, 32, [67, 68, 69], '#0a0c08')

    var vL = [[2, 74], [4, 78], [6, 82], [3, 86], [7, 90], [5, 95]]
    for (var v = 0; v < vL.length; v++) { rect(ctx, vL[v][0], vL[v][1], 2, 2, '#1a3010'); px(ctx, vL[v][0] - 1, vL[v][1] + 1, '#223818') }
    var vR = [[153, 74], [155, 78], [157, 82], [152, 86], [156, 90], [154, 95]]
    for (var v2 = 0; v2 < vR.length; v2++) { rect(ctx, vR[v2][0], vR[v2][1], 2, 2, '#1a3010'); px(ctx, vR[v2][0] + 1, vR[v2][1] + 1, '#223818') }
  }

  function drawDungeonEntrance(ctx, t) {
    rect(ctx, 0, 72, 160, 41, '#181614')
    for (var sy = 72; sy < 113; sy += 6) {
      for (var sx = 0; sx < 160; sx += 8) {
        rect(ctx, sx, sy, 7, 5, Math.sin(sx * 0.7 + sy * 0.5) * 0.5 > 0 ? '#1c1a18' : '#141210')
        rect(ctx, sx, sy, 7, 1, '#201e1c')
      }
    }
    rowFn(ctx, 78, [20, 21, 22, 23, 24], '#0e0c0a'); rowFn(ctx, 85, [60, 61, 62, 63, 64, 65], '#0e0c0a')
    rowFn(ctx, 92, [110, 111, 112, 113], '#0e0c0a'); rowFn(ctx, 100, [30, 31, 32, 33, 34, 35], '#0e0c0a')

    var archStones = [
      [58, 56, 4, 5], [62, 53, 4, 4], [66, 51, 4, 4], [70, 50, 4, 3], [74, 50, 4, 3],
      [78, 50, 4, 3], [82, 51, 4, 4], [86, 53, 4, 4], [90, 56, 4, 5],
    ]
    for (var a = 0; a < archStones.length; a++) {
      var as = archStones[a]
      rect(ctx, as[0], as[1], as[2], as[3], '#2a2624')
      rect(ctx, as[0], as[1], as[2], 1, '#34302c')
      rect(ctx, as[0], as[1] + as[3] - 1, as[2], 1, '#1c1816')
    }
    rect(ctx, 76, 48, 8, 4, '#302c28'); rect(ctx, 77, 47, 6, 2, '#3a3430')

    rect(ctx, 58, 56, 8, 57, '#222020'); rect(ctx, 94, 56, 8, 57, '#222020')
    rowFn(ctx, 65, [58, 59, 60, 61, 62, 63, 64, 65], '#181614')
    rowFn(ctx, 75, [58, 59, 60, 61, 62, 63, 64, 65], '#181614')
    rowFn(ctx, 85, [58, 59, 60, 61, 62, 63, 64, 65], '#181614')
    rowFn(ctx, 65, [94, 95, 96, 97, 98, 99, 100, 101], '#181614')
    rowFn(ctx, 75, [94, 95, 96, 97, 98, 99, 100, 101], '#181614')
    rowFn(ctx, 85, [94, 95, 96, 97, 98, 99, 100, 101], '#181614')

    rect(ctx, 66, 56, 28, 57, '#020202'); rect(ctx, 67, 57, 26, 55, '#030304')
    rect(ctx, 56, 108, 48, 5, '#282422'); rect(ctx, 57, 109, 46, 2, '#302c28'); rect(ctx, 54, 111, 52, 2, '#201e1c')

    rowFn(ctx, 80, [68, 69], '#282420'); rowFn(ctx, 81, [67, 70], '#282420'); rowFn(ctx, 82, [68, 69], '#282420')
    rowFn(ctx, 80, [90, 91], '#282420'); rowFn(ctx, 81, [89, 92], '#282420'); rowFn(ctx, 82, [90, 91], '#282420')

    rect(ctx, 50, 68, 4, 2, '#282422'); rect(ctx, 51, 70, 2, 6, '#1e1c18')
    rect(ctx, 106, 68, 4, 2, '#282422'); rect(ctx, 107, 70, 2, 6, '#1e1c18')
    rect(ctx, 50, 66, 4, 3, '#1a1814'); rect(ctx, 106, 66, 4, 3, '#1a1814')
    var tg = Math.sin(t * 0.003) * 0.5 + 0.5
    ctx.fillStyle = 'rgba(80,50,10,' + (0.06 + tg * 0.04) + ')'; ctx.fillRect(48 * P, 62 * P, 10 * P, 12 * P)
    ctx.fillStyle = 'rgba(80,50,10,' + (0.06 + tg * 0.04) + ')'; ctx.fillRect(102 * P, 62 * P, 10 * P, 12 * P)

    var moss = [[0, 80], [0, 88], [0, 96], [0, 104], [158, 86], [157, 94], [158, 102]]
    for (var m = 0; m < moss.length; m++) {
      if (moss[m][0] === 0) { rect(ctx, 0, moss[m][1], 4, 3, '#1a2e10'); rect(ctx, 1, moss[m][1] - 1, 3, 1, '#223818') }
      else { rect(ctx, 156, moss[m][1], 4, 3, '#1a2e10'); rect(ctx, 157, moss[m][1] - 1, 3, 1, '#223818') }
    }
  }

  function drawPath(ctx, t) {
    var segs = [
      [110, 0, 160], [108, 4, 152], [106, 10, 140], [104, 16, 128], [102, 22, 116], [100, 28, 104],
      [98, 34, 92], [96, 40, 80], [94, 46, 68], [92, 52, 56], [90, 56, 48], [88, 58, 44],
    ]
    for (var s = 0; s < segs.length; s++) {
      rect(ctx, segs[s][1], segs[s][0], segs[s][2], 2, '#b0a070')
      for (var jx = segs[s][1]; jx < segs[s][1] + segs[s][2]; jx += 10) rect(ctx, jx, segs[s][0], 1, 2, '#9a8c60')
      rect(ctx, segs[s][1], segs[s][0], segs[s][2], 1, '#c8b880')
    }
    var ml = Math.sin(t * 0.0005) * 0.5 + 0.5
    ctx.fillStyle = 'rgba(180,160,70,' + (0.06 + ml * 0.05) + ')'; ctx.fillRect(66 * P, 88 * P, 28 * P, 22 * P)
  }

  function drawMist(ctx, t) {
    for (var band = 0; band < 4; band++) {
      var sp = 0.00022 + band * 0.00007
      var oA = Math.sin(t * sp + band * 1.8) * 6
      var oB = Math.sin(t * (sp + 0.0001) + band * 2.4 + 1) * 5
      var y = 96 + band * 3
      ctx.fillStyle = 'rgba(120,150,100,' + (0.1 + band * 0.02) + ')'
      for (var mx = 0; mx < 80 + oA; mx += 3) {
        var mh = 2 + Math.floor(Math.sin(mx * 0.32 + t * 0.0011) * 2)
        ctx.fillRect(mx * P, (y - mh) * P, 3 * P, (mh + 2) * P)
      }
      for (var mx2 = 0; mx2 < 80 + oB; mx2 += 3) {
        var mh2 = 2 + Math.floor(Math.sin(mx2 * 0.38 + t * 0.0009 + 2) * 2)
        ctx.fillRect((160 - mx2) * P, (y - mh2) * P, 3 * P, (mh2 + 2) * P)
      }
    }
    for (var mx3 = 67; mx3 < 93; mx3 += 2) {
      var mh3 = 3 + Math.floor(Math.sin(mx3 * 0.4 + t * 0.0014) * 3)
      ctx.fillStyle = 'rgba(100,120,80,0.16)'; ctx.fillRect(mx3 * P, (56 + 28 - mh3) * P, 2 * P, (mh3 + 2) * P)
    }
  }

  function drawMontor(ctx, t) {
    var p1 = Math.sin(t * 0.02) * 0.5 + 0.5, p2 = Math.sin(t * 0.027 + 1.8) * 0.5 + 0.5
    var ex1 = 74 + Math.sin(t * 0.0005) * 1, ey1 = 72 + Math.sin(t * 0.0008) * 0.8
    var ex2 = 84 + Math.sin(t * 0.0007 + 1.2) * 0.9, ey2 = 70 + Math.sin(t * 0.0006 + 2.1) * 0.7

    ctx.save()
    ctx.globalAlpha = 0.15 + p1 * 0.2; ctx.fillStyle = '#cc2200'
    ctx.beginPath(); ctx.arc(ex1 * P, ey1 * P, 3 * P, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.12 + p2 * 0.18
    ctx.beginPath(); ctx.arc(ex2 * P, ey2 * P, 2.5 * P, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1; ctx.restore()

    rect(ctx, Math.round(ex1), Math.round(ey1), 2, 1, 'rgba(230,50,0,' + (0.55 + p1 * 0.4) + ')')
    px(ctx, Math.round(ex1), Math.round(ey1), 'rgba(255,140,40,' + (0.45 + p1 * 0.4) + ')')
    rect(ctx, Math.round(ex2), Math.round(ey2), 1, 1, 'rgba(210,35,0,' + (0.5 + p2 * 0.35) + ')')

    ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.fillRect(64 * P, 90 * P, 32 * P, 12 * P)
  }

  function drawTitle(ctx) {
    ctx.save(); ctx.textAlign = 'center'

    // "DUNGEON OF" — iron/bronze tone, large
    ctx.font = (P * 3.5) + "px 'Press Start 2P',monospace"
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillText('DUNGEON OF', W / 2 + 2, 10 * P + 2)
    ctx.fillStyle = '#8b5e3c'; ctx.shadowColor = '#5a3420'; ctx.shadowBlur = 10
    ctx.fillText('DUNGEON OF', W / 2, 10 * P)
    ctx.shadowBlur = 0

    // "MONTOR" — huge, void purple to crimson gradient, heavy glow
    ctx.font = (P * 7) + "px 'Press Start 2P',monospace"
    // Shadow layer
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillText('MONTOR', W / 2 + 3, 28 * P + 3)
    // Purple glow halo
    ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 30
    ctx.fillStyle = '#9b59b6'; ctx.fillText('MONTOR', W / 2, 28 * P)
    // Gradient fill: void purple → crimson → deep red
    var g = ctx.createLinearGradient(0, 18 * P, 0, 30 * P)
    g.addColorStop(0, '#c06ee0')       // light purple top
    g.addColorStop(0.4, '#9b59b6')     // void purple
    g.addColorStop(0.7, '#cc2222')     // crimson
    g.addColorStop(1, '#5b2a7a')       // deep void
    ctx.fillStyle = g; ctx.shadowColor = '#7a2090'; ctx.shadowBlur = 40
    ctx.fillText('MONTOR', W / 2, 28 * P)
    ctx.shadowBlur = 0

    // Thin rule line under title — iron colour
    ctx.fillStyle = '#5a3420'; ctx.fillRect(20 * P, 31 * P, 120 * P, P)
    ctx.fillStyle = '#8b5e3c'; ctx.fillRect(22 * P, 31 * P, 116 * P, 1)
    ctx.restore()
  }

  function renderScene(ctx, t) {
    ctx.clearRect(0, 0, W, H)
    drawSky(ctx, t); drawBuilding(ctx, t); drawGarden(ctx); drawDungeonEntrance(ctx, t)
    drawPath(ctx, t); drawMist(ctx, t); drawMontor(ctx, t); drawTitle(ctx)
  }

  // Canvas animation loop
  useEffect(function() {
    var canvas = canvasRef.current
    if (!canvas) return
    var ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    function loop(t) { renderScene(ctx, t); animRef.current = requestAnimationFrame(loop) }
    animRef.current = requestAnimationFrame(loop)
    return function() { cancelAnimationFrame(animRef.current) }
  }, [])

  // Typewriter
  useEffect(function() {
    if (phase !== 'typing') return
    var ts = typeState.current
    var interval = setInterval(function() {
      if (ts.msgIdx >= messages.length) {
        setPhase('ready'); setShowButton(true); clearInterval(interval); return
      }
      ts.charIdx++
      var msg = messages[ts.msgIdx]
      if (ts.charIdx > msg.length) { ts.charIdx = 0; ts.msgIdx++; return }
      var text = messages.slice(0, ts.msgIdx).join(' ')
      if (ts.msgIdx > 0) text += ' '
      text += msg.slice(0, ts.charIdx)
      setDisplayText(text)
    }, 46)
    return function() { clearInterval(interval) }
  }, [phase])

  // Skip typewriter — click anywhere during typing to jump to ready
  function handleSkipTypewriter() {
    if (phase === 'typing') {
      var fullText = messages.join(' ')
      setDisplayText(fullText)
      setPhase('ready')
      setShowButton(true)
    }
  }

  function handleEnter() {
    setPhase('entering'); setDisplayText('You step inside.'); setShowButton(false)
    setTimeout(function() {
      setDisplayText('Something stirs in the dark.')
      setTimeout(function() { setPhase('name') }, 1500)
    }, 1400)
  }

  function handleStart() {
    document.activeElement && document.activeElement.blur()
    window.scrollTo(0, 0)
    setTimeout(function() { onEnter(name.trim() || 'Unnamed Knight') }, 100)
  }

  var pixelFont = "'Press Start 2P', monospace"
  var displayFont = "'Sorts Mill Goudy', serif"
  var uiFont = "system-ui, -apple-system, sans-serif"

  return (
    <div className="h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#030408' }}
      onClick={handleSkipTypewriter}
    >
      <div className="w-full max-w-[480px] relative" style={{ border: '4px solid #2a1a30', borderRadius: '2px' }}>
        {/* Scene canvas */}
        <div className="relative" style={{ cursor: phase === 'typing' ? 'pointer' : 'default' }}>
          <canvas ref={canvasRef} width={W} height={H} className="block w-full" style={{ imageRendering: 'pixelated' }} />
          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)'
          }} />
          {/* Skip hint during typing */}
          {phase === 'typing' && (
            <div className="absolute bottom-2 right-3 pointer-events-none">
              <span style={{ fontFamily: uiFont, fontSize: '10px', color: '#4a4a52', letterSpacing: '1px' }}>
                tap to skip
              </span>
            </div>
          )}
        </div>

        {/* Text panel */}
        <div className="p-5 min-h-[120px] flex flex-col justify-between" style={{ background: '#030408', borderTop: '3px solid #2a1a30' }}>
          {/* Typewriter / narrative text */}
          <div>
            <p style={{ fontFamily: displayFont, fontSize: '15px', lineHeight: '1.8', color: '#d4c8a0', minHeight: '50px', fontStyle: 'italic' }}>
              {displayText}
              {phase === 'typing' && <span className="inline-block w-2 h-3 align-middle ml-0.5 animate-pulse" style={{ background: '#d4c8a0' }} />}
            </p>
          </div>

          {/* Enter button */}
          {showButton && phase === 'ready' && (
            <div className="flex justify-center mt-4">
              <button onClick={function(e) { e.stopPropagation(); handleEnter() }}
                style={{
                  fontFamily: uiFont, fontSize: '14px', background: '#0e0818', border: '2px solid #7a3a9a',
                  color: '#c06ee0', padding: '12px 28px', cursor: 'pointer', letterSpacing: '2px', textTransform: 'uppercase',
                  boxShadow: '0 0 24px rgba(155,89,182,0.3)', borderRadius: '6px', fontWeight: 600,
                }}>
                Enter Dungeon
              </button>
            </div>
          )}

          {/* Name input */}
          {phase === 'name' && (
            <div className="mt-4 flex flex-col gap-3" onClick={function(e) { e.stopPropagation() }}>
              <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#8b5e3c', fontStyle: 'italic' }}>
                What is your name, knight?
              </p>
              <input type="text" placeholder="..." enterKeyHint="go" autoComplete="off" autoFocus
                value={name} onChange={function(e) { setName(e.target.value) }}
                onKeyDown={function(e) { if (e.key === 'Enter') handleStart() }}
                style={{
                  fontFamily: uiFont, fontSize: '16px', background: '#060410', border: '2px solid #2a1a30',
                  color: '#d4c8a0', padding: '12px 14px', outline: 'none', letterSpacing: '1px',
                  borderBottom: '2px solid #7a3a9a', borderRadius: '4px',
                }}
              />
              <div className="flex justify-center">
                <button onClick={handleStart}
                  style={{
                    fontFamily: uiFont, fontSize: '14px', background: '#0e0818', border: '2px solid #7a3a9a',
                    color: '#c06ee0', padding: '12px 28px', cursor: 'pointer', letterSpacing: '2px', textTransform: 'uppercase',
                    boxShadow: '0 0 24px rgba(155,89,182,0.3)', borderRadius: '6px', fontWeight: 600,
                  }}>
                  Begin
                </button>
              </div>
            </div>
          )}
        </div>
        {/* AI settings — bottom corner */}
        <div style={{ position: 'absolute', bottom: '12px', right: '12px' }} className="flex flex-col items-end gap-1">
          <PersonalityPicker />
          <GroqKeyInput />
        </div>
      </div>
    </div>
  )
}

export default LandingScene
