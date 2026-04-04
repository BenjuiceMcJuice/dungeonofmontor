import { useRef, useEffect } from 'react'
import { drawDoorSprite } from '../lib/sprites.js'

function DoorSprite({ theme, scale, open }) {
  var canvasRef = useRef(null)

  useEffect(function() {
    if (canvasRef.current) {
      drawDoorSprite(canvasRef.current, theme || 'garden', scale || 3, !!open)
    }
  }, [theme, scale, open])

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
}

export default DoorSprite
