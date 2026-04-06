# Bugs & Testing Tracker
> Active bugs, testing checklist, and sign-off log.

## Open Bugs
| # | Severity | Description | Repro steps | Status |
|---|---|---|---|---|
| 1 | LOW | Condition icons briefly stale after enemy tick | Kill enemy with conditions, icons linger ~300ms | Known — immediate setBattle caused worse bug (combat lock), reverted |
| 2 | LOW | Enemy STR/DEF shows green on first floor (old cached runs) | Start run from before _baseStats deploy | Self-resolves on new runs |

## Testing Checklist (2026-04-06 build)
- [ ] Run persistence: close browser mid-run, reopen, verify resume prompt works
- [ ] Resume a run: HP, gold, inventory, position, gifts all correct
- [ ] Die or complete run: no resume prompt next time (save cleared)
- [ ] Montor mood: be tidy (Careful Clean only) → check safe room gives 2 tonic picks
- [ ] Montor mood: ransack everything → check safe room gives nothing
- [ ] Safe room 3-way choice: try each option (Tonic/Item/Montor's Choice)
- [ ] Inventory: rarity colours showing on all items (inventory, merchants, loot, search)
- [ ] Inventory: sort toggle works (Rarity/DMG/DEF/Name)
- [ ] Inventory: item comparison shows when viewing equippable item
- [ ] Inventory: weight bar visible in header
- [ ] Combat inventory: shows glanceable status card (not old scrollable list)
- [ ] Gift weapon effects: test at least 1 class-specific weapon gift per gift type
- [ ] Condition reactions: POISON + NAUSEA = DYSENTERY, POISON + FEAR = DELIRIUM, POISON + FROST = NECROSIS
- [ ] Throwables: single-target throws work without pre-selecting enemy
- [ ] Traps: can die from trap damage (HP reaches 0)
- [ ] Enemy stats: green when buffed, red when debuffed (e.g. Acid Edge)
- [ ] Montor speaks in purple pixel font everywhere (whispers + safe room)
- [ ] Find a Peddler NPC — check consumables stock
- [ ] Get poisoned AND bleeding simultaneously (multiple conditions coexist)
- [ ] Level up — check XP bar, stat descriptions, How It Works guide
- [ ] Check stats panel shows all equipment bonuses (green/red with gear label)
- [ ] Apply a gift at safe room terminal (all 6 types should show options)
- [ ] Deep Clean a junk pile — check harder enemies spawn (level 2-3)
- [ ] Victory screen shows "+X XP" gained
- [ ] Resist stacking: equip two bleed resist relics, verify additive
- [ ] Relic display: wards (purple) vs relics (gold) split correctly
- [ ] Starter shop has generic Leather Cap + Worn Boots (not Montor items)
- [ ] ErrorBoundary: if crash occurs, shows error message not black screen

## Fixed Bugs (2026-04-03)
| # | Description | Fix |
|---|---|---|
| 1 | Ambush combat lock when player wins initiative | Fixed currentTurnIndex to point to enemy |
| 2 | FEAR turn skip shows buttons briefly then yanks away | isPlayerTurn gated on playerConditionTicked |
| 3 | Black screen on zone door transition | Added setGamePhase('doors') to handleOpenZoneDoor |
| 4 | Duplicate condition sprites (FEAR, POISON from gifts) | All gift conditions now use applyCondition |
| 5 | Poison refresh resets accumulated drains | Re-poison preserves drainedStats |
| 6 | Rings/amulets can't be equipped (Equip button missing) | Added ring/amulet to isEquippable check |
| 7 | 'undefined' stats on new item types | Fixed detail panel for helmets/boots/rings/amulets |
| 8 | Shields in wrong inventory tab | Moved to Arms tab, Wear excludes offhand |
| 9 | Stats panel missing equipment bonuses | All 3 panels now scan all equipment slots |
| 10 | Stat tiles show confusing D&D modifier | Removed — shows gear bonus or nothing |
| 11 | Render fallthrough returns null (black screen) | Recovery UI with "Return to Doors" button |

## Fixed Bugs (2026-04-06)
| # | Description | Fix |
|---|---|---|
| 12 | 11 gift effects defined but never wired | Wired all 11 (Lick Wounds, Bile Blood, Rot Resistance, etc.) |
| 13 | Throwable button only showed for 3/13 throwable types | hasThrowables now checks all 13 effect types |
| 14 | Single-target throwables silently failed (no target selected) | Auto-target first living enemy via throwTarget fallback |
| 15 | Universal weapon gifts broken (Acid Edge, Ignite, etc.) | Only Petal gets appliedWeaponType, others stay universal |
| 16 | Napalm only enhanced weapon-innate BURN | Now enhances BURN from all sources (gifts, throwables, reactions) |
| 17 | Traps couldn't kill (HP floored at 1) | Math.max(0,...) + death check after trap damage |
| 18 | Combat victory not firing (setBattle race condition) | Removed immediate setBattle in enemy tick useEffect |
| 19 | Battle Won overlay locked game (recursive call) | Removed feature entirely |

## Sign-off Log
| Date | Tester | Build | Notes |
|---|---|---|---|
| 2026-04-03 | Steve | post-gift-wiring | Testing in progress |
| 2026-04-06 | Steve | post-effects-audit | Full effects audit, persistence, mood system |
