var TAB_CONFIG = [
  { id: 'view', icon: '👁', label: 'View' },
  { id: 'party', icon: '⚔️', label: 'Party' },
  { id: 'stats', icon: '📋', label: 'Stats' },
  { id: 'inventory', icon: '🎒', label: 'Inventory' },
  { id: 'story', icon: '📜', label: 'Story' },
]

function Nav({ tab, setTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around py-2 px-1 z-50">
      {TAB_CONFIG.map(function(t) {
        var active = tab === t.id
        return (
          <button
            key={t.id}
            onClick={function() { setTab(t.id) }}
            className={
              'flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors ' +
              (active ? 'text-gold' : 'text-ink-faint')
            }
          >
            <span className="text-lg">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default Nav
