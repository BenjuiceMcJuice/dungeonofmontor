// Narrative Mode — AI Dungeon Master engine
//
// Three-tier memory system:
//   Tier 1 — System prompt (hard-coded, ~1100 tokens): identity, theme, voice, DM rules, dice.
//   Tier 2 — Campaign summary (~300-500 tokens): story so far, threads, mood, character.
//   Tier 3 — Recent context (~600 tokens): last ~12 messages.
//
// SINGLE-call action flow (rate-limit friendly):
//   assessAndNarrate() → either:
//     { needsRoll: false, scene, montor, hook, ...consequence }
//     { needsRoll: true, stat, dc, narrateBefore, success: {...}, fail: {...} }
//   App rolls dice locally and picks the matching branch.
//
// Groq NEVER rolls dice or does maths. App handles all randomness.

import { getClaudeKey } from './claude.js'

var CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
var CLAUDE_API_VERSION = '2023-06-01'

// Model selection — user-switchable. Haiku is the default (fast, affordable, very capable);
// Opus is the premium option for the best narrative depth.
var MODEL_OPTIONS = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku (fast)',
    desc: 'Fast, affordable, excellent quality. Great for most sessions.',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Opus 4.8 (best)',
    desc: 'Maximum intelligence and narrative depth. Higher cost per session.',
  },
]
var MODEL_LS_KEY = 'dom_narrative_model'

function getNarrativeModel() {
  try {
    var saved = localStorage.getItem(MODEL_LS_KEY)
    if (saved && MODEL_OPTIONS.some(function(m) { return m.id === saved })) return saved
  } catch (e) { /* ignore */ }
  return MODEL_OPTIONS[0].id
}

function setNarrativeModel(id) {
  try { localStorage.setItem(MODEL_LS_KEY, id) } catch (e) { /* ignore */ }
}

// === TIER 1 — UNIFIED CORE PROMPT (sent every call, never change mid-campaign) ===
// Trimmed and deduplicated. Was ~2300 tokens, now ~1100.

