// Free-form action input. Pressing Enter (or Send) submits.
import { useState } from 'react'

var uiFont = "system-ui, -apple-system, sans-serif"
var displayFont = "'Sorts Mill Goudy', serif"

function NarrativeInput({ onSubmit, disabled, placeholder }) {
  var [text, setText] = useState('')

  function handleSubmit() {
    if (disabled) return
    var t = text.trim()
    if (!t) return
    onSubmit(t)
    setText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={{
      borderTop: '1px solid #2e2818',
      background: '#110f09',
      padding: '10px 12px',
      paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
    }}>
      <div className="flex gap-2 items-end max-w-2xl mx-auto">
        <textarea
          value={text}
          onChange={function(e) { setText(e.target.value) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'What do you do?'}
          rows={2}
          disabled={disabled}
          style={{
            flex: 1,
            background: '#1a1510',
            border: '1px solid #2e2818',
            borderRadius: '6px',
            padding: '10px 12px',
            color: '#c8ba90',
            fontFamily: displayFont,
            fontSize: '14px',
            outline: 'none',
            resize: 'none',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          style={{
            background: disabled || !text.trim() ? '#211c14' : '#1a1510',
            border: '2px solid ' + (disabled || !text.trim() ? '#2e2818' : '#5a4820'),
            borderRadius: '6px',
            color: disabled || !text.trim() ? '#6a5e48' : '#9a8a68',
            padding: '10px 16px',
            fontFamily: uiFont,
            fontSize: '12px',
            letterSpacing: '1px',
            fontWeight: 600,
            cursor: disabled || !text.trim() ? 'default' : 'pointer',
            minHeight: '54px',
          }}
        >
          ACT
        </button>
      </div>
    </div>
  )
}

export default NarrativeInput
