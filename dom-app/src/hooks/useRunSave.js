// Hook for run persistence — save/load/clear with localStorage + Firestore
// Now per-character: requires both uid and charId
import { useState, useEffect, useRef } from 'react'
import { buildSavePayload, saveToLocalStorage, loadFromLocalStorage, clearLocalStorage, loadFromFirestore, clearFirestore, createDebouncedFirestoreSave } from '../lib/runSave.js'

function useRunSave(uid, charId) {
  var [isLoading, setIsLoading] = useState(true)
  var debouncedRef = useRef(null)

  useEffect(function() {
    if (!uid || !charId) return
    debouncedRef.current = createDebouncedFirestoreSave(uid, charId, 4000)
    return function() {
      if (debouncedRef.current) debouncedRef.current.cancel()
    }
  }, [uid, charId])

  function save(stateBundle) {
    if (!uid || !charId) return
    var payload = buildSavePayload(stateBundle, charId)
    saveToLocalStorage(uid, charId, payload)
    if (debouncedRef.current) debouncedRef.current.save(payload)
  }

  function load() {
    if (!uid || !charId) { setIsLoading(false); return Promise.resolve(null) }
    // Try localStorage first (instant)
    var local = loadFromLocalStorage(uid, charId)
    if (local) {
      setIsLoading(false)
      return Promise.resolve({ source: 'local', data: local })
    }
    // Fall back to Firestore (async)
    return loadFromFirestore(uid, charId).then(function(data) {
      setIsLoading(false)
      if (data) return { source: 'firestore', data: data }
      return null
    }).catch(function() {
      setIsLoading(false)
      return null
    })
  }

  function clear() {
    if (!uid || !charId) return
    if (debouncedRef.current) debouncedRef.current.cancel()
    clearLocalStorage(uid, charId)
    clearFirestore(uid, charId)
  }

  return { save: save, load: load, clear: clear, isLoading: isLoading }
}

export default useRunSave
