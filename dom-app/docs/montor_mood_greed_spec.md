# Montor's Mood, Greed & Safe Room Rewards
> Status: ✅ IMPLEMENTED (2026-04-06). Tidiness tiers updated 2026-04-07.

## Overview
Montor watches how you treat his dungeon. Search his junk piles? He notices. Loot everything? He's less generous. Show restraint? He rewards you at safe rooms. This creates per-pile decision-making: loot now vs Montor's favour later.

In co-op: gifts go to whoever finds them. Montor tracks each player's greed independently but rewards/punishes the party as a whole based on the worst offender.

## The Three Pillars

### 1. Tidiness Score (per floor)
Every junk search adds disturbance points based on clean level:

| Clean Level | Disturbance per search |
|---|---|
| Careful Clean (1 layer) | 1 point |
| Thorough Search (2 layers) | 3 points |
| Deep Clean (3 layers) | 6 points |

**Max possible disturbance per floor** = total pile layers across all rooms on that floor. Tidiness % = `1 - (disturbance / maxPossible)`. Each floor tracks independently.

You MUST search some piles to find terminals (progression requires it) — this is the core tension. You can't be 100% tidy and progress.

### 2. Greed Score (per run)
Tracks looting behaviour across the whole run:

| Action | Greed change |
|---|---|
| Take gold from corpse | +1 |
| Take item from corpse | +2 |
| Take ALL items from corpse | +3 |
| Leave corpse unlooted | -2 |
| Leave gold on corpse | -1 |
| Buy from merchant | 0 (neutral) |
| Sell to merchant | +1 |

**Greed is NOT a punishment.** Looting is normal — you're in a dungeon. High greed = neutral outcomes. LOW greed = Montor is intrigued by your restraint and rewards you.

### 3. Montor's Taste (per run, random)
At run start, Montor randomly:
- **Favours** one stat (e.g. "Montor admires strength today")
- **Dislikes** one stat (e.g. "Montor finds cunning distasteful")

Building his favoured stat pleases him. Stacking his disliked stat annoys him. This affects his "choice" tonic at safe rooms. Player never sees the label — only hints via whispers.

## Safe Room Rewards

When you enter a safe room, Montor's mood determines what you get in addition to the gift smash/apply:

| Floor Tidiness | Greed | Reward |
|---|---|---|
| 80%+ (pristine) | Low (<10) | 2x stat tonic (player picks both) |
| 80%+ (pristine) | Normal | 1x stat tonic (player picks) + hint |
| 60-79% (tidy) | Low (<10) | 1x stat tonic (player picks) |
| 60-79% (tidy) | Normal | 1x Montor's choice tonic (based on his taste) |
| 40-59% (messy) | Any | Random: 50% Montor's choice tonic, 50% nothing |
| Below 40% (ransacked) | Any | Nothing. "You've made quite a mess." |

**Stat tonics** permanently increase a stat by 1 for the run. Over 7 floors, a disciplined player gets up to +10-14 stat points. A greedy looter-player gets +2-4 but has better gear.

## Montor in the Safe Room

Currently safe rooms have the gift smash flow. Add Montor's presence:

### Safe Room Flow (updated)
```
1. Arrive → "Montor's presence fills the room."
2. Tidiness summary → "He seems [pleased/indifferent/annoyed]."
3. Gift offering (if treasure found) → smash/give flow (unchanged)
4. Montor's reward → tonic selection based on mood
5. Whisper → flavour text reflecting overall mood
6. Continue → doors
```

### Montor's Dialogue (data-driven, not AI)
Short lines based on mood bracket:

**Pristine + low greed:**
- "You're careful. I appreciate that."
- "Most of them just... take."
- "The garden looks almost the same."

**Tidy + normal greed:**
- "You could have been gentler."
- "I suppose you need to eat."
- *silence*

**Messy:**
- "Look at this place."
- "My grandmother would be appalled."
- "You know these things don't grow back."

**Ransacked:**
- "..."
- "Get out."
- "I hope it was worth it."

## Whispers Between Rooms

Already have `montorWhisper` — extend to be mood-aware:

| Mood state | Whisper pool |
|---|---|
| Happy (pristine, low greed) | "He seems content.", "A faint humming from somewhere.", "The air feels warmer." |
| Neutral | "Something watches.", "A creak in the walls.", "Dust settles." |
| Annoyed (messy) | "The walls feel closer.", "A low rumble.", "Something shifted in the dark." |
| Angry (ransacked, high greed) | "He knows.", "The temperature drops.", "You shouldn't have done that." |

## Co-op Additions

