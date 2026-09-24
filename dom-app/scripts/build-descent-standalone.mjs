// Builds docs/descent_p0.html: the Descent P0 engine as a single playable HTML page.
// Usage: node scripts/build-descent-standalone.mjs   (run from dom-app/, after `npm ci`)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

var here = path.dirname(fileURLToPath(import.meta.url))
var root = path.join(here, '..')

// The engine is a plain ES module; strip its export line so it runs as a classic script.
var engine = fs.readFileSync(path.join(root, 'src/descent/engine.js'), 'utf8').replace(/\nexport \{[^}]*\}\n?/, '\n')

// Assets: run the app's own encoder (assets.js → lib/sprites.js). Node needs an import attribute for the
// JSON theme file that Vite doesn't, so import patched copies from a temp dir rather than the sources.
import os from 'os'
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'descent-'))
fs.writeFileSync(path.join(tmp, 'themes.json'), fs.readFileSync(path.join(root, 'src/data/themes.json')))
fs.writeFileSync(path.join(tmp, 'sprites.js'), fs.readFileSync(path.join(root, 'src/lib/sprites.js'), 'utf8').replace("from '../data/themes.json'", "from './themes.json' with { type: 'json' }"))
fs.writeFileSync(path.join(tmp, 'assets.js'), fs.readFileSync(path.join(root, 'src/descent/assets.js'), 'utf8').replace("from '../lib/sprites.js'", "from './sprites.js'"))
var assets = await import(path.join(tmp, 'assets.js')).then(function(m) { return m.buildDescentAssets('garden') })
fs.rmSync(tmp, { recursive: true, force: true })

var html = `<title>Montor's Descent</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>
  :root { color-scheme: dark; --bg:#050407; --gold:#d4a017; --muted:#8b7b60; }
  body { background: var(--bg); margin: 0; color: #d4c8a0; font-family: system-ui, sans-serif; }
  .wrap { display: flex; flex-direction: column; align-items: center; padding: 8px 16px 24px; gap: 8px; }
  h1 { font-family: 'Press Start 2P', monospace; font-size: 11px; color: var(--gold); margin: 6px 0 0; }
  canvas { width: 100%; max-width: 720px; aspect-ratio: 360 / 300; image-rendering: pixelated; touch-action: none; display: block; }
  p { font-size: 12px; color: var(--muted); max-width: 60ch; text-align: center; margin: 0; line-height: 1.5; }
</style>
<div class="wrap">
  <h1>MONTOR'S DESCENT · P0</h1>
  <canvas id="game" width="360" height="300"></canvas>
  <p>Keyboard: arrows or WASD to move, <b>Z</b> jump, <b>X</b> act (pick up / throw / swing / dig), <b>C</b> roll. Down+X puts a thing down, Up+X puts it in the sack. On a phone use the pad and buttons.</p>
  <p>Fill the three bins (wood, metal, Montor's) to open the door. Or take the hole. Dig the pile with anything. Throw the pipe into the water while the slug's in it.</p>
</div>
<script>
var DESCENT_ASSETS = ${JSON.stringify(assets)};
${engine}
createDescentGame(document.getElementById('game'), DESCENT_ASSETS, { debug: location.hash === '#debug' });
</script>
`
fs.writeFileSync(path.join(root, 'docs/descent_p0.html'), html)
console.log('wrote docs/descent_p0.html')
