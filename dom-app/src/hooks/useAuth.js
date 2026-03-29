import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase.js'

function useAuth() {
  var [user, setUser] = useState(null)
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState(null)

  useEffect(function() {
    var unsub = onAuthStateChanged(auth, function(u) {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  function signInWithGoogle() {
    setError(null)
    return signInWithPopup(auth, googleProvider).catch(function(err) {
      setError(err.message)
    })
  }

  function signInWithEmail(email, password) {
    setError(null)
    return signInWithEmailAndPassword(auth, email, password).catch(function(err) {
      setError(err.message)
    })
  }

  function signUpWithEmail(email, password) {
    setError(null)
    return createUserWithEmailAndPassword(auth, email, password).catch(function(err) {
      setError(err.message)
    })
  }

  function signOut() {
    return firebaseSignOut(auth)
  }

  return { user: user, loading: loading, error: error, signInWithGoogle: signInWithGoogle, signInWithEmail: signInWithEmail, signUpWithEmail: signUpWithEmail, signOut: signOut }
}

export default useAuth
