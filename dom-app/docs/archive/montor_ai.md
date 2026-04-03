# Montor AI Conversations & Mood System

> Design spec — 2026-04-01
> Stage 4 feature. Depends on: Groq API integration, static dialogue system (Stage 1), gift system

---

## Core Concept

Montor is not just a narrator — he's a character you can talk to. Via speaking tubes, mirrors, portraits, or safe room encounters, the player has freeform AI-driven conversations with Montor. The outcome (reward or punishment) depends on how well the player reads Montor's mood and responds accordingly.

**The key design rule:** It must never be obvious what Montor wants. Each run he has a different mood, and the player has to figure it out through the conversation itself.

---

## 1. Montor's Mood System

### Per-Run Mood
At the start of each run, Montor is assigned a mood from a weighted random pool. The mood label is NEVER shown to the player.

| Mood | What pleases him | What annoys him | Subtle tells |
|---|---|---|---|
| Nostalgic | Talk about family, the past, memories | Rushing, impatience, ignoring his stories | Mentions his mum unprompted, references "the old days" |
| Paranoid | Honesty, directness, transparency | Flattery, evasion, changing subject | Asks "why" repeatedly, questions your motives, repeats himself |
| Bored | Wit, surprises, entertainment, risk-taking | Predictability, politeness, playing it safe | Short responses, sighs, "go on then" energy |
| Proud | Admiration of his dungeon, collection, craft | Criticism, indifference to his work, breaking things | Describes rooms lovingly, corrects you about his things |
| Lonely | Kindness, staying to chat, genuine interest | Being transactional, trying to leave quickly | Keeps conversation going, asks personal questions, pauses |
| Vengeful | Defiance, strength, fighting spirit | Weakness, begging, running away | Threatens more than usual, references past adventurers who failed |
| Playful | Games, riddles, bets, humour | Seriousness, refusing to engage, being boring | Offers deals, asks trick questions, laughs |
| Melancholy | Empathy, listening, patience | Forced cheerfulness, dismissing his feelings | Trails off mid-sentence, long pauses, philosophical |

