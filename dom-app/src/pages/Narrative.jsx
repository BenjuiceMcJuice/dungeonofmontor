// Narrative Mode page — "Montor's Tale" PoC.
// Three sub-screens: setup → playing → death/end.
// Bypasses the roguelike Game.jsx entirely.

import { useState, useEffect } from 'react'
import useNarrativeCampaign from '../hooks/useNarrativeCampaign.js'
import { hasClaudeKey as hasGroqKey } from '../lib/claude.js'
import GroqKeyInput from '../components/GroqKeyInput.jsx'
import NarrativeFeed from '../components/narrative/NarrativeFeed.jsx'
import NarrativeInput from '../components/narrative/NarrativeInput.jsx'
import NarrativeDiceCard from '../components/narrative/NarrativeDiceCard.jsx'
import NarrativeStatusBar from '../components/narrative/NarrativeStatusBar.jsx'
import { MODEL_OPTIONS, getNarrativeModel, setNarrativeModel } from '../lib/narrative.js'

var pixelFont = "'Press Start 2P', monospace"
var displayFont = "'Sorts Mill Goudy', serif"
var uiFont = "system-ui, -apple-system, sans-serif"

// Reusable model picker — used in setup screen and AI manager modal.
function ModelPicker() {
  var [modelId, setModelId] = useState(getNarrativeModel())

  return (
    <div style={{
      background: '#110f09',
      border: '1px solid #2e2818',
      borderRadius: '6px',
      padding: '12px',
    }}>
      <p style={{ fontFamily: pixelFont, fontSize: '9px', color: '#a0a898', letterSpacing: '2px', marginBottom: '10px' }}>
        MODEL
      </p>
      <div className="flex flex-col gap-2">
        {MODEL_OPTIONS.map(function(m) {
          var isActive = m.id === modelId
          return (
            <button key={m.id} onClick={function() { setNarrativeModel(m.id); setModelId(m.id) }}
              style={{
                background: isActive ? '#211c14' : 'transparent',
                border: '1px solid ' + (isActive ? '#5a4820' : '#2e2818'),
                borderRadius: '4px',
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}>
              <div style={{ fontFamily: uiFont, fontSize: '12px', color: isActive ? '#9a8a68' : '#6a5e48', fontWeight: 600, marginBottom: '2px' }}>
                {m.label} {isActive && '✓'}
              </div>
              <div style={{ fontFamily: uiFont, fontSize: '10px', color: '#3a3428', lineHeight: '1.4' }}>
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
  var [brief, setBrief] = useState('')
  var hasKey = hasGroqKey()

  return (
    <div className="h-full overflow-auto flex flex-col items-center px-4 py-8" style={{ background: '#0a0906' }}>
      <h1 style={{ fontFamily: pixelFont, fontSize: '16px', color: '#c8b880', letterSpacing: '2px', textShadow: '0 0 20px rgba(192,160,48,0.2)' }} className="mb-1">
        MONTOR'S TALE
      </h1>
      <p style={{ fontFamily: displayFont, fontSize: '13px', color: '#9a8a68', fontStyle: 'italic', textAlign: 'center', maxWidth: '320px' }} className="mb-6">
        A campaign with Montor as your Dungeon Master. He narrates. You decide. The dice fall.
      </p>

      <div style={{
        background: '#1a1510',
        border: '2px solid ' + (hasKey ? '#2e2818' : '#8a7020'),
        borderRadius: '8px',
        padding: '14px',
        maxWidth: '340px',
        width: '100%',
        marginBottom: '14px',
      }}>
        <p style={{ fontFamily: uiFont, fontSize: '12px', color: hasKey ? '#9a8a68' : '#8a7020', marginBottom: '10px' }}>
          {hasKey ? 'Claude API key is set. Tap to manage.' : 'Narrative Mode needs a Claude API key.'}
        </p>
        <GroqKeyInput />
      </div>

      {/* Model picker */}
      <div style={{ maxWidth: '340px', width: '100%', marginBottom: '20px' }}>
        <ModelPicker />
      </div>

      <div style={{ background: '#1a1510', border: '2px solid #2e2818', borderRadius: '8px', padding: '20px', maxWidth: '340px', width: '100%' }}>
        <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#9a8a68', fontStyle: 'italic', marginBottom: '10px' }}>
          What is your name, knight?
        </p>
        <input
          type="text"
          value={name}
          onChange={function(e) { setName(e.target.value) }}
          placeholder="..."
          style={{
            fontFamily: uiFont, fontSize: '15px', background: '#110f09',
            border: '2px solid #2e2818', borderBottom: '2px solid #5a4820',
            color: '#c8ba90', padding: '10px 12px', outline: 'none',
            borderRadius: '4px', width: '100%', boxSizing: 'border-box',
            marginBottom: '16px',
          }}
        />

        <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#9a8a68', fontStyle: 'italic', marginBottom: '8px' }}>
          What kind of story?
        </p>
        <p style={{ fontFamily: uiFont, fontSize: '10px', color: '#6a5e48', marginBottom: '8px', lineHeight: '1.5' }}>
          Set a tone, a goal, a backstory. Montor will honour this throughout.
        </p>
        <textarea
          value={brief}
          onChange={function(e) { setBrief(e.target.value) }}
          placeholder="e.g. Gothic horror — I want to find out what happened to the castle family. Or: fast and brutal, no mercy."
          rows={3}
          style={{
            fontFamily: uiFont, fontSize: '13px', background: '#110f09',
            border: '2px solid #2e2818', borderBottom: '2px solid #5a4820',
            color: '#c8ba90', padding: '10px 12px', outline: 'none',
            borderRadius: '4px', width: '100%', boxSizing: 'border-box',
            marginBottom: '16px', resize: 'none', lineHeight: '1.5',
          }}
        />

        <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#6a5e48', marginBottom: '14px', lineHeight: '1.5' }}>
          Montor is the house. He is in the walls, the smell, the space between things left behind. You will not see him.
        </p>

        <button
          onClick={function() { onStart(name, brief) }}
          disabled={busy || !hasKey}
          style={{
            fontFamily: uiFont, fontSize: '13px',
            background: busy || !hasKey ? '#211c14' : '#1a1510',
            border: '2px solid ' + (busy || !hasKey ? '#2e2818' : '#5a4820'),
            color: busy || !hasKey ? '#6a5e48' : '#9a8a68',
            padding: '12px 20px', cursor: busy || !hasKey ? 'default' : 'pointer',
            letterSpacing: '1px', borderRadius: '6px', fontWeight: 600,
            width: '100%',
          }}>
          {busy ? 'The house is waking...' : 'Begin'}
        </button>

        {error && (
          <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#a03828', marginTop: '10px', textAlign: 'center', lineHeight: '1.5' }}>
            {error}
          </p>
        )}
        {busy && !error && (
          <p style={{ fontFamily: uiFont, fontSize: '10px', color: '#6a5e48', marginTop: '10px', textAlign: 'center' }}>
            Sending request to Claude... if this hangs, check the browser console.
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
      <div className="h-full flex flex-col" style={{ background: '#0a0906' }}>
        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: '1px solid #2e2818' }}>
          <button onClick={onExit}
            style={{ fontFamily: uiFont, fontSize: '11px', color: '#6a5e48', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Tavern
          </button>
          <span style={{ fontFamily: pixelFont, fontSize: '9px', color: '#3a3428', letterSpacing: '2px' }}>POC v1</span>
        </div>
        <SetupScreen onStart={nc.startCampaign} busy={nc.busy} error={nc.error} />
      </div>
    )
  }

  var character = nc.campaign.character || {}
  var dead = character.hp <= 0

  return (
    <div className="h-full flex flex-col" style={{ background: '#0a0906' }}>
      {/* Top: status bar */}
      <div style={{ position: 'relative' }}>
        <NarrativeStatusBar campaign={nc.campaign} />
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          display: 'flex', gap: '6px',
        }}>
          <button onClick={function() { setShowKeyManager(true) }}
            style={{
              fontFamily: uiFont, fontSize: '10px', color: '#9a8a68',
              background: 'none', border: '1px solid #2e2818', borderRadius: '4px',
              padding: '4px 8px', cursor: 'pointer',
            }}>
            AI
          </button>
          <button onClick={function() { setShowEndConfirm(true) }}
            style={{
              fontFamily: uiFont, fontSize: '10px', color: '#6a5e48',
              background: 'none', border: '1px solid #2e2818', borderRadius: '4px',
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
            fontFamily: uiFont, fontSize: '11px', color: '#a03828',
            textAlign: 'center', padding: '8px', maxWidth: '400px', margin: '0 auto',
          }}>
            {nc.error}
          </p>
        )}
      </div>

      {/* Bottom: input (or death message) */}
      {dead ? (
        <div style={{
          borderTop: '1px solid #2e2818',
          background: '#110f09',
          padding: '16px',
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#7a2818', fontStyle: 'italic', marginBottom: '10px' }}>
            You have fallen. The house is quiet.
          </p>
          <button onClick={function() { nc.endCampaign() }}
            style={{
              fontFamily: uiFont, fontSize: '12px',
              background: '#1a1510', border: '2px solid #5a4820',
              color: '#9a8a68', padding: '10px 20px', cursor: 'pointer',
              letterSpacing: '1px', borderRadius: '6px', fontWeight: 600,
            }}>
            Begin Again
          </button>
        </div>
      ) : nc.pendingRoll ? (
        <NarrativeDiceCard
          stat={nc.pendingRoll.stat}
          dc={nc.pendingRoll.dc}
          modifier={nc.pendingRoll.modifier}
          onCommit={nc.commitRoll}
        />
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
            background: '#1a1510', border: '2px solid #5a4820', borderRadius: '8px',
            padding: '20px', maxWidth: '360px', width: '100%',
          }}>
            <p style={{ fontFamily: pixelFont, fontSize: '11px', color: '#a0a898', letterSpacing: '2px', marginBottom: '12px' }}>
              MONTOR AI
            </p>
            <p style={{ fontFamily: uiFont, fontSize: '11px', color: '#9a8a68', marginBottom: '14px', lineHeight: '1.5' }}>
              Manage your Claude API key and pick a model. Switch to Haiku for speed, Opus for depth.
            </p>
            <GroqKeyInput />
            <div style={{ marginTop: '14px' }}>
              <ModelPicker />
            </div>
            <button onClick={function() { setShowKeyManager(false) }}
              style={{
                fontFamily: uiFont, fontSize: '12px', background: 'none',
                border: '2px solid #2e2818', color: '#6a5e48',
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
            background: '#1a1510', border: '2px solid #5a4820', borderRadius: '8px',
            padding: '20px', maxWidth: '320px', width: '100%',
          }}>
            <p style={{ fontFamily: displayFont, fontSize: '14px', color: '#c8ba90', fontStyle: 'italic', marginBottom: '14px' }}>
              End this campaign? Your story will be lost. The house will not remember you.
            </p>
            <div className="flex gap-2">
              <button onClick={function() { setShowEndConfirm(false); nc.endCampaign() }}
                style={{
                  fontFamily: uiFont, fontSize: '12px', background: '#211c14',
                  border: '2px solid #7a2818', color: '#7a2818',
                  padding: '10px', cursor: 'pointer', borderRadius: '6px', flex: 1,
                }}>
                End
              </button>
              <button onClick={function() { setShowEndConfirm(false) }}
                style={{
                  fontFamily: uiFont, fontSize: '12px', background: 'none',
                  border: '2px solid #2e2818', color: '#6a5e48',
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
