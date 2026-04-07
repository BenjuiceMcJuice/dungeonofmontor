# Narrative Mode — Montor as Dungeon Master

## Concept
A text-based RPG campaign played asynchronously by 1-4 friends over days/weeks. Montor IS the dungeon master — he narrates, reacts, sets scenes, controls enemies, and judges dice rolls. Same dungeon, same items, same lore — but experienced through rich AI-generated narrative instead of the combat grid.

Think: D&D campaign in a group chat, with Montor running the show.

## Two Views

### 1. Story View (primary)
The main screen. A scrolling narrative feed — Montor's descriptions at the top, player actions at the bottom, dice rolls in the middle when needed.

```
┌─────────────────────────────────┐
│ MONTOR (DM)                     │
│                                 │
│ "The corridor splits. Left:     │
│  the sound of running water.    │
│  Right: silence. The kind that  │
│  means something is listening." │
│                                 │
│         ┌─────────┐             │
│         │  d20: 14 │            │
│         │ +2 PER   │            │
│         │ = 16 ✓   │            │
│         └─────────┘             │
│                                 │
│ KEITH (Player 1):               │
│ "I check the left passage       │
│  for traps"                     │
│                                 │
│ MONTOR:                         │
│ "Your fingers find a wire.      │
│  Thin. Almost invisible.        │
│  Almost."                       │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ [Type your action...]      [⚄]  │
│ [Inventory] [Party] [History]   │
└─────────────────────────────────┘
```

### 2. History View (secondary)
A condensed log of everything that happened — switchable from Story. Shows:
- Chapter summaries (AI-generated at the end of each session)
- Key decisions and outcomes
- Dice rolls and their consequences
- Loot found, enemies defeated, rooms explored
- Who did what (per-player action log)

## How It Plays

### Campaign Creation
1. One player creates a campaign: picks dungeon, difficulty, invites friends
2. Friends join via code (same as co-op spec)
3. Each player creates a character (name, archetype, stat allocation)
4. Montor introduces the dungeon — AI-generated opening narration based on his personality

### Turn Structure
Async — like a group chat. No strict turn order for exploration.

**Exploration turns (free flow):**
- Any player can type an action: "I search the bookshelf", "I listen at the door", "I drink the red liquid"
- Montor (AI) narrates the outcome
- If a stat check is needed, Montor calls for a roll: "Roll PER to spot the trap"
- Dice animation plays, result applied
- Other players see the action + outcome in their feed when they open the app

**Combat turns (structured):**
- Montor describes the encounter: "Three rats burst from the junk pile"
- Initiative rolled automatically for all players + enemies
- Turn order displayed
- Active player gets: Attack / Defend / Use Item / Flee / Speak
- Montor narrates each action's outcome with flair
- Enemy turns: Montor describes their actions ("The orc howls. Its allies stiffen with fury.")
- Between turns: players can speak to each other or to Montor (free text)

### Dice Rolls
Same d20 system as the main game. But presented narratively:

```
MONTOR: "The door is locked. Rusted. Old."

YOU: "I try to force it open"

MONTOR: "Roll STR. Let's see what you're made of."

         ┌─────────┐
         │  d20: 17 │
         │  +3 STR  │
         │  = 20 ✓  │
         └─────────┘

MONTOR: "The hinges scream. The door gives. 
         Behind it: darkness. And the smell 
         of something that used to be alive."
```

Failed rolls get narrated too — Montor loves describing failure:

```
         ┌─────────┐
         │  d20: 3  │
         │  +3 STR  │
         │  = 6 ✗   │
         └─────────┘

MONTOR: "You bounce off the door like a moth 
         off a window. The door doesn't move. 
         Your shoulder does. -2 HP."
```

### The AI Architecture

#### Two-tier prompting system:

**Tier 1: Campaign Context (long-term memory)**
Stored in Firestore, updated after each scene. Passed as system context to every AI call.

```json
{
  "campaign": {
    "dungeon": "Montor's Garden",
    "floor": 1,
    "roomsExplored": 5,
    "currentRoom": "A greenhouse with cracked glass ceiling",
    "monstersDefeated": ["2x Dungeon Rat", "1x Slug"],
    "lootFound": ["Rusty Dagger", "Health Potion"],
    "keyDecisions": [
      "Spared the wounded rat (Montor noticed)",
      "Broke the garden gnome (Montor furious)"
    ],
    "montorMood": "vengeful",
    "montorPersonality": "dramatic",
    "partyRelationships": {
      "Keith→Steve": "allied (shared potion)",
      "Steve→Montor": "hostile (broke gnome)"
    }
  }
}
```

