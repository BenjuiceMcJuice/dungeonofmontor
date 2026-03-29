# ⚔️ Dungeon of Montor
## 02 — Game Mechanics
*Full rules: stats, dice, combat, items, progression, factions, legacy*
*v0.3 — March 2026*

---

## 1. Characters & Classes

Players create a named character that persists across all runs and campaigns — carrying level, stats, gear, scars, titles, faction standing, and deity devotion permanently.

### Classes

| Class | Base HP | HP/Level | Auto-Skills per Level | Free Points/Level | Playstyle |
|---|---|---|---|---|---|
| Knight | 30 | +8 | STR +1, DEF +1 | 2 | Tanky frontliner |
| Ranger | 25 | +6 | AGI +1, PER +1 | 3 | Mobile skirmisher |
| Mage | 18 | +4 | INT +2 | 3 | High damage, fragile |
| Rogue | 22 | +5 | AGI +1, LCK +1 | 3 | Crits and tricks |
| Cleric | 27 | +6 | VIT +1, WIS +1 | 2 | Healer and support |
| Berserker | 32 | +9 | STR +2, DEF −1 | 1 | High-risk brawler |
| Orc Warchief | 40 | +14 | STR +1, DEF +2, END +1 | 1 | Enormous HP, specialist |
| Bard | 22 | +5 | CHA +2 | 4 | Buffs, AI narrative influence |
| Druid | 28 | +7 | WIS +1, VIT +1 | 2 | Adaptable, nature abilities |
| Paladin | 35 | +9 | STR +1, WIS +1, CHA +1 | 1 | Tank/support hybrid |

### Starting HP Formula

```
Max HP = Class Base HP + (VIT × 5) + (END × 2)

Knight, VIT 12, END 10:  30 + 60 + 20 = 110 HP
Orc Warchief, VIT 14, END 14:  40 + 70 + 28 = 138 HP
```

---

## 2. Skills & Stats

Every character has **14 skills**. At creation players distribute **70 points** across all skills. Minimum 1, maximum 18 in any skill before class bonuses.

**Modifier formula:** `floor((Skill − 10) / 2)` — a skill of 14 = +2, a skill of 8 = −1.

### Combat
| Skill | Abbrev | Effect |
|---|---|---|
| Strength | STR | Melee attack damage + hit chance. Carry weight. |
| Agility | AGI | Ranged accuracy, dodge chance, initiative. |
| Defence | DEF | Damage reduction: every 2 DEF = −1 damage taken (min 1). |
| Endurance | END | Stamina for special moves. Contributes to max HP. Fatigue resistance. |

### Mental
| Skill | Abbrev | Effect |
|---|---|---|
| Intellect | INT | Spell power, damage, accuracy. Item identification. |
| Wisdom | WIS | Resist mind effects and traps. Healing power for Clerics/Druids. |
| Perception | PER | Spot hidden enemies, traps, secret passages. Ambush detection. |

### Fortune
| Skill | Abbrev | Effect |
|---|---|---|
| Luck | LCK | Crit chance, loot quality rolls, random event outcomes. |
| Charisma | CHA | NPC persuasion, merchant prices, party morale. |

### Body
| Skill | Abbrev | Effect |
|---|---|---|
| Vitality | VIT | Max HP: each point = +5 HP on top of class base. |
| Resilience | RES | Resist poison, disease, environmental damage. Recovery from Downed. |

### Specialist
| Skill | Abbrev | Effect |
|---|---|---|
| Stealth | STH | Avoid detection, open ambushes, escape attempts. |
| Cunning | CUN | Trap-setting, disarming, reading enemy patterns. Bonus when outnumbered. |
| Willpower | WIL | Resist fear and morale loss. Buff duration. Concentration spells. |

---

## 3. Levelling Up

### XP Sources

| Action | XP |
|---|---|
| Defeating an enemy | 10–80 (scales with enemy tier) |
| Winning a combat encounter | +25 bonus |
| Succeeding at a skill check | 5–20 |
| Helping a Downed ally | 15 |
| Completing a Run | 100–300 (difficulty dependent) |
| Campaign milestone | 50–150 |

### XP Thresholds

