// Run with: node tests/forecast.test.cjs
// Checks forecast.html shares index-old.html's seat engine (the pre-election calculator) and that its outcome model gives the hand-worked results.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index-old.html'),'utf8'),forecast=fs.readFileSync(path.join(root,'forecast.html'),'utf8');
const script=html=>html.match(/<script>([\s\S]*)<\/script>/)[1];
const fjs=script(forecast);
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name)}

test('the whole page script parses',()=>{assert.doesNotThrow(()=>new Function(fjs))});

test('forecast.html carries an exact copy of the shared engine',()=>{
 const ijs=script(index),start='// ---- shared data + engine';
 const fromIndex=ijs.slice(ijs.indexOf(start),ijs.indexOf('function loadState(')).trimEnd();
 const fromForecast=fjs.slice(fjs.indexOf(start),fjs.indexOf('// ---- end shared engine ----')).trimEnd();
 assert.ok(fromIndex.length>1000);assert.equal(fromForecast,fromIndex);
});

// new Function rather than vm: the model runs thousands of allocations and vm global lookups are slow.
const m=new Function(fjs.slice(fjs.indexOf('var ROSTER='),fjs.indexOf('// ---- end forecast model ----'))+';return{simulate:simulate,pollAverage:pollAverage,evaluate:evaluate,pollWeights:pollWeights,POLLS:POLLS,MAORI:MAORI,MAORI_FC:MAORI_FC,GENERAL:GENERAL,E23:E23,natGeneralWins:natGeneralWins,adjustedPoll:adjustedPoll,HOUSE_EFFECTS:HOUSE_EFFECTS}')();
const winners=(tpm,rest='Labour')=>Object.fromEntries(m.MAORI.map(x=>[x.seat,tpm.includes(x.seat)?'Te Pāti Māori':rest]));
const sixTpm=winners(m.MAORI.map(x=>x.seat).filter(s=>s!=='Ikaroa-Rāwhiti'));
const v=o=>Object.assign({NAT:0,LAB:0,GRN:0,ACT:0,NZF:0,TPM:0,TOP:0,OTH:0},o);

test('Māori seat assumptions and electorate data line up with the engine',()=>{
 assert.deepEqual(m.MAORI_FC.map(x=>x.seat).sort(),m.MAORI.map(x=>x.seat).sort());
 assert.equal(m.GENERAL.length,64);
});

test('With 2023 party votes and no noise, the electorate model returns National\'s 44 notional general seats',()=>{
 assert.equal(m.natGeneralWins(m.E23,()=>.25),44); // r()=.25 makes every gauss() draw ~0
 const weaker=Object.assign({},m.E23,{NAT:m.E23.NAT-8,NZF:m.E23.NZF+8});
 const kept=m.natGeneralWins(weaker,()=>.25);assert.ok(kept<44&&kept>30,String(kept)); // NZF voters still split for National
});

test('Poll average sums to 100 and gives 1 News and Taxpayers\' Union only a slight bump',()=>{
 const a=m.pollAverage();assert.ok(Math.abs(Object.values(a).reduce((s,x)=>s+x,0)-100)<1e-9);
 const w=m.pollWeights(),same=m.POLLS.findIndex(p=>p.org==='The Post/Freshwater Strategy'),bump=m.POLLS.findIndex(p=>p.org==="Taxpayers' Union–Curia");
 assert.equal(m.POLLS[same].date,m.POLLS[bump].date);
 const ratio=(w[bump]/Math.sqrt(m.POLLS[bump].n))/(w[same]/Math.sqrt(m.POLLS[same].n));assert.ok(ratio>1.05&&ratio<1.15,String(ratio));
});

test('House effects are subtracted per firm, and firms without one are left as published',()=>{
 const verian=m.POLLS.find(p=>p.org==='1 News–Verian'),a=m.adjustedPoll(verian);
 assert.ok(Math.abs(a.NAT-(verian.v.NAT-1.54))<1e-9);assert.ok(Math.abs(a.LAB-(verian.v.LAB-.23))<1e-9);
 const fresh=m.POLLS.find(p=>p.org==='The Post/Freshwater Strategy');assert.equal(m.adjustedPoll(fresh).TOP,fresh.v.TOP);
 const anacta=m.POLLS.find(p=>p.org==='Anacta');assert.equal(m.HOUSE_EFFECTS.Anacta,undefined);assert.equal(m.adjustedPoll(anacta).NAT,anacta.v.NAT);
 m.POLLS.forEach(p=>assert.ok(!m.HOUSE_EFFECTS[p.org]||Object.keys(m.HOUSE_EFFECTS[p.org]).length>=6,p.org));
 const raw=m.pollAverage(true),adj=m.pollAverage();assert.ok(adj.NAT<raw.NAT);assert.ok(Math.abs(Object.values(adj).reduce((s,x)=>s+x,0)-100)<1e-9);
});

