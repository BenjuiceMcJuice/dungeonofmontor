import { useState, useEffect, useRef } from 'react'

var DEF_VERBS = ['deflects', 'absorbs', 'blocks', 'shrugs off']
function pickVerb(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// Colour by tier — not damage amount
function getTierColour(tierName) {
  if (tierName === 'crit') return 'text-crimson'      // crimson
  if (tierName === 'hit') return 'text-amber-500'      // orange
  if (tierName === 'glancing') return 'text-yellow-400' // yellow
  return 'text-ink-dim'
}

// Inline style colour by tier (for CSS color property)
function getTierHex(tierName) {
  if (tierName === 'crit') return '#c0392b'
  if (tierName === 'hit') return '#f59e0b'
  if (tierName === 'glancing') return '#facc15'
  return '#9d94b0'
}

// Font size scales with damage — bigger hit = bigger number
function getDamageFontSize(dmg) {
  if (dmg >= 12) return '4rem'
  if (dmg >= 8) return '3.2rem'
  if (dmg >= 5) return '2.6rem'
  if (dmg >= 3) return '2.2rem'
  return '1.8rem'
}

function CombatRoller({ onAttackRoll, onComplete, attackMod, damageDie, damageMod, buttonLabel, colour, autoRoll, resolvedDamage, damageBreakdown, doubleStrike, doubleStrikeDamage, offhandHit, offhandDamage, attackerName, targetName }) {
  var lastTapRef = useRef(0)
  var resolvedDamageRef = useRef(resolvedDamage)
  resolvedDamageRef.current = resolvedDamage
  var breakdownRef = useRef(damageBreakdown)
  breakdownRef.current = damageBreakdown
  var doubleStrikeRef = useRef(doubleStrike)
  doubleStrikeRef.current = doubleStrike
  var doubleStrikeDamageRef = useRef(doubleStrikeDamage)
  doubleStrikeDamageRef.current = doubleStrikeDamage
  var offhandHitRef = useRef(offhandHit)
  offhandHitRef.current = offhandHit
  var offhandDamageRef = useRef(offhandDamage)
  offhandDamageRef.current = offhandDamage

  var accentBorder = colour === 'red' ? 'border-red-400' : 'border-gold'
  var accentBg = colour === 'red' ? 'bg-red-400/10' : 'bg-gold-glow'
  var accentText = colour === 'red' ? 'text-red-400' : 'text-gold'

  var [phase, setPhase] = useState('idle')
  var [attackDisplay, setAttackDisplay] = useState(null)
  var [attackResult, setAttackResult] = useState(null)
  var [damageDisplay, setDamageDisplay] = useState(null)
  var [isHit, setIsHit] = useState(false)
  var [started, setStarted] = useState(false)
  var [narrative, setNarrative] = useState('')
  var [finalDamage, setFinalDamage] = useState(null)
  var [finalTier, setFinalTier] = useState(null)
  var [showDoubleStrike, setShowDoubleStrike] = useState(false)

  var who = attackerName || 'Attacker'
  var target = targetName || 'target'

  useEffect(function() {
    if (autoRoll && !started) {
      setStarted(true)
      setTimeout(function() { handleRoll() }, 300)
    }
  }, [autoRoll])

  function handleRoll() {
    if (phase !== 'idle') return
    setPhase('attackRolling')
    setAttackResult(null)
    setDamageDisplay(null)
    setIsHit(false)
    setNarrative(who + ' attacks ' + target + '...')
    setFinalDamage(null)
    setFinalTier(null)

    var ticks = 0
    var interval = setInterval(function() {
      setAttackDisplay(Math.floor(Math.random() * 20) + 1)
      ticks++
      if (ticks >= 12) {
        clearInterval(interval)
        var result = onAttackRoll()
        setAttackResult(result)
        setAttackDisplay(result.roll)

        var hit = result.tier <= 3
        setIsHit(hit)
        setPhase('attackResult')

        // Update narrative with tier outcome
        if (result.tierName === 'crit') {
          setNarrative(who + ' attacks ' + target + '... critical strike!')
        } else if (result.tierName === 'hit') {
          setNarrative(who + ' attacks ' + target + '... clean hit!')
        } else if (result.tierName === 'glancing') {
          setNarrative(who + ' attacks ' + target + '... glancing blow!')
        } else {
          setNarrative(who + ' swings at ' + target + '... misses!')
        }

        if (hit) {
          setTimeout(function() {
            setPhase('damageRolling')
            var dTicks = 0
            var dInterval = setInterval(function() {
              setDamageDisplay(Math.floor(Math.random() * damageDie) + 1)
              dTicks++
              if (dTicks >= 8) {
                clearInterval(dInterval)
                var bd = breakdownRef.current
                var dmg = resolvedDamageRef.current != null ? resolvedDamageRef.current : 1

                // Die face shows raw weapon roll
                if (bd) {
                  setDamageDisplay(bd.weaponRoll)
                } else {
                  setDamageDisplay(dmg)
                }

                // Build full narrative
                var defVerb = pickVerb(DEF_VERBS)
                var tierLabel = result.tierName === 'crit' ? 'critical strike' : result.tierName === 'glancing' ? 'glancing blow' : 'clean hit'
                var sentence = who + ' attacks ' + target + '... ' + tierLabel + '!'

                if (bd) {
                  var hitValue = bd.tierMul !== 'x1' ? bd.afterTier : bd.raw
                  sentence += ' Hits for ' + hitValue + '...'
                  if (bd.defReduction > 0) {
                    if (bd.defReduction >= hitValue) {
                      // DEF exceeds hit — armour tanked it, only minimum damage gets through
                      sentence += ' ' + target + "'s armour absorbs most of the blow."
                    } else {
                      sentence += ' ' + target + ' ' + defVerb + ' ' + bd.defReduction + '.'
                    }
                  }
                }

                setNarrative(sentence)
                setFinalDamage(dmg)
                setFinalTier(result.tierName)
                setShowDoubleStrike(false)

                // Show double strike after a beat
                if (doubleStrikeRef.current && doubleStrikeDamageRef.current > 0) {
                  setPhase('damageResult')
                  setTimeout(function() {
                    setShowDoubleStrike(true)
                  }, 600)
                } else {
                  setPhase('damageResult')
                }
              }
            }, 60)
          }, 800)
        }
      }
    }, 60)
  }

  var waitingForDoubleStrike = phase === 'damageResult' && doubleStrikeRef.current && !showDoubleStrike
  var showContinueCheck = ((phase === 'attackResult' && !isHit) || phase === 'damageResult') && !waitingForDoubleStrike

  // Gate: minimum 800ms display before tapping is allowed
  var [continueReady, setContinueReady] = useState(false)
  useEffect(function() {
    if (showContinueCheck && !continueReady) {
      var gateTimeout = setTimeout(function() { setContinueReady(true) }, 800)
      return function() { clearTimeout(gateTimeout) }
    }
    if (!showContinueCheck) setContinueReady(false)
  }, [showContinueCheck])

  var showContinue = showContinueCheck && continueReady

  function getAttackDieClass() {
    if (phase === 'attackRolling') return accentBorder + ' ' + accentBg + ' ' + accentText + ' animate-pulse scale-110'
    if (!attackResult) return 'border-border-hl bg-raised text-ink-dim'
    if (attackResult.tierName === 'crit') return accentBorder + ' ' + accentBg + ' ' + accentText + ' scale-110'
    if (attackResult.tierName === 'miss') return 'border-border bg-surface text-ink-dim'
    if (attackResult.tierName === 'glancing') return 'border-amber-400 bg-amber-400/10 text-amber-400'
    return accentBorder + ' bg-surface ' + accentText
  }

  return (
    <div className="flex flex-col items-center gap-3" onClick={showContinue ? function() { var now = Date.now(); if (now - lastTapRef.current < 400) return; lastTapRef.current = now; if (onComplete) onComplete(attackResult, 0) } : undefined} style={showContinue ? { cursor: 'pointer' } : undefined}>
      {/* Dice row */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className={'w-14 h-14 rounded-xl flex items-center justify-center font-display text-xl border-2 transition-all ' + getAttackDieClass()}>
            {attackDisplay !== null ? attackDisplay : 'd20'}
          </div>
          <span className="text-ink-dim text-[10px]">d20</span>
        </div>

        {(phase === 'damageRolling' || phase === 'damageResult') && (
          <div className="flex flex-col items-center gap-1">
            <div className={
              'w-14 h-14 rounded-xl flex items-center justify-center font-display text-xl border-2 transition-all ' +
              (phase === 'damageRolling'
                ? accentBorder + ' ' + accentBg + ' ' + accentText + ' animate-pulse scale-110'
                : accentBorder + ' bg-surface ' + accentText)
            }>
              {damageDisplay !== null ? damageDisplay : '?'}
            </div>
            <span className="text-ink-dim text-[10px]">d{damageDie}</span>
          </div>
        )}

        {phase !== 'damageRolling' && phase !== 'damageResult' && phase !== 'idle' && isHit && (
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center border-2 border-border-hl bg-raised text-ink-faint font-display text-lg opacity-30">
              d{damageDie}
            </div>
            <span className="text-ink-faint text-[10px]">d{damageDie}</span>
          </div>
        )}
      </div>

      {/* Narrative sentence */}
      {narrative && (
        <p className="text-ink text-base font-sans text-center max-w-xs leading-relaxed italic">
          {narrative}
        </p>
      )}

      {/* Damage number — colour by tier, size by damage amount */}
      {finalDamage !== null && finalTier && (
        <div className="text-center">
          <p className="font-display" style={{ fontSize: getDamageFontSize(finalDamage), color: getTierHex(finalTier), lineHeight: 1.1 }}>
            {finalDamage}
          </p>
          <p className="text-xs font-sans uppercase tracking-widest mt-1" style={{ color: getTierHex(finalTier) }}>
            damage
          </p>
        </div>
      )}

      {/* Double strike flash */}
      {showDoubleStrike && doubleStrikeDamageRef.current > 0 && (
        <div className="text-center animate-bounce">
          <p className="text-emerald-400 font-display text-xs uppercase tracking-widest">Double Strike!</p>
          <p className="font-display text-emerald-400" style={{ fontSize: getDamageFontSize(doubleStrikeDamageRef.current), lineHeight: 1.1 }}>
            +{doubleStrikeDamageRef.current}
          </p>
        </div>
      )}

      {/* Off-hand hit flash */}
      {showContinue && offhandHitRef.current && offhandDamageRef.current > 0 && (
        <div className="text-center">
          <p className="text-blue font-display text-xs uppercase tracking-widest">Off-Hand!</p>
          <p className="font-display text-blue" style={{ fontSize: getDamageFontSize(offhandDamageRef.current), lineHeight: 1.1 }}>
            +{offhandDamageRef.current}
          </p>
        </div>
      )}

      {/* Roll button */}
      {phase === 'idle' && !autoRoll && (
        <button onClick={handleRoll}
          className={
            'py-3 px-8 rounded-lg font-sans text-base font-semibold transition-all ' +
            (colour === 'red'
              ? 'bg-red-400/20 border border-red-400 text-red-400'
              : 'bg-gold text-bg hover:opacity-90 active:scale-95')
          }>
          {buttonLabel || 'Attack!'}
        </button>
      )}

      {showContinue && (
        <p className="text-ink-faint text-xs font-sans">Tap anywhere to continue</p>
      )}
    </div>
  )
}

export default CombatRoller
