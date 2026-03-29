import { useState, useEffect } from 'react'
import useAuth from './hooks/useAuth.js'
import { generateKnight } from './lib/classes.js'
import Home from './pages/Home.jsx'
import Tavern from './pages/Tavern.jsx'
import Game from './pages/Game.jsx'
import Results from './pages/Results.jsx'
import './App.css'

// Screens: home (auth) → tavern (start run) → game (dungeon) → results → tavern
function App() {
  var { user, loading, error, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth()
  var [screen, setScreen] = useState('tavern') // tavern | game | results
  var [character, setCharacter] = useState(null)
  var [runResult, setRunResult] = useState(null)

  // iOS scroll prevention — prevent body bounce/scroll on all screens
  useEffect(function() {
    function preventScroll(e) {
      // Allow scrolling inside elements that need it (combat log)
      if (e.target.closest && e.target.closest('[data-scrollable]')) return
      e.preventDefault()
    }
    document.body.addEventListener('touchmove', preventScroll, { passive: false })
    // Also reset scroll on every screen change
    window.scrollTo(0, 0)
    return function() {
      document.body.removeEventListener('touchmove', preventScroll)
    }
  }, [screen, user])

  // Loading auth state
  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <span className="text-ink-faint text-sm">Loading...</span>
      </div>
    )
  }

  // Not signed in
  if (!user) {
    return (
      <Home
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
        error={error}
      />
    )
  }

  // Signed in — route by screen
  if (screen === 'game' && character) {
    return (
      <Game
        character={character}
        user={user}
        onEndRun={function(result) {
          setRunResult(result)
          setScreen('results')
        }}
      />
    )
  }

  if (screen === 'results' && character && runResult) {
    return (
      <Results
        character={character}
        result={runResult}
        onReturnToTavern={function() {
          setCharacter(null)
          setRunResult(null)
          setScreen('tavern')
        }}
      />
    )
  }

  // Default: tavern
  return (
    <Tavern
      user={user}
      onSignOut={signOut}
      onStartRun={function(name) {
        var knight = generateKnight(name)
        setCharacter(knight)
        setScreen('game')
      }}
    />
  )
}

export default App
