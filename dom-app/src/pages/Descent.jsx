// Montor's Descent — junk platformer P0. Mounts the canvas engine; React only owns the frame.
import { useEffect, useRef } from 'react'
import { createDescentGame, VIEW_W, VIEW_H } from '../descent/engine.js'
import { buildDescentAssets } from '../descent/assets.js'

var pixelFont = "'Press Start 2P', monospace"
var uiFont = "system-ui, -apple-system, sans-serif"

function Descent({ onExit }) {
  var canvasRef = useRef(null)

  useEffect(function() {
    var game = createDescentGame(canvasRef.current, buildDescentAssets('garden'), {})
    return function() { game.destroy() }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#050407', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '720px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
        <span style={{ fontFamily: pixelFont, fontSize: '10px', color: '#d4a017' }}>MONTOR'S DESCENT</span>
        <button onClick={onExit} style={{ fontFamily: uiFont, fontSize: '11px', color: '#8b7b60', background: 'none', border: '1px solid #2a1a30', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer' }}>
          Back to Tavern
        </button>
      </div>
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H}
        style={{ width: '100%', maxWidth: '720px', aspectRatio: VIEW_W + ' / ' + VIEW_H, imageRendering: 'pixelated', touchAction: 'none', display: 'block' }} />
      <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#5a4a60', padding: '10px 16px', maxWidth: '720px', textAlign: 'center' }}>
        Keyboard: arrows / WASD, Z jump, X act, C roll. Touch: pad and buttons on the canvas.
      </p>
    </div>
  )
}

export default Descent
