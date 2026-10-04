/* Run: WVR_THREE_PATH=/path/to/three-r128.min.js node tests/browser.cjs
   Requires Playwright and Chromium; CDN scripts can be supplied offline. */
const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((q,r)=>{const pathname=new URL(q.url,'http://localhost').pathname;const file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)){r.writeHead(403);return r.end();}try{r.setHeader('Content-Type',file.endsWith('.json')?'application/json':'text/html');r.end(fs.readFileSync(file));}catch{r.writeHead(404);r.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const context=await browser.newContext();const errors=[];
 async function page(size){const p=await context.newPage();await p.setViewportSize(size);if(size.width<500){const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});}p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text());});if(process.env.WVR_THREE_PATH)await p.route('**/*',route=>{const u=route.request().url();if(u.includes('three.min.js'))return route.fulfill({path:process.env.WVR_THREE_PATH,contentType:'application/javascript'});if(u.startsWith(url)||u.startsWith('data:'))return route.continue();return route.abort();});await p.goto(url,{waitUntil:"domcontentloaded",timeout:60000});await p.waitForFunction(()=>!!window.__wvr);return p;}
 try{
 const desktop=await page({width:1280,height:720});
 const result=await desktop.evaluate(()=>{
  const w=window.__wvr,tests=[];function check(ok,name,extra){if(!ok)throw Error(name+' '+JSON.stringify(extra));tests.push(name);}
  const fresh=seed=>{const g=w.newGame(['viking','rentner'],seed);g.cd=0;g.towerOff=[true,true];g.itemT=1e9;g.bears=[];return g;};
  for(const seed of [4242,1001,1017,1025]){
   let g=fresh(seed);check(w.MAP.pads.length>0,'pads generated '+seed);
   for(let pi=0;pi<w.MAP.pads.length;pi++){
    g=fresh(seed);const pd=w.MAP.pads[pi];
    w.spawnUnit(g,0,4);const u=g.units[0];Object.assign(u,{x:pd.x,z:pd.z,ord:{x:pd.x,z:pd.z,mv:true}});
    for(let i=0;i<4;i++)w.step(g);check(!!u.pj,'rider launched '+seed+'/'+pi);
    const j={...u.pj};let peak=u.y;
    while(u.pj){w.step(g);if(u.pj){const k=u.pj.t/1.75;check(Math.abs(u.x-(j.sx+(j.tx-j.sx)*k))<1e-7,'unperturbed flight '+seed+'/'+pi+'/'+k.toFixed(2));peak=Math.max(peak,u.y);}}
    check(peak>Math.max(w.groundY(j.sx,j.sz),w.groundY(j.tx,j.tz))+8,'high arc '+pi);
    check(Math.hypot(u.x-j.tx,u.z-j.tz)<0.02,'landing '+pi);
    for(let i=0;i<80;i++)w.step(g);check(Math.hypot(u.x-j.tx,u.z-j.tz)<1,'pad order consumed '+pi);
    // Repeat use after cooldown without stale waypoints.
    Object.assign(u,{x:pd.x,z:pd.z,ord:{x:pd.x,z:pd.z,mv:true}});for(let i=0;i<5;i++)w.step(g);check(!!u.pj,'repeat launch '+pi);
   }
  }
  // All batched rigs retain animated joints and release uniquely owned debris.
  for(let kind=0;kind<w.KINDS.length;kind++){const rig=w.buildUnit(kind);rig.walk=0;rig.atkT=9;for(let i=0;i<5;i++)w.animateRig(rig,1/60,true,i%2===0);check(Number.isFinite(rig.rig.rotation.x),'animated rig '+kind);w.disposeUnit(rig);}
  const dropped=w.buildUnit(5);w.scene.add(dropped.g);let disposed=0,owned=0;dropped.rol.traverse(o=>{if(o.userData.ownedGeometry){owned++;o.geometry.addEventListener('dispose',()=>disposed++);}});w.dropPart(dropped.rol,0,0,0,0);w.debrisTick(7);check(owned>0&&disposed===owned,'dropped unique geometry released');w.disposeUnit(dropped);
  // Packet-loss recovery: a possessed player can miss the entire flight.
  let recovery=fresh(4242),recoveryPad=w.MAP.pads[0];w.spawnUnit(recovery,0,4);const recoveryUnit=recovery.units[0];Object.assign(recoveryUnit,{x:recoveryPad.x,z:recoveryPad.z,poss:true});recovery.teams[0].pos=recoveryUnit.id;
  for(let i=0;i<4;i++)w.step(recovery);while(recoveryUnit.pj)w.step(recovery);
  w.aiThink(recovery,0);check(recovery.teams[0].posIn?.pad===recoveryUnit.padAck,'AI possession acknowledges landing');const aiBefore={x:recoveryUnit.x,z:recoveryUnit.z};w.step(recovery);check(Math.hypot(recoveryUnit.x-aiBefore.x,recoveryUnit.z-aiBefore.z)>.001,'AI possession moves after landing');
  w.G=recovery;w.beginMatch('ai',['viking','rentner'],0,4242);const recoverySnap=w.snapOf(recovery);w.V.latest=recoverySnap;w.V.poss={id:recoveryUnit.id,k:4,x:recoveryPad.x,z:recoveryPad.z};w.updateWorld(0);
  check(w.V.poss.padAck===recoveryUnit.padAck&&Math.hypot(w.V.poss.x-recoveryUnit.x,w.V.poss.z-recoveryUnit.z)<.1,'missed-flight landing acknowledgement');w.V.poss=null;
  w.V.buf=[];w.V.offset=performance.now()-10000;w.V.renderTime=8;w.pushSnap({...recoverySnap,t:1});check(w.V.renderTime===undefined,'render clock resets after long stall');w.V.renderTime=100;w.renderUnits(performance.now(),.016);check(w.V.renderTime<=1,'render clock bounded by available states');
  // A directed connection must be part of the actual route to the opposite bank.
  for(const seed of [4242,1001]){let g=fresh(seed);for(const [pi,pd]of w.MAP.pads.entries()){
   const dx=pd.tx-pd.x,dz=pd.tz-pd.z,d=Math.hypot(dx,dz);const start=w.nw(pd.x-dx/d*4,pd.z-dz/d*4),goal=w.nw(pd.tx+dx/d*4,pd.tz+dz/d*4);
   const path=w.findPath(start.x,start.z,goal.x,goal.z);check(path&&path.some(p=>p[2]===pi),'directed navigation '+seed+'/'+pi,path);
   g.units=[];g.padSt=null;w.spawnUnit(g,0,0);const u=g.units[0];Object.assign(u,{x:start.x,z:start.z,ord:{x:goal.x,z:goal.z,mv:true}});let launched=false;
   for(let i=0;i<400;i++){w.step(g);launched ||= !!u.pj;}
   check(launched&&Math.hypot(u.x-goal.x,u.z-goal.z)<1.5,'AI completes route '+seed+'/'+pi,{u,goal});
  }}
  let g=fresh(4242),pd=w.MAP.pads[0];for(let i=0;i<20;i++){w.spawnUnit(g,0,i%2?4:0);const u=g.units.at(-1);Object.assign(u,{x:pd.x+(i%5-2)*0.5,z:pd.z+(Math.floor(i/5)-1.5)*0.45,ord:{x:pd.tx,z:pd.tz,mv:true}});}
  for(let i=0;i<5;i++)w.step(g);check(g.units.filter(u=>u.pj).length===20,'mass launch includes all units');
  const flights=g.units.map(u=>({...u.pj}));for(let i=0;i<15;i++){w.step(g);for(let n=0;n<20;n++){const u=g.units[n],j=flights[n];check(Math.abs(u.x-(j.sx+(j.tx-j.sx)*u.pj.t/1.75))<1e-7,'mass flight collision isolation '+i+'/'+n);}}
  g=fresh(4242);pd=w.MAP.pads[0];for(let i=0;i<20;i++){w.spawnUnit(g,0,0);const u=g.units.at(-1);u.x=pd.x;u.z=pd.z;}
  w.applyCmd(g,0,{t:'order',ids:g.units.map(u=>u.id),x:pd.x,z:pd.z,m:1});for(let i=0;i<4;i++)w.step(g);check(g.units.every(u=>u.pj),'commander mass pad command');
  for(let i=0;i<90;i++)w.step(g);check(g.units.every(u=>Math.hypot(u.ord.x-pd.x,u.ord.z-pd.z)>8),'commander old targets consumed');
  const noJump=w.findPath(pd.x,pd.z,pd.tx,pd.tz,false);check(!noJump||noJump.every(p=>p[2]===undefined),'siege routes do not use pads');
  // Skyborne attackers stay out of ground separation; server ignores stale landing input.
  g=fresh(4242);pd=w.MAP.pads[0];w.spawnUnit(g,1,4);const rider=g.units[0];Object.assign(rider,{x:pd.x,z:pd.z,poss:true});g.teams[1].pos=rider.id;g.teams[1].posIn={id:rider.id,x:pd.x,z:pd.z,y:0,a:0,s:0,j:0,g:0};for(let i=0;i<4;i++)w.step(g);while(rider.pj)w.step(g);const landed={x:rider.x,z:rider.z};g.teams[1].posIn={...g.teams[1].posIn,x:landed.x,z:landed.z-2,pad:0};w.step(g);check(Math.hypot(rider.x-landed.x,rider.z-landed.z)<1e-7,'stale landing input rejected');g.teams[1].posIn.pad=rider.padAck;w.step(g);check(Math.abs(rider.z-(landed.z-2))<0.01,'acknowledged landing input accepted');
  for(let seed=1001;seed<1065;seed++){const m=w.genMap(seed);w.setMap(m);if(m.type==='wiesen'){check(!m.cliff&&!m.lift&&!m.crev.length,'safe meadow '+seed);check(m.hg.every(Number.isFinite),'finite terrain '+seed);}}
  w.G=fresh(4242);w.beginMatch('ai',['viking','rentner'],0,4242);
  const v=w.PADV()[0],dir=new w.THREE_.Vector3(v.g.position.x-w.MAP.pads[0].tx,0,v.g.position.z-w.MAP.pads[0].tz).negate().normalize();
  v.g.updateMatrixWorld(true);const normal=new w.THREE_.Vector3(0,0,1).transformDirection(v.g.matrixWorld);check(normal.dot(dir)>0.999,'pad local +z equals flight direction');
  const a=v.arr.geometry.attributes.position;let tip=-Infinity,tail=Infinity;for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i))<0.001){tip=Math.max(tip,a.getZ(i));}for(let i=0;i<a.count;i++)tail=Math.min(tail,a.getZ(i));check(tip>1&&tail<-.8,'arrow tip points forward');
  for(let i=0;i<1000;i++)w.puff(0,2,0,0xffffff,8);check(w.fx.puffs.length<=192,'bounded particle pool');w.setQuality(2);check(w.renderer.getPixelRatio()<=.8&&!w.scene.children.find(o=>o.isDirectionalLight).castShadow,'low quality budget');w.setQuality(0);
  w.setQuality(1);w.PERF.acc=0;w.PERF.n=0;w.PERF.t=0;for(let i=0;i<42;i++)w.perfTick(.4);check(w.PERF.level===2,'very slow visible frames lower quality');w.setQuality(0);
  // Exercise actual ego physics, with the same river points for every speed mode.
  w.G=fresh(4242);w.beginMatch('ai',['viking','rentner'],0,4242);
  const s=w.snapOf(w.G);s.ch=true;s.pk=[{},{}];w.V.latest=s;
  let land,water;for(let z=-65;z<65;z+=2)for(let x=-65;x<65;x+=2){if(!w.walkable(x,z)||!w.walkable(x+.5,z))continue;if(w.inWater(x,z)&&w.inWater(x+.5,z)&&!water)water={x,z};if(!w.inWater(x,z)&&!w.wadeAt(x,z)&&!land)land={x,z};}
  check(land&&water,'land and river physics fixtures');
  function velocity(at,turbo,dash,drag){s.pk[0].turbo=turbo;w.V.poss={id:999,k:4,x:at.x,z:at.z,camYaw:Math.PI/2,pitch:.16,a:0,s:0,cdT:0,spT:0,dashT:dash?1:0,rageT:0,t0:performance.now(),confirmed:true,waterDrag:drag,fy:w.unitY(at.x,at.z)};w.EG.joy={dx:0,dy:-1};w.egoUpdate(1/120);return Math.hypot(w.V.poss.x-at.x,w.V.poss.z-at.z)*120;}
  const normalLand=velocity(land,0,false),normalWater=velocity(water,0,false),turboLand=velocity(land,1,false),turboWater=velocity(water,1,false),dashLand=velocity(land,0,true),dashWater=velocity(water,0,true),transition=velocity(water,1,false,1);
  check(normalWater<normalLand&&turboWater>normalWater&&turboWater<turboLand,'turbo retains water resistance',{normalLand,normalWater,turboLand,turboWater});
  check(dashWater<dashLand&&dashWater>normalWater,'rider dash retains water resistance');check(transition>turboWater&&transition<turboLand,'water entry slows smoothly');w.V.poss=null;w.EG.joy=null;w.V.latest=w.snapOf(w.G);
  return {count:tests.length,groups:['single/rider/repeated/both directions','AI navigation and continuation','20-unit flights','stale input acknowledgement','64 seeded maps','arrow transform','particle bounds','quality tiers']};
 });console.log('Regression:',JSON.stringify(result));
 await desktop.waitForTimeout(500);await desktop.screenshot({path:'/tmp/wvr-after.png'});assert.deepEqual(errors,[]);

 // Two real browser pages exchange production snapshots and commands over BroadcastChannel.
 // Latency is injected at the host's transport boundary; public STUN/TURN is not needed here.
 console.log("Starting mobile window"); const mobile=await page({width:390,height:844}); console.log("Both windows loaded");assert(await mobile.evaluate(()=>matchMedia('(pointer:coarse)').matches),'mobile touch mode enabled');
 await desktop.evaluate(async()=>{const w=window.__wvr;w.stopSim();w.G=w.newGame(['viking','rentner'],4242);const g=w.G;g.cd=0;g.towerOff=[true,true];g.itemT=1e9;g.bears=[];w.beginMatch('host',['viking','rentner'],0,4242);
  for(let team=0;team<2;team++)for(let i=0;i<35;i++)w.spawnUnit(g,team,team?2:0);
  w.spawnUnit(g,1,5);const u=g.units.at(-1),pd=w.MAP.pads[0],dx=pd.tx-pd.x,dz=pd.tz-pd.z,d=Math.hypot(dx,dz);Object.assign(u,{x:pd.x-dx/d*4,z:pd.z-dz/d*4,ord:{x:pd.tx,z:pd.tz,mv:true}});window.testRider=u.id;
  const r=await w.localRoom().join('regression');const send=r.presence.bind(r);let deliver=0;window.netMetrics={packets:0,bytes:0};r.presence=patch=>{window.netMetrics.packets++;window.netMetrics.bytes+=JSON.stringify(patch).length;const t=performance.now();deliver=Math.max(deliver+1,t+80+(window.netMetrics.packets%4)*15);return new Promise(resolve=>setTimeout(()=>send(patch).then(resolve),deliver-t));};w.NET.r=r;w.NET.role='host';w.NET.code='TEST';w.NET.p2p=true;
 });
 await mobile.evaluate(async()=>{const w=window.__wvr;w.NET.r=await w.localRoom().join('regression');w.NET.role='guest';w.NET.code='TEST';w.NET.p2p=true;w.beginMatch('guest',['viking','rentner'],1,4242);await w.NET.r.presence({role:'guest',code:'TEST',cmds:[]});window.received=0;window.maxUnits=0;window.seenFlight=false;let last=-1;window.testPoll=setInterval(()=>{const host=w.NET.r.peers().find(p=>!p.isMe&&p.presence.role==='host');if(host&&host.presence.snap&&host.presence.snap.t!==last){const s=host.presence.snap;last=s.t;window.received++;window.maxUnits=Math.max(window.maxUnits,s.u.length);window.seenFlight ||= s.pj.length>0;w.pushSnap(s);} },20);});
 await desktop.evaluate(()=>window.__wvr.startSim(false));
 await mobile.waitForFunction(()=>window.received>4,{},{timeout:30000});console.log('Packets arriving');
 await mobile.evaluate(()=>{const w=window.__wvr,s=w.V.latest,unit=s.u.find(u=>u[1]===5);if(!unit)throw Error('missing rider');window.remoteRider=unit[0];});
 await mobile.waitForFunction(()=>window.seenFlight,{},{timeout:20000});
 await mobile.waitForFunction(()=>window.seenFlight&&window.__wvr.V.latest.pj.length===0,{},{timeout:20000});
 const net=await mobile.evaluate(()=>({received:window.received,maxUnits:window.maxUnits,flight:window.seenFlight,delay:window.__wvr.V.delay,unitsDrawn:window.__wvr.V.units.size}));console.log('Two-window latency:',JSON.stringify(net));assert(net.received>4&&net.maxUnits===71&&net.flight,'complete armies and jump state received');
 await mobile.evaluate(()=>{const w=window.__wvr;const u=w.V.units.get(window.remoteRider);w.V.selected=new Set([u.id]); w.enterEgo();});
 await mobile.waitForTimeout(500);const beforeMove=await desktop.evaluate(()=>{const u=window.__wvr.G.units.find(u=>u.id===window.testRider);return{x:u.x,z:u.z};});await mobile.evaluate(()=>{window.__wvr.EG.joy={dx:0,dy:-1};});await mobile.waitForTimeout(1500);await mobile.evaluate(()=>{window.__wvr.EG.joy=null;});await mobile.waitForTimeout(300);
 const local=await mobile.evaluate(()=>({id:window.__wvr.V.poss?.id,moving:window.__wvr.V.poss?.moving,padAck:window.__wvr.V.poss?.padAck}));assert(local.id,'mobile ego controls start');
 const afterMove=await desktop.evaluate(()=>{const u=window.__wvr.G.units.find(u=>u.id===window.testRider);return{x:u.x,z:u.z};});console.log('Movement',JSON.stringify({beforeMove,afterMove,local,host:await desktop.evaluate(()=>({pos:window.__wvr.G.teams[1].pos,input:window.__wvr.G.teams[1].posIn}))}));assert(Math.hypot(afterMove.x-beforeMove.x,afterMove.z-beforeMove.z)>0.2,'remote mobile input moves authoritative rider after landing');console.log('Network packets:',await desktop.evaluate(()=>window.netMetrics));
 await mobile.screenshot({path:'/tmp/wvr-mobile.png'});await mobile.evaluate(()=>{clearInterval(window.testPoll);window.__wvr.NET.r.leave();});await desktop.evaluate(()=>{window.__wvr.stopSim();window.__wvr.NET.r.leave();});assert.deepEqual(errors,[]);console.log('Browser errors:',errors);

 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