**Tier 2: Scene Prompts (short-term)**
Per-action calls. Use campaign context + immediate situation.

```
System: [Campaign context + Montor personality + rules]

User: "The party enters the next room. Describe it. Include 
something interactive, a potential danger, and a Montor comment. 
If the party's previous actions warrant consequences, include them.
Return JSON: { 
  narration: '...', 
  roomType: 'exploration|combat|puzzle|social',
  interactables: ['bookshelf', 'suspicious puddle', 'locked chest'],
  danger: { type: 'trap|enemy|environmental', severity: 1-5 },
  montorComment: '...'
}"
```

#### Dice Rules (in Lore Bible, every call)
```
DICE RULES:
- d20 + stat modifier vs DC (difficulty class)
- DC 8 = easy, DC 11 = normal, DC 14 = hard, DC 17 = very hard
- Stat modifiers: (stat - 10) / 2, rounded down
  e.g. STR 12 = +1, AGI 8 = -1, INT 14 = +2
- Roll 1 = critical fail (something goes wrong)
- Roll 20 = critical success (something extra happens)

WHEN TO CALL FOR A ROLL:
- Physical action with risk: STR, AGI, DEF
- Noticing something hidden: PER
- Knowing/remembering something: INT, WIS
- Persuading/deceiving: CHA
- Lucky breaks: LCK

WHEN NOT TO ROLL:
- Walking through a door, picking up visible items, talking (unless
  persuading), looking at something obvious, making a choice

COMBAT:
- Attack: d20 + STR mod vs enemy DEF
- Damage: weapon die + STR mod
- Tiers: 20+ = crit (2x), 11-19 = hit, 6-10 = glancing (0.5x), <6 = miss
```

### Key Design: Groq Decides IF, App Rolls Dice
Groq NEVER rolls dice or calculates maths. It decides whether a roll is needed, which stat, and the DC. The app handles all random number generation and modifier calculation. Then sends the result back for narration.

**Two-call flow (actions needing dice):**
```
Call 1: Player action → Groq assesses
  Input: action + scene + player stats
  Output: { needsRoll, stat, dc, narrateBefore }

  [App rolls d20 + modifier, shows dice animation]

Call 2: Roll result → Groq narrates outcome
  Input: roll result + success/fail + context
  Output: { narration, consequence, loreDiscovery }
```

**One-call flow (no dice needed):**
```
Call 1: Player action → Groq narrates directly
  Input: action + scene
  Output: { needsRoll: false, narration, loreDiscovery }
```

### JSON Contracts

**Call 1 — Action Assessment:**
```json
{
  "needsRoll": true,
  "stat": "agi",
  "dc": 12,
  "narrateBefore": "You eye the shelves. Old. Possibly load-bearing. Possibly not.",
  "combat": false
}
```

**Call 2 — Outcome Narration (only if needsRoll):**
```json
{
  "narration": "You scramble up like a spider in armour. On the top shelf: a dusty envelope.",
  "consequence": null,
  "loreDiscovery": "Sealed envelope with wax stamp — letter M"
}
```

**No-roll action:**
```json
{
  "needsRoll": false,
  "narration": "It's a portrait of a woman. Kind. The paint is cracked but someone has touched up the eyes recently. Green eyes.",
  "loreDiscovery": "Portrait has green eyes — same glow as tree hollow"
}
```

The `loreDiscovery` field is critical — Groq flags what's narratively important so the campaign summary system knows what to preserve. The AI tells us what to remember.

### Action Resolution Prompt:
```
System: [Campaign context + Montor personality]

User: "Player 'Keith' says: 'I search the bookshelf for hidden 
passages'. Current room: greenhouse. Keith has PER 14 (+2 mod).
Determine: does this need a dice roll? If yes, which stat and DC?
If no roll needed, narrate the outcome directly.
Return JSON: {
  needsRoll: true/false,
  stat: 'per',
  dc: 12,
  narration: '...',
  onSuccess: { narration: '...', reward: '...' },
  onFailure: { narration: '...', consequence: '...' }
}"
```

#### Combat Narration Prompt:
```
System: [Campaign context + battle state]

User: "Keith attacks Dungeon Rat with Rusty Dagger. 
Attack roll: 15 + 2 STR = 17 (hit). 
Damage roll: d4=3 + 2 STR = 5 damage. 
Rat has 4 HP. Rat is killed.
Narrate this dramatically in Montor's voice."

Return JSON: { narration: '...' }
```

### Rooms and Progression
Same dungeon structure as the main game (4x4 grid, 7 floors) but experienced through text. Montor describes each room when entered. Players choose directions, interact with objects, search for loot.

