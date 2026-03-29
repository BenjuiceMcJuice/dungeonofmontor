# ⚔️ Dungeon of Montor
## 04 — UI Specification
*Tab structure, screen states, combat UX flow, design system*
*v0.3 — March 2026*

---

## Core Principle

**The View tab is the game. Everything else is reference.**

Players should never scroll past irrelevant information to take their turn. The action surface is minimal — almost like reading a text thread, with choices appearing only when needed and disappearing when they're not. Tabs solve the information density problem without hiding anything.

---

## Tab Structure

Five persistent tabs on a fixed bottom navigation bar.

```
[ 👁 View ] [ ⚔️ Party ] [ 📋 Stats ] [ 🎒 Inventory ] [ 📜 Story ]
```

Default tab: **View**. Active tab: gold label. During your turn, View tab label shows a subtle dot indicator.

Transitions between tabs: **instant**. No animation delays — reference should feel immediate.

---

## Tab 1 — 👁 View

The only tab that changes meaningfully during play. Everything else is relatively static.

### State A — Your Turn

**Layout top to bottom:**

1. **Scene header** — one line. Encounter type and round. e.g. *"Combat · Round 2"*

2. **Situation text** — 2–4 sentences of AI narration. What you can see. What's happening. Second person, present tense. Only text on screen before you act.

3. **Action buttons** — appear below situation text. Maximum 4 options. Large tap targets. No sub-descriptions cluttering the view.
   - Attack / Use Item / Help Ally / Flee

4. **Target selection** — on action selected, enemies listed with HP and TN. Tap to select.

5. **Confirmation strip** — one line replacing the grid. e.g. *"Attack → Hollow Warden · d20 +3 vs TN 14"*. Single large **Roll the Dice** button below it. Nothing else on screen.

6. **Roll** — die animates (~0.7s wobble). Result: big number, modifier breakdown in small text, Hit / Miss / Crit / Fumble label.

7. **Narration** — fades in beneath the result. Lingers ~2.5s then auto-advances.

**What is NOT shown on View tab during your turn:**
- Enemy HP bars (Party tab)
- Your stat block (Stats tab)
- Inventory list (Inventory tab)
- Combat log
- Initiative order strip

Only exception: a faded one-liner at the screen bottom showing who goes next.

---

### State B — Not Your Turn (Spectator)

View tab shows a **live event feed** — read-only, no buttons.

1. **Scene header** with pulsing **LIVE** dot and whose turn it is.

2. **Live event feed** — events appear sequentially as the turn plays out:
   - Who is acting and on what
   - Dice roll and breakdown (coloured outcome labels — same visual weight as your own rolls)
   - Damage or effect
   - Narration paragraph

**Enemy turns receive full narration** — identical visual treatment to player turns. Same narration block, same typography, same size. Only difference: border colour (gold for player, deep red for enemy, blue for ally). An enemy critical hit should feel as significant as one of yours.

---

### State C — Out of Combat

1. **Scene description** — 3–6 sentences of AI narration. Sets the scene fully.

2. **Choices** — if a decision is required, 2–4 choice buttons appear below.

3. **Skill check** — if a choice triggers a roll, same flow: confirmation line → Roll button → result → narration.

4. **Rest encounters** — narration only + Continue button.

---

### State D — Between Runs

Brief downtime screen: run summary, XP earned, loot found. Link to Story Page. Option to start next run or return to home.

---

## Tab 2 — ⚔️ Party

Read-only overview of all combatants.

**Shows:**
- Each party member: name, class, level, current / max HP, HP bar, status effects
- Enemy list: name, tier (colour only — no label), HP bar
- Initiative order for current combat — numbered list, current actor highlighted
- Turn timer if async timeout is set

**During combat:** fully read-only.
**Out of combat:** updated to reflect post-combat HP.

---

## Tab 3 — 📋 Stats

Character sheet for the logged-in player only.

**Shows:**
- Name, class, level, XP + XP-to-next (small progress bar)
- All 14 stats in grouped layout (Combat / Mental / Fortune / Body / Specialist)
- Each stat: value, modifier, label
- Unlocked abilities (passive and active, brief descriptions)
- Scars — individually listed with stat penalty and AI-flavoured description
- Titles — displayed as badges
- Faction standing — name, tier badge, standing number, directional bar (centred at 0)
- Deity devotion — name, tier badge, progress bar with tier markers, estimated runs to next tier

**During combat:** read-only.
**Out of combat / between runs:** still read-only in-run. Stat point allocation and ability selection only available at the Character screen between runs.

---

## Tab 4 — 🎒 Inventory

**Equipped section (top):**
- Weapon slot
- Off-hand slot
- Armour slot
- 3 × Relic slots
- Each slot: item name, rarity colour dot, key stat
- Active synergies shown as a small tag if applicable

**Active inventory (below):**
- 10 slots as a grid
- Filled: item name, rarity dot, count for consumables
- Empty: faint outline

