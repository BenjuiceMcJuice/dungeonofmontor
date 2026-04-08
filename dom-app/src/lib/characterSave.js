// Character persistence — Firestore CRUD for persistent character slots
// Max 3 characters per user. Characters survive between runs.
// Only bankedGifts persist on death — stats/items/gold reset each run.

import { db } from './firebase.js'
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'

function getCharactersRef(uid) {
  return collection(db, 'users', uid, 'characters')
}

function getCharacterRef(uid, charId) {
  return doc(db, 'users', uid, 'characters', charId)
}

// Load all characters for a user (max 3), sorted by creation time
function loadCharacters(uid) {
  var q = query(getCharactersRef(uid), orderBy('createdAt', 'asc'))
  return getDocs(q).then(function(snap) {
    var chars = []
    snap.forEach(function(d) {
      chars.push(Object.assign({ id: d.id }, d.data()))
    })
    return chars
  }).catch(function(e) {
    console.warn('characterSave: loadCharacters failed', e)
    return []
  })
}

// Load a single character by ID
function loadCharacter(uid, charId) {
  return getDoc(getCharacterRef(uid, charId)).then(function(snap) {
    if (!snap.exists()) return null
    return Object.assign({ id: snap.id }, snap.data())
  }).catch(function(e) {
    console.warn('characterSave: loadCharacter failed', e)
    return null
  })
}

// Create a new character (returns the new doc ID)
function createCharacter(uid, name, archetype) {
  var data = {
    name: name,
    archetype: archetype || 'knight',
    bankedGifts: [],
    runCount: 0,
    deathCount: 0,
    victoryCount: 0,
    bestFloor: null,
    totalEnemiesDefeated: 0,
    totalChambersCleared: 0,
    createdAt: serverTimestamp(),
    lastRunResult: null,
  }
  return addDoc(getCharactersRef(uid), data).then(function(ref) {
    return ref.id
  }).catch(function(e) {
    console.error('characterSave: createCharacter failed', e)
    return null
  })
}

// Update character after a run ends (death or victory)
function updateCharacterAfterRun(uid, charId, runData) {
  return loadCharacter(uid, charId).then(function(char) {
    if (!char) return

    // Merge banked gifts (deduplicate)
    var existing = char.bankedGifts || []
    var newGifts = runData.collectedTreasures || []
    var merged = existing.slice()
    for (var i = 0; i < newGifts.length; i++) {
      if (merged.indexOf(newGifts[i]) === -1) merged.push(newGifts[i])
    }

    // Determine best floor (compare by floor order)
    var floorOrder = ['grounds', 'underground', 'underbelly', 'quarters', 'works', 'deep', 'domain']
    var bestFloor = char.bestFloor
    var reached = runData.floorReached
    if (reached && floorOrder.indexOf(reached) > floorOrder.indexOf(bestFloor)) {
      bestFloor = reached
    }

    var updates = {
      bankedGifts: merged,
      runCount: (char.runCount || 0) + 1,
      bestFloor: bestFloor,
      totalEnemiesDefeated: (char.totalEnemiesDefeated || 0) + (runData.enemiesDefeated || 0),
      totalChambersCleared: (char.totalChambersCleared || 0) + (runData.chambersCleared || 0),
      lastRunResult: {
        outcome: runData.outcome,
        floorReached: runData.floorReached || 'grounds',
        zoneReached: runData.zoneReached || null,
        xp: runData.xp || 0,
        killedBy: runData.killedBy || null,
        timestamp: serverTimestamp(),
      },
    }

    if (runData.outcome === 'defeat') {
      updates.deathCount = (char.deathCount || 0) + 1
    } else if (runData.outcome === 'victory') {
      updates.victoryCount = (char.victoryCount || 0) + 1
    }

    return updateDoc(getCharacterRef(uid, charId), updates)
  }).catch(function(e) {
    console.error('characterSave: updateCharacterAfterRun failed', e)
  })
}

// Delete a character and its activeRun subcollection
function deleteCharacter(uid, charId) {
  // Delete active run first (if exists)
  var runRef = doc(db, 'users', uid, 'characters', charId, 'activeRun', 'current')
  return deleteDoc(runRef).catch(function() { /* ignore if no active run */ })
    .then(function() {
      return deleteDoc(getCharacterRef(uid, charId))
    }).catch(function(e) {
      console.error('characterSave: deleteCharacter failed', e)
    })
}

export {
  loadCharacters,
  loadCharacter,
  createCharacter,
  updateCharacterAfterRun,
  deleteCharacter,
}