Key difference: in narrative mode, rooms can have **puzzles and social encounters** that don't exist in the combat game:
- A locked door that needs a riddle answer
- An NPC who trades information for items
- A moral choice (save the rat or kill it for XP)
- Montor himself appearing in a mirror, offering a deal

### Items and Combat
Same items.json and weapons data. Same stat system. But presented narratively:
- "You find a Montor's Pruning Shears tucked behind a flowerpot. It smells faintly of rust and regret."
- Combat uses the same dice mechanics but Montor narrates every blow
- Conditions described in prose: "Poison seeps into your veins. Your vision swims. -2 STR until it passes."

### Montor's Role
Montor is NOT a neutral DM. He has opinions. His personality colours everything:
- **Dramatic Montor** narrates combat like a sports commentator
- **Chef Montor** describes wounds as cooking metaphors
- **Bureaucratic Montor** insists enemies fill in death certificates
- **Bad Montor** monologues about his master plan between rooms

He also:
- Comments on player decisions ("You LEFT the gold? ...interesting.")
- Remembers grudges from earlier in the campaign
- Adjusts difficulty based on mood (angry Montor spawns harder encounters)
- Can be negotiated with (treasure negotiation from main game, but richer)
- Occasionally helps if he likes the party (whispered hints, mysterious items appearing)

### Session Structure
A "session" is a play period — maybe 30 minutes to 2 hours of async messages.

At the end of each session, Montor generates a **chapter summary**:
```
"Chapter 3: The Greenhouse Incident

In which Keith found a poisoned puddle and drank 
from it anyway, Steve broke Gerald (I will never 
forgive this), and the party defeated The Overgrowth 
by the skin of their teeth. The Garden is cleared. 
The Underground awaits.

Notable: Steve's PER roll of 19 saved the party 
from the dart trap. Keith's STR roll of 2 did not 
save the door. Or Keith's shoulder."
```

### Party Dynamics
- Players can talk to each other in the feed (out of character or in character)
- Players can trade items
- Players can split up (Montor manages separate scenes)
- Players can disagree on decisions (Montor adjudicates or calls a vote)
- Dead players become ghosts who can whisper hints (1 per room) until revived at a safe room

## Data Model

### Firestore Structure
```
/campaigns/{campaignId}
  type: 'narrative'
  status: 'active' | 'paused' | 'completed'
  difficulty: 'novice' | 'seasoned' | 'veteran'
  montorPersonality: { id, desc }
  montorMood: 'happy' | 'neutral' | 'annoyed' | 'angry'
  currentFloor: 0
  currentRoom: { description, interactables, danger }
  
  participants: [{ uid, name, character, isAlive }]
  
  campaignContext: { ... } // long-term AI memory (see above)
  
  // Current combat state (if in combat)
  battleState: { ... } // same as main game
  
/campaigns/{campaignId}/messages/{msgId}
  timestamp, authorUid, authorName
  type: 'narration' | 'player_action' | 'dice_roll' | 'combat' | 'chat' | 'chapter_summary'
  content: string
  diceRoll: { stat, roll, modifier, total, dc, success } // if applicable
  aiGenerated: boolean

/campaigns/{campaignId}/chapters/{chapterNum}
  summary: string (AI-generated)
  roomsExplored, enemiesDefeated, keyDecisions
  startTimestamp, endTimestamp
```

## UI Components Needed

### New Components
- `NarrativeView.jsx` — main story feed (scrolling messages)
- `NarrativeInput.jsx` — action input + quick action buttons
- `DiceRollDisplay.jsx` — animated dice result card
- `NarrativeHistory.jsx` — chapter summaries + full log
- `NarrativePartyBar.jsx` — party status strip (HP, conditions, turn order in combat)
- `NarrativeCampaignLobby.jsx` — create/join narrative campaigns

### Shared with Main Game
- `ChamberIcon` sprites (for room decoration)
- `ConditionIcon` (for condition display)
- Item data (items.json, weapons, etc.)
- Dice mechanics (dice.js)
- Character generation (classes.js)
- Condition system (conditions.js)

## Implementation Phases

### Phase 1: Solo narrative (2-3 weeks)
- Single player only
- Basic story feed + action input
- AI room generation + action resolution
- Dice roll display
- Same dungeon structure, navigated by text
- Items and combat through narrative
- Chapter summaries

### Phase 2: Multiplayer narrative (2-3 weeks)
- Campaign creation + join codes
- Async message feed (Firestore onSnapshot)
- Multiple players in same story
- Turn-gated combat, free-flow exploration
- Player-to-player chat
- Push notifications for new messages

