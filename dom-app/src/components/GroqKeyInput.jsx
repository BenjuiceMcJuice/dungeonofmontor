// Claude API key input with test function
import { useState } from 'react'
import { getClaudeKey, setClaudeKey, hasClaudeKey } from '../lib/claude.js'

function ClaudeKeyInput() {
  var [showInput, setShowInput] = useState(false)
  var [key, setKey] = useState(getClaudeKey())
  var [testing, setTesting] = useState(false)
  var [testResult, setTestResult] = useState(null) // null | 'ok' | error string

  function handleTest() {
    if (!key || testing) return
    setTesting(true)
    setTestResult(null)
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Say OK' }],
      }),
    })
      .then(function(res) {
        if (res.ok) {
          setTestResult('ok')
          setClaudeKey(key) // auto-save on success
          return
        }
        return res.json().then(function(err) {
          var msg = (err && err.error && err.error.message) || 'Error ' + res.status
          setTestResult(msg)
        })
      })
      .catch(function(e) { setTestResult(e.message || 'Connection failed') })
      .finally(function() { setTesting(false) })
  }

  if (!showInput) {
    return (
      <button onClick={function() { setShowInput(true); setTestResult(null) }}
        className={'text-[10px] font-sans px-2 py-1 rounded border transition-colors ' +
          (hasClaudeKey() ? 'text-purple-400 border-purple-400/30 hover:border-purple-400' : 'text-ink-faint border-border hover:text-ink')}>
        {hasClaudeKey() ? 'AI: ON' : 'AI: OFF'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface border border-purple-400/30 w-full max-w-xs">
      <p className="text-purple-400 text-xs font-display">Montor AI (Claude)</p>
      <p className="text-ink-faint text-[10px] font-sans">Paste your Anthropic API key. Stored locally only.</p>
      <input
        type="password"
        value={key}
        onChange={function(e) { setKey(e.target.value); setTestResult(null) }}
        placeholder="sk-ant-..."
        className="bg-bg border border-border rounded px-2 py-1.5 text-xs text-ink font-sans w-full"
      />
      <div className="flex gap-2">
        <button onClick={handleTest}
          disabled={testing || !key}
          className={'flex-1 text-xs py-1.5 rounded border transition-colors ' +
            (testing ? 'text-ink-faint border-border' :
             testResult === 'ok' ? 'text-green-400 border-green-400/40' :
             'text-purple-400 border-purple-400/40 hover:border-purple-400')}>
          {testing ? 'Testing...' : testResult === 'ok' ? 'Connected!' : 'Test & Save'}
        </button>
        <button onClick={function() { setShowInput(false) }}
          className="flex-1 text-xs text-ink-dim border border-border py-1.5 rounded hover:text-ink transition-colors">
          Close
        </button>
      </div>
      {testResult && testResult !== 'ok' && (
        <p className="text-red-400 text-[10px] font-sans">{testResult}</p>
      )}
      {testResult === 'ok' && (
        <p className="text-green-400 text-[10px] font-sans">Key saved. Montor is listening.</p>
      )}
      {hasClaudeKey() && (
        <button onClick={function() { setKey(''); setClaudeKey(''); setTestResult(null) }}
          className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
          Remove key
        </button>
      )}
    </div>
  )
}

export default ClaudeKeyInput
