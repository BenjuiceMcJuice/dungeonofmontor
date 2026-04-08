import { useState, useEffect, useRef } from 'react'
import useAuth from './hooks/useAuth.js'
import useRunSave from './hooks/useRunSave.js'
import { generateKnight } from './lib/classes.js'
import { loadCharacters, createCharacter, updateCharacterAfterRun, deleteCharacter } from './lib/characterSave.js'
import { loadFromLocalStorage, loadFromFirestore } from './lib/runSave.js'
import Home from './pages/Home.jsx'
import Tavern from './pages/Tavern.jsx'
import Game from './pages/Game.jsx'
import Results from './pages/Results.jsx'
import Preparation from './pages/Preparation.jsx'
import LandingScene from './components/LandingScene.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './App.css'

// Screens: home (auth) → landing (intro, first visit) → tavern (character hub) → prep → game → results → tavern
function App() {
  var { user, loading, error, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth()

  var [screen, setScreen] = useState('loading') // loading | landing | tavern | prep | game | results
  var [characters, setCharacters] = useState([])
  var [selectedCharId, setSelectedCharId] = useState(null)
  var [character, setCharacter] = useState(null)
  var [runResult, setRunResult] = useState(null)
  var [savedRun, setSavedRun] = useState(null)
  var [activeRuns, setActiveRuns] = useState({}) // { charId: saveData }
  var [charsLoading, setCharsLoading] = useState(false)
  var [returnContext, setReturnContext] = useState('fresh') // fresh | fromRun | fromVictory | fromDefeat

  // Run save hook — per character
  var runSave = useRunSave(user ? user.uid : null, selectedCharId)

  // Load characters after auth resolves
  useEffect(function() {
    if (loading || !user) return
    reloadCharacters()
  }, [loading, user])

  function reloadCharacters() {
    if (!user) return Promise.resolve()
    setCharsLoading(true)
    return loadCharacters(user.uid).then(function(chars) {
      setCharacters(chars)
      // Check for active runs on each character
      var runChecks = chars.map(function(c) {
        // Try localStorage first, then Firestore
        var local = loadFromLocalStorage(user.uid, c.id)
        if (local) return Promise.resolve({ charId: c.id, data: local })
        return loadFromFirestore(user.uid, c.id).then(function(data) {
          return data ? { charId: c.id, data: data } : null
        })
      })
      return Promise.all(runChecks).then(function(results) {
        var runs = {}
        for (var i = 0; i < results.length; i++) {
          if (results[i]) runs[results[i].charId] = results[i].data
        }
        setActiveRuns(runs)
        // If no characters, show landing intro. Otherwise show tavern.
        if (chars.length === 0) {
          setScreen('landing')
        } else {
          setScreen('tavern')
        }
        setCharsLoading(false)
      })
    }).catch(function() {
      setCharsLoading(false)
      setScreen('landing')
    })
  }

  // Reset scroll on screen change
  useEffect(function() {
    window.scrollTo(0, 0)
  }, [screen, user])

  // --- Handlers ---

  function handleCreateCharacter(name, archetype) {
    createCharacter(user.uid, name, archetype).then(function(charId) {
      if (!charId) return
      return reloadCharacters().then(function() {
        // Auto-select the new character and go to prep
        setSelectedCharId(charId)
        var knight = generateKnight(name)
        setCharacter(knight)
        setSavedRun(null)
        setScreen('prep')
      })
    })
  }

  function handleSelectCharacter(charId) {
    var char = characters.find(function(c) { return c.id === charId })
    if (!char) return
    setSelectedCharId(charId)
    var knight = generateKnight(char.name)
    // Pass banked gifts to knight for future use
    knight.bankedGifts = char.bankedGifts || []
    setCharacter(knight)
    setSavedRun(null)
    setScreen('prep')
  }

  function handleResumeRun(charId, saveData) {
    setSelectedCharId(charId)
    setCharacter(saveData.character)
    setSavedRun(saveData)
    setScreen('game')
  }

  function handleDeleteCharacter(charId) {
    deleteCharacter(user.uid, charId).then(function() {
      reloadCharacters()
    })
  }

  function handleEndRun(result) {
    // Bank gifts and update character stats in Firestore
    if (selectedCharId) {
      updateCharacterAfterRun(user.uid, selectedCharId, {
        outcome: result.victory ? 'victory' : 'defeat',
        floorReached: result.floorReached || 'grounds',
        zoneReached: result.zoneReached || null,
        xp: result.xp || 0,
        killedBy: result.killedBy || null,
        collectedTreasures: result.collectedTreasures || [],
        enemiesDefeated: result.enemiesDefeated || 0,
        chambersCleared: result.chambersCleared || 0,
      })
    }
    runSave.clear()
    setSavedRun(null)
    setRunResult(result)
    setScreen('results')
  }

  function handleReturnToTavern() {
    var ctx = runResult && runResult.victory ? 'fromVictory' : runResult ? 'fromDefeat' : 'fromRun'
    setReturnContext(ctx)
    setCharacter(null)
    setRunResult(null)
    setSelectedCharId(null)
    setSavedRun(null)
    reloadCharacters()
  }

  function handleLandingEnter(name) {
    // First-time flow: create character from landing, then go to prep
    handleCreateCharacter(name, 'knight')
  }

  function handleSignOut() {
    setScreen('loading')
    setCharacters([])
    setSelectedCharId(null)
    setCharacter(null)
    setRunResult(null)
    setSavedRun(null)
    setActiveRuns({})
    signOut()
  }

  // --- Rendering ---

  if (loading || screen === 'loading' || charsLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <span className="text-ink-faint text-sm">Loading...</span>
      </div>
    )
  }

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

  // Landing scene — first visit (no characters yet)
  if (screen === 'landing') {
    return (
      <LandingScene onEnter={handleLandingEnter} />
    )
  }

  // Tavern — character hub
  if (screen === 'tavern') {
    return (
      <Tavern
        user={user}
        characters={characters}
        activeRuns={activeRuns}
        returnContext={returnContext}
        onCreateCharacter={handleCreateCharacter}
        onSelectCharacter={handleSelectCharacter}
        onResumeRun={handleResumeRun}
        onDeleteCharacter={handleDeleteCharacter}
        onSignOut={handleSignOut}
      />
    )
  }

  // Preparation
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

  // Game
  if (screen === 'game' && character) {
    return (
      <ErrorBoundary>
        <Game
          character={character}
          user={user}
          charId={selectedCharId}
          savedRun={savedRun}
          onSaveRun={runSave.save}
          onEndRun={handleEndRun}
        />
      </ErrorBoundary>
    )
  }

  // Results
  if (screen === 'results' && character && runResult) {
    return (
      <Results
        character={character}
        result={runResult}
        onReturnToTavern={handleReturnToTavern}
      />
    )
  }

  // Fallback — tavern
  return (
    <Tavern
      user={user}
      characters={characters}
      activeRuns={activeRuns}
      returnContext={returnContext}
      onCreateCharacter={handleCreateCharacter}
      onSelectCharacter={handleSelectCharacter}
      onResumeRun={handleResumeRun}
      onDeleteCharacter={handleDeleteCharacter}
      onSignOut={handleSignOut}
    />
  )
}

export default App