| Level | XP to Reach | Level | XP to Reach |
|---|---|---|---|
| 2 | 100 | 8 | 1,250 |
| 3 | 200 | 9 | 1,600 |
| 4 | 350 | 10 | 2,000 |
| 5 | 500 | 11–20 | +500/level |
| 6 | 700 | 21–30 | +1,000/level |
| 7 | 950 | 31–50 | +2,000/level |

### On Level Up

1. **HP increase** — automatic, class-dependent
2. **Auto-skill gains** — automatic, class-dependent
3. **Free skill points** — player allocates. Max any skill = `Level + 10`
4. **Ability unlock** — every 5 levels (5, 10, 15, 20...), choose from class list

### Example Abilities

| Class | Ability | Type | Effect |
|---|---|---|---|
| Knight | Shield Wall | Passive | −2 damage taken at full HP |
| Ranger | Eagle Eye | Passive | +3 to ranged attack rolls |
| Mage | Arcane Surge | Active | Next spell +50% damage; 3-turn cooldown |
| Rogue | Backstab | Active | Double damage if enemy hasn't acted this round |
| Cleric | Lay on Hands | Active | Heal ally 2d8 + WIS; 2/run |
| Berserker | Blood Frenzy | Passive | +2 STR below 50% HP |
| Orc Warchief | Blood Rage | Passive | +3 STR below 30% HP |
| Bard | Inspiring Ballad | Active | All allies +2 to next roll |
| Druid | Barkskin | Active | +4 DEF for 3 turns |
| Paladin | Holy Smite | Active | +d8 bonus damage on hit; 2/encounter |

---

## 4. Dice Mechanics

### Dice Available
`d4 · d6 · d8 · d10 · d12 · d20 · d100`

The **d20** is the primary resolution die for all checks.

### Core Formula

```
Roll d20 + skill modifier  vs  Target Number (TN)

Natural 20  →  Critical Success (double effect + AI special narration)
Roll ≥ TN   →  Success
Roll < TN   →  Failure
Natural 1   →  Critical Failure (bad consequence + AI special narration)
```

### Attack Resolution

```
Attacker rolls: d20 + STR modifier (melee) or AGI modifier (ranged)
  vs  Defence TN = 10 + target DEF modifier

On hit:
  Damage = weapon die + STR modifier − floor(enemy DEF ÷ 2), min 1
```

### Skill Check Reference

| Situation | Skill | TN |
|---|---|---|
| Persuade a guard | CHA | 13 |
| Spot a hidden trap | PER | 14 |
| Pick a lock under pressure | CUN | 15 |
| Resist a fear spell | WIL | 13 |
| Identify a rare item | WIS or INT | 16 |
| Escape from combat | AGI | 14 |
| Resist poison | RES | 12 |
| Ambush an enemy | STH | 15 |
| Endure a gruelling march | END | 11 |

### Luck

Luck applies probabilistically rather than via direct checks. Loot quality: `d100 + LCK modifier` vs rarity table. Crit chance: base 5% (natural 20), +1% per 4 LCK above 10.

---

## 5. Combat

### Turn Order

Initiative at combat start: `d20 + AGI modifier`, highest first. Ties broken by raw AGI, then coin flip.

### On Your Turn — Actions

**One Action:**
- **Attack** — melee (STR) or ranged (AGI)
- **Cast Spell** — INT modifier; class-dependent
- **Use Item** — from active inventory (locked at battle start)
- **Help Ally** — revive a Downed teammate (WIS or INT vs TN 14)
- **Flee** — AGI check vs enemy AGI TN; success = escape, fail = opportunity attack

**One optional Bonus Action:**
- Use a class ability (if not on cooldown)
- Switch weapon
- Drink a potion already in active inventory

### Inventory Lock

When a battle begins (`inBattle: true` set on campaign doc), all inventory changes are locked. Players can only use items already in their 10 active slots. Items cannot be added, swapped, or purchased until the encounter ends. This forces pre-battle loadout decisions — reading narrative cues in exploration events to anticipate what's coming rewards smart play.

### Damage & Death

```
Damage dealt  = weapon die + STR modifier
Damage taken  = damage dealt − floor(DEF ÷ 2), min 1
```

Reaching 0 HP = **Downed** (cannot act). Allies can spend their Action to revive (WIS/INT vs TN 14). Success returns the character at 25% max HP.

All party members Downed = Run Failure. Partial XP awarded (50%), loot lost. Characters survive in Standard mode.

### Death Modes

