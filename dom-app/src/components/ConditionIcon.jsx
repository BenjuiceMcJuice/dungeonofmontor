import { useRef, useEffect } from 'react'
import { drawConditionIcon } from '../lib/sprites.js'

function ConditionIcon({ conditionId, scale }) {
  var canvasRef = useRef(null)
  useEffect(function() {
    if (canvasRef.current) drawConditionIcon(canvasRef.current, conditionId, scale || 3)
  }, [conditionId, scale])
  return <canvas ref={canvasRef} className="inline-block align-middle" style={{ imageRendering: 'pixelated' }} />
}

export default ConditionIcon