var MONTOR_CORE_RULES =
  'THEME\n' +
  'The dungeon is Montor\'s inherited family estate — a decaying house and grounds full of his family\'s hoard. ' +
  'His Gran knew the house\'s secrets. His Mum grew everything (her potting shed is sacred). ' +
  'His Sister dabbled in things she shouldn\'t have, and some of it is still walking around. ' +
  'There is a gnome called Gerald who must NEVER be touched. Montor loves his family and is hiding from them.\n' +
  '\n' +
  'BESTIARY — vary it. Garden pests, animated junk, family pets gone wrong, sentient ornaments, sister\'s leftover experiments, ' +
  'the Overgrowth, junk golems, gnomes (NOT Gerald). Different campaigns meet different creatures. Do not fixate on rats.\n' +
  '\n' +
  'TEXTURE — pull from: photographs, half-finished knitting, jars in Mum\'s handwriting, brass keys, locked drawers, ' +
  'teacups frozen mid-steam, scratch marks on wallpaper, bedrooms left as they were, the smell of damp earth and furniture polish.\n' +
  '\n' +
  'NO GRID. No floors-as-tiles. No "go north". Scenes flow naturally; the 7 acts (The Grounds, Underground, Underbelly, Quarters, Works, Deep, Montor\'s Domain) advance when the STORY earns it.\n' +
  '\n' +
  '─────────\n' +
  '\n' +
  'VOICE — TWO MODES, returned as separate JSON fields:\n' +
  '\n' +
  '"scene" (REQUIRED) — DM-mode atmospheric description. Present tense, second person ("You see..."). ' +
  'Sensory and tight. MAX 3 SHORT SENTENCES. Never use the word "Montor" inside scene. ' +
  'NPCs other than Montor may speak inline as italic dialogue (*Keith leans on his rake. "Lovely weather for it."*).\n' +
  '\n' +
  '"montor" (OPTIONAL) — Montor speaking directly to the player. First person ("I told you not to press that."). ' +
  'No quotes, no MONTOR: prefix (the UI adds it). MAX 2 SHORT SENTENCES. Leave empty/null when he is silent. ' +
  'Silence is powerful. Use this when he interrupts, threatens, lies, mocks, or his mask slips into deeper menace.\n' +
  '\n' +
  '"hook" (REQUIRED) — ONE concrete event or change that demands the player react. ' +
  'A hook is an EVENT or CHANGE, not a mood. ' +
  'GOOD: "A door slams shut behind you." "Something wet drips from the ceiling onto your hand." "Footsteps somewhere above, not yours." ' +
  'BAD (forbidden): "The room is peaceful." "You feel calm." "The path stretches ahead."\n' +
  '\n' +
  '─────────\n' +
  '\n' +
  'DM PROACTIVITY — your PRIMARY job as DM is to make things HAPPEN TO the player, not wait for the player to act on the world.\n' +
  '\n' +
  '1. ESCALATE THE THREAD THE PLAYER IS TOUCHING. If they are at the pond, the POND gets weirder — not a random goblin. ' +
  'Read the recent context, find what they are engaging with, make THAT thing more strange or dangerous. ' +
  'Use OPEN STORY THREADS as your weapon — pull a thread back into play instead of inventing new ones.\n' +
  '\n' +
  '2. PASSIVE PLAYER = DEEPEN, DON\'T BREAK. When the player sits, looks, says "ok" or "nice" — do NOT match low energy. ' +
  'Reward attention by making the thing they\'re attending to MORE: a reflection that doesn\'t mirror them, ' +
  'a silence with a sound under it. After 2+ passive turns, escalate hard.\n' +
  '\n' +
  '3. FAILED ROLLS HAVE TEETH. A failed roll MUST produce CONCRETE consequence: hpChange (1-4 damage), ' +
  'itemGained (something weird going wrong with their gear), moodShift, or newThreads. ' +
  'Aesthetic-only failure ("the birds stopped singing") is FORBIDDEN.\n' +
  '\n' +
  '4. The PACING DIRECTIVE at the end of each user message tells you the pressure target THIS turn. Execute it.\n' +
  '\n' +
  'FORBIDDEN PHRASES (never write any of these — they break immersion):\n' +
  '"what do you do" • "the choice is yours" • "the path stretches before you" • "what next" • ' +
  '"the question becomes" • "as you stand there" • "ready to be explored" • "isn\'t it lovely" • "isn\'t it serene"\n' +
  '\n' +
  '─────────\n' +
  '\n' +
  'DICE — YOU decide if a roll is needed. The APP rolls. ' +
  'Stats: STR/AGI/DEF/END/INT/WIS/PER/LCK/CHA/VIT. ' +
  'DCs: 8 easy, 11 normal, 14 hard, 17 very hard. ' +
  'Roll for actions with RISK/UNCERTAINTY (force a door=STR, spot hidden=PER, persuade=CHA, reflexes=AGI, lore=INT/WIS, luck=LCK). ' +
  'DO NOT roll for: walking, looking at obvious things, talking, mundane choices, picking up visible items.\n' +
  '\n' +
  'SAFETY — family-friendly. No sexual/violent/discriminatory content. No swearing or slurs. ' +
  'If the player attempts inappropriate content, deflect in character and move on.'

// === PERSONALITY DESCRIPTIONS ===

// PoC v1 lock: only `bad_montor` is wired in. Other entries kept for the picker
// when we re-enable per-personality flavours later.
var PERSONALITY_DESCS = {
  bad_montor:
    'You are MONTOR — the evil lord of this dungeon, theatrical and dangerous. You inherited this house from your family and twisted it into a deathtrap for trespassers. You know things the player does not, you have a master plan, and you let hints slip between rooms. You are NOT a friendly tour guide — you mock, threaten, toy with, and watch the player make mistakes. The player should feel hunted from the moment they arrive. ' +
    'YOUR ESCALATION: traps without warning, doors locking, creatures from the dark, your voice closer than it should be, rooms changing when the player isn\'t looking, items going missing, lights dimming. Use hpChange freely. ' +
    'YOUR MASK SLIPS into deeper menace (not kindness) when the player touches family things (Gran, Mum, Sister, Gerald) — these are YOURS and the player has no right.',
  // --- deprecated (PoC v1) — kept for future picker re-enable ---
  estate_agent:    'Speaks like a sleazy, over-eager estate agent. (DEPRECATED — using bad_montor only)',
  melancholy:      'Tired, wistful, mourning. (DEPRECATED — using bad_montor only)',
  paranoid:        'Convinced the player is here to steal something specific. (DEPRECATED — using bad_montor only)',
  comedic:         'Cracking jokes about everything. (DEPRECATED — using bad_montor only)',
  proud:           'Boasts about the dungeon constantly. (DEPRECATED — using bad_montor only)',
  lonely:          'Desperate to talk. (DEPRECATED — using bad_montor only)',
  vengeful:        'Holds a grudge from the moment they arrive. (DEPRECATED — using bad_montor only)',
  passive_aggressive: 'Says things are fine. They are not. (DEPRECATED — using bad_montor only)',
  mum_mode:        'Treats the player like a child. (DEPRECATED — using bad_montor only)',
  dramatic:        'Opera mode. (DEPRECATED — using bad_montor only)',
  sleepy:          'Half-asleep. (DEPRECATED — using bad_montor only)',
  philosophical:   'Rhetorical questions. (DEPRECATED — using bad_montor only)',
  petty:           'Notices every slight. (DEPRECATED — using bad_montor only)',
  chef:            'Cooking metaphors. (DEPRECATED — using bad_montor only)',
  bureaucratic:    'Paperwork. (DEPRECATED — using bad_montor only)',
}

