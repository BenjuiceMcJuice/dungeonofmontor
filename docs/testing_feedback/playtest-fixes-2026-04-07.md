# Playtest Session — Fix List for Claude Code
> Session: 2026-04-06 late night playtest
> Load this file at the start of the Claude Code session tomorrow.

---

## Bugs to Fix

### 1. BLIND condition not affecting enemies
BLIND's accuracy penalty appears to only apply to the player. Check `conditions.js` / `combat.js` and ensure BLIND reduces enemy attack accuracy too.

### 2. Montor safe room dialogue wrong tier
"You could have been gentler" is Tidy/neutral dialogue but was showing on a Pristine result. Dialogue pools need to match their correct tidiness tier exactly:
- 80%+ Pristine: warm lines e.g. "You're careful. I appreciate that."
- 60-79% Tidy: neutral lines e.g. "You could have been gentler."
- 40-59% Messy: annoyed lines e.g. "Look at this place."
- Below 40% Ransacked: hostile lines e.g. "Get out."

### 3. Gerald smash dialogue fires before player chooses
"You BROKE Gerald?!" triggers on finding the gnome, not on confirming the smash. Split dialogue into three trigger points:
- **On find:** Montor reacts to you holding it — e.g. *"Put that down."*
- **On smash confirm:** *"You BROKE Gerald?!"*
- **On keep:** Suspicious silence or *"...why are you carrying that."*

### 4. Junk search result narrative clashing
Two issues on the junk result screen:
- "Almost missed it" lucky find flavour text is firing alongside trap results — suppress all positive flavour text if the result contains a trap
- Trap description is appearing twice (big red card at top + grey text at bottom) — remove the redundant grey text line

### 5. Orc feast mechanic
- Orcs can eat any enemy corpse (correct) but target must be **dead** — not living enemies
- Each corpse can only be eaten **once** — add a `consumed` flag to the corpse object, check before feasting
- Add combat log line: *"The Orc devours its fallen kin."*

### 6. END regen design doc mismatch
Code implements "Base 1 HP + END modifier per room" but `game_design.md` says just "END modifier per room". Update the doc to reflect the base 1 HP. Also consider flooring total regen at 0 so low END (e.g. 6) never actively drains HP between rooms.

### 7. Montor text must always use pixel font
All Montor dialogue — whispers, safe room lines, treasure negotiation, room entry trolling — must render in the purple pixel font. Audit every place Montor speaks and ensure no instances fall back to standard text rendering.

### 8. Petal gift duplication — two Thorn gifts doing the same thing
Check all Petal gift definitions — there are reportedly two "Thorn" variants that have near-identical effects. Identify them, document what each does, and either differentiate them meaningfully or merge into one. Also clarify exactly when each Petal gift triggers (on hit, on block, on entering room etc) and make sure these are consistent and documented.

---

## Balance Changes

### 8. Healing potion drop rate
Increase healing potion weight/frequency in junk loot tables (`junk.json`). Game is feeling harder due to fewer heals dropping from junk piles.

### 9. Trap damage as a range
Replace flat trap damage values with randomised ranges per search level:

| Level | Current | New range |
|---|---|---|
| Careful / Quick Rummage | 5 HP flat | 2–8 HP |
| Thorough Search | 12 HP flat | 8–16 HP |
| Deep Clean | 25 HP flat | 15–35 HP |

Roll randomly within the range. LCK stat can optionally bias toward the lower end of the range.

---

## New Mechanics

### 10. Spawn system overhaul
- **Remove spawn behaviour from Baby Dungeon Rats** — only adult Dungeon Rats can spawn babies
- **Hard cap: max 5 enemies in any single combat** — spawn silently fails if cap is already reached
- **Baby rats mature into adults** after X turns if not killed (decide value — suggest 4 turns)
- **Per-creature spawn rules:**
  - Rat: spawns 1 baby every 3 turns, baby matures in 4 turns
  - Spider: spawns 2 spiderlings at once, spiderlings can poison but are 1-shot killable and cannot mature
  - Moth: lays eggs that hatch after 2 turns rather than live spawn
  - Hound: calls a pup, pup grows into adult faster than rat babies

### 11. Montor room entry trolling
When the player enters a room, Montor occasionally interjects with a short troll/comment. Mood-aware — same tidiness/greed/mood state used elsewhere:
- **Happy Montor:** smug, proprietorial — *"I painted that ceiling myself."*
- **Neutral Montor:** dry observation — *"You won't find anything useful in here."*
- **Annoyed Montor:** passive aggressive — *"Careful. That's load-bearing."*
- **Angry Montor:** threatening — *"I know exactly where you are."*

For the AI version (Groq): generate 1 short line on room entry based on mood + room type. Not every room — maybe 30% chance to trigger. Must use purple pixel font. Keep lines very short (under 10 words ideally). Return JSON: `{ "whisper": "..." }`

For the static fallback version: extend existing `montorWhisper` pool with room-entry lines per mood tier.

### 12. Notice board (AI only)
A notice board appears once per zone (like a terminal — found in a specific chamber or junk pile). The player can post a short freeform question or message to Montor. Montor's answer appears on the notice board in the **next zone**.

