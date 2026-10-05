'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf("'use strict';"), end = html.indexOf('function cnv(', start);
const source = `(() => { ${html.slice(start, end)}\n${html.match(/function segDist\([^\n]+/)[0]}\nreturn { newGame, step, spawnUnit, unitY, possStep, advanceGround, startAir, airStep, get MAP(){return MAP;} }; })()`;
const w = vm.runInNewContext(source, { performance }, { timeout:10000 });
const g = w.newGame(['viking', 'rentner'], 4242); g.cd = 0; g.bears = []; g.itemT = 1e9; g.towerOff = [true, true];
w.spawnUnit(g, 0, 4); const u = g.units[0]; u.poss = true; u.dashUntil = 10; g.teams[0].pos = u.id;
function request(ack) {
  g.teams[0].posIn = { id:u.id, x:u.x, z:u.z, y:0, a:0, s:0, j:0, g:0, air:ack, flying:true, av:[4, 0, 1.3, 1, u.y + .2, u.y] };
}
request(1); w.step(g); assert(u.air && u.airAck === 1, 'first predicted flight reaches authority');
let ticks = 0; while (u.air && ticks++ < 100) w.step(g);
assert(!u.air && u.hp > 0, 'first flight lands safely');
const landed = { x:u.x, z:u.z, y:u.y };
request(1); for (let i = 0; i < 30; i++) w.step(g);
assert(!u.air && u.airAck === 1, 'duplicate old flight packets never relaunch');
assert(Math.hypot(u.x - landed.x, u.z - landed.z) < .05, 'stale flying positions cannot pull rider back');
request(2); w.step(g); assert(u.air && u.airAck === 2, 'second predicted flight is accepted after first acknowledgement');
while (u.air && ticks++ < 200) w.step(g);
assert(!u.air && u.airCompleted === 2, 'second flight completes normally');
assert.equal(g.teams[0].posIn.flying, false, 'landing clears stale airborne request');
// A steep vertical face must block both rising and descending bodies.
const m = w.MAP; m.hg.fill(0); m.lift = 0; m.br = []; m.cliff = false;
for (let row = 0; row < m.HHt; row++) for (let col = 0; col < m.HWd; col++) if (col > m.HWd / 2) m.hg[row * m.HWd + col] = 20;
const body = { x:0, z:0, y:0, hp:100 };
w.startAir(body, 20, 0, 5, 'impact'); w.airStep(body, .05);
assert(body.x < 1 && body.y >= 0, 'rising ram victim cannot tunnel beneath high plateau');
console.log('Air/network regression: repeated flights, duplicate packets, landing cleanup and rising wall collision passed.');