- Each player has their own greed score
- Tidiness is shared (both players disturb the same dungeon)
- Safe room reward uses the PARTY's worst tidiness + average greed
- Gifts go to whoever finds them (searches the pile that contains it)
- Montor comments on individual behaviour: "Your friend is more careful than you."

## Data Model

### New state in Game.jsx
```javascript
var [floorDisturbance, setFloorDisturbance] = useState(0)
var [maxFloorDisturbance, setMaxFloorDisturbance] = useState(0)
var [greedScore, setGreedScore] = useState(0)
var [montorTaste, setMontorTaste] = useState({ favours: null, dislikes: null })
var [montorMood, setMontorMood] = useState('neutral') // derived from tidiness + greed
```

### montorTaste generation (on run start)
```javascript
var stats = ['str', 'def', 'agi', 'int', 'lck', 'per', 'end', 'wis', 'cha', 'vit']
var shuffled = stats.slice().sort(function() { return Math.random() - 0.5 })
montorTaste = { favours: shuffled[0], dislikes: shuffled[1] }
```

### Disturbance tracking hooks
In `handleChooseCleanLevel` (junkpiles resolution):
```javascript
var disturbancePoints = { 1: 1, 2: 3, 3: 6 }
setFloorDisturbance(function(d) { return d + disturbancePoints[cleanLevel] })
```

### maxFloorDisturbance calculation
On floor generation, sum all pile layers across all chambers:
```javascript
var maxDist = floor.zones[0].chambers.reduce(function(sum, ch) {
  if (!ch.junkPiles) return sum
  return sum + ch.junkPiles.reduce(function(s, p) { return s + p.totalLayers }, 0)
}, 0)
// Multiply by Deep Clean cost (6) since that's the max disturbance per layer
setMaxFloorDisturbance(maxDist * 6)
```

### Greed tracking hooks
In corpse loot handlers:
```javascript
// Take gold
setGreedScore(function(g) { return g + 1 })
// Take item
setGreedScore(function(g) { return g + 2 })
// Leave corpse (dismiss without looting)
setGreedScore(function(g) { return g - 2 })
```

### Mood derivation
```javascript
function getMontorMood() {
  var tidiness = maxFloorDisturbance > 0 ? 1 - (floorDisturbance / maxFloorDisturbance) : 1
  if (tidiness >= 0.8 && greedScore < 10) return 'happy'
  if (tidiness >= 0.6) return 'neutral'
  if (tidiness >= 0.4) return 'annoyed'
  return 'angry'
}
```

## New data file: `src/data/montor-dialogue.json`
```json
{
  "safeRoom": {
    "happy": ["You're careful. I appreciate that.", "Most of them just... take."],
    "neutral": ["You could have been gentler.", "I suppose you need to eat."],
    "annoyed": ["Look at this place.", "My grandmother would be appalled."],
    "angry": ["...", "Get out.", "I hope it was worth it."]
  },
  "whispers": {
    "happy": ["He seems content.", "A faint humming.", "The air feels warmer."],
    "neutral": ["Something watches.", "A creak in the walls.", "Dust settles."],
    "annoyed": ["The walls feel closer.", "A low rumble.", "Something shifted."],
    "angry": ["He knows.", "The temperature drops.", "You shouldn't have done that."]
  },
  "greedComments": {
    "low": ["You left that behind. Interesting.", "Restraint. Rare down here."],
    "high": ["Taking everything, are we?", "Your pockets must be heavy."]
  }
}
```

## Implementation Order

### Sprint 1: Tracking (1-2 hours)
- Add disturbance/greed/taste state to Game.jsx
- Hook disturbance into junk search resolution
- Hook greed into corpse loot handlers
- Generate montorTaste on run start
- Add to save payload (runSave)

### Sprint 2: Safe room rewards (2-3 hours)
- Derive mood from tidiness + greed
- Tonic generation based on mood bracket
- StatPicker for tonic selection
- Montor dialogue in safe room UI
- Safe room flow: arrive → mood summary → gift → tonic → continue

### Sprint 3: Whispers + polish (1-2 hours)
- Mood-aware whisper pool
- Greed comments on looting
- Tidiness hint in safe room
- Visual mood indicator (colour/icon)

### Sprint 4: Save persistence (30 min)
- Add disturbance, greed, taste to save payload
- Restore on resume

## What This Doesn't Include (Future)
- AI-driven Montor conversations (Stage 4, Groq API)
- WIS-gated mood reading
- Montor visual presence (sprite/portrait)
- Gift sacrifice mechanic (not smashing = mood bonus)
- Soul slot synergies
- Cross-run Montor memory