**Standard:** Downed characters survive with a **Scar** — a permanent −1 to a thematically appropriate stat, AI-named to the manner of the defeat.

**Legacy Mode:** Character can choose a **Final Stand** when Downed — one free action, then permanently retired. Preserved read-only in campaign history.

**Ironman Mode:** True permadeath. 0 HP = deleted (or archived). AI writes a eulogy.

### Enemy Behaviour

Enemy actions determined each turn by the AI from: enemy type and tier, current HP of all participants, party composition, campaign context. Enemies react — they don't follow fixed scripts.

Enemy tiers: **Dust · Slate · Iron · Crimson · Void**

Boss enemies (Void-tier and campaign bosses) have phases — behaviour shifts at 50% HP.

---

## 6. Campaign Structure

### Campaigns & Runs

**Campaign** = full story arc (one overarching narrative, multiple sessions).
**Run** = one session (5–15 encounters, always ends with a Boss).

After each run: XP and loot distributed, characters saved, AI writes a chronicle entry. Next run begins with the AI given a compressed summary of prior events for continuity.

### Encounter Deck

Each run draws from a weighted deck, shuffled fresh:

| Type | Weight | Description |
|---|---|---|
| Combat | 45% | 1–5 enemies, scaled to party level and difficulty |
| Exploration | 20% | Skill check for reward; AI-narrated scene |
| Rest | 10% | Recover HP (d6 + VIT mod per character); possible minor event |
| Merchant | 10% | Buy/sell; CHA affects prices |
| Narrative Event | 10% | Story choice; consequences echoed in future narration |
| Boss | 5% | Always the final encounter of a run |

### Difficulty

| Setting | Enemy Modifier | Notes |
|---|---|---|
| Novice | −20% stats | First-timers |
| Seasoned | Standard | Recommended default |
| Veteran | +20% stats | Experienced players |
| Legendary | +40% stats, no rest recovery | Hardest |

Enemies also soft-scale with average party level — encounters never become trivially easy.

---

## 7. Items & Loot

### Item Types

All items are either **Equipped** (persistent effect while held/worn) or **Consumable** (single-use, destroyed on activation). Effects are either **flat** (fixed value) or **multiplier** (scales an existing stat).

**Equipped Slots:** 1 Weapon · 1 Off-hand · 1 Armour · 3 Relics

**Active Inventory:** 10 slots (locked at battle start)

**Stash:** Persistent Firebase storage, unlimited, not accessible mid-run

### Weapons

| Weapon | Die | Stat | Notes |
|---|---|---|---|
| Dagger | d4 | AGI | +1 attack roll |
| Shortsword | d6 | STR | — |
| Longsword | d8 | STR | — |
| War Axe | d8 | STR | Ignores 2 DEF on hit |
| Greatsword | d10 | STR | Two-handed |
| Maul | d12 | STR | Two-handed; −2 attack |
| Shortbow | d6 | AGI | Ranged |
| Longbow | d8 | AGI | Ranged; two-handed |
| Staff | d6 | INT | +2 spell rolls |
| Wand | d4 | INT | Off-hand usable |

**Weapon Prefixes** — rolled at loot generation, permanently attached:

| Prefix | Type | Effect |
|---|---|---|
| Serrated | Flat | +2 damage on hit |
| Venomous | Flat | Target loses 3 HP/turn for 2 turns |
| Flaming | Flat | +d4 fire damage on hit |
| Keen | Multiplier | Crit range 19–20 instead of 20 |
| Savage | Multiplier | Crit damage ×3 instead of ×2 |
| Ancient | Multiplier | All damage ×1.25 (rounded up) |

### Armour

| Armour | DEF Bonus | AGI Penalty |
|---|---|---|
| Leather | +2 | — |
| Chainmail | +4 | −1 |
| Half-Plate | +6 | −2 |
| Full Plate | +8 | −3 |
| Dragon Scale | +7 | −1 + fire resistance |
| Shadow Weave | +3 | +1 AGI bonus |

### Relics — Flat

| Item | Effect |
|---|---|
| Ring of Vitality | +3 VIT |
| Lucky Coin | +2 LCK |
| Cloak of Whispers | +2 CHA |
| Sage's Pendant | +2 INT |
| Shadowstep Ring | +2 STH |

### Relics — Multiplier

