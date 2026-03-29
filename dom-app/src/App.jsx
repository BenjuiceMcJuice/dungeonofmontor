import { useState } from 'react'
import Nav from './components/Nav.jsx'
import './App.css'

var TABS = ['view', 'party', 'stats', 'inventory', 'story']

function App() {
  var [tab, setTab] = useState('view')

  return (
    <div className="flex flex-col min-h-svh">
      <main className="flex-1 px-4 pt-6 pb-20">
        {tab === 'view' && <ViewTab />}
        {tab === 'party' && <PlaceholderTab name="Party" icon="⚔️" />}
        {tab === 'stats' && <PlaceholderTab name="Stats" icon="📋" />}
        {tab === 'inventory' && <PlaceholderTab name="Inventory" icon="🎒" />}
        {tab === 'story' && <PlaceholderTab name="Story" icon="📜" />}
      </main>
      <Nav tab={tab} setTab={setTab} />
    </div>
  )
}

function ViewTab() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60svh] text-center gap-6">
      <h1 className="font-display text-4xl md:text-5xl text-gold leading-tight">
        Dungeon of Montor
      </h1>
      <p className="text-ink-dim text-lg italic max-w-md">
        The dungeon is Montor's house. You are the intruder.
      </p>
      <div className="mt-4 px-6 py-3 rounded-lg bg-raised border border-border text-ink-dim text-sm">
        v0.1 — Solo Foundation coming soon
      </div>
    </div>
  )
}

function PlaceholderTab({ name, icon }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60svh] text-center gap-4">
      <span className="text-5xl">{icon}</span>
      <h2 className="font-display text-2xl text-gold">{name}</h2>
      <p className="text-ink-faint text-sm">Coming soon</p>
    </div>
  )
}

export default App
