/* Offline WebGL regressions: WVR_THREE_PATH=/path/to/three-r128.min.js node tests/graphics.cjs */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wvr-graphics-'));
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace('window.__wvr = {', 'window.__gfx = { emitFX,puffTick,puffPool,FX_PROFILES,rippleTick,ripples,ripplePool,rippleMesh,waterRipple,clearRipples,waterMotionFX,water,windClock,waterClock,unitShadowRange,camera,mapGroup:()=>mapGroup };\nwindow.__wvr = {');
  const server = http.createServer((request, response) => { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport:{ width:900, height:650 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /THREE|shader|WebGL/.test(m.text())) errors.push(m.text()); });
    if (process.env.WVR_THREE_PATH) await page.route('**/*', route => {
      const u = route.request().url();
      if (u.includes('three.min.js')) return route.fulfill({ path:process.env.WVR_THREE_PATH, contentType:'application/javascript' });
      if (u.startsWith(url) || u.startsWith('data:')) return route.continue();
      return route.abort();
    });
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForFunction(() => !!window.__gfx);
    const report = await page.evaluate(() => {
      const w = window.__wvr, f = window.__gfx, checks = [];
      function check(ok, name) { if (!ok) throw Error(name); checks.push(name); }
      w.setQuality(0); f.puffTick(2);
      const records = new Set(f.puffPool);
      for (const kind of Object.keys(f.FX_PROFILES)) f.emitFX(kind, 0, 2, 0, { dx:1, n:6 });
      check(w.fx.puffs.length > 40, 'All effect profiles emit particles');
      check(w.fx.puffs.every(p => records.has(p)), 'Particle records come from preallocated pool');
      f.puffTick(0.1); check(w.fx.puffs.every(p => Number.isFinite(p.m.matrix.elements[0]) && p.profile), 'Profile motion remains finite');
      for (const kind of Object.keys(f.FX_PROFILES)) f.emitFX(kind, 0, 2, 0, { n:100 });
      check(w.fx.puffs.length <= 192, 'High quality particle cap');
      f.puffTick(2); check(w.fx.puffs.length === 0 && f.puffPool.length === 192, 'All particle records return to pool');
      w.setQuality(2); f.emitFX('explosion', 0, 2, 0, { n:500 });
      check(w.fx.puffs.length <= 48, 'Low quality particle cap');
      f.puffTick(2); f.clearRipples();
      for (let i = 0; i < 100; i++) f.waterRipple(0, 0, 1.5);
      check(f.ripples.length === 10, 'Low quality ripple cap');
      f.rippleTick(0.2); check(f.rippleMesh.count === 10, 'Ripples use shared instanced mesh');
      f.rippleTick(2); check(f.ripples.length === 0 && f.ripplePool.length === 40, 'Ripple records return to pool');
      w.setQuality(0); const unit = w.buildUnit(0); unit.g.position.set(0, 2, 0); w.camS.x = 0; w.camS.z = 0;
      f.unitShadowRange(unit); check(unit.shadowCasters.length > 0 && unit.shadowCasters.every(m => m.castShadow), 'Near unit uses important shadow casters');
      unit.g.position.x = 200; f.unitShadowRange(unit); check(unit.shadowCasters.every(m => !m.castShadow), 'Far unit drops expensive shadow casters');
      w.disposeUnit(unit);
      w.renderer.compile(w.scene, f.camera); w.renderer.render(w.scene, f.camera);
      let ownedMaterials = 0; f.mapGroup().traverse(o => { if (o.material?.userData.mapOwned) ownedMaterials++; });
      check(ownedMaterials > 5, 'Map materials have explicit ownership');
      return { checks, programs:w.renderer.info.programs.length, particleGeometry:w.puffMesh.geometry.type, rippleGeometry:f.rippleMesh.geometry.type };
    });
    await page.waitForTimeout(200);
    assert.deepEqual(errors, []); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); fs.rmSync(scratch, { recursive:true, force:true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