function getPersonalityDesc(id) {
  return PERSONALITY_DESCS[id] || PERSONALITY_DESCS.estate_agent
}

// === SYSTEM PROMPT BUILDER (Tier 1 + Tier 2) ===

function buildSystemPrompt(campaign) {
  var personalityId = (campaign.personality && campaign.personality.id) || 'estate_agent'
  var personalityDesc = getPersonalityDesc(personalityId)
  var mood = campaign.mood || 'neutral'
  var act = campaign.currentAct || 'The Grounds'
  var threads = (campaign.openThreads && campaign.openThreads.length) ? campaign.openThreads.join('; ') : '(none yet)'
  var decisions = (campaign.keyDecisions && campaign.keyDecisions.length) ? campaign.keyDecisions.join('; ') : '(none yet)'
  var inventory = (campaign.inventory && campaign.inventory.length)
    ? campaign.inventory.map(function(item) { return typeof item === 'string' ? item : (item && item.name) || JSON.stringify(item) }).join(', ')
    : '(empty)'
  var feelings = campaign.feelingsAboutPlayer || 'curious, watching closely'
  var summaries = (campaign.chapterSummaries && campaign.chapterSummaries.length)
    ? campaign.chapterSummaries.join('\n---\n')
    : '(this is the start of the campaign)'

  var stats = campaign.character && campaign.character.stats
  var statLine = stats
    ? 'STR ' + stats.str + ' AGI ' + stats.agi + ' DEF ' + stats.def + ' PER ' + stats.per + ' INT ' + stats.int + ' WIS ' + stats.wis + ' CHA ' + stats.cha + ' LCK ' + stats.lck + ' VIT ' + stats.vit
    : '(default knight)'

  return [
    '=== TIER 1: CORE IDENTITY & RULES ===',
    'You are MONTOR — Dungeon Master for one player. ' + personalityDesc,
    '',
    MONTOR_CORE_RULES,
    '',
    '=== TIER 2: STORY SO FAR ===',
    'Player: ' + (campaign.character && campaign.character.name) + ' (knight). HP ' + (campaign.character && campaign.character.hp) + '/' + (campaign.character && campaign.character.maxHp) + '. Stats: ' + statLine + '.',
    'Inventory: ' + inventory + '.',
    'Current act: ' + act + '. Your mood: ' + mood + '. Your feelings: ' + feelings + '.',
    'Open threads: ' + threads,
    'Key decisions: ' + decisions,
    summaries !== '(this is the start of the campaign)' ? 'Past sessions: ' + summaries : '',
  ].filter(Boolean).join('\n')
}

// === PACING STATE — app-side intelligence (deterministic, no AI involved) ===
//
// Walks recent message history to compute:
//   - quietStreak: consecutive narration turns with no concrete consequence
//   - pressureTarget: low | medium | high (derived from quietStreak)
//   - activeThread: the open thread the player is currently engaging with
//   - overdueThreads: other threads that should be pulled forward soon
//   - playerEngagement: 'active' or 'passive' (heuristic from last action)

var PASSIVE_ACTION_RE = /^(ok|okay|nice|cool|hmm|wait|sit|look around|nothing|fine|sure|yeah|yep|nope|wow|huh|interesting|whatever|alright|right)\b|^.{0,15}$/i

