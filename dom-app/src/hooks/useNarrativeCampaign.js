// Narrative campaign state hook.
//
// Owns the active campaign object, the message log, and the action loop.
// Wraps the two-call Groq flow so components only call takeAction(text).

import { useState, useEffect, useRef } from 'react'
import { generateOpeningScene, assessAndNarrate, generateChapterSummary, getLastGroqError } from '../lib/narrative.js'
import { saveCampaign, loadCampaign, clearCampaign } from '../lib/narrativeStorage.js'
import { d20Check } from '../lib/dice.js'
import { getModifier } from '../lib/classes.js'

// Default knight stats — same as roguelike base, no separate allocation in PoC v1.
var DEFAULT_STATS = {
  str: 12, agi: 12, def: 12, end: 10,
  int: 10, wis: 10, per: 12, lck: 10,
  cha: 10, vit: 10, res: 8, sth: 8, cun: 8, wil: 8,
}

function defaultMaxHp(stats) {
  return 25 + ((stats.vit || 8) * 5)
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function makeMessage(type, content, extra) {
  return Object.assign({
    id: newId(),
    ts: Date.now(),
    type: type,
    content: content,
  }, extra || {})
}

// Extract just the consequence-bearing fields from a Groq response, for storing
// on the message itself so the pacing logic can walk back through history.
function extractConsequence(payload) {
  if (!payload) return null
  return {
    hpChange: payload.hpChange || 0,
    itemGained: payload.itemGained || null,
    moodShift: payload.moodShift || null,
    newThreads: payload.newThreads || [],
    loreDiscovery: payload.loreDiscovery || null,
  }
}

function useNarrativeCampaign() {
  var [campaign, setCampaign] = useState(null)
  var [busy, setBusy] = useState(false)
  var [error, setError] = useState(null)
  var [pendingRoll, setPendingRoll] = useState(null) // { stat, dc, modifier, successBranch, failBranch, baseState }
  var campaignRef = useRef(null)
  var pendingRollRef = useRef(null)

  useEffect(function() { pendingRollRef.current = pendingRoll }, [pendingRoll])

  // Keep ref synced for async callbacks that need the latest state.
  useEffect(function() { campaignRef.current = campaign }, [campaign])

  // Load saved campaign on mount.
  useEffect(function() {
    var saved = loadCampaign()
    if (saved) setCampaign(saved)
  }, [])

  // Persist whenever campaign changes.
  useEffect(function() {
    if (campaign) saveCampaign(campaign)
  }, [campaign])

  // ── Mutators ──

  function appendMessages(c, newMessages) {
    return Object.assign({}, c, {
      messages: (c.messages || []).concat(newMessages),
      updatedAt: Date.now(),
    })
  }

  function applyConsequences(c, payload) {
    if (!payload) return c
    var next = Object.assign({}, c)
    var character = Object.assign({}, c.character)
    var changed = false

    if (typeof payload.hpChange === 'number' && payload.hpChange !== 0) {
      character.hp = Math.max(0, Math.min(character.maxHp, character.hp + payload.hpChange))
      changed = true
    }
    if (payload.itemGained) {
      next.inventory = (c.inventory || []).concat([payload.itemGained])
      changed = true
    }
    if (payload.moodShift) {
      next.mood = payload.moodShift
      changed = true
    }
    if (payload.feelingsShift) {
      next.feelingsAboutPlayer = payload.feelingsShift
      changed = true
    }
    if (payload.newThreads && payload.newThreads.length) {
      var threads = (c.openThreads || []).concat(payload.newThreads).slice(-12)
      next.openThreads = threads
      changed = true
    }
    if (payload.loreDiscovery) {
      next.keyDecisions = (c.keyDecisions || []).concat([payload.loreDiscovery]).slice(-20)
      changed = true
    }
    if (payload.actAdvance) {
      next.currentAct = payload.actAdvance
      changed = true
    }

    if (changed) next.character = character
    return next
  }

  // After every 12 player actions, compress history: summarise, trim messages to last 6.
  // Fires async in the background — campaign is already persisted; we update again when done.
  function maybeCompressCampaign(c) {
    var playerCount = (c.messages || []).filter(function(m) { return m.type === 'player_action' }).length
    if (playerCount === 0 || playerCount % 12 !== 0) return

    generateChapterSummary(c).then(function(summary) {
      if (!summary) return
      setCampaign(function(prev) {
        if (!prev) return prev
        var trimmed = (prev.messages || []).slice(-6)
        return Object.assign({}, prev, {
          chapterSummaries: (prev.chapterSummaries || []).concat([summary]),
          messages: trimmed,
          updatedAt: Date.now(),
        })
      })
    }).catch(function(e) {
      console.warn('[useNarrativeCampaign] chapter summary failed:', e)
    })
  }

  // ── Public API ──

  // Start a brand new campaign. Wipes any existing one.
  // PoC v1 — personality is locked to bad_montor regardless of input.
  function startCampaign(characterName) {
    setError(null)
    setBusy(true)

    var stats = Object.assign({}, DEFAULT_STATS)
    var maxHp = defaultMaxHp(stats)

    var fresh = {
      id: 'narr_' + Date.now().toString(36),
      character: {
        name: (characterName || 'Knight').trim() || 'Knight',
        stats: stats,
        hp: maxHp,
        maxHp: maxHp,
      },
      personality: { id: 'bad_montor' },
      mood: 'neutral',
      feelingsAboutPlayer: 'curious — a new visitor has arrived',
      currentAct: 'The Grounds',
      openThreads: [],
      keyDecisions: [],
      inventory: [],
      messages: [],
      chapterSummaries: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    return generateOpeningScene(fresh).then(function(result) {
      if (!result || (!result.scene && !result.narration)) {
        setError(getLastGroqError() || 'Montor said nothing. Check your Claude API key.')
        setBusy(false)
        return null
      }
      var withMessage = appendMessages(fresh, [
        makeMessage('narration', '', {
          scene: result.scene || result.narration || '',
          montor: result.montor || '',
          hook: result.hook || '',
          consequence: extractConsequence(result),
        }),
      ])
      var afterConsequences = applyConsequences(withMessage, result)
      setCampaign(afterConsequences)
      setBusy(false)
      return afterConsequences
    }).catch(function(e) {
      console.warn('[useNarrativeCampaign] startCampaign failed:', e)
      setError('Failed to start campaign. ' + (e && e.message ? e.message : ''))
      setBusy(false)
      return null
    })
  }

  // Take a free-form player action. Runs the two-call flow if dice are needed.
  function takeAction(text) {
    var current = campaignRef.current
    if (!current || busy || !text || !text.trim()) return Promise.resolve(null)

    setError(null)
    setBusy(true)

    var actionText = text.trim()

    // Optimistically add the player's action to the feed.
    var withAction = appendMessages(current, [
      makeMessage('player_action', actionText, { author: current.character.name }),
    ])
    setCampaign(withAction)

    return assessAndNarrate(withAction, actionText).then(function(result) {
      if (!result) {
        setError(getLastGroqError() || 'Montor did not respond. Check your Claude API key or try again.')
        setBusy(false)
        return null
      }

      // === No-roll path — narrate directly ===
      if (!result.needsRoll) {
        var sceneText = result.scene || result.narration
        if (!sceneText && !result.montor) {
          setError(getLastGroqError() || 'Empty response from Montor.')
          setBusy(false)
          return null
        }
        var c1 = appendMessages(withAction, [
          makeMessage('narration', '', {
            scene: sceneText || '',
            montor: result.montor || '',
            hook: result.hook || '',
            consequence: extractConsequence(result),
          }),
        ])
        c1 = applyConsequences(c1, result)
        setCampaign(c1)
        maybeCompressCampaign(c1)
        setBusy(false)
        return c1
      }

      // === Dice path — pause and wait for player to tap the die ===
      var stat = (result.stat || 'lck').toLowerCase()
      var dc = Math.max(5, Math.min(20, parseInt(result.dc, 10) || 11))
      var statValue = (current.character.stats && current.character.stats[stat]) || 10
      var modifier = getModifier(statValue)

      if (!result.success || !result.fail) {
        setError('Montor returned a roll without proper branches. Try again.')
        setBusy(false)
        return null
      }

      // Show narrateBefore in the feed, then surface the interactive dice card.
      var withBefore = withAction
      if (result.narrateBefore) {
        withBefore = appendMessages(withBefore, [
          makeMessage('narration', '', { scene: result.narrateBefore, montor: '', hook: '', consequence: null }),
        ])
      }
      setCampaign(withBefore)
      setPendingRoll({
        stat: stat,
        dc: dc,
        modifier: modifier,
        successBranch: result.success,
        failBranch: result.fail,
        baseState: withBefore,
      })
      setBusy(false)
      return null
    }).catch(function(e) {
      console.warn('[useNarrativeCampaign] takeAction failed:', e)
      setError('Action failed. ' + (e && e.message ? e.message : ''))
      setBusy(false)
      return null
    })
  }

  // Called by NarrativeDiceCard after the player taps and the animation completes.
  // rollRes is the result from d20Check() computed in the UI.
  function commitRoll(rollRes) {
    var pending = pendingRollRef.current
    if (!pending || !rollRes) return

    var rollDetails = {
      stat: pending.stat,
      roll: rollRes.roll,
      modifier: pending.modifier,
      total: rollRes.total,
      dc: pending.dc,
      success: rollRes.success,
      crit: rollRes.crit,
      fumble: rollRes.fumble,
    }

    var branch = rollRes.success ? pending.successBranch : pending.failBranch
    var withRoll = appendMessages(pending.baseState, [
      makeMessage('dice_roll', '', { dice: rollDetails }),
    ])
    var outcomeMsg = makeMessage('narration', '', {
      scene: branch.scene || '',
      montor: branch.montor || '',
      hook: branch.hook || '',
      consequence: extractConsequence(branch),
    })
    withRoll = appendMessages(withRoll, [outcomeMsg])
    var c2 = applyConsequences(withRoll, branch)
    setCampaign(c2)
    maybeCompressCampaign(c2)
    setPendingRoll(null)
  }

  function endCampaign() {
    clearCampaign()
    setCampaign(null)
    setPendingRoll(null)
    setError(null)
  }

  return {
    campaign: campaign,
    busy: busy,
    error: error,
    pendingRoll: pendingRoll,
    startCampaign: startCampaign,
    takeAction: takeAction,
    commitRoll: commitRoll,
    endCampaign: endCampaign,
  }
}

export default useNarrativeCampaign