| Item | Rarity | Effect |
|---|---|---|
| Blood Signet | Rare | STR modifier ×1.5 for damage rolls |
| Arcane Lens | Rare | INT modifier ×1.5 for spell damage |
| Ironheart Core | Epic | Max HP ×1.1 |
| Ring of Echoes | Epic | Crit damage ×2.5 |
| The Undying Shard | Legendary | Survive one killing blow per run at 1 HP |
| Godstone of Ruin | Legendary | All damage ×1.3; take +10% damage |
| Crown of the Fallen | Legendary | +5% damage per Downed party member |

### Consumables

| Item | Effect |
|---|---|
| Minor Health Potion | Restore 2d6 HP |
| Health Potion | Restore 3d8 HP |
| Greater Health Potion | Restore 5d10 HP |
| Antidote | Remove poison/disease |
| Smelling Salts | Instantly revive Downed ally (no check needed) |
| Rage Draught | +4 STR, −2 DEF for 3 turns |
| Smoke Bomb | Enemies −4 to attacks next turn |
| Berserker's Blood | STR ×1.5 for damage; no Bonus Actions for 2 turns |

### Item Synergies

Certain combinations trigger automatically when equipped simultaneously:

| Items | Synergy | Bonus |
|---|---|---|
| Keen weapon + Ring of Echoes | Edge of Oblivion | Crits on 18–20; crit damage ×3 |
| Dragon Scale + Godstone of Ruin | Dragonborn | Fire immunity; fire damage heals 50% instead |
| Shadow Weave + Shadowstep Ring | Phantom Form | Re-enter stealth mid-combat (STH check TN 15) |
| Full Plate + Ironheart Core | Immovable | Cannot be moved, knocked back, or stunned |

**Multiplier cap:** ×2 total from all sources for any single stat or damage type. Prevents infinite stacking.

### Loot Rarity

Roll `d100 + LCK modifier` after combat:

| Roll | Rarity |
|---|---|
| 1–50 | Common |
| 51–70 | Uncommon |
| 71–85 | Rare |
| 86–95 | Epic |
| 96–100 | Legendary |

Boss encounters: guaranteed Rare or better. Legendary difficulty shifts the table up.

---

## 8. Enemy Types & Tiers

### Five Enemy Archetypes

| Enemy | Silhouette | Combat Style | Signature (Void Tier) |
|---|---|---|---|
| **Rat** | Small, hunched, front-on | Swarm mechanic — every rat alive +1 to all rat rolls | Swarm Call: 6 Dust rats join immediately |
| **Orc** | Wide upright biped | Melee only. High STR, low AGI. DEF scales sharply | Warcry: all allies +2 STR for 2 turns |
| **Rock Monster** | Asymmetric, craggy, massive | Slow. Immune to stagger. Every hit ignores 3 DEF | Avalanche: deals damage to entire party |
| **Slug** | Low, wide, side-on | Poisons on every hit (RES check TN 12). Leaves hazard trail | Death Secretion: poison bypasses RES, stacks per round |
| **Wraith** | Floating, hooded void | Ignores 50% DEF. Attacks WIL every third hit | Hollow Scream: one party member loses next turn |

### Five Power Tiers

| Tier | Colour | Hex | Feel |
|---|---|---|---|
| Dust | Light grey | `#c8c8c8` | Throwaway. Cannon fodder. |
| Slate | Blue-grey | `#6a8fa8` | Organised. Worth paying attention to. |
| Iron | Dark steel | `#4a4e52` | Dangerous. Built for this. |
| Crimson | Deep blood red | `#6b1a1a` | Elite. Something shaped this creature. |
| Void | Near-black | `#111111` | Singular. Named. The stuff of stories. |

Tier is communicated by sprite colour only — no label, no number. Same sprite form, different colour. Players learn the system through play.

---

## 9. Factions & Deities — The Long Game

These systems are designed to be felt across months of play, not unlocked in a session. They are implementation Phase 3–4 (see Technical doc).

### Character Arc Phases

Characters move through four phases over their career:

| Phase | Approx. Level | Feel |
|---|---|---|
| The Wanderer | 1–10 | Unknown. World doesn't care yet. |
| The Known | 10–25 | Factions remember. A deity stirs. |
| The Established | 25–40 | A reputation. Named enemies. |
| The Legend | 40+ | Power and consequence. |