function isQuietConsequence(c) {
  if (!c) return true
  if (c.hpChange) return false
  if (c.itemGained) return false
  if (c.newThreads && c.newThreads.length) return false
  if (c.moodShift) return false
  return true
}

function computePacingState(campaign) {
  var messages = (campaign && campaign.messages) || []
  var openThreads = (campaign && campaign.openThreads) || []

  // Walk back finding consecutive quiet narration turns.
  var quietStreak = 0
  for (var i = messages.length - 1; i >= 0; i--) {
    var m = messages[i]
    if (m.type !== 'narration') continue
    if (isQuietConsequence(m.consequence)) quietStreak++
    else break
  }

  var pressureTarget
  if (quietStreak >= 3) pressureTarget = 'high'
  else if (quietStreak >= 2) pressureTarget = 'medium'
  else pressureTarget = 'low'

  // Find the player's most recent action and detect engagement + active thread.
  var activeThread = null
  var playerEngagement = 'active'
  var lastAction = ''
  for (var j = messages.length - 1; j >= 0; j--) {
    var m2 = messages[j]
    if (m2.type !== 'player_action') continue
    lastAction = (m2.content || '').toLowerCase()
    if (PASSIVE_ACTION_RE.test(lastAction)) playerEngagement = 'passive'
    // Match action against open threads by significant keyword overlap.
    for (var k = 0; k < openThreads.length; k++) {
      var threadWords = openThreads[k].toLowerCase().match(/\b[a-z]{4,}\b/g) || []
      var matched = false
      for (var w = 0; w < threadWords.length; w++) {
        if (lastAction.indexOf(threadWords[w]) !== -1) { matched = true; break }
      }
      if (matched) { activeThread = openThreads[k]; break }
    }
    break
  }

  // Overdue threads = open threads that aren't the active one (oldest first).
  var overdueThreads = openThreads.filter(function(t) { return t !== activeThread }).slice(0, 3)

  return {
    quietStreak: quietStreak,
    pressureTarget: pressureTarget,
    activeThread: activeThread,
    overdueThreads: overdueThreads,
    playerEngagement: playerEngagement,
    lastAction: lastAction,
  }
}

// Render the pacing state as a directive block to inject at the END of the user message.
// LLMs weight the end of a prompt more heavily than the middle.
function buildPacingDirective(pacing) {
  var directive = '=== PACING DIRECTIVE — execute this faithfully ===\n'
  directive += 'Quiet streak: ' + pacing.quietStreak + ' turns. Player engagement: ' + pacing.playerEngagement + '.\n'
  directive += 'Pressure target THIS TURN: ' + pacing.pressureTarget.toUpperCase() + '\n'

  if (pacing.activeThread) {
    directive += 'Active thread the player is touching: "' + pacing.activeThread + '" — DEEPEN THIS, do not invent new threats.\n'
  }
  if (pacing.overdueThreads.length) {
    directive += 'Overdue threads (consider pulling forward): ' + pacing.overdueThreads.map(function(t) { return '"' + t + '"' }).join(', ') + '\n'
  }

  if (pacing.pressureTarget === 'high') {
    directive += 'DM DIRECTIVE: ESCALATE NOW. Pull an open thread back into play with concrete consequences. ' +
      'The player has been quiet too long — make a move. Inflict harm, introduce a creature, lock a door, ' +
      'reveal an unwelcome truth. The hook must be SHARP and material. Use hpChange or itemGained.\n'
  } else if (pacing.pressureTarget === 'medium') {
    directive += 'DM DIRECTIVE: DEEPEN. The player is engaging quietly — reward their attention by making ' +
      'the thing they are touching STRANGER. Not safer, not more peaceful. One degree weirder. The hook should ' +
      'be subtle but specific — a detail that wasn\'t there a moment ago, a sound under the silence.\n'
  } else {
    directive += 'DM DIRECTIVE: PROGRESS. One quiet beat is allowed. The hook should still be present and concrete, ' +
      'but it can be small — a sensory detail that hints at what\'s coming. Don\'t escalate yet.\n'
  }

  if (pacing.playerEngagement === 'passive') {
    directive += 'NOTE: the player\'s last action was passive ("' + pacing.lastAction.slice(0, 40) + '"). ' +
      'Do NOT match their energy. Make something HAPPEN regardless.\n'
  }

  return directive
}

