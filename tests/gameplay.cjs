/* Gameplay and input regressions for the Codex development copy.
 * Run: WVR_THREE_PATH=/path/to/three-r128.min.js node tests/gameplay.cjs
 * The test server exposes existing functions and routes room creation through
 * the real local transport. The production file and public services are untouched.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

function testHtml() {
  const exports = ['startAir', 'airStep', 'ramImpulse', 'startFall', 'possSpecial',
    'iceVelocity', 'iceStep', 'hitBear', 'tameBearStep', 'baseGap', 'baseApproach',
    'baseAttackSlots', 'tutCommand', 'tutEnemySelected', 'tutTick', 'tutSteps',
    'sendCmd', 'setOrderMode', 'endTutorial', 'toMenu', 'processSnap', 'holeAt',
    'genCode', 'leaveNet', 'worldStep', 'puffTick', 'emitFX', 'resetInput'];
  const hooks = exports.map(name => `${name}:typeof ${name}==='function'?${name}:undefined`).join(',');
  return fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace('window.__wvr = {', `window.__wvr = { ${hooks}, camera, CFG, FX_PROFILES, get water(){return water;},`)
    .replace('async function openMulti(code, role) {',
      "async function openMulti(code, role) { return localRoom().join('wvr-' + code);");
}

(async () => {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/' || pathname === '/index.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(testHtml());
      return;
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    try {
      response.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless:true,
    args:['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const errors = [], results = [];
  async function openPage(mobile = false) {
    const context = await browser.newContext({
      viewport:mobile ? { width:390, height:844 } : { width:1280, height:720 },
      hasTouch:mobile, isMobile:mobile, deviceScaleFactor:mobile ? 2 : 1
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /THREE|shader|WebGL/.test(message.text())) errors.push(message.text());
    });
    if (process.env.WVR_THREE_PATH) {
      await page.route('**/*', route => {
        const requestUrl = route.request().url();
        if (requestUrl.includes('three.min.js')) return route.fulfill({ path:process.env.WVR_THREE_PATH, contentType:'application/javascript' });
        if (requestUrl.startsWith(url) || requestUrl.startsWith('data:')) return route.continue();
        return route.abort();
      });
    }
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForFunction(() => !!window.__wvr, {}, { timeout:60000 });
    await page.evaluate(() => {
      window.gameplayChecks = [];
      window.checkGameplay = (condition, name, details) => {
        if (!condition) throw Error(name + (details === undefined ? '' : ' ' + JSON.stringify(details)));
        window.gameplayChecks.push(name);
      };
    });
    return page;
  }
  async function group(page, name, callback) {
    const before = await page.evaluate(() => window.gameplayChecks.length);
    const detail = await page.evaluate(callback);
    const after = await page.evaluate(() => window.gameplayChecks.length);
    results.push({ name, checks:after - before, detail });
    console.log(name + ': ' + (after - before) + ' checks ' + JSON.stringify(detail || {}));
  }
  try {
    const desktop = await openPage();
    await group(desktop, 'Numeric codes and difficulty faces', () => {
      const w = window.__wvr, check = window.checkGameplay;
      const codes = new Set();
      for (let i = 0; i < 1000; i++) { const code = w.genCode(); check(/^\d{6}$/.test(code), 'six digit room code ' + i, code); codes.add(code); }
      check(codes.size > 900, 'room code combination space', codes.size);
      const buttons = [...document.querySelectorAll('.lvl button[data-lvl]')];
      check(buttons.length === 5, 'five bot difficulty cards');
      const faces = buttons.map(button => button.querySelector('.botface'));
      check(faces.every(face => face && face.src.startsWith('data:image/png')), 'every difficulty uses rendered robot portrait');
      check(new Set(faces.map(face => face.src)).size === faces.length, 'difficulty portraits visibly differ');
      const input = document.querySelector('#codeIn');
      input.value = '58a37Z012'; input.dispatchEvent(new Event('input', { bubbles:true }));
      check(input.value === '583701' && input.inputMode === 'numeric', 'numeric input sanitizes and limits code');
      input.value = '';
      return { uniqueCodes:codes.size, faces:faces.length };
    });
    const popups = []; desktop.on('popup', popup => popups.push(popup));
    await desktop.locator('#btnHost').click();
    await desktop.waitForFunction(() => /^\d{6}$/.test(document.querySelector('#codeIn').value));
    await group(desktop, 'Create stays in existing menu', () => {
      const check = window.checkGameplay, input = document.querySelector('#codeIn');
      check(!document.querySelector('#menu').hidden && document.querySelector('#lobby').hidden, 'host keeps original menu visible');
      check(input.readOnly && /^\d{6}$/.test(input.value), 'host code visible in same input');
      check(!document.querySelector('#onlineActions').hidden, 'copy and cancel available');
      check(/Warte/.test(document.querySelector('#onlineStatus').textContent), 'host waits for opponent in menu');
      return { code:input.value };
    });
    assert.equal(popups.length, 0, 'Create does not open another window');
    await desktop.locator('#btnCodeCopy').click();
    await desktop.locator('#btnHostCancel').click();
    await desktop.waitForFunction(() => !document.querySelector('#codeIn').readOnly && !document.querySelector('#btnHost').disabled);

    await group(desktop, 'First tutorial flag requires real movement', () => {
      const w = window.__wvr, check = window.checkGameplay;
      w.startTutorial(false); w.stopSim(); const g = w.G; g.cd = 0;
      w.spawnUnit(g, 0, 0); w.spawnUnit(g, 0, 0);
      const index = w.TUT.steps.findIndex(step => step.id === 'firstFlag');
      check(index >= 0, 'beginner first movement step exists'); w.tutGo(index);
      const stage = w.TUT.steps[index], flag = stage.world();
      const ids = g.units.filter(unit => unit.team === 0).map(unit => unit.id);
      for (let i = 0; i < 240; i++) w.step(g);
      check(!stage.done() && !w.TUT.moveProof, 'idle army cannot pass first movement task');
      check(g.units.every(unit => Math.hypot(unit.x - flag.x, unit.z - flag.z) > w.CFG.flagR), 'first rally remains outside flag checkpoint');
      const one = { t:'order', ids:ids.slice(0, 1), x:flag.x, z:flag.z, m:0 };
      check(w.tutCommand(one) === false, 'first task rejects ordering only one required warrior');
      const order = { ...one, ids };
      check(w.tutCommand(order) !== false, 'first task accepts actual two warrior order');
      w.applyCmd(g, 0, order);
      check(!stage.done(), 'issuing order alone does not complete task');
      let ticks = 0; while (!stage.done() && ticks++ < 1200) w.step(g);
      check(stage.done(), 'first task completes after movement and capture', g.units.map(unit => ({ x:unit.x, z:unit.z, ord:unit.ord })));
      check(w.TUT.moveProof.every(proof => { const unit = g.units.find(u => u.id === proof.id); return Math.hypot(unit.x - proof.x, unit.z - proof.z) >= 4; }), 'required troops visibly displaced');
      w.endTutorial();
      return { ticks };
    });

    async function enemySelection(page, mobile) {
      const projected = await page.evaluate(() => {
        const w = window.__wvr, check = window.checkGameplay;
        w.startTutorial(false); w.stopSim();
        const index = w.TUT.steps.findIndex(step => step.id === 'enemySelect');
        check(index >= 0, 'explicit enemy selection tutorial'); w.tutGo(index);
        const text = document.querySelector('#tutText').textContent, coarse = matchMedia('(pointer:coarse)').matches;
        check(coarse ? /länger gedrückt/.test(text) : /Linksklick/.test(text), 'selection explanation matches input method', text);
        const id = w.TUT.enemyIds[0];
        w.tutEnemySelected(id, coarse ? 'click' : 'longpress');
        check(!w.TUT.steps[index].done(), 'wrong selection method cannot pass tutorial');
        w.V.latest = w.snapOf(w.G); w.V.buf = [w.V.latest]; w.V.offset = performance.now() - w.V.latest.t * 1000; w.V.renderTime = w.V.latest.t; w.V.evT = w.V.latest.t; w.processSnap(w.V.latest);
        const unit = w.V.units.get(id);
        w.TUT.cam = null; w.TUT.camSeq = null;
        Object.assign(w.camS, { x:unit.g.position.x, z:unit.g.position.z + 3, dist:28, pitch:0.8, yaw:0 }); w.applyCam();
        return { ...w.toScreen(unit.g.position.x, unit.g.position.y + 1.1, unit.g.position.z), id };
      });
      assert(projected.vis && projected.x > 0 && projected.y > 0, 'tutorial enemy projected on screen');
      if (mobile) {
        const session = await page.context().newCDPSession(page);
        const point = { x:projected.x, y:projected.y };
        await session.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[point] });
        await page.waitForTimeout(450);
        await session.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
      } else await page.mouse.click(projected.x, projected.y, { button:'left' });
      await page.waitForFunction(id => window.__wvr.TUT.flags.enemySelected === id, projected.id, { timeout:5000 });
      await group(page, (mobile ? 'Touch' : 'Mouse') + ' enemy selection input', () => {
        const w = window.__wvr; window.checkGameplay(w.TUT.flags.enemySelected === w.TUT.enemyIds[0], 'actual pointer input selects required enemy');
        w.endTutorial(); w.resetInput();
        return { method:matchMedia('(pointer:coarse)').matches ? 'longpress' : 'click' };
      });
    }
    await enemySelection(desktop, false);

    await group(desktop, 'Pro tutorial move mode, two Auto targets and counter text', () => {
      const w = window.__wvr, check = window.checkGameplay;
      w.startTutorial(true); w.stopSim(); const g = w.G; g.cd = 0;
      const textOf = stage => typeof stage.t === 'function' ? stage.t() : stage.t;
      check(w.TUT.steps.every(stage => !/Chaos/i.test(textOf(stage))), 'pro tutorial never mentions Chaos');
      w.tutGo(1);
      const index = w.TUT.steps.findIndex(stage => stage.id === 'moveMode');
      check(index >= 0, 'practical move mode step exists'); w.tutGo(index);
      const setup = w.TUT.moveSetup, stage = w.TUT.steps[index], goal = w.FLAGS[setup.flagIndex], ids = setup.units.map(unit => unit.id);
      check(w.V.orderMode === 'attack' && ids.length >= 2, 'move exercise starts from attack mode');
      for (let attempt = 0; attempt < 2; attempt++) {
        const unit = g.units.find(u => u.id === ids[0]); unit.x += 2; unit.vx = 5; unit.path = [[goal.x, goal.z]];
        w.V.selected = new Set(ids); g.flags[setup.flagIndex] = { owner:0, p:1 };
        check(w.tutCommand({ t:'order', ids, x:goal.x, z:goal.z, m:0 }) === false, 'attack mode attempt rejected ' + attempt);
        check(g.units.filter(u => ids.includes(u.id)).every(u => { const initial = setup.units.find(p => p.id === u.id); return u.x === initial.x && u.z === initial.z && !u.path && !u.vx && !u.pj && !u.air; }), 'incorrect attempt restores troop state ' + attempt);
        check(!w.TUT.moveProof && !w.V.selected.size && w.V.orderMode === 'attack', 'incorrect attempt clears mode and movement proof ' + attempt);
        check(JSON.stringify(g.flags[setup.flagIndex]) === JSON.stringify(setup.flag), 'incorrect attempt restores flag state ' + attempt);
        check(/Laufmodus|Laufen/.test(document.querySelector('#tutText').textContent), 'retry explains requested mode ' + attempt);
      }
      check(w.tutCommand({ t:'order', ids, x:goal.x, z:goal.z, m:1 }) === false, 'move packet alone cannot fake active move mode');
      w.setOrderMode('move');
      const order = { t:'order', ids, x:goal.x, z:goal.z, m:1 };
      check(w.tutCommand(order) !== false, 'correct mode plus destination accepted'); w.applyCmd(g, 0, order);
      check(!stage.done(), 'move exercise requires actual travel');
      let ticks = 0; while (!stage.done() && ticks++ < 1400) w.step(g);
      check(stage.done(), 'correct mode completes after all ordered troops reach flag', g.units.filter(u => ids.includes(u.id)).map(u => ({ x:u.x, z:u.z, ord:u.ord })));
      const autoIndex = w.TUT.steps.findIndex(step => step.id === 'twoAuto'); w.tutGo(autoIndex); w.tutTick();
      const autoStage = w.TUT.steps[autoIndex], kinds = w.KINDS.map((kind, k) => ({ kind, k })).filter(x => x.kind.fac === g.teams[0].fac && !x.kind.bear);
      const first = kinds.find(x => x.kind.role === 'melee').k, second = kinds.find(x => x.kind.role === 'ranged').k, other = kinds.find(x => x.kind.role === 'cav').k;
      check(document.querySelectorAll('.spawn[data-slot="0"] .auto.tutGlow,.spawn[data-slot="1"] .auto.tutGlow').length === 2, 'both required Auto buttons highlighted');
      w.applyCmd(g, 0, { t:'auto', k:first, on:true });
      check(!autoStage.done(), 'one Auto cannot complete two Auto task');
      w.applyCmd(g, 0, { t:'auto', k:other, on:true });
      check(!autoStage.done(), 'unrelated second type cannot substitute required Auto');
      w.applyCmd(g, 0, { t:'auto', k:second, on:true }); check(autoStage.done(), 'both requested Auto types complete task');
      const counter = w.TUT.steps.find(step => step.id === 'counterRule');
      check(textOf(counter).startsWith('Unten bei der Einheit steht, gegen welche sie stark ist.'), 'counter rule starts with card display explanation');
      w.endTutorial();
      return { movementTicks:ticks };
    });

    await group(desktop, 'Direct base attack for both factions', () => {
      const w = window.__wvr, check = window.checkGameplay, report = [];
      for (const team of [0, 1]) {
        const g = w.newGame(['viking', 'rentner'], 4242); w.G = g; g.cd = 0; g.bears = []; g.itemT = 1e9; g.towerOff = [true, true];
        const base = w.BASES[1 - team], k = team === 0 ? 0 : 2;
        for (let i = 0; i < 10; i++) {
          w.spawnUnit(g, team, k); const unit = g.units.at(-1), p = w.nw(base.x + (i % 5 - 2) * 2.2, base.z + (team ? -1 : 1) * (13 + Math.floor(i / 5) * 2));
          Object.assign(unit, { x:p.x, z:p.z, y:w.unitY(p.x, p.z), ord:{ x:p.x, z:p.z, mv:false } });
        }
        const ids = g.units.map(unit => unit.id);
        g.teams[1 - team].hp = 100000;
        const healthyBase = g.teams[1 - team].hp;
        w.applyCmd(g, team, { t:'order', ids, x:base.x, z:base.z, m:0, target:-2 });
        check(g.units.every(unit => unit.ord.target === -2), 'base command persists for faction ' + team);
        const attackers = new Set();
        for (let tick = 0; tick < 250 && g.over < 0; tick++) {
          w.step(g); for (const unit of g.units) if (unit.at === -2 && unit.atk > 0) attackers.add(unit.id);
        }
        check(g.teams[1 - team].hp < healthyBase - 150, 'direct melee group damages enemy base ' + team, g.teams[1 - team].hp);
        check(attackers.size >= 8, 'formation members actively attack base ' + team, { attackers:[...attackers], units:g.units.map(u => ({ x:u.x, z:u.z, tgt:u.tgt, slot:u.baseSlot, ord:u.ord })) });
        check(g.units.every(unit => !unit.baseSlot || w.walkable(unit.baseSlot.x, unit.baseSlot.z)), 'base attack slots use valid ground ' + team);
        w.spawnUnit(g, 1 - team, team ? 0 : 2); const distraction = g.units.at(-1), lead = g.units.find(unit => unit.id === ids[0]);
        Object.assign(distraction, { x:lead.x + 3, z:lead.z, hp:10000, tutStill:true, ord:{ x:lead.x + 3, z:lead.z, mv:false } });
        for (let tick = 0; tick < 7; tick++) w.step(g);
        check(g.units.filter(unit => ids.includes(unit.id)).every(unit => unit.ord.target === -2 && unit.tgt === -2), 'nearby enemy does not silently replace explicit base attack ' + team);
        const survivor = g.units[0], away = w.nw(base.x, base.z + (team ? -1 : 1) * 20);
        if (survivor && g.over < 0) { w.applyCmd(g, team, { t:'order', ids:[survivor.id], x:away.x, z:away.z, m:1 }); check(survivor.ord.target !== -2, 'new explicit movement cancels base target ' + team); }
        report.push({ team, attackers:attackers.size, baseDamage:healthyBase - g.teams[1 - team].hp });
      }
      return report;
    });

    await group(desktop, 'Forward ram impulses and ballistic air state', () => {
      const w = window.__wvr, check = window.checkGameplay;
      for (const team of [0, 1]) {
        const g = w.newGame(['viking', 'rentner'], 4242); w.G = g; g.cd = 0; g.bears = []; g.itemT = 1e9; g.towerOff = [true, true];
        const p = w.nw(25, 35), forward = team ? -1 : 1;
        w.spawnUnit(g, team, team ? 5 : 4); const attacker = g.units.at(-1);
        Object.assign(attacker, { x:p.x, z:p.z - forward * 4, y:w.unitY(p.x, p.z - forward * 4), yaw:team ? Math.PI : 0 });
        w.spawnUnit(g, 1 - team, team ? 0 : 2); const centered = g.units.at(-1); Object.assign(centered, { x:p.x, z:p.z, y:w.unitY(p.x, p.z) });
        w.spawnUnit(g, 1 - team, team ? 0 : 2); const oblique = g.units.at(-1); Object.assign(oblique, { x:p.x + 1.8, z:p.z, y:w.unitY(p.x + 1.8, p.z) });
        w.possSpecial(g, attacker, new Map(g.units.map(unit => [unit.id, unit])));
        check(centered.air && centered.air.vz * forward > 5, 'frontal ram has forward air velocity ' + team, centered.air);
        check(Math.abs(centered.air.vx) < centered.air.vz * forward * .1, 'frontal ram has negligible side displacement ' + team, centered.air);
        check(centered.air.vy > 0, 'strong frontal ram includes lift ' + team, centered.air);
        check(oblique.air && oblique.air.vz * forward > Math.abs(oblique.air.vx), 'oblique ram still primarily moves forward ' + team, oblique.air);
        check(Math.abs(oblique.air.vx) > .1, 'oblique ram includes controlled side force ' + team, oblique.air);
        g.units = [centered]; const x = centered.x, z = centered.z, y = centered.y, vx = centered.air.vx, vz = centered.air.vz;
        w.step(g);
        check(Math.abs(centered.x - (x + vx * .05)) < .05 && Math.abs(centered.z - (z + vz * .05)) < .05, 'air movement keeps horizontal momentum ' + team);
        check(centered.y > y && centered.y > w.unitY(centered.x, centered.z), 'terrain navigation does not snap launched target ' + team);
      }
      const g = w.newGame(['viking', 'rentner'], 4242); w.G = g; g.cd = 0; g.bears = []; g.itemT = 1e9; g.towerOff = [true, true];
      const p = w.nw(24, 34); w.spawnUnit(g, 0, 4); const rider = g.units[0];
      Object.assign(rider, { x:p.x, z:p.z, y:w.unitY(p.x, p.z) + 5, ord:{ x:p.x, z:p.z, mv:false } });
      w.startAir(rider, 8, 0, 0, 'dash'); const initial = rider.y; let lastY = initial, airborneTicks = 0;
      while (rider.air && airborneTicks++ < 100) { w.step(g); if (rider.air) { check(rider.y <= lastY + .001, 'gravity descent never warps upwards ' + airborneTicks); lastY = rider.y; } }
      check(!rider.air && rider.hp > 0, 'dash flight lands on lower safe terrain');
      check(rider.x > p.x + 2 && Math.abs(rider.y - w.unitY(rider.x, rider.z)) < .05, 'dash landing ends at actual lower ground');
      return { lowerLandingTicks:airborneTicks };
    });

    await group(desktop, 'Cliff dash and corpse stay below ledge', () => {
      const w = window.__wvr, check = window.checkGameplay;
      const g = w.newGame(['viking', 'rentner'], 72036); w.G = g; g.cd = 0; g.bears = []; g.itemT = 1e9; g.towerOff = [true, true];
      check(w.MAP.cliff, 'cliff terrain fixture');
      let edge;
      for (let x = -65; x <= 65 && !edge; x += 1) for (let z = -65; z <= 65 && !edge; z += 1) {
        if (!w.walkable(x, z)) continue;
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx * 1.3, nz = z + dz * 1.3;
          if (w.fallZone(nx, nz) && w.groundY(x, z) - w.groundY(nx, nz) > 1.5 && w.edgeSlide(nx, nz)) { edge = { x, z, dx, dz }; break; }
        }
      }
      check(edge, 'real walkable cliff edge found');
      w.spawnUnit(g, 0, 4); const rider = g.units[0];
      Object.assign(rider, { x:edge.x, z:edge.z, y:w.unitY(edge.x, edge.z), poss:true, dashS:.42, dfx:edge.dx, dfz:edge.dz });
      g.teams[0].pos = rider.id; const top = rider.y;
      w.beginMatch('ai', ['viking', 'rentner'], 0, 72036); w.stopSim();
      w.V.delay = 0; w.V.latest = w.snapOf(g); w.processSnap(w.V.latest);
      w.step(g); check(rider.air && Math.hypot(rider.air.vx, rider.air.vz) > 20, 'dash leaves actual cliff with speed intact', rider);
      // High-speed dash may legitimately clear this narrow chasm. Exercise
      // that flight separately from a slow, fatal fall into its deep centre.
      for (let i = 0; i < 80 && rider.air; i++) { w.step(g); check(rider.y <= top + .2, 'dash does not return to upper ledge ' + i); }
      check(!rider.air, 'dash reaches a real landing or impact');
      let deep;
      for (let d = 1.3; d <= 14 && !deep; d += .2) { const x = edge.x + edge.dx * d, z = edge.z + edge.dz * d; if (w.fallZone(x, z) && w.unitY(x, z) < top - 4) deep = { x, z }; }
      check(deep, 'deep actual chasm floor found');
      Object.assign(rider, { ...deep, y:top, fy:top, hp:100, air:null, fall:0, falling:false, dashS:0, down:0 });
      w.startFall(rider, edge.dx * 1.5, edge.dz * 1.5);
      let minY = top, previous = rider.y, ticks = 0;
      while (g.units.includes(rider) && ticks++ < 200) {
        w.step(g); minY = Math.min(minY, rider.y);
        if (rider.air && rider.air.vy <= 0) check(rider.y <= previous + .1, 'cliff fall remains descending ' + ticks);
        previous = rider.y;
        const snap = w.snapOf(g); w.pushSnap(snap); w.V.offset = performance.now() - snap.t * 1000; w.V.renderTime = undefined;
        w.processSnap(snap); w.renderUnits(performance.now(), .05);
        const displayed = w.V.units.get(rider.id);
        if (displayed && rider.air) check(displayed.g.position.y < top + .2, 'airborne renderer does not snap to upper terrain ' + ticks);
      }
      check(minY < top - 3, 'fall visibly descends inside chasm', { top, minY, ticks });
      check(!g.units.includes(rider) && rider.hp <= 0, 'fatal cliff fall ends cleanly');
      const corpse = w.V.dying.find(unit => unit.id === rider.id);
      check(!corpse || corpse.g.position.y <= minY + 1, 'corpse never reappears on upper ledge', corpse && { y:corpse.g.position.y, minY, top });
      return { top, minY, ticks, corpseY:corpse?.g.position.y };
    });

    await group(desktop, 'Ice speed, turning, permanent holes and frozen ocean', () => {
      const w = window.__wvr, check = window.checkGameplay;
      let seed;
      for (let value = 1000; value < 1300; value++) if (w.genMap(value).type === 'arktis') { seed = value; break; }
      check(seed !== undefined, 'arctic map seed found');
      const g = w.newGame(['viking', 'rentner'], seed); w.G = g; g.cd = 0; g.bears = []; g.bearQ = null; g.itemT = 1e9; g.towerOff = [true, true];
      let ice;
      for (let x = -65; x < 65 && !ice; x += 1) for (let z = -65; z < 65 && !ice; z += 1) if (w.onIce(x, z) && w.walkable(x, z)) ice = { x, z };
      check(ice, 'ice movement fixture');
      for (const kind of [0, 2, 4, 5]) {
        const speed = w.KINDS[kind].speed, unit = { ...ice, ivx:0, ivz:0 };
        for (let frame = 0; frame < 60; frame++) w.iceVelocity(unit, speed, 0, 1/60);
        check(Math.hypot(unit.ivx, unit.ivz) > speed * 1.35, 'ice raises maximum speed kind ' + kind, unit);
        const previousSpeed = Math.hypot(unit.ivx, unit.ivz);
        w.iceVelocity(unit, -speed, 0, 1/60);
        check(unit.ivx > 0 && Math.abs(unit.ivz) > .01, 'ice turn retains momentum kind ' + kind, unit);
        w.iceVelocity(unit, 0, 0, .1);
        check(Math.hypot(unit.ivx, unit.ivz) > previousSpeed * .85, 'ice low friction preserves coasting kind ' + kind, unit);
      }
      check(!w.inWater(ice.x, ice.z), 'intact frozen water avoids water speed penalty');
      const dropped = { ...ice }; w.breakIce(g, dropped); const hole = g.holes[0], id = hole.id;
      w.breakIce(g, { ...ice }); check(g.holes.length === 1, 'same ice cell collapses once');
      for (let tick = 0; tick < 2400; tick++) w.iceStep(g);
      check(g.holes.some(entry => entry.id === id) && w.holeAt(ice.x, ice.z), 'hole remains after two simulated minutes');
      check(w.inWater(ice.x, ice.z), 'persistent hole exposes real water');
      w.spawnUnit(g, 0, 0); const entrant = g.units[0]; Object.assign(entrant, { ...ice, down:0, hp:130 });
      w.iceStep(g); check(entrant.inHole && entrant.hp < 130, 'later unit interacts with old hole');
      check(w.snapOf(g).ih.some(entry => entry[0] === id), 'permanent hole included in network snapshot');
      w.beginMatch('ai', ['viking', 'rentner'], 0, seed); w.stopSim();
      check(!w.water.visible, 'arctic ordinary water mesh hidden');
      let frozen; w.scene.traverse(object => { if (object.userData.frozenOcean) frozen = object; });
      check(frozen && frozen.visible, 'frozen surface covers ocean outside playable sheet');
      check(frozen.geometry.parameters.width >= 900 && frozen.geometry.parameters.height >= 900, 'frozen ocean matches entire visible water extent');
      w.V.latest = w.snapOf(g); w.updateWorld(.016);
      check(w.WV().holes.has(id), 'persistent hole remains visible after map rebuild');
      check(w.WV().holeLayers.layers.every(layer => layer.im.visible && layer.im.count === 1), 'persistent hole surface and cracks remain rendered');
      return { seed, hole:id, iceKinds:4 };
    });

    await group(desktop, 'Bear collapse, conversion and delayed ally activation', () => {
      const w = window.__wvr, check = window.checkGameplay;
      const report = [];
      for (const team of [0, 1]) {
        const g = w.newGame(['viking', 'rentner'], 4242); w.G = g; g.cd = 0; g.bears = []; g.bearQ = null; g.itemT = 1e9; g.towerOff = [true, true];
        const p = w.nw(24, 35), bear = { id:50 + team, ...p, hx:p.x, hz:p.z, yaw:0, cd:0, atk:0, mv:0, wt:5, hp:520, mhp:520 };
        w.beginMatch('ai', ['viking', 'rentner'], 0, 4242); w.stopSim();
        g.bears.push(bear); w.hitBear(g, bear, 1000, team, -1);
        check(bear.hp === 0 && bear.tameTeam === team && g.bears.includes(bear), 'defeated bear remains neutral during collapse ' + team);
        check(g.units.length === 0 && !(g.bevS > 0), 'bear is not ally immediately on defeat ' + team);
        w.step(g); let state = w.snapOf(g).br.find(entry => entry[6] === bear.id);
        check(state && state[7] > 0 && state[8] === team + 1, 'network includes defeat stage and future team ' + team, state);
        for (let tick = 0; tick < 11; tick++) w.step(g);
        check(bear.tameT < .65 && g.units.length === 0, 'collapse finishes before conversion starts ' + team, bear.tameT);
        w.V.latest = w.snapOf(g); w.V.offset = performance.now() - g.t * 1000; w.updateWorld(.016);
        let view = w.WV().bears.find(entry => entry.id === bear.id);
        check(view && Math.abs(view.body.rotation.z) > .7 && !view.aura.visible, 'bear visibly collapses before team aura ' + team);
        for (let tick = 0; tick < 20; tick++) w.step(g);
        check(bear.tameT > .65 && bear.tameT < 1.65 && g.units.length === 0, 'visible conversion still excluded from active units ' + team, bear.tameT);
        w.V.latest = w.snapOf(g); w.V.offset = performance.now() - g.t * 1000; w.updateWorld(.016);
        view = w.WV().bears.find(entry => entry.id === bear.id);
        check(view && view.aura.visible && Math.abs(view.body.rotation.z) > .7, 'team conversion effect begins while bear is down ' + team);
        for (let tick = 0; tick < 10; tick++) w.step(g);
        check(bear.tameT >= 1.65 && bear.tameT < 2.25 && g.units.length === 0, 'stand-up stage still inactive ' + team, bear.tameT);
        w.V.latest = w.snapOf(g); w.V.offset = performance.now() - g.t * 1000; w.updateWorld(.016);
        view = w.WV().bears.find(entry => entry.id === bear.id);
        check(view && Math.abs(view.body.rotation.z) < .7, 'bear visibly rises after conversion ' + team);
        for (let tick = 0; tick < 7; tick++) w.step(g);
        const ally = g.units.find(unit => unit.team === team && w.KINDS[unit.k].bear);
        check(ally && !g.bears.includes(bear) && g.bevS === 1, 'bear becomes ally exactly after stand-up ' + team);
        check(w.KINDS[ally.k].fac === g.teams[team].fac && ally.hp > 0, 'tamed bear belongs to correct faction ' + team);
        report.push({ team, tameSeconds:bear.tameT, kind:ally.k });
      }
      return report;
    });

    const mobile = await openPage(true);
    assert(await mobile.evaluate(() => matchMedia('(pointer:coarse)').matches), 'mobile context has actual coarse input');
    await enemySelection(mobile, true);
    await group(mobile, 'Mobile particle and HUD budget', () => {
      const w = window.__wvr, check = window.checkGameplay;
      w.endTutorial(); w.stopSim(); w.setQuality(2);
      const g = w.newGame(['viking', 'rentner'], 4242); w.G = g; g.cd = 0; g.bears = []; g.itemT = 1e9; g.towerOff = [true, true];
      w.beginMatch('ai', ['viking', 'rentner'], 0, 4242);
      for (let team = 0; team < 2; team++) for (let i = 0; i < 35; i++) w.spawnUnit(g, team, team ? 2 : 0);
      w.V.latest = w.snapOf(g); w.processSnap(w.V.latest);
      const geometryBefore = w.renderer.info.memory.geometries;
      for (const kind of ['dust', 'land', 'dash', 'pad', 'hit', 'explosion', 'water', 'ice', 'building', 'tame']) {
        w.puffTick(2); w.emitFX(kind, 0, 2, 0, { dx:1, dz:0 });
        check(w.fx.puffs.length > 0 && w.fx.puffs.every(particle => particle.profile === w.FX_PROFILES[kind]), 'distinct pooled effect profile ' + kind);
      }
      for (let burst = 0; burst < 1000; burst++) w.puff(0, 2, 0, burst % 2 ? 0xffaf40 : 0x99ddff, 16, 1.5);
      check(w.fx.puffs.length <= 48 && w.puffMesh.isInstancedMesh, 'mobile battle effects stay in single bounded particle pool', w.fx.puffs.length);
      w.puffTick(.016);
      check(w.renderer.info.memory.geometries <= geometryBefore + 1, 'particle storms do not allocate hundreds of geometries');
      const shadowState = w.renderer.shadowMap.enabled; w.renderer.shadowMap.enabled = false;
      w.puffMesh.visible = false; w.renderer.info.reset(); w.renderer.render(w.scene, w.camera); const before = w.renderer.info.render.calls;
      w.puffMesh.visible = true; w.renderer.info.reset(); w.renderer.render(w.scene, w.camera); const after = w.renderer.info.render.calls;
      w.renderer.shadowMap.enabled = shadowState;
      check(after - before === 1, 'complete mobile particle storm adds exactly one draw call', { before, after });
      check(w.renderer.getPixelRatio() <= .8, 'mobile low tier retains resolution limit');
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const army = document.querySelector('#pop')?.closest('.panel'), controls = [...document.querySelectorAll('#hud .fsBtn,#hud .muteBtn,#menuBtn')].filter(button => !button.hidden);
      check(army, 'mobile army panel exists');
      const rect = army.getBoundingClientRect();
      check(controls.every(control => !overlaps(rect, control.getBoundingClientRect())), 'mobile army panel and top controls do not overlap');
      return { units:g.units.length, particles:w.fx.puffs.length, quality:w.PERF.level };
    });
    await mobile.screenshot({ path:'/tmp/wvr-gameplay-mobile.png' });
    assert.deepEqual(errors, [], 'no JavaScript or shader errors');
    console.log(JSON.stringify({ groups:results, checks:results.reduce((sum, group) => sum + group.checks, 0), browserErrors:errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
