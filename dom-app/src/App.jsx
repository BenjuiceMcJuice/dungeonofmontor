import { useState, useEffect } from 'react'
import useAuth from './hooks/useAuth.js'
import useRunSave from './hooks/useRunSave.js'
import { generateKnight } from './lib/classes.js'
import Home from './pages/Home.jsx'
import Tavern from './pages/Tavern.jsx'
import Game from './pages/Game.jsx'
import Results from './pages/Results.jsx'
import Preparation from './pages/Preparation.jsx'
import LandingScene from './components/LandingScene.jsx'
import ResumeRunPrompt from './components/ResumeRunPrompt.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './App.css'

// Screens: home (auth) → landing (scene + name) → prep (stats + shop) → game (dungeon) → results → landing
function App() {
  var { user, loading, error, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth()
  var runSave = useRunSave(user ? user.uid : null)
  var [screen, setScreen] = useState('loading') // loading | landing | resume | prep | game | results
  var [character, setCharacter] = useState(null)
  var [runResult, setRunResult] = useState(null)
  var [savedRun, setSavedRun] = useState(null)

  // Check for saved run after auth resolves
  useEffect(function() {
    if (loading || !user) return
    runSave.load().then(function(result) {
      if (result && result.data) {
        setSavedRun(result.data)
        setScreen('resume')
      } else {
        setScreen('landing')
      }
    })
  }, [loading, user])

  // Reset scroll position on screen changes
  useEffect(function() {
    window.scrollTo(0, 0)
  }, [screen, user])

  // Loading auth state or checking for save
  if (loading || screen === 'loading') {
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

  // Resume prompt — saved run found
  if (screen === 'resume' && savedRun) {
    return (
      <ResumeRunPrompt
        savedRun={savedRun}
        onResume={function() {
          setCharacter(savedRun.character)
          setScreen('game')
        }}
        onAbandon={function() {
          runSave.clear()
          setSavedRun(null)
          setScreen('landing')
        }}
      />
    )
  }

  // Signed in — route by screen
  if (screen === 'prep' && character) {
    return (
      <Preparation
        character={character}
        onReady={function(preparedCharacter) {
          setCharacter(preparedCharacter)
          setScreen('game')
        }}
      />
    )
  }

  if (screen === 'game' && character) {
    return (
      <ErrorBoundary>
        <Game
          character={character}
          user={user}
          savedRun={savedRun}
          onSaveRun={runSave.save}
          onEndRun={function(result) {
            runSave.clear()
            setSavedRun(null)
            setRunResult(result)
            setScreen('results')
          }}
        />
      </ErrorBoundary>
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
          setScreen('landing')
        }}
      />
    )
  }

  // Default: landing scene
  return (
    <LandingScene
      onEnter={function(name) {
        var knight = generateKnight(name)
        setCharacter(knight)
        setSavedRun(null)
        setScreen('prep')
      }}
    />
  )
}

export default App