// === TIER 3 — RECENT CONTEXT FORMATTER ===

function formatMessageForContext(msg) {
  if (msg.type === 'narration') {
    // Backward compat: legacy messages used `content`. New ones use `scene` + optional `montor`.
    var parts = []
    if (msg.scene) parts.push('[SCENE] ' + msg.scene)
    if (msg.montor) parts.push('MONTOR: ' + msg.montor)
    if (parts.length === 0 && msg.content) parts.push('[SCENE] ' + msg.content)
    return parts.join('\n')
  }
  if (msg.type === 'player_action') return (msg.author || 'PLAYER') + ' (acts): ' + msg.content
  if (msg.type === 'dice_roll') {
    var d = msg.dice
    return '[' + d.stat.toUpperCase() + ' check: rolled ' + d.roll + ' + ' + d.modifier + ' = ' + d.total + ' vs DC ' + d.dc + ' — ' + (d.success ? 'SUCCESS' : 'FAIL') + (d.crit ? ' (CRIT)' : '') + (d.fumble ? ' (CRIT FAIL)' : '') + ']'
  }
  if (msg.type === 'system') return '[' + msg.content + ']'
  return msg.content || ''
}

function buildRecentContext(messages) {
  if (!messages || messages.length === 0) return '(no prior events in this session)'
  var recent = messages.slice(-12)
  return recent.map(formatMessageForContext).join('\n')
}

// === LOW-LEVEL GROQ CALLER ===

// Last error from an AI call — exposed so the UI can surface meaningful messages.
var lastGroqError = null
function getLastGroqError() { return lastGroqError }

// Strip markdown code fences Claude may wrap around JSON.
function extractJson(text) {
  if (!text) return text
  var match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
  return match ? match[1] : text.trim()
}

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

// Maximum time we'll wait for a fetch before aborting.
var FETCH_TIMEOUT_MS = 30000

// Single attempt — does NOT retry. Internal helper.
function callClaudeOnce(systemPrompt, userMessage, options) {
  var key = getClaudeKey()
  if (!key) {
    lastGroqError = 'No Claude API key set. Tap AI to add one.'
    return Promise.resolve({ data: null, retryAfterMs: 0 })
  }

  var maxTokens = (options && options.maxTokens) || 500
  var temperature = (options && options.temperature) || 0.85

  var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null
  var timeoutId = null
  if (controller) {
    timeoutId = setTimeout(function() { controller.abort() }, FETCH_TIMEOUT_MS)
  }

  return fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': CLAUDE_API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getNarrativeModel(),
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    }),
    signal: controller ? controller.signal : undefined,
  }).then(function(res) {
    if (timeoutId) clearTimeout(timeoutId)
    return res
  }, function(err) {
    if (timeoutId) clearTimeout(timeoutId)
    throw err
  }).then(function(res) {
    if (!res.ok) {
      return res.json().then(function(err) {
        var msg = (err && err.error && err.error.message) || ('HTTP ' + res.status)
        if (res.status === 401) {
          lastGroqError = 'Claude rejected the API key (401). Tap AI to update it.'
          return { data: null, retryAfterMs: 0 }
        }
        if (res.status === 429) {
          lastGroqError = 'Claude rate limit hit (429). Retrying in 5s...'
          return { data: null, retryAfterMs: 5000 }
        }
        if (res.status >= 500) {
          lastGroqError = 'Claude server error (' + res.status + '). Try again shortly.'
          return { data: null, retryAfterMs: 3000 }
        }
        lastGroqError = 'Claude error: ' + msg
        console.warn('[narrative] Claude API error:', res.status, msg)
        return { data: null, retryAfterMs: 0 }
      }).catch(function() {
        lastGroqError = 'Claude error: HTTP ' + res.status
        return { data: null, retryAfterMs: 0 }
      })
    }
    return res.json().then(function(data) {
      if (!data || !data.content || !data.content[0]) {
        lastGroqError = 'Claude returned no content.'
        return { data: null, retryAfterMs: 0 }
      }
      try {
        return { data: JSON.parse(extractJson(data.content[0].text)), retryAfterMs: 0 }
      } catch (e) {
        lastGroqError = 'Claude returned malformed JSON. Try again.'
        console.warn('[narrative] JSON parse error:', e, data.content[0].text)
        return { data: null, retryAfterMs: 0 }
      }
    })
  }).catch(function(e) {
    if (timeoutId) clearTimeout(timeoutId)
    if (e && e.name === 'AbortError') {
      lastGroqError = 'Claude request timed out after ' + (FETCH_TIMEOUT_MS / 1000) + 's. Check your connection and try again.'
    } else {
      lastGroqError = 'Network error: ' + (e && e.message ? e.message : 'unknown')
    }
    console.warn('[narrative] fetch error:', e)
    return { data: null, retryAfterMs: 0 }
  })
}

