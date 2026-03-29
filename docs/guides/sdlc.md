# Dungeon of Montor — SDLC (Software Development Lifecycle)

> Last updated: 2026-03-29

How code goes from idea to production.

---

## Branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production. Only merged code lands here. | TBC |
| `dev` | Active development. All new work happens here. | TBC |

**Never commit directly to `main`.** All work goes through `dev` first.

---

## Development Workflow

### 1. Start a session

```
git checkout dev
git pull origin dev
```

Read `DEVLOG.md` and the most recent `logs/YYYY-MM-DD.md` to understand where things are.

### 2. Develop locally

TBC — update once tech stack is decided.

### 3. Test

- **Browser:** Check the feature works on desktop and mobile viewport
- **Data:** Test with existing data — check that nothing breaks
- **Build check:** Run the build command before committing — catches errors early

### 4. Commit and push

```
git add <specific files>
git commit -m "feat: description of what changed"
git push origin dev
```

**Commit conventions:**
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructure, no behaviour change
- `docs:` — documentation only

**Every commit must also update:**
- `logs/YYYY-MM-DD.md` — what was changed, files affected
- `DEVLOG.md` — only when a milestone/step is complete
- `CLAUDE.md` — only if architecture changed

### 5. Merge to production

Only when you're confident the feature is ready:

```
git checkout main
git pull origin main
git merge dev
git push origin main
```

### 6. Verify production

- Check the live site
- Hard refresh to bypass any caches
- Spot-check the feature on desktop and mobile

---

## Pre-Merge Checklist

Before merging `dev` → `main`:

- [ ] Feature tested locally on desktop and mobile
- [ ] Build passes cleanly
- [ ] No debug code, console.logs, or placeholder content
- [ ] `logs/YYYY-MM-DD.md` updated for today's work
- [ ] `DEVLOG.md` updated if a milestone was completed
- [ ] `CLAUDE.md` updated if architecture changed

---

## Diagram

```
  dev branch                   main branch              production
  ──────────                   ───────────              ──────────
      │                            │                        │
 dev + test                        │                        │
      │                            │                        │
 push to remote                    │                        │
      │                            │                        │
 merge to main ────────────────► push ──────────────► auto-deploy
      │                            │                        │
 continue dev                      │                   live
```

---

## What Lives Where

| Concern | Location |
|---|---|
| Documentation | Root `*.md` files + `docs/` |
| Daily logs | `logs/YYYY-MM-DD.md` |
| Milestone tracker | `DEVLOG.md` |
| Claude Code guidance | `CLAUDE.md` (root) |