**Flow:**
1. Player finds notice board — "Post a message to Montor?"
2. Short text input (max ~80 chars)
3. Message stored in run state
4. On entering next zone, notice board shows Montor's AI-generated reply
5. Reply is mood-aware and in character — he can ignore it, mock it, answer earnestly, or lie

**Prompt structure:**
```
You are Montor. You are [mood]. A trespasser left you this message: "[player message]". 
Reply in character. You can answer, mock, ignore, or lie. Max 2 sentences. 
Return JSON: { "reply": "..." }
```

Reply renders in purple pixel font on the notice board. AI only — no static fallback needed (just don't show the board if no Groq key).

### 13. Spear weapon identity
Give spears a distinct mechanical identity as the **condition delivery weapon**:
- Higher base condition apply % than other weapon classes
- Bonus to condition duration on spear hits
- Pairs naturally with INT stat — high INT/spear = dedicated condition controller build
- Update weapon class description in `game_design.md`

### 14. Prebuilt character roster
Replace the single starting Knight with a selection of prebuilt characters. Each has deliberate stat weaknesses that force a playstyle. Suggested roster:

| Name | Strengths | Weaknesses | Playstyle |
|---|---|---|---|
| The Knight | Balanced | None | Tutorial / default |
| The Glutton | STR 16, VIT 16 | END 4, CHA 4 | Hit hard, drain fast, merchants hate you |
| The Coward | AGI 16, LCK 16 | STR 6, END 6 | Flee often, crit when you do fight |
| The Hermit | WIS 16, PER 16 | CHA 4, STR 6 | Reads Montor perfectly, terrible fighter |
| The Brute | STR 16, DEF 16 | INT 4 | Can't apply conditions, ignores them too |

Characters should have names, a short flavour description, and their full stat spread defined.

### 15. Inventory tab restructure
Current layout breaks once equipment slots fill up — equipped and unequipped items compete for space. Restructure to:
- **Equipped** tab — currently equipped slots only (max 8 items, always clean)
- **Gear** tab — unequipped weapons and armour to choose from
- **Accessories** tab — rings, amulets, relics (unchanged)
- **Items** tab — consumables (unchanged)
- **Junk** tab — junk bag (unchanged)

### 16. AI Montor treasure negotiation ⚡ Priority — implement first
At every treasure find, trigger an AI-driven negotiation where Montor tries to convince the player NOT to smash the gift.

**Flow:**
1. Player finds treasure
2. Montor opens with a character line (not "You BROKE Gerald" — that's post-smash)
3. Groq generates Montor's argument + 3 player response options
4. Player picks a response
5. Montor reacts, 2–3 exchanges max
6. Player then sees Smash / Keep choice
7. Better reward if player keeps it (already in design)

**System prompt inputs (already available in state):**
- `floorTidiness` score
- `greedScore`
- Random mood roll at run start: happy / melancholy / insane / comedic / angry / paranoid / lonely / vengeful

**Montor's character rules for the prompt:**
- He is possessive, sarcastic, domestic
- He can lie, bribe, guilt trip, make jokes, reference his mum or gran
- He must never break character
- He must never directly explain the game mechanics
- Mood flavours his tone — comedic Montor makes jokes, paranoid Montor accuses you of being sent by someone

**Example system prompt structure:**
```
You are Montor. You are [mood]. The player has found [treasure name]. 
Your dungeon tidiness is [pristine/tidy/messy/ransacked]. 
You are trying to convince the player not to smash it. 
You can lie, bribe, joke, guilt trip. Stay in character. Never explain game mechanics.
Generate: one opening line from Montor, then three short player response options.
Return JSON: { "montor": "...", "options": ["...", "...", "..."] }
```

**UI:** Conversation window overlay at the treasure moment. Use safe room dialogue UI as template.

### 17. Zone-themed trader sprites
Tailor and Peddler NPCs currently have no visual identity. Add a unique pixel sprite per zone for each trader type, themed to match the zone aesthetic. Sprites follow the same canvas grid array format as enemies — no image files.

Suggested themes per zone:

| Zone | Tailor sprite | Peddler sprite |
|---|---|---|
| Garden (Grounds) | Gardener in apron | Wheelbarrow vendor |
| Great Hall (Underground) | Butler in livery | Travelling salesman with case |
| Kitchen (Underbelly) | Cook with ladle | Rat-catcher with sack |
| Sewers | Hooded figure | Urchin with trolley |
| Bedroom (Quarters) | Dressing gown figure | Nightstand vendor |
| Forge (Works) | Blacksmith | Scrap merchant |
| Caverns (Deep) | Robed cave dweller | Blind trader |
| Throne Room (Domain) | None (no traders) | None |

Start with Garden zone traders as the first implementation — they're the most played zone and set the visual standard. Each sprite should be recognisably different from enemies and from each other. Trader names are already zone-themed in the data — sprites should match.

---

## Documentation Updates
- Update `game_design.md` END regen section to match actual code (base 1 HP + modifier)
- Document Thornhide gift — currently exists in code but missing from all design docs. Add full description including trigger condition, effect, and which gift type / slot it belongs to
- Update spear weapon class description once new identity is implemented
- Add prebuilt character stat spreads to `game_design.md` or new `characters.md`