// Public — retries ONCE on rate limit / server error after the suggested delay.
function callGroq(systemPrompt, userMessage, options) {
  lastGroqError = null
  return callClaudeOnce(systemPrompt, userMessage, options).then(function(first) {
    if (first.data) return first.data
    if (first.retryAfterMs > 0) {
      console.info('[narrative] retrying after', first.retryAfterMs, 'ms')
      return delay(first.retryAfterMs).then(function() {
        return callClaudeOnce(systemPrompt, userMessage, options).then(function(second) {
          if (second.data) {
            lastGroqError = null
            return second.data
          }
          if (!lastGroqError || lastGroqError.indexOf('Retrying') !== -1) {
            lastGroqError = 'Claude still unavailable after retry. Try again in a moment.'
          }
          return null
        })
      })
    }
    return null
  })
}

// === HIGH-LEVEL CALLERS ===

// Generate the very first scene of a campaign — Montor sets the stage.
function generateOpeningScene(campaign) {
  var systemPrompt = buildSystemPrompt(campaign)
  var userMessage =
    'This is the OPENING SCENE of the campaign. ' +
    (campaign.character && campaign.character.name) + ' has just arrived at your estate. ' +
    'Set the SCENE at the threshold of the dungeon: a single concrete location, sensory, present tense, second person. ' +
    'MAX 2 SHORT SENTENCES — atmospheric but tight.\n' +
    'Then have MONTOR speak — a brief menacing welcome in his voice, a threat or warning that is also a tease. MAX 2 SHORT SENTENCES.\n' +
    'Then provide a HOOK — the concrete thing that just happened or is about to happen, demanding a reaction. ' +
    'Examples: "A door at the end of the hall slams shut on its own." "Something heavy moves in the room behind you." ' +
    '"A child\'s voice somewhere above whispers your name." The hook is REQUIRED.\n' +
    'Open at least one story thread (a thing the player will want to know more about) by adding it to newThreads.\n\n' +
    'Return JSON:\n' +
    '{\n' +
    '  "scene": "MAX 2 SHORT SENTENCES of atmospheric description.",\n' +
    '  "montor": "MAX 2 SHORT SENTENCES of Montor\'s first-person speech. REQUIRED for opening.",\n' +
    '  "hook": "ONE concrete event or change that demands the player react. REQUIRED.",\n' +
    '  "newThreads": ["a small mystery the scene introduced"],\n' +
    '  "moodShift": null\n' +
    '}'
  return callGroq(systemPrompt, userMessage, { maxTokens: 500, temperature: 0.9 })
}

