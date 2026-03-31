// 4x4 dungeon grid map
// Shows chambers, doors between them, current position, visited state

function DungeonMap({ zone, onSelectChamber }) {
  var SIZE = zone.gridSize
  var cellSize = 64
  var doorLen = 16
  var gap = doorLen
  var totalSize = SIZE * cellSize + (SIZE - 1) * gap

  function getChamber(row, col) {
    return zone.chambers[row * SIZE + col]
  }

  // Render a single chamber cell
  function renderChamber(chamber) {
    var isCurrent = zone.playerPosition === chamber.id
    var isVisited = chamber.visited
    var isCleared = chamber.cleared
    var isAdjacent = false

    // Check if this chamber is adjacent to current position and has a door
    var current = zone.chambers[zone.playerPosition]
    if (current.doors.N && zone.playerPosition - 4 === chamber.id) isAdjacent = true
    if (current.doors.S && zone.playerPosition + 4 === chamber.id) isAdjacent = true
    if (current.doors.E && zone.playerPosition + 1 === chamber.id) isAdjacent = true
    if (current.doors.W && zone.playerPosition - 1 === chamber.id) isAdjacent = true

    var canNavigate = isAdjacent && isCurrent === false

    // Determine cell style
    var bg = 'bg-surface'
    var border = 'border-border'
    var textCol = 'text-ink-faint'
    var opacity = 'opacity-30'

    if (isCurrent) {
      bg = 'bg-gold/20'
      border = 'border-gold'
      textCol = 'text-gold'
      opacity = 'opacity-100'
    } else if (isAdjacent && isVisited) {
      bg = 'bg-surface'
      border = 'border-border-hl'
      textCol = 'text-ink-dim'
      opacity = 'opacity-100'
    } else if (isAdjacent) {
      bg = 'bg-raised'
      border = 'border-border-hl'
      textCol = 'text-ink-dim'
      opacity = 'opacity-70'
    } else if (isVisited) {
      bg = isCleared ? 'bg-surface' : 'bg-raised'
      border = 'border-border'
      textCol = isCleared ? 'text-ink-faint' : 'text-ink-dim'
      opacity = 'opacity-100'
    }

    // Icon colour based on chamber type
    var iconCol = textCol
    if (isCurrent) iconCol = 'text-gold'
    else if (chamber.type === 'stairwell_descent' && isVisited) iconCol = 'text-green-400'
    else if (chamber.type === 'stairwell_entry') iconCol = 'text-ink-dim'
    else if ((chamber.type === 'combat_standard' || chamber.type === 'combat_elite' || chamber.type === 'mini_boss') && !isCleared && isVisited) iconCol = 'text-red-400'

    return (
      <button
        key={chamber.id}
        onClick={function() { if (canNavigate) onSelectChamber(chamber.id) }}
        disabled={!canNavigate}
        className={
          'flex flex-col items-center justify-center border-2 rounded-md transition-all ' +
          bg + ' ' + border + ' ' + opacity + ' ' +
          (canNavigate ? ' cursor-pointer hover:border-gold hover:opacity-100' : '') +
          (isCurrent ? ' ring-1 ring-gold/40' : '')
        }
        style={{ width: cellSize, height: cellSize }}
      >
        {(isVisited || isAdjacent || isCurrent) ? (
          <>
            <span className={iconCol + ' text-lg leading-none'}>{chamber.icon}</span>
            {isCurrent && <span className="text-gold text-[8px] mt-0.5 font-sans font-bold">YOU</span>}
            {!isCurrent && isVisited && isCleared && <span className="text-green-400/60 text-[8px] mt-0.5 font-sans">done</span>}
            {!isCurrent && isVisited && !isCleared && <span className="text-red-400/60 text-[8px] mt-0.5 font-sans">!</span>}
          </>
        ) : (
          <span className="text-ink-faint/30 text-lg">?</span>
        )}
      </button>
    )
  }

  // Render a horizontal door (between col and col+1 in same row)
  function renderHDoor(row, col) {
    var chamber = getChamber(row, col)
    var hasDoor = chamber.doors.E
    var isVisible = chamber.visited || getChamber(row, col + 1).visited

    return (
      <div key={'h-' + row + '-' + col}
        className="flex items-center justify-center"
        style={{ width: gap, height: cellSize }}
      >
        {hasDoor && isVisible && (
          <div className="w-full h-1 bg-border-hl rounded-full" />
        )}
      </div>
    )
  }

  // Render a vertical door (between row and row+1 in same col)
  function renderVDoor(row, col) {
    var chamber = getChamber(row, col)
    var hasDoor = chamber.doors.S
    var isVisible = chamber.visited || getChamber(row + 1, col).visited

    return (
      <div key={'v-' + row + '-' + col}
        className="flex items-center justify-center"
        style={{ width: cellSize, height: gap }}
      >
        {hasDoor && isVisible && (
          <div className="h-full w-1 bg-border-hl rounded-full" />
        )}
      </div>
    )
  }

  // Build rows
  var rows = []
  for (var r = 0; r < SIZE; r++) {
    // Chamber row
    var chamberRow = []
    for (var c = 0; c < SIZE; c++) {
      chamberRow.push(renderChamber(getChamber(r, c)))
      if (c < SIZE - 1) chamberRow.push(renderHDoor(r, c))
    }
    rows.push(
      <div key={'row-' + r} className="flex items-center">
        {chamberRow}
      </div>
    )

    // Door row (vertical doors between this row and next)
    if (r < SIZE - 1) {
      var doorRow = []
      for (var c2 = 0; c2 < SIZE; c2++) {
        doorRow.push(renderVDoor(r, c2))
        if (c2 < SIZE - 1) {
          // Empty spacer at intersection
          doorRow.push(<div key={'spacer-' + r + '-' + c2} style={{ width: gap, height: gap }} />)
        }
      }
      rows.push(
        <div key={'doors-' + r} className="flex items-center">
          {doorRow}
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col items-center gap-0">
      <p className="text-ink-dim text-xs uppercase tracking-widest mb-2 font-sans">
        {zone.zoneName} — {zone.floorName}
      </p>
      <div className="flex flex-col items-center">
        {rows}
      </div>
    </div>
  )
}

export default DungeonMap
