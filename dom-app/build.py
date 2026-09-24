import re,sys
S='/tmp/claude-0/-home-user-dungeonofmontor/40b48fce-161c-5d7a-bc37-1b71ad2dc47e/scratchpad'
eng=open('/home/user/dungeonofmontor/dom-app/src/descent/engine.js').read()
eng=re.sub(r"\nexport \{[^}]*\}\n?","\n",eng)
spr=open(S+'/sprites.json').read()
html='''<title>Montor's Descent</title>
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
var DESCENT_ASSETS = ''' + spr + ''';
''' + eng + '''
createDescentGame(document.getElementById('game'), DESCENT_ASSETS, { debug: location.hash === '#debug' });
</script>
'''
open(S+'/descent-p0.html','w').write(html)
