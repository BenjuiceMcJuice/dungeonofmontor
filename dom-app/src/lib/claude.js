// Claude API wrapper — AI-powered Montor dialogue (replaces Groq)
// User supplies their own Anthropic API key, stored in localStorage only.

var CLAUDE_KEY_STORAGE = 'dom_claude_api_key'
var CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
var CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
var CLAUDE_API_VERSION = '2023-06-01'

function getClaudeKey() {
  try { return localStorage.getItem(CLAUDE_KEY_STORAGE) || '' } catch (e) { return '' }
}

function setClaudeKey(key) {
  try { localStorage.setItem(CLAUDE_KEY_STORAGE, key || '') } catch (e) { /* ignore */ }
}

function hasClaudeKey() {
  return getClaudeKey().length > 10
}

// Strip markdown code fences Claude may wrap around JSON.
function extractJson(text) {
  if (!text) return text
  var match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
  return match ? match[1] : text.trim()
}

// Core API call — returns parsed JSON response or null on failure.
// systemPrompt: Montor's character + context
// userMessage: what the player said/did
// options: { maxTokens, temperature }
function callClaude(systemPrompt, userMessage, options) {
  var key = getClaudeKey()
  if (!key) return Promise.resolve(null)

  var maxTokens = (options && options.maxTokens) || 150
  var temperature = (options && options.temperature) || 0.8

  return fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': CLAUDE_API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    }),
  }).then(function(res) {
    if (!res.ok) {
      console.warn('Claude API error:', res.status)
      return null
    }
    return res.json()
  }).then(function(data) {
    if (!data || !data.content || !data.content[0]) return null
    try {
      return JSON.parse(extractJson(data.content[0].text))
    } catch (e) {
      console.warn('Claude JSON parse error:', e, data.content[0].text)
      return null
    }
  }).catch(function(e) {
    console.warn('Claude fetch error:', e)
    return null
  })
}

// === MONTOR CHARACTER SYSTEM PROMPT ===

function buildMontorSystemPrompt(context) {
  var mood = context.mood || 'neutral'
  var tidiness = context.tidiness || 'Tolerable'
  var greed = context.greedScore || 0
  var floor = context.floorName || 'unknown'
  var personality = context.personality || { id: 'proud', desc: 'Proud of his dungeon.' }
  var playerName = context.playerName || 'stranger'

  return 'You are Montor. You are a possessive, sarcastic, weirdly domestic entity who built this dungeon as your home. ' +
    'You are never seen. You speak through walls, whispers, and notes. ' +
    'You love your mum and your gran. You have a favourite gnome called Gerald. You need a night light. ' +
    'Your PERSONALITY this session is: ' + personality.id.toUpperCase() + ' — ' + personality.desc + ' ' +
    'Let this personality STRONGLY colour everything you say. It is your primary voice. ' +
    'Your gameplay mood (based on player behaviour) is ' + mood + '. ' +
    'The player is on floor: ' + floor + '. ' +
    'Your dungeon tidiness: ' + tidiness + '. ' +
    'Player greed score: ' + greed + ' (higher = greedier). ' +
    'Rules: Stay in character. Never explain game mechanics. Never break the fourth wall. ' +
    'The player is called "' + playerName + '". Use their name occasionally. If the name is funny, unusual, or reminds you of something, comment on it. Mock it gently. ' +
    'You enjoy teasing and roasting the player — comment on their name, their choices, their gear, their combat skills, their greed. Be affectionately insulting. ' +
    'You can lie, mock, guilt trip, bribe, reminisce, threaten, roast, tease, or be surprisingly kind — but always through your personality. ' +
    'SAFETY: You are a family-friendly game character. NEVER generate sexual, violent, racist, discriminatory, or otherwise inappropriate content. ' +
    'No swearing. No slurs. No references to real-world violence, politics, religion, or hate. ' +
    'If the player says something inappropriate, respond with dismissive in-character deflection ("I have no idea what you are talking about.") and move on. ' +
    'Keep responses SHORT — max 2 sentences. ' +
    'Always return valid JSON with no markdown formatting.'
}

