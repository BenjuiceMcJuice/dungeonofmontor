# Montor

> Everything about Montor the character, his Gifts, his mood, and his future as an AI personality.
> Updated 2026-04-03.

---

## 1. Who Is Montor?

Montor is an eccentric old man who built this dungeon as his home. The word is invented -- a portmanteau of Monster, carrying the weight of something paternal and ancient. A Daddy Monster.

He is never mechanically defined. He is possessive, sarcastic, and weirdly domestic. His dungeon is full of his stuff -- kitchen implements, garden tools, his mum's wedding ring, his gran's lottery ticket, a favourite garden gnome called Gerald. Every weapon in the game is something from his house. Every piece of armour is his clothing. The dungeon descends through his garden, his reception rooms, his sewers, his private quarters, his forge, his caves, and finally his throne room.

Players are always the intruders. You're in his house. You're going through his things. He has opinions about that.

**Key traits:**
- Possessive hoarder -- he can't throw anything away
- Sarcastic but not cruel (except when he is)
- Loves his mum and his gran -- references them constantly
- Has a favourite garden gnome named Gerald
- Needs a night light to sleep
- Owns calibrated tongs he's proud of
- His grandmother had a gravy boat that's important to him

---

## 2. Montor's Gifts

### Overview

Each floor of the dungeon is saturated with one of Montor's Gifts -- elemental essences that belong to him. Players steal these powers by finding and breaking Montor's prized possessions hidden in junk piles. The breaking is irreversible. Montor is furious.

### The Treasures

| Floor | Treasure | How you break it | Gift released |
|---|---|---|---|
| 0 -- The Grounds | Montor's Favourite Gnome | Kick it. Gerald's head pops off. | **Petal** |
| -1 -- The Underground | Montor's Gravy Boat | Tip it over. The gravy never stops. | **Stone** |
| -2 -- The Underbelly | Montor's Toilet Seat | Slam the lid. It cracks in half. | **Bile** |
| -3 -- The Quarters | Montor's Music Box | Wind it backwards. The melody inverts. | **Blood** |
| -4 -- The Works | Montor's Best Tongs | Bend them. They snap. | **Ember** |
| -5 -- The Deep | Montor's Night Light | Blow it out. The darkness rushes in. | **Void Shard** |

### The 6 Gifts

| Gift | Theme | Colour |
|---|---|---|
| Petal | Nature -- pollen, thorns, vines, healing | Green |
| Stone | Earth -- rock, weight, cold, endurance | Blue-grey |
| Bile | Decay -- acid, rot, disease, weakening | Sickly yellow |
| Blood | Flesh -- life, pain, regeneration, hunger | Crimson |
| Ember | Fire -- heat, metal, forge, destruction | Orange |
| Void Shard | Chaos -- shadow, entropy, dice manipulation | Black |

### Application Slots

Gifts are applied at safe rooms between floors. 4 slots are available:

| Slot | Effect type |
|---|---|
| Body | Passive stat/mechanic bonus |
| Mind | Passive perception/control bonus |
| Weapon | Enchantment on equipped weapon |
| Shield | Enchantment on equipped shield |

One active boon per slot. Applying a new boon to an occupied slot replaces the old one permanently.

### Current State: Petal Gift (fully implemented)

The Petal gift is the only gift type currently implemented. It has 16 effects across all 4 slots, each with full and partial power versions:

| Slot | Boon name | Full effect | Partial effect |
|---|---|---|---|
| Body | Bloomheart | Regen 2 HP per chamber | 1 HP per chamber |
| Body | Thornhide | Reflect 2 damage on hit | Reflect 1 |
| Body | Barkweave | +2 DEF permanently | +1 DEF |
| Body | Roothold | Immune to knockback/stagger | 50% resist |
| Mind | Pollen Sense | Searches always find something, +2 PER | +1 PER only |
| Mind | Thorn Instinct | +2 initiative permanently | +1 initiative |
| Mind | Verdant Calm | Immune to FEAR | 50% FEAR resist |
| Mind | Root Memory | Reveal terminal location on floor | Narrow search area |
| Weapon | Lifethorn | Heal 2 HP on each hit | Heal 1 HP |
| Weapon | Vine Lash | 20% chance to POISON on hit | 10% chance |
| Weapon | Thorn Strike | +2 damage permanently | +1 damage |
| Weapon | Petal Edge | Crits apply BLEED | 50% chance |
| Shield | Bark Shield | Blocking heals 3 HP | Heals 1 HP |
| Shield | Thorn Guard | Blocking reflects 2 damage | Reflects 1 |
| Shield | Pollen Burst | Blocking has 20% chance to DAZE | 10% chance |
| Shield | Root Anchor | +5% block chance | +2% block chance |

Gift activation uses a d20 + WIS roll at the safe room. Montor demands a sacrifice before allowing activation. Roll determines full/partial/no effect.

### Future: 5 More Gift Types (planned)

Stone, Bile, Blood, Ember, and Void Shard gifts are fully designed (see design specs) but not yet implemented in code. Each follows the same 4-slot pattern with effects themed to their element. Implementation is on the backlog.

