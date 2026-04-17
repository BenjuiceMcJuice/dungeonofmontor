// Narrative Mode page — "Montor's Tale" PoC.
// Three sub-screens: setup → playing → death/end.
// Bypasses the roguelike Game.jsx entirely.

import { useState, useEffect } from 'react'
import useNarrativeCampaign from '../hooks/useNarrativeCampaign.js'
import { hasGroqKey } from '../lib/groq.js'
import GroqKeyInput from '../components/GroqKeyInput.jsx'
import NarrativeFeed from '../components/narrative/NarrativeFeed.jsx'
import NarrativeInput from '../components/narrative/NarrativeInput.jsx'
import NarrativeStatusBar from '../components/narrative/NarrativeStatusBar.jsx'
import { MODEL_OPTIONS, getNarrativeModel, setNarrativeModel } from '../lib/narrative.js'

var pixelFont = "'Press Start 2P', monospace"
var displayFont = "'Sorts Mill Goudy', serif"
var uiFont = "system-ui, -apple-system, sans-serif"

// PoC v1 lock — single Montor voice (bad_montor). Personality picker re-enables in Phase 1 polish.

// Reusable model picker — used in setup screen and AI manager modal.
function ModelPicker() {
  var [modelId, setModelId] = useState(getNarrativeModel())

  return (
    <div style={{
      background: '#060410',
      border: '1px solid #2a1a30',
      borderRadius: '6px',
      padding: '12px',
    }}>
      <p style={{ fontFamily: pixelFont, fontSize: '9px', color: '#c06ee0', letterSpacing: '2px', marginBottom: '10px' }}>
        MODEL
      </p>
      <div className="flex flex-col gap-2">
        {MODEL_OPTIONS.map(function(m) {
          var isActive = m.id === modelId
          return (
            <button key={m.id} onClick={function() { setNarrativeModel(m.id); setModelId(m.id) }}
              style={{
                background: isActive ? '#1a0e26' : 'transparent',
                border: '1px solid ' + (isActive ? '#7a3a9a' : '#2a1a30'),
                borderRadius: '4px',
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}>
              <div style={{ fontFamily: uiFont, fontSize: '12px', color: isActive ? '#c06ee0' : '#8b7b60', fontWeight: 600, marginBottom: '2px' }}>
                {m.label} {isActive && '✓'}
              </div>
              <div style={{ fontFamily: uiFont, fontSize: '10px', color: '#5a4a60', lineHeight: '1.4' }}>
                {m.desc}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SetupScreen({ onStart, busy, error, defaultName }) {
  var [name, setName] = useState(defaultName || '')
  var hasKey = hasGroqKey()

  return (
    <div className="h-full overflow-auto flex flex-col items-center px-4 py-8" style={{ background: '#030408' }}>
      <h1 style={{ fontFamily: pixelFont, fontSize: '16px', color: '#c06ee0', letterSpacing: '2px', textShadow: '0 0 20px rgba(155,89,182,0.4)' }} className="mb-1">
        MONTOR'S TALE
      </h1>
      <p style={{ fontFamily: displayFont, fontSize: '13px', color: '#8b7b60', fontStyle: 'italic', textAlign: 'center', maxWidth: '320px' }} className="mb-6">
        A campaign with Montor as your Dungeon Master. He narrates. You decide. The dice fall.
      </p>

      {/* Always show the Groq key input — collapsed if a key exists, expanded if missing.
          This way the user can re-test or replace the key without leaving narrative mode. */}
      <div style={{
        background: '#0a0812',
        border: '2px solid ' + (hasKey ? '#2a1a30' : '#d4a847'),
        borderRadius: '8px',
        padding: '14px',
        maxWidth: '340px',
        width: '100%',
        marginBottom: '14px',
      }}>
        <p style={{ fontFamily: uiFont, fontSize: '12px', color: hasKey ? '#8b7b60' : '#d4a847', marginBottom: '10px' }}>
          {hasKey ? 'Groq API key is set. Tap to manage.' : 'Narrative Mode needs a Groq API key.'}
        </p>
        <GroqKeyInput />
      </div>

      {/* Model picker — switch between 70b (quality) and 8b (high limits) */}
      <div style={{ maxWidth: '340px', width: '100%', marginBottom: '20px' }}>
        <ModelPicker />
      </div>

      <div style={{ background: '#0a0812', border: '2px solid #2a1a30', borderRadius: '8px', padding: '20px', maxWidth: '340px', width: '100%' }}>
        <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#8b5e3c', fontStyle: 'italic', marginBottom: '10px' }}>
          What is your name, knight?
        </p>
        <input
          type="text"
          value={name}
          onChange={function(e) { setName(e.target.value) }}
          placeholder="..."
          style={{
            fontFamily: uiFont, fontSize: '15px', background: '#060410',
            border: '2px solid #2a1a30', borderBottom: '2px solid #7a3a9a',
            color: '#d4c8a0', padding: '10px 12px', outline: 'none',
            borderRadius: '4px', width: '100%', boxSizing: 'border-box',
            marginBottom: '16px',
          }}
        />

        <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#5a4a60', marginBottom: '14px', lineHeight: '1.5' }}>
          Montor is the dungeon lord — theatrical, dangerous, and watching. He is not your friend.
        </p>

        <button
          onClick={function() { onStart(name) }}
          disabled={busy || !hasKey}
          style={{
            fontFamily: uiFont, fontSize: '13px',
            background: busy || !hasKey ? '#1a1020' : '#0e0818',
            border: '2px solid ' + (busy || !hasKey ? '#2a1a30' : '#7a3a9a'),
            color: busy || !hasKey ? '#5a4a60' : '#c06ee0',
            padding: '12px 20px', cursor: busy || !hasKey ? 'default' : 'pointer',
            letterSpacing: '1px', borderRadius: '6px', fontWeight: 600,
            width: '100%',
          }}>
          {busy ? 'Montor is preparing...' : 'Begin'}
        </button>

        {/* Show live error during busy state too — otherwise users stare at "preparing" forever. */}
        {error && (
          <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#c0392b', marginTop: '10px', textAlign: 'center', lineHeight: '1.5' }}>
            {error}
          </p>
        )}
        {busy && !error && (
          <p style={{ fontFamily: uiFont, fontSize: '10px', color: '#5a4a60', marginTop: '10px', textAlign: 'center' }}>
            Sending request to Groq... if this hangs, check the browser console.
          </p>
        )}
      </div>
    </div>
  )
}

function Narrative({ onExit }) {
  var nc = useNarrativeCampaign()
  var [showEndConfirm, setShowEndConfirm] = useState(false)
  var [showKeyManager, setShowKeyManager] = useState(false)

  // Auto-resume if a saved campaign loads from localStorage. The hook handles that.
  // No campaign yet → setup screen.
  if (!nc.campaign) {
    return (
      <div className="h-full flex flex-col" style={{ background: '#030408' }}>
        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: '1px solid #2a1a30' }}>
          <button onClick={onExit}
            style={{ fontFamily: uiFont, fontSize: '11px', color: '#5a4a60', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Tavern
          </button>
          <span style={{ fontFamily: pixelFont, fontSize: '9px', color: '#5a4a60', letterSpacing: '2px' }}>POC v1</span>
        </div>
        <SetupScreen onStart={nc.startCampaign} busy={nc.busy} error={nc.error} />
      </div>
    )
  }

  var character = nc.campaign.character || {}
  var dead = character.hp <= 0

  return (
    <div className="h-full flex flex-col" style={{ background: '#030408' }}>
      {/* Top: status bar */}
      <div style={{ position: 'relative' }}>
        <NarrativeStatusBar campaign={nc.campaign} />
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          display: 'flex', gap: '6px',
        }}>
          <button onClick={function() { setShowKeyManager(true) }}
            style={{
              fontFamily: uiFont, fontSize: '10px', color: '#c06ee0',
              background: 'none', border: '1px solid #2a1a30', borderRadius: '4px',
              padding: '4px 8px', cursor: 'pointer',
            }}>
            AI
          </button>
          <button onClick={function() { setShowEndConfirm(true) }}
            style={{
              fontFamily: uiFont, fontSize: '10px', color: '#5a4a60',
              background: 'none', border: '1px solid #2a1a30', borderRadius: '4px',
              padding: '4px 8px', cursor: 'pointer',
            }}>
            End
          </button>
        </div>
      </div>

      {/* Middle: scrolling feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <NarrativeFeed messages={nc.campaign.messages} busy={nc.busy} />
        </div>
        {nc.error && (
          <p style={{
            fontFamily: uiFont, fontSize: '11px', color: '#c0392b',
            textAlign: 'center', padding: '8px', maxWidth: '400px', margin: '0 auto',
          }}>
            {nc.error}
          </p>
        )}
      </div>

      {/* Bottom: input (or death message) */}
      {dead ? (
        <div style={{
          borderTop: '1px solid #2a1a30',
          background: '#060410',
          padding: '16px',
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#c0392b', fontStyle: 'italic', marginBottom: '10px' }}>
            You have fallen. Montor is quiet.
          </p>
          <button onClick={function() { nc.endCampaign() }}
            style={{
              fontFamily: uiFont, fontSize: '12px',
              background: '#0e0818', border: '2px solid #7a3a9a',
              color: '#c06ee0', padding: '10px 20px', cursor: 'pointer',
              letterSpacing: '1px', borderRadius: '6px', fontWeight: 600,
            }}>
            Begin Again
          </button>
        </div>
      ) : (
        <NarrativeInput onSubmit={nc.takeAction} disabled={nc.busy} />
      )}

      {/* AI key manager — accessible mid-campaign */}
      {showKeyManager && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', zIndex: 100,
        }}>
          <div style={{
            background: '#0a0812', border: '2px solid #7a3a9a', borderRadius: '8px',
            padding: '20px', maxWidth: '360px', width: '100%',
          }}>
            <p style={{ fontFamily: pixelFont, fontSize: '11px', color: '#c06ee0', letterSpacing: '2px', marginBottom: '12px' }}>
              MONTOR AI
            </p>
            <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#8b7b60', marginBottom: '14px', lineHeight: '1.5' }}>
              Manage your Groq API key and pick a model. If you're rate limited on 70B, switch to 8B.
            </p>
            <GroqKeyInput />
            <div style={{ marginTop: '14px' }}>
              <ModelPicker />
            </div>
            <button onClick={function() { setShowKeyManager(false) }}
              style={{
                fontFamily: uiFont, fontSize: '12px', background: 'none',
                border: '2px solid #2a1a30', color: '#5a4a60',
                padding: '10px', cursor: 'pointer', borderRadius: '6px',
                width: '100%', marginTop: '14px',
              }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* End-campaign confirm */}
      {showEndConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', zIndex: 100,
        }}>
          <div style={{
            background: '#0a0812', border: '2px solid #7a3a9a', borderRadius: '8px',
            padding: '20px', maxWidth: '320px', width: '100%',
          }}>
            <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#d4c8a0', fontStyle: 'italic', marginBottom: '14px' }}>
              End this campaign? Your story will be lost. Montor will not forgive you.
            </p>
            <div className="flex gap-2">
              <button onClick={function() { setShowEndConfirm(false); nc.endCampaign() }}
                style={{
                  fontFamily: uiFont, fontSize: '12px', background: '#0e0818',
                  border: '2px solid #c0392b', color: '#c0392b',
                  padding: '10px', cursor: 'pointer', borderRadius: '6px', flex: 1,
                }}>
                End
              </button>
              <button onClick={function() { setShowEndConfirm(false) }}
                style={{
                  fontFamily: uiFont, fontSize: '12px', background: 'none',
                  border: '2px solid #2a1a30', color: '#5a4a60',
                  padding: '10px', cursor: 'pointer', borderRadius: '6px', flex: 1,
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Narrative