### Factions

Characters accumulate **Standing** (−100 to +100) with factions across all campaigns. Standing moves ~±15–30 per run — Champion (+76) takes 5–8 runs of consistent positive actions to reach from neutral.

| Standing | Tier | Effect |
|---|---|---|
| +76 to +100 | Champion | Faction Legendary item access. 30% merchant discount. Faction may send narrative aid. |
| +51 to +75 | Honoured | Faction multiplier relics. 15% discount. |
| +26 to +50 | Allied | Faction standard gear unlocked. |
| −51 to −75 | Enemies | Faction encounter added to run deck. |
| −76 to −100 | Blood Enemy | Assassination events in Rest encounters. Faction boss may become a campaign villain. |

### Deities

Seven deities, each tied to a domain. Devotion tracked 0–1000. Grows slowly through aligned play — averaging 100–150 per run. Effects unlock through five tiers: Unnoticed → Seeker → Faithful → Devoted → Exalted → Avatar.

| Deity | Domain | Avatar Effect |
|---|---|---|
| Valdrus the Undying | Death, endurance | Survive one killing blow per campaign |
| Serath of the Blade | War, strength | STR modifier ×1.25 for melee; first kill each combat restores 10 HP |
| The Pale Weaver | Fate, luck | LCK modifier counted twice; once per campaign reroll any dice |
| Morrigan the Shadow | Stealth, cunning | First attack each combat auto-hits; can re-enter stealth mid-combat |
| Aelindra the Radiant | Light, healing | All healing ×1.5; once per campaign fully heal entire party |
| Gorrath the Ruiner | Chaos, destruction | All damage ×1.15; on kill: next attack auto-crits |
| The Nameless | Void, forbidden power | Spell crits trigger twice; once per campaign: a forbidden spell |

Divine Intervention (Exalted tier): once per campaign, not per run. A genuine dramatic moment.

### Faction × Deity Synergies

Reaching Honoured (faction) + Devoted (deity) simultaneously unlocks bonus effects unique to that combination. These are rare achievements requiring many campaigns.

---

## 10. Character Legacy — Permadeath & Embuing

### Scars

Permanent stat penalties earned from near-death experiences. AI-named to the manner of the defeat. Accumulate across a career. The AI reads them and references them in narration — a heavily-scarred character is written differently.

### Veteran Embuing (Level 20+)

High-level characters can pass power to lower-level ones. Maximum 3 Embues given per character lifetime. Maximum 2 received.

**Types:**
- **Skill Embue** — recipient gains +2 to one skill; veteran loses −1 permanently
- **Relic Embue** — pass a Bound relic; carries the veteran's name in its description
- **Legacy Blessing** — shortcut faction standing or deity devotion to the recipient

Legacy Characters (retired/dead) can still Embue at no cost — their final gift.

### Novice Contribution (Level 10 and below)

Lower-level characters in a mixed party:
- **Morale Aura** — party gets +1 to all skill checks while they're alive and not Downed
- **Lucky Charm** — if highest LCK in party, their full LCK modifier applies to all party loot rolls
- **Novice Embue** — three options: sacrifice next run's loot for a party benefit, give advantage once per campaign on any roll, or write a note the AI incorporates into the chronicle

---

## 11. The Story Page

Every campaign has a living Story Page updated by the AI after each significant encounter.

**Contains:**
- Campaign header (name, brief, difficulty, run number, party roster)
- **The Chronicle** — rolling prose narrative, one paragraph per encounter, written in story voice not game log
- **Key Moments** — tagged notable events: crits, deaths, rare items, story choices, named kills
- **Character Arcs** — scars earned, titles gained, faction movements, deity devotion milestones
- **Embue Records** — presented as story moments
- **Shareable link** — read-only, no account needed

No additional AI calls required — assembled from narration already generated during play.

---

## 12. The Dungeon Mood System

Inspired by Dungeon Crawler Carl — the dungeon is not a neutral setting. It is a place with a personality, controlled by something that watches, judges, and reacts. That something is Montor's voice.

Every piece of AI narration in Dungeon of Montor is delivered not by an omniscient narrator but by the dungeon itself. It has moods. It has opinions about what you're doing. It gets bored. It gets delighted. Sometimes it gets strange.

This reframes the entire AI output — the dungeon isn't describing events, it's *commenting* on them.