---

## 3. Endgame Vision (planned)

Across multiple runs, the endgame goal is to restore all 6 Gifts to the **Void Chamber** deep in the dungeon. Each Gift must be found, activated, and carried to the chamber. This requires multiple runs because:
- Only one Gift can be found per floor per run
- Unactivated Gifts are lost when a run ends
- The Void Chamber is on the deepest floor

Restoring all Gifts completes a meta-progression arc. The exact rewards and final encounter are TBD.

---

## 4. Montor's Mood System (planned)

Three pillars drive Montor's personality during a run:

### Pillar 1: Tidiness Score
- Every junk search adds disturbance points: Quick = 1/layer, Thorough = 2/layer, Deep Clean = 4/layer
- Per-floor tidiness = actual disturbance as % of maximum possible
- 0% = pristine (Montor loves you), 100% = ransacked (he's livid)
- You MUST search some piles to find terminals -- this is what first gets his attention
- Core tension: loot and XP now vs better rewards at the safe room

### Pillar 2: Gift Sacrifice
- Choosing NOT to smash a gift on a floor makes Montor extra happy
- Trade-off: combat power (gift slot) vs Montor's favour (better tonics at safe rooms)

### Pillar 3: Montor's Taste (per-run)
- Each run Montor randomly favours and hates certain stats
- Building what he likes = pleased; stacking his hated stat = grumpy
- Affects "Montor's choice" tonic selection at safe rooms

### Safe Room Tonic Rewards

| Tidiness | Reward | Player chooses? |
|---|---|---|
| 90%+ (pristine) | 2x stat tonic | Yes -- pick any 2 stats |
| 70-89% (tidy) | 1x stat tonic | Yes -- pick any stat |
| 50-69% (messy) | 1x Montor's choice tonic | No -- he picks based on taste |
| Below 50% (ransacked) | Random junk or nothing | No |

Over 7 floors, a disciplined player gets up to +14 permanent stat points. A greedy player gets +3-4 stats but more loot/items. Both playstyles are viable.

### Between-Room Whispers

Montor's mood affects short whisper messages shown between rooms: "He seems pleased..." vs "Something feels hostile..." These create a sense of a reactive personality without full AI.

---

## 5. WIS as the Montor Relationship Stat (planned)

WIS governs the player's relationship with Montor:
- **Gift activation:** d20 + WIS determines boon power (full, partial, or wasted)
- **Mood reading (Stage 4):** Higher WIS gives UI hints about Montor's current mood
  - Low WIS: no hints
  - Mid WIS (mod +1): vague ("He seems distracted")
  - High WIS (mod +2+): clearer ("He's dwelling on something. The past, maybe.")
- **Conversation quality (Stage 4):** Better WIS = better suggested dialogue responses

---

## 6. AI Montor (Stage 4 -- planned)

### Conversation System

Montor is not just a narrator -- he's a character you can talk to. Via speaking tubes, mirrors, portraits, or safe room encounters, the player has freeform AI-driven conversations with Montor. The outcome depends on how well the player reads his mood.

### Per-Run Mood (AI version)

At the start of each run, Montor is assigned a hidden mood:

| Mood | What pleases him | What annoys him |
|---|---|---|
| Nostalgic | Talk about family, the past | Rushing, impatience |
| Paranoid | Honesty, directness | Flattery, evasion |
| Bored | Wit, surprises, risk-taking | Predictability, politeness |
| Proud | Admiration of his dungeon | Criticism, indifference |
| Lonely | Kindness, staying to chat | Being transactional |
| Vengeful | Defiance, fighting spirit | Weakness, begging |
| Playful | Games, riddles, bets | Seriousness |
| Melancholy | Empathy, listening | Forced cheerfulness |

The mood label is NEVER shown to the player. They must figure it out through conversation.

### Conversation Scoring

The AI scores each conversation 1-10 based on mood alignment:

| Score | Outcome |
|---|---|
| 1-2 | Furious -- punishment (spawn enemies, curse, lock door) |
| 3-4 | Annoyed -- mild punishment (lose gold, temporary debuff) |
| 5-6 | Neutral -- nothing happens |
| 7-8 | Pleased -- reward (heal, item, gold, hint) |
| 9-10 | Impressed -- rare reward (gift boost, unique item, safe passage) |

### "You Remind Me of Her"

The rarest outcome. If a player has high WIS, responds with genuine empathy during Melancholy/Nostalgic mood, and is carrying his mum's items -- Montor goes quiet, then says "You remind me of her." Full heal, unique relic, and Montor stops attacking for the rest of the floor.

### AI Implementation

- Groq API (user-supplied key, stored in localStorage only)
- Max 5 exchanges per conversation, max 2 per floor
- Fallback: if no API key, use static dialogue from whispers array
- Stats affect conversations: CHA governs response options, WIS governs mood reading, CUN unlocks manipulation (risky)

---

*Montor -- v1.0 -- April 2026*
