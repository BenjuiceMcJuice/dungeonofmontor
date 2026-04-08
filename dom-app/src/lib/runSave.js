// Run persistence — localStorage (instant) + Firestore (debounced backup)
// Saves at room boundaries only. Combat state is NOT saved.
// Path: /users/{uid}/characters/{charId}/activeRun/current

import { db } from './firebase.js'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'

var SAVE_VERSION = 2
var LS_PREFIX = 'dom_activeRun_'

// Build the save payload from game state
function buildSavePayload(state, charId) {
  return {
    version: SAVE_VERSION,
    charId: charId || null,
    savedAt: Date.now(),
    character: state.character,
    playerHp: state.playerHp,
    playerGold: state.playerGold,
    playerInventory: state.playerInventory,
    playerJunkBag: state.playerJunkBag,
    floorId: state.floorId,
    zone: state.zone,
    chambersCleared: state.chambersCleared,
    floorsCompleted: state.floorsCompleted,
    collectedTreasures: state.collectedTreasures,
    hasZoneKey: state.hasZoneKey,
    totalXp: state.totalXp,
    runLevel: state.runLevel,
    giftSlots: state.giftSlots,
    unlockedGifts: state.unlockedGifts,
    activeBuffs: state.activeBuffs,
    runStats: state.runStats,
    floorDisturbance: state.floorDisturbance || 0,
    greedScore: state.greedScore || 0,
    montorTaste: state.montorTaste || null,
  }
}

// --- localStorage ---

function lsKey(uid, charId) {
  return LS_PREFIX + uid + '_' + charId
}

function saveToLocalStorage(uid, charId, payload) {
  try {
    localStorage.setItem(lsKey(uid, charId), JSON.stringify(payload))
    return true
  } catch (e) {
    console.warn('runSave: localStorage write failed', e)
    return false
  }
}

function loadFromLocalStorage(uid, charId) {
  try {
    var raw = localStorage.getItem(lsKey(uid, charId))
    if (!raw) return null
    var data = JSON.parse(raw)
    if (!data || (data.version !== SAVE_VERSION && data.version !== 1)) return null
    return data
  } catch (e) {
    console.warn('runSave: localStorage read failed', e)
    return null
  }
}

function clearLocalStorage(uid, charId) {
  try { localStorage.removeItem(lsKey(uid, charId)) } catch (e) { /* ignore */ }
}

// --- Firestore ---

function getDocRef(uid, charId) {
  return doc(db, 'users', uid, 'characters', charId, 'activeRun', 'current')
}

function saveToFirestore(uid, charId, payload) {
  return setDoc(getDocRef(uid, charId), payload).catch(function(e) {
    console.warn('runSave: Firestore write failed', e)
  })
}

function loadFromFirestore(uid, charId) {
  return getDoc(getDocRef(uid, charId)).then(function(snap) {
    if (!snap.exists()) return null
    var data = snap.data()
    if (!data || (data.version !== SAVE_VERSION && data.version !== 1)) return null
    return data
  }).catch(function(e) {
    console.warn('runSave: Firestore read failed', e)
    return null
  })
}

function clearFirestore(uid, charId) {
  return deleteDoc(getDocRef(uid, charId)).catch(function(e) {
    console.warn('runSave: Firestore delete failed', e)
  })
}

// --- Debounced Firestore saver ---

function createDebouncedFirestoreSave(uid, charId, delayMs) {
  var timer = null
  return {
    save: function(payload) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(function() {
        saveToFirestore(uid, charId, payload)
        timer = null
      }, delayMs || 4000)
    },
    cancel: function() {
      if (timer) { clearTimeout(timer); timer = null }
    },
  }
}

export {
  buildSavePayload,
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  saveToFirestore,
  loadFromFirestore,
  clearFirestore,
  createDebouncedFirestoreSave,
}
