import { useRef, useEffect } from 'react'
import { drawChamberIcon } from '../lib/sprites.js'

function ChamberIcon({ iconKey, theme, scale }) {
  var canvasRef = useRef(null)

  useEffect(function() {
    if (canvasRef.current) {
      drawChamberIcon(canvasRef.current, iconKey, theme || 'garden', scale || 3)
    }
  }, [iconKey, theme, scale])

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
}

export default ChamberIcon
