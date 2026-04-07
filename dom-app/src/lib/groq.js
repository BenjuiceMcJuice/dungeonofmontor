// Groq API wrapper — AI-powered Montor dialogue
// User supplies their own API key, stored in localStorage only

var GROQ_KEY_STORAGE = 'dom_groq_api_key'
var GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
var GROQ_MODEL = 'llama-3.3-70b-versatile'

function getGroqKey() {
  try { return localStorage.getItem(GROQ_KEY_STORAGE) || '' } catch (e) { return '' }
}

function setGroqKey(key) {
  try { localStorage.setItem(GROQ_KEY_STORAGE, key || '') } catch (e) { /* ignore */ }
}

function hasGroqKey() {
  return getGroqKey().length > 10
}

// Core API call — returns parsed JSON response or null on failure
// systemPrompt: Montor's character + context
// userMessage: what the player said/did
// options: { maxTokens, temperature }
function callGroq(systemPrompt, userMessage, options) {
  var key = getGroqKey()
  if (!key) return Promise.resolve(null)

  var maxTokens = (options && options.maxTokens) || 150
  var temperature = (options && options.temperature) || 0.8

  return fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
      response_format: { type: 'json_object' },
    }),
  }).then(function(res) {
    if (!res.ok) {
      console.warn('Groq API error:', res.status)
      return null
    }
    return res.json()
  }).then(function(data) {
    if (!data || !data.choices || !data.choices[0]) return null
    try {
      return JSON.parse(data.choices[0].message.content)
    } catch (e) {
      console.warn('Groq JSON parse error:', e)
      return null
    }
  }).catch(function(e) {
    console.warn('Groq fetch error:', e)
    return null
  })
}

// === MONTOR CHARACTER SYSTEM PROMPT ===

function buildMontorSystemPrompt(context) {
  var mood = context.mood || 'neutral'
  var tidiness = context.tidiness || 'Tolerable'
  var greed = context.greedScore || 0
  var floor = context.floorName || 'unknown'

  return 'You are Montor. You are a possessive, sarcastic, weirdly domestic entity who built this dungeon as your home. ' +
    'You are never seen. You speak through walls, whispers, and notes. ' +
    'You love your mum and your gran. You have a favourite gnome called Gerald. You need a night light. ' +
    'Your mood right now is ' + mood + '. ' +
    'The player is on floor: ' + floor + '. ' +
    'Your dungeon tidiness: ' + tidiness + '. ' +
    'Player greed score: ' + greed + ' (higher = greedier). ' +
    'Rules: Stay in character. Never explain game mechanics. Never break the fourth wall. ' +
    'You can lie, mock, guilt trip, bribe, reminisce, threaten, or be surprisingly kind. ' +
    'Keep responses SHORT — max 2 sentences. ' +
    'Always return valid JSON.'
}

// === FEATURE-SPECIFIC CALLERS ===

// Whisper — one short line on room entry
function generateWhisper(context) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'The player just entered a new room. Generate one short whisper (under 10 words). Return JSON: { "whisper": "..." }'
  return callGroq(systemPrompt, userMessage, { maxTokens: 50, temperature: 0.9 })
}

// Treasure negotiation — Montor reacts to player holding his treasure
function generateTreasureReaction(context, treasureName) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'The player has found ' + treasureName + '. ' +
    'You want them NOT to smash it. Try to convince them. ' +
    'Generate one opening line from you, and three short player response options. ' +
    'Return JSON: { "montor": "...", "options": ["...", "...", "..."] }'
  return callGroq(systemPrompt, userMessage, { maxTokens: 200, temperature: 0.8 })
}

// Treasure negotiation follow-up — player responded, Montor reacts
function generateTreasureFollowUp(context, treasureName, playerChoice, previousExchange) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'You are discussing ' + treasureName + ' with the player. ' +
    'Previous exchange: ' + previousExchange + '. ' +
    'The player said: "' + playerChoice + '". ' +
    'React and give one final line. The player will then choose to Smash or Keep. ' +
    'Return JSON: { "montor": "..." }'
  return callGroq(systemPrompt, userMessage, { maxTokens: 100, temperature: 0.8 })
}

// Notice board — player posts a message, Montor replies
function generateNoticeBoardReply(context, playerMessage) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'A trespasser left you this message on the notice board: "' + playerMessage + '". ' +
    'Reply in character. You can answer, mock, ignore, or lie. Max 2 sentences. ' +
    'Return JSON: { "reply": "..." }'
  return callGroq(systemPrompt, userMessage, { maxTokens: 100, temperature: 0.8 })
}

// Safe room dialogue — Montor's mood-aware greeting
function generateSafeRoomLine(context) {
  var systemPrompt = buildMontorSystemPrompt(context)
  var userMessage = 'The player has entered your safe room. Say something based on your mood and how they have treated your dungeon. One line. ' +
    'Return JSON: { "line": "..." }'
  return callGroq(systemPrompt, userMessage, { maxTokens: 80, temperature: 0.85 })
}

export {
  getGroqKey,
  setGroqKey,
  hasGroqKey,
  callGroq,
  buildMontorSystemPrompt,
  generateWhisper,
  generateTreasureReaction,
  generateTreasureFollowUp,
  generateNoticeBoardReply,
  generateSafeRoomLine,
}
