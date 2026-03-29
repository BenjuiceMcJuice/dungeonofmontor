# DEVLOG — Dungeon of Montor

Milestone tracker. Updated when a step is complete, not after every file change.
Granular daily work is in `logs/YYYY-MM-DD.md`.

---

## Milestones

| Date       | Milestone                          | Status |
|------------|------------------------------------|--------|
| 2026-03-29 | Repo scaffolded, SDLC in place     | ✅ Done |
|            | Step 0 — Infra & hosting setup     | ⬜ |
|            | Step 1 — React scaffold + shell    | ⬜ |
|            | Step 2 — Character creation        | ⬜ |
|            | Step 3 — Campaign brief + encounter deck | ⬜ |
|            | Step 4 — Combat loop + dice UI     | ⬜ |
|            | Step 5 — Sprite renderer           | ⬜ |
|            | Step 6 — Groq AI narration         | ⬜ |
|            | Step 7 — Loot + items + synergies  | ⬜ |
|            | Step 8 — Story Page                | ⬜ |
|            | Step 9 — Firebase auth + save/load | ⬜ |

---

## v0.1 Build Order — Solo Foundation (Phase 1)

### Step 0 — Infrastructure & Hosting

**GitHub Pages (free, no custom domain needed yet):**
- Enable GitHub Pages on `BenjuiceMcJuice/dungeonofmontor` repo
  - Settings → Pages → Source: GitHub Actions (or `gh-pages` branch)
- Vite builds to static files — use `vite-plugin-gh-pages` or a simple GitHub Action
- SPA routing: use `HashRouter` (not `BrowserRouter`) to avoid 404s on GH Pages
- Site will be at: `https://benjuicemcjuice.github.io/dungeonofmontor/`
- Set `base: '/dungeonofmontor/'` in `vite.config.js` for correct asset paths
- Can migrate to Cloudflare Pages + custom domain later with zero code changes

**Firebase project (new, separate from BetaLog):**
- Create new Firebase project in console (e.g. `dungeon-of-montor`)
- Enable Authentication: Google sign-in + email/password
- Create Firestore database (europe-west2 to match BetaLog)
- Spark (free) plan — sufficient for solo dev and early multiplayer
- Add Firebase config to `src/lib/firebase.js` (client keys are public by design)
- Firestore security rules: deploy via `firebase deploy --only firestore:rules`
- Cloud Functions needed later (Phase 2 multiplayer) — not yet

**Groq API:**
- User supplies own key in Settings screen
- Stored in `localStorage` only — never touches Firebase
- Key sent to Groq directly from client (no Cloud Function proxy needed for solo Phase 1)
- Proxy via Cloud Function only needed in Phase 2 when multiplayer requires server-side AI calls

**PWA setup:**
- `manifest.json` — app name, icons, theme colour (`#09080a`)
- Basic service worker — cache app shell, network-first for API calls
- Can install to home screen on mobile

### Step 1 — React Scaffold + App Shell

- `npm create vite@latest` with React template
- Tailwind v4 setup
- Bottom tab nav (5 tabs: View, Party, Stats, Inventory, Story)
- Dark theme with design system colours from UI spec
- Google Fonts: Uncial Antiqua (headings/numbers), Sorts Mill Goudy (body/narration)
- Placeholder content in each tab
- GitHub Pages deploy pipeline working

### Step 2 — Character Creation

- Character create screen: name, class selection (10 classes), stat point allocation (70 points across 14 skills)
- Class data from `02_Game_Mechanics` — base HP, HP/level, auto-skills, free points
- Stat modifier formula: `floor((skill − 10) / 2)`
- HP formula: `classBaseHP + (VIT × 5) + (END × 2)`
- Save character to localStorage (Firebase sync in Step 9)
- Stats tab populated with character sheet

### Step 3 — Campaign Brief + Encounter Deck

- Campaign creation: name, difficulty, write/generate brief
- Encounter deck: weighted shuffle (Combat 45%, Exploration 20%, Rest 10%, Merchant 10%, Narrative 10%, Boss 5%)
- Run structure: draw encounters sequentially, boss always last
- Campaign state management (localStorage for now)

### Step 4 — Combat Loop + Dice UI

- Initiative: `d20 + AGI modifier`, turn order
- Action panel: Attack / Use Item / Help Ally / Flee
- Target selection → confirmation strip → Roll the Dice button
- Dice animation (~0.7s wobble), result display (nat 20/1 handling)
- Attack resolution: `d20 + STR/AGI mod vs 10 + target DEF mod`
- Damage calc: `weapon die + STR mod − floor(enemy DEF ÷ 2), min 1`
- Enemy generation: 5 archetypes × 5 tiers, stat scaling by tier and difficulty
- Downed/death handling (Standard mode scars for v0.1)
- View tab combat UX flow as per UI spec

### Step 5 — Sprite Renderer

- Canvas grid renderer: `drawSprite(canvas, spriteKey, tierColour, shadowColour)`
- 5 enemy sprite grids (Rat 16×14, Orc 18×24, Rock Monster 20×22, Slug 22×12, Wraith 16×24)
- Tier colour swap at render time — same grid data, different colours
- `image-rendering: pixelated` for clean scaling
- Dark pad (`#1e1e1e`) for Iron/Crimson/Void tier readability

### Step 6 — Groq AI Narration

- Compressed context builder: brief, party summary, encounter state
- Trigger types: `run_start`, `combat_start`, `turn_result`, `crit/fumble`, `exploration`, `narrative_event`, `run_end`
- Token budgets per trigger (as per tech spec)
- API key from localStorage → direct Groq call (no proxy for solo)
- Narration displayed in View tab situation text
- Settings: model selection, optional "Brief Narration" mode

### Step 7 — Loot + Items + Synergies

- Loot rarity roll: `d100 + LCK mod` vs rarity table
- Weapon/armour/relic/consumable generation from item tables
- Weapon prefix system (Serrated, Venomous, Flaming, Keen, Savage, Ancient)
- Equipped slots: weapon, off-hand, armour, 3 relics
- Active inventory: 10 slots, locked at battle start
- Item synergy detection (4 combos from spec)
- Multiplier cap: ×2 from all sources
- Inventory tab UI
- Merchant encounters: buy/sell, CHA affects prices

### Step 8 — Story Page

- Chronicle: AI-written prose per encounter, stored in campaign state
- Key moments: tagged events (crits, deaths, loot, choices)
- Story tab layout: campaign header, key moments, chronicle, character arc summary
- Share button (generates read-only link — can be a simple static page for now)

### Step 9 — Firebase Auth + Save/Load

- Firebase Auth: Google sign-in + email/password
- Character save/load to Firestore (`/characters/{characterId}`)
- Campaign save/load to Firestore (`/campaigns/{campaignId}`)
- Firestore security rules (characters owned by uid, campaigns readable by party)
- Offline: localStorage as primary, Firestore as cloud backup
- Settings screen with auth status + Groq key entry