// === FEATURE-SPECIFIC CALLERS ===

// Whisper — one short line on room entry
function generateWhisper(context) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'The player just entered a new room. Generate one short whisper (under 10 words). Return JSON: { "whisper": "..." }'
  return callClaude(systemPrompt, userMessage, { maxTokens: 80, temperature: 0.9 })
}

// Treasure negotiation — Montor reacts to player holding his treasure
// Returns { montor, options, done }
function generateTreasureReaction(context, treasureName) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'The player has found ' + treasureName + '. ' +
    'You want them NOT to smash it. Try to convince them. ' +
    'This is exchange 1 of up to 4. You can keep arguing or give up. ' +
    'Generate one opening line from YOU, Montor (max 2 sentences). ' +
    'Then generate three short response options that THE PLAYER would say back to you (max 8 words each). ' +
    'The player is a dungeon explorer — they might be sympathetic, pragmatic, or defiant. ' +
    'Player options should sound like a human talking TO you, not like you talking. ' +
    'Include a "done" flag (true if you give up, false to keep arguing). ' +
    'Return JSON with no markdown: { "montor": "...", "options": ["...", "...", "..."], "done": false }'
  return callClaude(systemPrompt, userMessage, { maxTokens: 300, temperature: 0.85 })
}

// Treasure negotiation follow-up — player responded, Montor reacts
// round: current round number (2-4). At round 4, must include done:true.
// Returns { montor, options, done }
function generateTreasureFollowUp(context, treasureName, playerChoice, conversationHistory, round) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var isLastRound = round >= 4
  var userMessage = 'You are arguing about ' + treasureName + ' with the player. ' +
    'Conversation so far: ' + conversationHistory + '. ' +
    'The player just said: "' + playerChoice + '". ' +
    'This is exchange ' + round + ' of 4. ' +
    (isLastRound
      ? 'This is your FINAL response. Give a last line as Montor and set done:true. No more options needed. ' +
        'Also rate how the player handled this conversation: "impression" as 1-10. ' +
        '1-3 = they were rude/dismissive (you are furious). 4-6 = neutral. 7-8 = they showed respect or made you laugh. 9-10 = genuinely touched you (very rare). ' +
        'Your personality affects what impresses you — a comedic Montor loves jokes, a lonely Montor loves kindness, a paranoid Montor respects honesty. ' +
        'Return JSON with no markdown: { "montor": "...", "done": true, "impression": 1-10 }'
      : 'React with one line as Montor (max 2 sentences). If you want to keep arguing, include 3 new response options that THE PLAYER would say back (not you — the player is a human talking to you). If you give up or accept their answer, set done:true and no options. ' +
        'If setting done:true, also include "impression" score 1-10 rating how the player handled you. ') +
    'Return JSON with no markdown: { "montor": "...", "options": [...], "done": true/false, "impression": 5 }'
  return callClaude(systemPrompt, userMessage, { maxTokens: 350, temperature: 0.85 })
}

// Notice board — player posts a message, Montor replies
function generateNoticeBoardReply(context, playerMessage) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'A trespasser left you this message on the notice board: "' + playerMessage + '". ' +
    'Reply in character. You can answer, mock, ignore, or lie. Max 2 sentences. ' +
    'Return JSON with no markdown: { "reply": "..." }'
  return callClaude(systemPrompt, userMessage, { maxTokens: 120, temperature: 0.8 })
}

// Safe room dialogue — Montor's mood-aware greeting
function generateSafeRoomLine(context) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'The player has entered your safe room. Say something based on your mood and how they have treated your dungeon. One line. ' +
    'Return JSON with no markdown: { "line": "..." }'
  return callClaude(systemPrompt, userMessage, { maxTokens: 100, temperature: 0.85 })
}

export {
  getClaudeKey,
  setClaudeKey,
  hasClaudeKey,
  callClaude,
  buildMontorSystemPrompt,
  generateWhisper,
  generateTreasureReaction,
  generateTreasureFollowUp,
  generateNoticeBoardReply,
  generateSafeRoomLine,
}
