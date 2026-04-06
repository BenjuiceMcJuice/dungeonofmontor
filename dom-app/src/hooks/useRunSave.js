// Hook for run persistence — save/load/clear with localStorage + Firestore
import { useState, useEffect, useRef } from 'react'
import { buildSavePayload, saveToLocalStorage, loadFromLocalStorage, clearLocalStorage, loadFromFirestore, clearFirestore, createDebouncedFirestoreSave } from '../lib/runSave.js'

function useRunSave(uid) {
  var [isLoading, setIsLoading] = useState(true)
  var debouncedRef = useRef(null)

  useEffect(function() {
    if (!uid) return
    debouncedRef.current = createDebouncedFirestoreSave(uid, 4000)
    return function() {
      if (debouncedRef.current) debouncedRef.current.cancel()
    }
  }, [uid])

  function save(stateBundle) {
    if (!uid) return
    var payload = buildSavePayload(stateBundle)
    saveToLocalStorage(uid, payload)
    if (debouncedRef.current) debouncedRef.current.save(payload)
  }

  function load() {
    if (!uid) { setIsLoading(false); return Promise.resolve(null) }
    // Try localStorage first (instant)
    var local = loadFromLocalStorage(uid)
    if (local) {
      setIsLoading(false)
      return Promise.resolve({ source: 'local', data: local })
    }
    // Fall back to Firestore (async)
    return loadFromFirestore(uid).then(function(data) {
      setIsLoading(false)
      if (data) return { source: 'firestore', data: data }
      return null
    }).catch(function() {
      setIsLoading(false)
      return null
    })
  }

  function clear() {
    if (!uid) return
    if (debouncedRef.current) debouncedRef.current.cancel()
    clearLocalStorage(uid)
    clearFirestore(uid)
  }

  return { save: save, load: load, clear: clear, isLoading: isLoading }
}

export default useRunSave
