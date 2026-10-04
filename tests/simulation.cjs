/* Plain Node simulation benchmark; no browser, renderer or network.
   Run: node tests/simulation.cjs [baseline HTML path]
   The default baseline is the unchanged copy committed in this repository. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const baselineCommit = '202e03f635312655f4b60365ae006c55c28f1ac2';
const fixture = { seed:4242, units:100, ticks:300, warmupRuns:3, measuredRuns:9 };

function simulationContext(html, label) {
  const start = html.indexOf("'use strict';");
  const end = html.indexOf('function cnv(', start);
  const segmentDistance = html.match(/function segDist\([^\n]+/);
  if (start < 0 || end < 0 || !segmentDistance) {
    throw new Error(`${label}: simulation source boundaries changed; update this benchmark.`);
  }
  // Run the actual game functions preceding the texture/rendering code.
  // segDist is the one map helper declared later in the source.
  const source = `(() => {\n${html.slice(start, end)}\n${segmentDistance[0]}\n` +
    'return { newGame, step, spawnUnit, rng, nearestWalkable, get MAP() { return MAP; } };\n})()';
  const context = vm.createContext({ performance, fixture });
  context.game = vm.runInContext(source, context, { timeout:10000, filename:label });
  return context;
}

function measure(html, label) {
  const context = simulationContext(html, label);
  return vm.runInContext(`(() => {
    const samples = [];
    let gameState;
    for (let run = 0; run < fixture.warmupRuns + fixture.measuredRuns; run++) {
      Math.random = game.rng(123456);
      gameState = game.newGame(['viking', 'rentner'], fixture.seed);
      gameState.cd = 0;
      gameState.bears = [];
      gameState.itemT = 1e9;
      gameState.towerOff = [true, true];
      for (let team = 0; team < 2; team++) {
        for (let i = 0; i < fixture.units / 2; i++) {
          game.spawnUnit(gameState, team, team ? 2 : 0);
          const unit = gameState.units.at(-1);
          const position = game.nearestWalkable(game.MAP,
            -35 + i % 10 * 7, (team ? -1 : 1) * (35 + Math.floor(i / 10) * 6));
          Object.assign(unit, {
            x:position.x, z:position.z,
            ord:{ x:position.x, z:position.z, mv:false }
          });
        }
      }
      const started = performance.now();
      for (let tick = 0; tick < fixture.ticks; tick++) game.step(gameState);
      const elapsed = performance.now() - started;
      if (run >= fixture.warmupRuns) samples.push(elapsed);
      if (gameState.units.length !== fixture.units || gameState.over >= 0) {
        throw new Error('Idle benchmark fixture unexpectedly lost units or ended the match.');
      }
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const round = value => Math.round(value * 1000) / 1000;
    return {
      version:${JSON.stringify(label)},
      simulationMsMedian:round(sorted[Math.floor(sorted.length / 2)]),
      simulationMsSamples:samples.map(round),
      units:gameState.units.length
    };
  })()`, context, { timeout:60000, filename:`${label}-fixture` });
}

try {
  const baseline = process.argv[2]
    ? fs.readFileSync(path.resolve(process.argv[2]), 'utf8')
    : execFileSync('git', ['show', `${baselineCommit}:index.html`], {
        cwd:root, encoding:'utf8', timeout:10000, maxBuffer:10 * 1024 * 1024,
        stdio:['ignore', 'pipe', 'pipe']
      });
  const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  console.log(JSON.stringify({
    node:process.version,
    baseline:process.argv[2] ? path.resolve(process.argv[2]) : baselineCommit,
    fixture,
    results:[measure(baseline, 'before'), measure(current, 'after')]
  }, null, 2));
} catch (error) {
  console.error(`Simulation benchmark failed: ${error.message}`);
  process.exitCode = 1;
}
