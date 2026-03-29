import { useRef, useEffect } from 'react'
import { drawSprite } from '../lib/sprites.js'

function SpriteRenderer({ spriteKey, tierKey, scale }) {
  var canvasRef = useRef(null)

  useEffect(function() {
    if (canvasRef.current) {
      drawSprite(canvasRef.current, spriteKey, tierKey, scale || 4)
    }
  }, [spriteKey, tierKey, scale])

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
}

export default SpriteRenderer
