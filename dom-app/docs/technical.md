# Technical Architecture

> How Dungeon of Montor is built. Updated 2026-04-04.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind v4 | Mobile-first PWA |
| Auth | Firebase Auth | Email + Google sign-in |
| Database | Firestore | Real-time sync for multiplayer (Spark/free plan, europe-west2) |
| AI (future) | Groq API | AI narration; user-supplied key stored in localStorage |
| Hosting | GitHub Pages | Auto-deploy from `main` via GitHub Actions |
| Sprites | Canvas grid arrays | No image files; sprites are JS data |

---

## 2. Repository

**GitHub:** `BenjuiceMcJuice/dungeonofmontor`

**Branches:**
- `main` -- production. Only merged code lands here. Auto-deploys via GitHub Actions.
- `dev` -- active development. All new work happens here. Never commit directly to `main`.

---

## 3. File Structure

```
dom-app/                              The active React app
  src/
    App.jsx                           Root component, tab routing
    main.jsx                          Entry point
    pages/
      Home.jsx                        Landing page
      Tavern.jsx                      Pre-run hub (Stage 2 placeholder)
      Preparation.jsx                 Stat allocation + pre-run merchant
      Game.jsx                        Main game loop (~6000 lines)
      Results.jsx                     Run summary
    components/
      Nav.jsx                         Bottom tab nav
      ChamberView.jsx                 Room rendering, junk piles, NPCs
      ChamberIcon.jsx                 Map chamber type icons
      CombatRoller.jsx                Combat dice animation + result display (tap-gated condition flow)
      DiceRoller.jsx                  Generic dice roller component
      ErrorBoundary.jsx               React error boundary for crash diagnosis (iOS WebKit)
      DungeonMap.jsx                  4x4 zone grid map
      DoorSprite.jsx                  Door pixel art
      SpriteRenderer.jsx             Sprite canvas renderer
      PlayerSprite.jsx                Player character sprite
      ConditionIcon.jsx               18 condition pixel sprites
      LandingScene.jsx                Title screen art
      StatPicker.jsx                  Reusable stat allocation UI
    data/
      classes.json                    Class definitions, starter shop
      conditions.json                 18 conditions + 6 reactions with mechanics
      dialogue.json                   Montor whispers, merchant lines
      encounters.json                 Encounter type definitions
      enemies.json                    12 archetypes + tier/difficulty multipliers + 7 AI behaviours
      gifts.json                      Gift definitions, boon effects
      items.json                      243 items (weapons, armour, relics, consumables, bombs, throwables)
      junk.json                       Junk pools per floor, consumable junk, pile descriptions
      loot-tables.json                Zone-specific loot tables
      progression.json                XP thresholds, level-up rules
      themes.json                     Floor colour themes
      zones.json                      13 zones with chamber templates, merchants, enemies
    hooks/
      useAuth.js                      Firebase Auth hook
    lib/
      firebase.js                     Firebase config
      dice.js                         All dice math (d4-d100), modifiers, crit detection
      combat.js                       Attack resolution, damage calc, initiative, stagger, enemy AI, gift combat integration
      conditions.js                   Condition application, duration, stacking, reactions, tap-gated tick flow
      loot.js                         Rarity rolls, item generation, loot tables
      dungeon.js                      Zone grid generation, chamber placement
      encounters.js                   Encounter deck, enemy spawning
      enemies.js                      Enemy stat calculation from archetypes + tiers, flee/drop bag, AI behaviours
      classes.js                      Class stat generation
      gifts.js                        Gift activation, boon application, sacrifice system
      junkpiles.js                    Pile generation, search rolls, terminal placement
      sprites.js                      All enemy + player + junk pile sprite grid data + draw function
  public/
    manifest.json                     PWA manifest
    sw.js                             Service worker (cache-first for assets)
    icon.svg                          App icon

docs/                                 Documentation (this folder)
logs/YYYY-MM-DD.md                    Daily work logs
DEVLOG.md                             Milestone tracker
CLAUDE.md                             Claude Code guidance
README.md                             GitHub page
.github/workflows/deploy.yml          GitHub Pages deploy pipeline
```

---

## 4. Data Architecture