test('63–63 with TPM below its first list seat is a deadlock',()=>{
 const f=m.evaluate(v({NAT:30,LAB:28.4,GRN:16.4,ACT:10,NZF:8.4,TPM:.3,TOP:4.9,OTH:1.6}),sixTpm,0);
 assert.equal(f.house,126);assert.equal(f.maj,64);assert.equal(f.L,63);assert.equal(f.R,63);assert.equal(f.b,'hung');
});

test('TOP on 4.9% leaves a left majority; on 5.1% TOP becomes kingmaker',()=>{
 const night=m.evaluate(v({NAT:29.5,LAB:28.8,GRN:16.4,ACT:10,NZF:8.4,TPM:.4,TOP:4.9,OTH:1.6}),sixTpm,0);
 assert.equal(night.L,64);assert.equal(night.house,125);assert.equal(night.b,'left');
 const fin=m.evaluate(v({NAT:29.5,LAB:28.8,GRN:16.4,ACT:10,NZF:8.4,TPM:.4,TOP:5.1,OTH:1.4}),sixTpm,0);
 assert.equal(fin.s.TOP,6);assert.equal(fin.L,62);assert.equal(fin.R,58);assert.equal(fin.maj,64);assert.equal(fin.b,'king');
});

test('Simulation is deterministic for a seed and every run has a night and final outcome',()=>{
 const a=m.simulate(300,7),b=m.simulate(300,7),ok=['left','right','king','hung'];
 assert.deepEqual(a.sims.map(x=>x.f.b),b.sims.map(x=>x.f.b));
 a.sims.forEach(x=>{assert.ok(ok.includes(x.f.b));assert.ok(ok.includes(x.n.b));assert.ok(Math.abs(Object.values(x.v).reduce((s,y)=>s+y,0)-100)<1e-9);assert.equal(Object.values(x.f.s).reduce((s,y)=>s+y,0),x.f.house)});
});

test('A picked Māori seat winner is forced in every run without changing anything else',()=>{
 const base=m.simulate(300,11),forced=m.simulate(300,11,{'Te Tai Tokerau':'TPM'});
 forced.sims.forEach((x,i)=>{const b=base.sims[i];assert.equal(x.w['Te Tai Tokerau'],'Te Pāti Māori');assert.deepEqual(x.v,b.v);assert.equal(x.ne,b.ne);
  Object.keys(b.w).filter(s=>s!=='Te Tai Tokerau').forEach(s=>assert.equal(x.w[s],b.w[s]))});
});

// The whole page script, unwrapped from its IIFE, so the edit helpers and the model share one scope as in the browser.
// With no `document` the page's start-up block is skipped.
const page=()=>new Function(fjs.slice(fjs.indexOf('"use strict";')+13,fjs.lastIndexOf('})();'))+';return{snapshot:snapshot,applyEdits:applyEdits,simulate:simulate,pollAverage:pollAverage,TUNE:TUNE,getN:function(){return N},getAsOf:function(){return AS_OF}}')();

test('Saved edits round-trip: applying a snapshot changes nothing',()=>{
 const p=page(),before=p.snapshot();p.applyEdits(JSON.parse(JSON.stringify(before)));assert.deepEqual(p.snapshot(),before);
 assert.ok(p.TUNE.every(d=>before.tune[d.id]!==undefined),'every dial is in the snapshot');
});

test('Edited dials, seat shares and polls reach the model',()=>{
 const p=page(),base=p.simulate(400,5),tpm=s=>s.sims.filter(x=>x.w['Ikaroa-Rāwhiti']==='Te Pāti Māori').length;
 p.applyEdits({tune:{tpmBias:30,n:5000}});assert.equal(p.getN(),5000);assert.ok(tpm(p.simulate(400,5))>tpm(base)+100,'a big TPM boost wins Ikaroa-Rāwhiti far more often');
 const q=page();q.applyEdits({maori:{'Ikaroa-Rāwhiti':{LAB:10,TPM:90,GRN:0}}});assert.ok(tpm(q.simulate(400,5))>380);
 const r=page(),poll={date:'2026-11-06',org:'Test',n:5000,v:{NAT:40,LAB:20,GRN:10,ACT:10,NZF:8,TPM:1,TOP:5}};
 r.applyEdits({polls:[poll]});assert.equal(r.getAsOf(),'2026-11-06');assert.ok(Math.abs(r.pollAverage(true).NAT-40*100/(94+6))<1e-9);
});

test('Zero-share blocs produce finite simulations in both forecast pages',()=>{
 for(const filename of ['forecast.html','forecast-bold.html']){
  const js=script(fs.readFileSync(path.join(root,filename),'utf8'));
  const model=new Function(js.slice(js.indexOf('var ROSTER='),js.indexOf('// ---- end forecast model ----'))+';return{drawVotes:drawVotes,rng:rng}')();
  for(const avg of [v({NAT:100}),v({LAB:100}),v({TOP:100})]){
   const draw=model.drawVotes(avg,model.rng(7));
   assert.ok(Object.values(draw).every(Number.isFinite),filename);
   assert.ok(Math.abs(Object.values(draw).reduce((a,b)=>a+b,0)-100)<1e-9);
  }
 }
});

console.log(`\n${checks} checks passed`);
