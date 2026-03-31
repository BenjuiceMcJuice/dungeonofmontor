import { useRef, useEffect } from 'react'
import { drawDoorSprite } from '../lib/sprites.js'

function DoorSprite({ theme, scale }) {
  var canvasRef = useRef(null)

  useEffect(function() {
    if (canvasRef.current) {
      drawDoorSprite(canvasRef.current, theme || 'garden', scale || 3)
    }
  }, [theme, scale])

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
}

export default DoorSprite