### Engine vs Content Separation

All game content lives in JSON data files (`src/data/*.json`). The engine files (`src/lib/*.js`) are pure logic that reads from those data files. Adding new items, enemies, zones, or conditions means editing JSON -- not writing new code.

| Data file | Content |
|---|---|
| `items.json` | 243 items: 64 weapons, 36 armour, 62 consumables (incl. bombs, throwables), 55 relics (incl. dice-triggered), 15 amulets, 11 rings |
| `enemies.json` | 12 enemy archetypes with base stats, tier/difficulty multipliers, and 7 AI behaviours |
| `zones.json` | 13 zones with chamber templates, merchant stock (Tailor/Peddler), enemy pools, loot table refs |
| `conditions.json` | 18 conditions (incl. WET, CHARGED catalysts) with body/mind slots, damage, duration, 6 elemental reactions |
| `gifts.json` | 6 gift types with boon effects per slot (all 6 fully wired with combat effects) |
| `junk.json` | Per-floor junk pools, consumable junk effects, pile size descriptions |
| `loot-tables.json` | Zone-specific weighted loot tables |
| `classes.json` | Class definitions with stat allocations and starter shop inventory |
| `progression.json` | XP thresholds for 9 levels of in-run levelling |

### Firebase Data Model

Currently using Firebase Auth only. Firestore data model is designed and documented (see archive) but content currently lives in local JSON files, not in Firestore collections.

**Planned Firestore structure:**

```
/users/{uid}                          Auth -- user accounts
/characters/{characterId}             Player -- persistent characters (Stage 2+)
/runs/{runId}                         Runtime -- active run state
  /grid/{chamberId}                   Runtime -- per-chamber state
```

Full schemas for content collections (floors, zones, enemies, items, loot tables, NPCs, events, chamber templates) are designed and ready to migrate to Firestore when the engine switches to reading from the database.

---

## 5. Sprite System

All sprites are 2D grid arrays in JavaScript. Each cell is one of: `null` (transparent), `K` (black outline), `C` (main colour), `S` (shadow). Colour is swapped at render time based on enemy tier.

```javascript
// Example draw function
function drawSprite(canvas, spriteKey, tierColour, shadowColour) {
  // reads grid from SPRITES[spriteKey], fills canvas pixels
  // K = #000000, C = tierColour, S = shadowColour
}
```

**Benefits:** Zero storage, infinitely scalable, colour swaps are a single variable change, entire sprite sheet is a few kilobytes of JS.

**Current sprites:** 12 enemy archetypes + 12 corpse sprites + 1 player sprite + 18 condition icons + door sprites + terminal sprite + junk pile sprites (6 Garden variants: 2 per size).

---

## 6. Code Style

- **ES5 style** in most files: `var`, `function(){}`, `Object.assign`. Match this in new code.
- No tests, no linting, no CI pipeline
- Manual testing on mobile (iOS Safari, Chrome) and desktop
- `Game.jsx` is the largest file (~6000 lines) -- it contains the entire game loop, combat, inventory, merchant, junk search, gift activation, and all game UI
- `ErrorBoundary.jsx` wraps Game.jsx to catch React render crashes and show error details instead of black screen (added for iOS WebKit crash diagnosis)
- Bundle size ~985KB and growing

---

## 7. Firebase

- **Project:** Firestore DB enabled (europe-west2), Spark/free plan
- **Auth:** Email + Google sign-in enabled
- **Firestore rules:** Test mode (rules expire ~2026-04-28 -- will need updating)
- **Cloud Functions:** Designed but not yet deployed (planned for multiplayer turn enforcement)
- **Cloud Messaging:** Planned for async turn notifications

**Firebase config is in source code** (`src/lib/firebase.js`). This is intentional -- Firebase client keys are public by design. Security is enforced by Firestore rules, not key secrecy.

---

## 8. PWA

- `manifest.json` in public/ with app name, icons, theme colour
- `sw.js` service worker with cache-first for app assets
- Installable on mobile (Add to Home Screen)
- Hard refresh (Ctrl+Shift+R) bypasses service worker cache during testing

---

*Technical Architecture -- v1.1 -- April 2026*