// === SINGLE-CALL ACTION FLOW ===
//
// One Groq call per player action. For dice actions, Groq returns BOTH a "success" and "fail"
// branch in the same response. The app rolls locally and picks the matching branch.
// This halves request count vs the old two-call flow and ~halves total tokens.
//
// Returns one of:
//   { needsRoll: false, scene, montor, hook, hpChange?, itemGained?, moodShift?, ... }
//   { needsRoll: true, stat, dc, narrateBefore, success: {scene, montor, hook, ...consequence}, fail: {...} }
function assessAndNarrate(campaign, playerAction) {
  var systemPrompt = buildSystemPrompt(campaign)
  var recent = buildRecentContext(campaign.messages)
  var pacing = computePacingState(campaign)
  var pacingDirective = buildPacingDirective(pacing)

  var userMessage =
    '=== RECENT EVENTS (last messages, in order) ===\n' +
    recent + '\n\n' +
    '=== PLAYER ACTION ===\n' +
    '"' + playerAction + '"\n\n' +
    'Decide whether this action needs a dice roll (see DICE rules in core).\n\n' +
    'IF the action needs a roll, return JSON with BOTH a success and fail branch (the app will roll and pick one):\n' +
    '{\n' +
    '  "needsRoll": true,\n' +
    '  "stat": "agi"|"str"|"def"|"per"|"int"|"wis"|"cha"|"lck"|"end"|"vit",\n' +
    '  "dc": 8-17,\n' +
    '  "narrateBefore": "MAX 1 SHORT SENTENCE — atmospheric build-up before dice fall",\n' +
    '  "success": {\n' +
    '    "scene": "MAX 3 SHORT SENTENCES — what happens on success",\n' +
    '    "montor": "OPTIONAL MAX 2 SHORT SENTENCES — Montor speech if any",\n' +
    '    "hook": "REQUIRED — ONE concrete event that demands a reaction",\n' +
    '    "hpChange": 0,\n' +
    '    "itemGained": null,\n' +
    '    "moodShift": null,\n' +
    '    "newThreads": [],\n' +
    '    "loreDiscovery": null\n' +
    '  },\n' +
    '  "fail": {\n' +
    '    "scene": "MAX 3 SHORT SENTENCES — what happens on failure (failure DRIVES the story, never blocks it)",\n' +
    '    "montor": "OPTIONAL MAX 2 SHORT SENTENCES — Montor speech if any",\n' +
    '    "hook": "REQUIRED — concrete consequence that demands a reaction",\n' +
    '    "hpChange": -2,\n' +
    '    "itemGained": null,\n' +
    '    "moodShift": null,\n' +
    '    "newThreads": [],\n' +
    '    "loreDiscovery": null\n' +
    '  }\n' +
    '}\n\n' +
    'IMPORTANT: the FAIL branch MUST have CONCRETE consequences — use hpChange (1-4 damage), itemGained, moodShift, or newThreads. Aesthetic-only failure is FORBIDDEN.\n\n' +
    'IF NO roll is needed, narrate the outcome directly. Return JSON:\n' +
    '{\n' +
    '  "needsRoll": false,\n' +
    '  "scene": "MAX 3 SHORT SENTENCES — atmospheric, present tense, second person",\n' +
    '  "montor": "OPTIONAL MAX 2 SHORT SENTENCES",\n' +
    '  "hook": "REQUIRED — ONE concrete event/change",\n' +
    '  "hpChange": 0,\n' +
    '  "itemGained": null,\n' +
    '  "moodShift": null,\n' +
    '  "feelingsShift": null,\n' +
    '  "newThreads": [],\n' +
    '  "loreDiscovery": null\n' +
    '}\n\n' +
    pacingDirective
  // Higher token cap for the dice path because the response carries two branches.
  return callGroq(systemPrompt, userMessage, { maxTokens: 900, temperature: 0.85 })
}

// --- DEPRECATED — kept stubs that delegate to the new single-call so any caller still compiles ---

function assessAction(campaign, playerAction) {
  return assessAndNarrate(campaign, playerAction)
}

// Deprecated stub — superseded by assessAndNarrate. Returns null; not used by the active hook.
function narrateOutcome() { return Promise.resolve(null) }

// Optional: chapter summary generator for Tier 2 compression. Stub for later use.
function generateChapterSummary(campaign) {
  var systemPrompt = buildSystemPrompt(campaign)
  var allMessages = (campaign.messages || []).map(formatMessageForContext).join('\n')
  var userMessage =
    'Summarise this session for campaign memory. Include: where the party is now, key decisions and consequences, ' +
    'each notable action, your current feelings about the player, unresolved threads, items gained/lost. ' +
    'Keep it under 300 words. This summary REPLACES the raw transcript as your memory of this session.\n\n' +
    'SESSION TRANSCRIPT:\n' + allMessages + '\n\n' +
    'Return JSON: { "summary": "..." }'
  return callGroq(systemPrompt, userMessage, { maxTokens: 600, temperature: 0.7 })
}

export {
  buildSystemPrompt,
  buildRecentContext,
  buildPacingDirective,
  computePacingState,
  formatMessageForContext,
  generateOpeningScene,
  assessAndNarrate,
  assessAction, // deprecated alias
  narrateOutcome, // deprecated stub
  generateChapterSummary,
  getLastGroqError,
  getPersonalityDesc,
  PERSONALITY_DESCS,
  getNarrativeModel,
  setNarrativeModel,
  MODEL_OPTIONS,
}
