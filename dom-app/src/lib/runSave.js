// Run persistence — localStorage (instant) + Firestore (debounced backup)
// Saves at room boundaries only. Combat state is NOT saved.

import { db } from './firebase.js'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'

var SAVE_VERSION = 1
var LS_PREFIX = 'dom_activeRun_'

// Build the save payload from game state
function buildSavePayload(state) {
  return {
    version: SAVE_VERSION,
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
  }
}

// --- localStorage ---

function saveToLocalStorage(uid, payload) {
  try {
    localStorage.setItem(LS_PREFIX + uid, JSON.stringify(payload))
    return true
  } catch (e) {
    console.warn('runSave: localStorage write failed', e)
    return false
  }
}

function loadFromLocalStorage(uid) {
  try {
    var raw = localStorage.getItem(LS_PREFIX + uid)
    if (!raw) return null
    var data = JSON.parse(raw)
    if (!data || data.version !== SAVE_VERSION) return null
    return data
  } catch (e) {
    console.warn('runSave: localStorage read failed', e)
    return null
  }
}

function clearLocalStorage(uid) {
  try { localStorage.removeItem(LS_PREFIX + uid) } catch (e) { /* ignore */ }
}

// --- Firestore ---

function getDocRef(uid) {
  return doc(db, 'users', uid, 'activeRun', 'current')
}

function saveToFirestore(uid, payload) {
  return setDoc(getDocRef(uid), payload).catch(function(e) {
    console.warn('runSave: Firestore write failed', e)
  })
}

function loadFromFirestore(uid) {
  return getDoc(getDocRef(uid)).then(function(snap) {
    if (!snap.exists()) return null
    var data = snap.data()
    if (!data || data.version !== SAVE_VERSION) return null
    return data
  }).catch(function(e) {
    console.warn('runSave: Firestore read failed', e)
    return null
  })
}

function clearFirestore(uid) {
  return deleteDoc(getDocRef(uid)).catch(function(e) {
    console.warn('runSave: Firestore delete failed', e)
  })
}

// --- Debounced Firestore saver ---

function createDebouncedFirestoreSave(uid, delayMs) {
  var timer = null
  return {
    save: function(payload) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(function() {
        saveToFirestore(uid, payload)
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