### Phase 3: Deep narrative (ongoing)
- Branching storylines based on decisions
- Montor's grudge system (remembers across sessions)
- Unique narrative events per personality
- Player death → ghost mechanics
- NPC conversations
- Puzzles and riddles
- The endgame: confronting Montor in the Domain

## Why This Works
- Same dungeon, items, combat mechanics — no new game design needed
- AI does the heavy lifting for narration — infinite replayability  
- Async play means friends in different timezones can campaign together
- Montor's personality makes every campaign feel different
- The text format is accessible — no graphics needed, works on any device
- Builds on everything already built: Groq integration, personality system, mood tracking, condition reactions

## Cross-Mode Progression (Roguelike → Narrative)

Roguelike runs feed into narrative characters:

| Roguelike Achievement | Narrative Benefit |
|---|---|
| Banked gifts | Available to equip at terminals in narrative mode |
| Run achievements ("100 rats killed") | Permanent stat bonuses in narrative (+1 STR etc.) |
| Items found in roguelike | Appear in narrative loot tables (familiar items) |
| Floors cleared | "Familiarity" bonus — Montor comments, DC reduced for known areas |
| High greed score runs | Montor remembers across modes — "You again. The greedy one." |
| Gift sacrifice choices | Narrative Montor references past decisions |

Characters can play BOTH modes. Roguelike builds power. Narrative mode uses that power in a richer story context. Neither mode is required — but cross-play is rewarded.

## Token Management — Three-Tier Memory

### The Problem
A campaign over days/weeks generates thousands of messages. Can't send full history to Groq every call — 128K context limit would be hit fast.

### The Solution: Compressed Memory

```
┌─────────────────────────────────────────────────┐
│ Tier 1: System Prompt (~500 tokens)             │
│   Montor personality, rules, safety, mood        │
│   Sent with EVERY call. Never changes mid-run.   │
├─────────────────────────────────────────────────┤
│ Tier 2: Campaign Summary (~1000 tokens)          │
│   AI-compressed summary of everything important  │
│   Updated after each chapter/session end          │
│   "The party is on floor 2. Keith has a grudge   │
│   against Montor. Steve broke Gerald. They found  │
│   the Pruning Shears. Montor is vengeful."       │
├─────────────────────────────────────────────────┤
│ Tier 3: Recent Context (~2000 tokens)            │
│   Last 10-15 messages only                       │
│   Gives AI immediate conversation flow           │
│   Older messages pruned automatically             │
├─────────────────────────────────────────────────┤
│ Total per call: ~3500 input + ~300 output        │
│ = ~3800 tokens per action                        │
└─────────────────────────────────────────────────┘
```

### How Summaries Work

**Scene summaries (every ~20 messages):**
- AI generates a 200-token scene summary
- Captures: what happened, who did what, consequences, Montor's reactions
- Stored in Firestore as scene records

**Chapter summaries (session end):**
- AI compresses ALL scene summaries into one campaign summary (~1000 tokens)
- This REPLACES the raw history as Tier 2 context
- Old messages archived in Firestore for History view but NOT sent to AI
- Campaign summary is the AI's "memory" — compressed, not raw

**Summary generation prompt:**
```
"Summarise this session for campaign memory. Include:
- Where the party is now (floor, room)
- Key decisions and their consequences
- Each player's notable actions and personality
- Montor's current feelings about each player
- Unresolved plot threads or dangers
- Items gained/lost, enemies defeated
Keep under 300 words. This summary replaces all previous
context — it must contain everything the DM needs to know."
```

### Pruning Strategy
```
Messages 1-20:    Summarised → Scene 1 summary
Messages 21-40:   Summarised → Scene 2 summary  
Messages 41-60:   Summarised → Scene 3 summary
Session end:      Scenes 1-3 compressed → Chapter summary
Next session:     Chapter summary = Tier 2 context
                  Only last 15 messages = Tier 3 context
```

### Cost Estimate
- 50 actions/session × 3800 tokens = 190K tokens/session
- 1 scene summary × 2000 tokens = 2K tokens
- 1 chapter summary × 3000 tokens = 3K tokens
- **Total per session: ~195K tokens**
- Groq free tier: handles this easily
- 10-session campaign: ~2M tokens total — well within limits
- 4 players × 50 actions = 200 actions, still ~760K tokens/session — manageable

### Context Quality Over Time
The compression approach means Montor's "memory" gets MORE focused over time, not less. Early sessions: raw messages, lots of noise. Later sessions: compressed summaries capture only what matters — grudges, alliances, key items, unresolved threats. Montor's narrative becomes richer as the campaign progresses because the context is cleaner.