### Mood Shifts
Mood can shift mid-run based on player actions:
- Kill his favourite creature → shifts toward Vengeful
- Carry his personal items carefully → shifts toward Nostalgic or Lonely
- Break/sell his treasures → shifts toward Paranoid or Vengeful
- Search everything thoroughly → shifts toward Proud (he respects thoroughness) or Paranoid (you're going through his things)
- Die and retry → shifts toward Bored ("You again?")

---

## 2. Conversation Encounters

### Trigger Points
Conversations can occur at:
- **Safe rooms** — Montor appears in a mirror, portrait, or speaking tube
- **Before boss fights** — Montor offers a deal or threatens you
- **After finding a treasure** — Montor confronts you about stealing his things
- **Random** — ~10% chance on entering any chamber, Montor wants to chat
- **Merchant visits** — Montor comments through the merchant (the Butler relays messages)

### Conversation Flow
1. Montor opens with a line (AI-generated, mood-influenced)
2. Player responds:
   - **Free text** (type anything)
   - OR **Suggested tones** (3-4 options derived from CHA/WIS): Flattery / Defiance / Humour / Honesty / Empathy / Manipulation
3. 3-5 exchanges total (short, punchy)
4. AI scores the conversation internally
5. Outcome delivered

### Response Options & Stats
- **CHA** governs response quality — higher CHA = better suggested responses, more options
- **WIS** governs reading Montor — higher WIS = UI hints about his mood
  - Low WIS: no hints
  - Mid WIS (mod +1): vague ("He seems distracted")
  - High WIS (mod +2+): clearer ("He's dwelling on something. The past, maybe.")
- **CUN** unlocks manipulation — a risky "say what he wants to hear" option
  - If it works: better reward than honest approach
  - If Montor catches on (CUN check vs his mood): worse punishment
  - Paranoid Montor almost always catches manipulation

### Scoring
The AI scores the conversation 1-10 based on mood alignment:

| Score | Outcome | Example |
|---|---|---|
| 1-2 | **Furious** — punishment (spawn enemies, curse, lock door) | Insulted his mum to a Nostalgic Montor |
| 3-4 | **Annoyed** — mild punishment (lose some gold, temporary debuff) | Boring responses to a Bored Montor |
| 5-6 | **Neutral** — nothing happens, conversation ends | Average, forgettable |
| 7-8 | **Pleased** — reward (heal, item, gold, hint) | Matched his mood well |
| 9-10 | **Impressed** — rare reward (gift power boost, unique item, safe passage) | Perfectly read and responded to his mood |

---

## 3. AI Implementation

### System Prompt Template
```
You are Montor, the owner of this dungeon. You are a sarcastic, possessive hoarder
who built this dungeon as your home. You are [MOOD] this run — but you must NEVER
say this directly. Express it through your tone, topics, and reactions.

You respect: [MOOD_POSITIVE_TRAITS]
You despise: [MOOD_NEGATIVE_TRAITS]

Player context:
- HP: [X]/[MAX] | Floor: [FLOOR] | Chambers cleared: [N]
- Carrying your items: [LIST or "none"]
- Recent actions: [KILLED_BOSS / SEARCHED_JUNK / etc.]
- Player stats: CHA [X], WIS [X], CUN [X]

Rules:
- Keep responses under 40 words. You're pithy, not verbose.
- Never break character. Never explain the mood system.
- Score each player response 1-10 silently. Report the final score after the conversation.
- If the player tries to manipulate you and their CUN modifier is below +2, catch them.
```

### API Integration
- Groq API (same as BetaLog coach pattern)
- User supplies their own API key
- Fallback: if no key, use static dialogue from whispers array
- Conversation state: array of messages, sent as chat completion
- Final message includes hidden score in structured format

### Cost Control
- Max 5 exchanges per conversation (short)
- Max 2 conversations per floor (prevent farming)
- Haiku/small model for speed — Montor should respond instantly

---

## 4. Conversation Rewards & Punishments

### Rewards (score 7+)
- Heal 20-50% HP
- Free item from floor loot table
- Gold (10-30g)
- Hint about treasure location ("The gnome is in the third pile on the left")
- Safe passage through next combat room (enemies stand aside)
- Gift boon power boost (+1 to existing boon)
- Montor unlocks a door for you

### Punishments (score 1-4)
- Spawn 1-2 enemies in current room
- Temporary curse: -2 to a random stat for 3 chambers
- Lose 10-20g
- Lock a door you haven't used yet
- Montor alerts the next boss ("He knows you're coming now")
- Item stolen from inventory (he takes back something of his)

### Impressed (score 9-10)
- Montor's Favour: unique buff lasting entire floor (+1 all rolls)
- He reveals a treasure location explicitly
- He gives you something from his personal collection (epic item)
- "You remind me of her." (highest compliment — references his mum)

---

## 5. The "You Remind Me of Her" Moment

The ultimate Montor interaction. If a player:
- Has high WIS (reads his mood perfectly)
- Responds with genuine empathy during Melancholy or Nostalgic mood
- Has been carrying his mum's items (Wedding Ring, Rolling Pin, Bread Knife, Bandage)

...Montor goes quiet. Then: "You remind me of her."

This is the rarest outcome. It grants:
- Full heal
- A unique relic: **Montor's Mum's Blessing** (permanent +1 to all stats for the run)
- Montor stops attacking you for the rest of the floor (enemies still fight, but no Montor-triggered events)

This moment is earned, not scripted. The AI recognises the emotional context. It's the heart of the game hiding inside the sarcasm.

---

## 6. Dependencies

- Stage 1: Static whispers and merchant dialogue (done — provides fallback)
- Stage 1: Montor-themed items and personality (done — provides context)
- Stage 2: Persistent character (conversations can reference past runs)
- Stage 3: Multiplayer (Montor talks to the party, plays them against each other)
- **Stage 4: This system**

Everything built before Stage 4 feeds into the AI's context. The more game state we track, the richer Montor's responses become.
