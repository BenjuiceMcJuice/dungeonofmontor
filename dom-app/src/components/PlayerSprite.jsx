import { useRef, useEffect } from 'react'
import { drawPlayerSprite } from '../lib/sprites.js'

function PlayerSprite({ classKey, scale }) {
  var canvasRef = useRef(null)

  useEffect(function() {
    if (canvasRef.current) {
      drawPlayerSprite(canvasRef.current, classKey, scale || 3)
    }
  }, [classKey, scale])

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
}

export default PlayerSprite
