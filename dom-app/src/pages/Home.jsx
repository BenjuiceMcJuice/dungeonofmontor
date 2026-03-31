import { useState } from 'react'

function Home({ onSignInWithGoogle, onSignInWithEmail, onSignUpWithEmail, error }) {
  var [email, setEmail] = useState('')
  var [password, setPassword] = useState('')
  var [isSignUp, setIsSignUp] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (isSignUp) {
      onSignUpWithEmail(email, password)
    } else {
      onSignInWithEmail(email, password)
    }
  }

  return (
    <div className="h-full overflow-auto flex flex-col items-center justify-center px-6 text-center bg-[#09080a]">
      <h1 className="text-4xl md:text-5xl leading-tight mb-2 tracking-wider"
        style={{ fontFamily: "'Press Start 2P', monospace", color: '#111111', textShadow: '0 0 8px rgba(17,17,17,0.6), 0 0 20px rgba(40,40,40,0.3), 1px 1px 0 #222, -1px -1px 0 #000' }}>
        DUNGEON OF
      </h1>
      <h1 className="text-5xl md:text-6xl leading-tight mb-4 tracking-wider"
        style={{ fontFamily: "'Press Start 2P', monospace", color: '#111111', textShadow: '0 0 10px rgba(17,17,17,0.8), 0 0 30px rgba(50,50,50,0.4), 2px 2px 0 #1a1a1a, -1px -1px 0 #000' }}>
        MONTOR
      </h1>
      <p className="text-ink-faint text-sm italic max-w-sm mb-10"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', lineHeight: '1.8', letterSpacing: '1px' }}>
        The dungeon is Montor's house. You are the intruder.
      </p>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <button
          onClick={onSignInWithGoogle}
          className="w-full py-3 px-4 rounded-lg bg-raised border border-border text-ink text-xs hover:border-border-hl transition-colors"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
        >
          Sign in with Google
        </button>

        <div className="flex items-center gap-3 text-ink-faint text-xs">
          <div className="flex-1 h-px bg-border" />
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={function(e) { setEmail(e.target.value) }}
            className="w-full py-3 px-4 rounded-lg bg-surface border border-border text-ink text-sm placeholder:text-ink-faint focus:border-border-hl focus:outline-none"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={function(e) { setPassword(e.target.value) }}
            className="w-full py-3 px-4 rounded-lg bg-surface border border-border text-ink text-sm placeholder:text-ink-faint focus:border-border-hl focus:outline-none"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
          />
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg border border-ink-faint text-ink text-xs font-semibold hover:border-ink hover:text-white transition-all"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={function() { setIsSignUp(!isSignUp) }}
          className="text-ink-faint text-xs hover:text-ink-dim transition-colors"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}
        >
          {isSignUp ? 'Already have an account? Sign in' : 'No account? Create one'}
        </button>

        {error && (
          <p className="text-red-400 text-xs mt-2" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>{error}</p>
        )}
      </div>
    </div>
  )
}

export default Home
