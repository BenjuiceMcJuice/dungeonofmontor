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
    <div className="h-svh overflow-hidden flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-5xl md:text-6xl text-gold leading-tight mb-3">
        Dungeon of Montor
      </h1>
      <p className="text-ink-dim text-lg italic max-w-sm mb-10">
        The dungeon is Montor's house. You are the intruder.
      </p>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <button
          onClick={onSignInWithGoogle}
          className="w-full py-3 px-4 rounded-lg bg-raised border border-border text-ink font-sans text-sm hover:border-border-hl transition-colors"
        >
          Sign in with Google
        </button>

        <div className="flex items-center gap-3 text-ink-faint text-xs">
          <div className="flex-1 h-px bg-border" />
          <span>or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={function(e) { setEmail(e.target.value) }}
            className="w-full py-3 px-4 rounded-lg bg-surface border border-border text-ink font-sans text-sm placeholder:text-ink-faint focus:border-border-hl focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={function(e) { setPassword(e.target.value) }}
            className="w-full py-3 px-4 rounded-lg bg-surface border border-border text-ink font-sans text-sm placeholder:text-ink-faint focus:border-border-hl focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg bg-gold text-bg font-sans text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={function() { setIsSignUp(!isSignUp) }}
          className="text-ink-faint text-xs hover:text-ink-dim transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : 'No account? Create one'}
        </button>

        {error && (
          <p className="text-crimson text-xs mt-2">{error}</p>
        )}
      </div>
    </div>
  )
}

export default Home