---

### The Six Moods

| Mood | Feel | Narration Style | Mechanical Effect |
|---|---|---|---|
| **Amused** | The dungeon finds your party entertaining | Dark humour, slightly theatrical, enjoys the drama | Loot rolls +5 bonus; encounter difficulty −5% |
| **Bored** | You're not trying hard enough | Dismissive, contemptuous, impatient | Encounter difficulty +10%; enemy initiative +2 |
| **Delighted** | Something extraordinary just happened | Gleeful, almost celebratory, overly generous | Loot rolls +15 bonus; chance of bonus encounter reward |
| **Wrathful** | You did something that displeased it | Threatening, personal, cold | Enemy damage +15%; no rest HP recovery this encounter |
| **Strange** | The dungeon is in an odd place | Surreal, non-sequitur, unsettling, rules feel bent | Random encounter modifier; AI may introduce unexpected elements |
| **Reverent** | You've done something genuinely impressive | Quiet, respectful, almost awed | Encounter difficulty −10%; one free reroll available this run |

The dungeon's mood is a **visible state** — not hidden from players. A subtle indicator on the View tab header shows the current mood as a single word or icon. Players should feel the shifts and be able to play into or against them.

---

### The Mood Score

Mood is tracked as a score from 0–100 on the campaign doc, with a current mood state. The score moves based on events and resets partially between runs (the dungeon has a memory, but it's not infinite).

```javascript
// campaign doc
dungeonMood: {
  current: 'amused' | 'bored' | 'delighted' | 'wrathful' | 'strange' | 'reverent',
  score: number,       // 0–100, position within current mood
  runCarryover: number // partial score carried into next run
}
```

**Score thresholds:**
```
0–15   → Wrathful
16–30  → Bored
31–50  → Amused       ← default starting state
51–70  → Delighted
71–85  → Reverent
86–100 → Strange      (the dungeon tips into something else entirely at extremes)
```

Strange is only reachable from the extremes — the dungeon has to tip past Wrathful or past Reverent to get there. It's an edge state, not a regular rotation.

---

### What Moves the Score

Mood shifts are triggered by coded game events, then *expressed* by the AI. The triggers are mechanical and deterministic. The expression is AI-generated and unique each time.

**Moves score UP (toward Delighted / Reverent / Strange):**

| Event | Score Change |
|---|---|
| Critical hit (natural 20) | +6 |
| Party survives encounter at low HP (any member below 20%) | +8 |
| Player attempts a dramatic or unusual action (AI-judged) | +5 |
| Rare or Legendary loot found | +7 |
| Campaign boss defeated | +15 |
| Run completed on Legendary difficulty | +12 |
| Player uses a consumable item creatively (AI-judged) | +4 |
| Character earns a scar and survives | +5 |

**Moves score DOWN (toward Bored / Wrathful / Strange):**

| Event | Score Change |
|---|---|
| Critical fumble (natural 1) | −5 |
| Party member Downed | −4 |
| Player flees combat | −8 |
| Party wipes (run failure) | −15 |
| Player takes no action for their turn (skips) | −6 |
| Same action used 3+ turns in a row (repetitive play) | −5 |
| Run completed too quickly (under 4 encounters) | −10 |

**Neutral / reset events:**
- Start of new run: score moves 20% toward centre (50)
- Rest encounter: score moves 10% toward centre
- Merchant encounter: no effect

---

### Mood Shift Scenes

When the score crosses a mood threshold, the AI writes a brief **Mood Shift Scene** — 1–3 sentences delivered as dungeon narration, inserted into the View tab between encounters. These are the moments the dungeon *notices* something changed.

They should feel like the room just shifted. Not an announcement. A feeling.

**Example mood shift narrations (AI-generated, these are illustrative):**

*Amused → Delighted (after a critical hit that kills a boss):*
> "Oh. Now *that* was something. The dungeon holds its breath for a moment — then exhales, slowly, like something old settling back into itself. It liked that."

*Amused → Bored (after three consecutive missed attacks):*
> "The torches dim. Not by much. But you notice."

*Bored → Wrathful (after a party wipe attempt):*
> "Something shifts in the walls. The temperature drops two degrees. Somewhere deeper, something stirs — not because it was summoned. Because it heard."

*Reverent → Strange (after a Legendary item is found and the score tips past 85):*
> "The corridor ahead is the same as it was. You are reasonably certain of this. You are less certain of the corridor behind."

---

### The Dungeon Addressing the Party

At Delighted, Reverent, and Strange moods, the AI is permitted to have the dungeon **address the party directly** — briefly, sparingly, never explained. Not breaking the fourth wall exactly. More like the wall becoming briefly transparent.

This is one of the things that makes Montor feel present without being seen.

**Rules for direct address:**
- Maximum once per run
- Never more than one sentence
- Never explains itself or answers questions
- Should feel like it could almost be coincidence

*Examples:*
> *"...and the door opens. As if it was waiting for you specifically."*

> *"You are the most interesting thing down here in some time."*

> *"Torren. The dungeon knows your name. It has always known your name."*

---

### Mood in the AI Prompt

The current mood is passed as a single token in the compressed context object — negligible cost:

```javascript
function buildCompressedContext(campaign, battleState, triggerType) {
  return {
    brief: campaign.brief,
    mood: campaign.dungeonMood.current,  // single word — ~1 token
    // ... rest of context
  };
}
```

The AI system prompt includes mood-specific instruction:

```
Current dungeon mood: {mood}

Adjust narration voice accordingly:
- amused: wry, theatrical, darkly entertained
- bored: flat, dismissive, impatient
- delighted: gleeful, generous, almost performative
- wrathful: cold, threatening, personal
- strange: non-linear, unsettling, slightly wrong
- reverent: quiet, measured, respectful
```

This costs almost nothing in tokens and changes everything about how the narration feels.

---

### Mood & Montor

The mood system *is* Montor's personality, expressed through the dungeon. Players will form a mental model of Montor through the shifts — not from description, but from behaviour. Some players will try to please the dungeon. Some will try to anger it. Some will find the Strange state and try to stay there.

None of this is explained in the game UI. It's discovered through play.

---

## 13. Montor's Offers & Curses

At certain mood thresholds, Montor intervenes directly — not through narration, but through a **special Narrative Event** that displaces a normal encounter in the deck. This is Montor's mechanical hand in the game.

Critically: **the player always chooses whether to engage**. Montor never imposes changes on existing gear or stats without consent. The offer is made. The player decides. This preserves trust — your sword is always your sword unless you chose otherwise.

Item stats are always generated by code. Montor influences *what is offered* and *at what cost* — not the underlying numbers.

---

### Montor's Offer (Delighted or Reverent mood, score 51+)

When mood crosses into Delighted or Reverent and at least 3 encounters have passed since the last Offer, a **Montor's Offer** event may trigger in place of the next Narrative Event slot.

The dungeon presents the party with something. The AI names and describes it. The item's stats are generated by the loot system at one rarity tier higher than the party would normally see. It is not random — the AI selects a *type* of item based on what the party needs most (inferred from current loadout and recent combat performance), and the code generates the stats for that type.

**The offer has a condition.** Always. The dungeon doesn't give freely.

Conditions are generated by the AI based on mood and campaign context. Examples:

| Mood | Example Condition |
|---|---|
| Delighted | "Take it. But the next enemy you kill — let it choose how it dies." (enemy gets a free final action) |
| Delighted | "It's yours. One of you must carry it unarmed for the next encounter." |
| Reverent | "The dungeon asks nothing. It simply wants to see what you do with it." (no condition — rare) |
| Reverent | "Wear it, and fight the next encounter without using abilities." |
| Strange | "Yes. But one of you will not remember receiving it." (random party member loses 5 XP from their next gain) |

The condition is mechanical — coded, not freeform. The AI selects from a pool of condition types; the code enforces it.

**If accepted:** item added to the accepting player's inventory. Condition logged to campaign doc and enforced by the game on the specified trigger.

**If declined:** mood score drops by 10 (the dungeon is mildly offended). No other consequence. You don't have to take it.

---

### Montor's Curse (Wrathful mood, score 0–15)

When mood crosses into Wrathful and at least 3 encounters have passed since the last Curse, a **Montor's Curse** event triggers in place of the next Narrative Event slot.

The dungeon does not remove or alter existing items. Instead it places a **Run Curse** — a debuff that lasts until the end of the current run only. Never permanent. Never touches base stats on the character doc.

The AI names and describes the curse in a mood-shift scene. The mechanical effect is coded and selected from a pool based on mood score severity.

**Curse pool (selected by code, named by AI):**

| Severity | Effect | Duration |
|---|---|---|
| Mild (score 10–15) | One random equipped relic goes inert — no effect this run | Until run end |
| Mild | All merchant prices +25% this run | Until run end |
| Moderate (score 5–10) | One party member's LCK treated as 5 regardless of actual value | Until run end |
| Moderate | Rest encounters restore 50% of normal HP this run | Until run end |
| Severe (score 0–5) | First combat encounter each run: all enemies act before party regardless of initiative | Until run end |
| Severe | Loot table drops one rarity tier for remainder of run | Until run end |

**The curse can be lifted.** The AI presents a condition in the curse narration — something the party can do to appease the dungeon. If the condition is met during the run, the curse lifts and mood score rises by 15.

**Lift conditions are dramatic, not mechanical favours:**

> *"The dungeon will release this if one of you takes a wound willingly before the next fight."* (a player voluntarily takes 10 damage before combat starts)

> *"Kill the next enemy with a natural 20. Nothing else will satisfy it."*

> *"Finish the next encounter without using any items."*

**If the run ends with the curse unlifted:** no further consequence. It expires. The dungeon's mood carries its carryover score into the next run — so a severe Wrathful state takes several runs to climb out of, but the curse itself doesn't persist.

---

### The Strange Offer

When mood is Strange (score 86–100), neither a standard Offer nor a standard Curse triggers. Instead: **The Strange Offer** — an event that can only happen in this state.

The Strange Offer is always unusual. The AI has more latitude here than anywhere else in the game. The item offered is real and coded, but the framing is wrong. The condition is real but slightly nonsensical. It shouldn't quite make sense, and that's correct.

The Strange Offer always involves a choice that feels like it has implications the game isn't telling you about.

**Examples:**

> *"There is a sword in the wall. It was not there before. It is very good. You may take it, but you must leave something behind — the game will not tell you what."* (random equipped item is moved to stash, inaccessible for this run — player doesn't know which one until after they accept)

> *"The dungeon offers you nothing. But if you ask it nicely, in writing, it may reconsider."* (player must type a short message — the AI reads it and decides whether to give an item. If the message pleases it, Rare item. If not, nothing. Mood unchanged either way.)

> *"Take the relic. It will work correctly on Tuesdays."* (item has double stats every other encounter — odd encounters normal, even encounters doubled. Coded. Genuinely useful if you track it.)

The Strange Offer always resolves cleanly in code. The weirdness is in the framing, not the mechanics.

---

### Implementation Notes

**Offer/Curse trigger check** runs after every encounter resolution in the Cloud Function:

```javascript
async function checkMontorEvent(campaignId) {
  const campaign = await getCampaign(campaignId);
  const { score, current, lastEventAt } = campaign.dungeonMood;
  const encountersSinceLastEvent = campaign.currentEncounterIndex - lastEventAt;

  if (encountersSinceLastEvent < 3) return; // cooldown

  if (score >= 86) return triggerStrangeOffer(campaign);
  if (score >= 51) return triggerOffer(campaign);
  if (score <= 15) return triggerCurse(campaign);
}
```

**AI call for Offer/Curse** is a single call with the current context + mood + party loadout summary. Returns: item type suggestion, condition text, flavour narration. Output token limit: 200. Cheap.

**Conditions are enforced mechanically** — stored on the campaign doc as structured objects, not freeform text:

```javascript
activeConditions: [{
  type: 'no_abilities_next_encounter' | 'voluntary_damage' | 'natural_20_kill' | ...,
  triggeredBy: 'montor_offer' | 'montor_curse',
  expiresAfter: 'next_encounter' | 'run_end',
  liftCondition: string | null,
  isMet: boolean
}]
```

The AI names the condition. The code enforces it. These never overlap.

---

### Montor's Offer/Curse & the Basic Crawler

In Basic Crawler mode (no AI / Montor disabled), Offer and Curse events are replaced by standard Narrative Events. The mood system still runs mechanically but has no output — loot roll modifier only (mood score shifts the table without any event firing).

This means the mood system gracefully degrades: full Montor mode gives named events and AI flavour; Basic Crawler mode gives silent loot table adjustments. Same code path, different output.

---

*Mechanics — v0.3 — March 2026*