**During combat — LOCKED:**
- Banner at top: *"Battle Active — Inventory Locked"*
- All slots visually dimmed
- Equipped gear visible but unchangeable
- Consumables in active slots visible but cannot be added/removed — only used via View tab
- Note: *"Loadout locked when combat began. Changes take effect after this encounter."*

**Out of combat:**
- Slots interactive — tap to equip, unequip, move to stash
- Stash button at bottom — scrollable list of stashed items
- Trade between party members available during Rest encounters

---

## Tab 5 — 📜 Story

The living chronicle. Always readable — during combat, during other turns, any time.

**Layout (scrollable):**

1. **Campaign header** — name, brief (italicised), difficulty badge, run number

2. **Current path** — simple progress indicator. Run X of estimated Y. Encounter position within run. Not a map — just a progress line.

3. **Key moments** — tagged list of notable events with icons:
   - ⚡ Scars earned
   - ✨ Critical hits and kills
   - 📜 Narrative choices made
   - 💎 Notable loot found
   - 💀 Deaths and near-deaths

4. **The Chronicle** — AI-written prose. One substantial paragraph per completed encounter, past tense, story voice. Reads like a novel. Current run's entry marked *"in progress..."*

5. **Character arc summary** — per-character one-liner: scars, titles, faction movements, deity milestones this campaign

**Share button** top-right — copies a read-only link. Non-players can read the chronicle without an account.

---

## Combat UX Flow — Full Sequence

```
Your turn begins
      ↓
View tab: Situation text (2–4 sentences AI narration)
      ↓
Action buttons appear — Attack / Use Item / Help Ally / Flee
      ↓
Player taps action
      ↓
Targets listed (enemies with HP and TN, or items)
      ↓
Player taps target
      ↓
Confirmation strip: "Attack → [Enemy] · d20 +3 vs TN 14"
Large ROLL THE DICE button. Nothing else on screen.
      ↓
Player taps Roll
      ↓
Die animates (wobble ~0.7s)
      ↓
Result: big number · modifier breakdown · Hit/Miss/Crit/Fumble
      ↓
Narration paragraph fades in (1s)
      ↓
Auto-advance after ~2.5s
      ↓
Next combatant's turn
      ↓
If not player → View shows spectator feed (LIVE dot, sequential events)
If player → cycle repeats
      ↓
Last enemy defeated → Loot reveal → XP summary → Victory screen
```

---

## Design System

### Fonts
- **Display / headings:** Uncial Antiqua (fantasy, distinctive)
- **Body / narration:** Sorts Mill Goudy italic (readable, atmospheric)
- **Stats / numbers:** Uncial Antiqua

### Colour Palette

| Token | Hex | Use |
|---|---|---|
| Background | `#09080a` | App background |
| Surface | `#100e12` | Cards, panels |
| Raised | `#191620` | Elevated surfaces |
| Border | `#2c2738` | Default borders |
| Border highlight | `#453d58` | Hover, active borders |
| Gold | `#d4a847` | Your turn, active elements, headings |
| Gold glow | `rgba(212,168,71,0.11)` | Active panel backgrounds |
| Crimson | `#c0392b` | Enemy actions, damage, danger |
| Blue | `#5b8dd9` | Ally actions |
| Ink | `#ede5f8` | Primary text |
| Ink dim | `#9d94b0` | Secondary text |
| Ink faint | `#524a64` | Labels, hints |

### Rarity Colours

| Rarity | Hex |
|---|---|
| Common | `#888888` |
| Uncommon | `#27ae60` |
| Rare | `#5b8dd9` |
| Epic | `#8e6dbf` |
| Legendary | `#d4a847` |

### Enemy Tier Colours

| Tier | Hex | Shadow |
|---|---|---|
| Dust | `#c8c8c8` | `#888888` |
| Slate | `#6a8fa8` | `#3a5a70` |
| Iron | `#4a4e52` | `#222428` |
| Crimson | `#6b1a1a` | `#3a0a0a` |
| Void | `#111111` | `#000000` |

Dark tiers (Iron, Crimson, Void) rendered on a `#1e1e1e` pad so sprite reads against the black background.

### Key UX Rules

**No modals over the View tab during active turns.** Reference requires tapping to another tab. Only allowed overlay: dice result and narration.

**Enemy turns get equal narration weight.** Same block, same size, same typography as player turns. Colour only differentiates actor.

**Inventory lock is a design decision, not just a technical one.** Communicating it clearly in the UI is important — the banner must be immediately legible.

**Die roll is the moment.** Build tension between action selection and roll. Confirmation strip → full-screen-ish Roll button → animation → result. Not buried in a panel corner.

**The faction standing bar is centred at 0** — not left-anchored — because standing moves in both directions.

**Devotion progress shows tier labels on the track** so players can see how far each threshold is without reading a table.

---

## Out of Scope for v1

- Graphical scene illustrations
- Animated character sprites (walk cycles etc. are for reference only)
- Voice narration / TTS
- Spectator-mode for non-players watching live
- Map view
- Drag-and-drop inventory (tap-to-move sufficient for v1)
- Sound / music

---

*UI Specification — v0.3 — March 2026*
