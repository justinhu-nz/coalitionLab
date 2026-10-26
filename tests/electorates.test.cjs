// Run with: node tests/electorates.test.cjs
// Evaluates electorates.html's engine block (between ==ENGINE== markers) with its embedded data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=process.argv[2]||path.join(__dirname,'..','ignore me','electorates.html');
const html=fs.readFileSync(file,'utf8');
const data=html.match(/<script type="application\/json" id="seatData">([\s\S]*?)<\/script>/)[1];
const engine=html.slice(html.indexOf('// ==ENGINE=='),html.indexOf('// ==/ENGINE=='));
const ctx={D:JSON.parse(data)};vm.createContext(ctx);vm.runInContext(engine+'\nthis.E={PARTIES,DEFAULT_OPTS,prepSeat,seatPartyVote,forecastSeat,topTwo,allocateHouse,simulate,cand23};',ctx);
const E=ctx.E,D=ctx.D,O=Object.assign({},E.DEFAULT_OPTS,{sims:300});
const P23=D.national23.slice(),PREP=D.seats.map(E.prepSeat);
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name)}

test('71 seats: 64 general + 7 Māori, notional 2023 sums to the official national result',()=>{
  assert.equal(D.seats.length,71);assert.equal(D.seats.filter(s=>s.m).length,7);
  const nat=D.national23;assert.ok(Math.abs(nat[0]-38.08)<.01&&Math.abs(nat[1]-26.92)<.01,String(nat));
});
test('2023 poll leaves every seat\'s party vote unchanged',()=>{
  D.seats.forEach(s=>E.seatPartyVote(s,P23,O).forEach((v,i)=>assert.ok(Math.abs(v-s.p[i])<.02,s.n)));
});
test('2023 poll + 2023 field reproduces every notional 2023 candidate share',()=>{
  PREP.filter(ps=>!ps.seat.i).forEach(ps=>{const v=E.forecastSeat(ps,P23,O,true);
    Object.keys(ps.resid).forEach(k=>assert.ok(Math.abs(v[k]-ps.c23[k]*100/Object.keys(ps.resid).reduce((a,b)=>a+ps.c23[b],0))<1e-6,ps.seat.n+' '+k))});
});
test('Forecast shares are non-negative and sum to 100 for every seat and option set',()=>{
  [O,Object.assign({},O,{mix:0,retireKeep:0,switchKeep:1}),Object.assign({},O,{mix:1})].forEach(o=>
    [P23,[25,31,14,9,9,2,8,2]].forEach(poll=>PREP.forEach(ps=>{const v=E.forecastSeat(ps,poll,o);const t=Object.values(v).reduce((a,b)=>a+b,0);
      assert.ok(Math.abs(t-100)<1e-9,ps.seat.n);Object.values(v).forEach(x=>assert.ok(x>=0))})));
});
test('2023 notional winners on 2023 votes give the 2023 House: 122 seats, TPM +2 overhang',()=>{
  const elect={};PREP.forEach(ps=>{const w=E.topTwo(ps.c23).w;elect[w]=(elect[w]||0)+1});
  const h=E.allocateHouse(P23,elect,O);
  assert.equal(h.house,122);assert.equal(h.total.NAT,48);assert.equal(h.total.LAB,34);assert.equal(h.total.GRN,15);assert.equal(h.total.ACT,11);assert.equal(h.total.NZF,8);assert.equal(h.total.TPM,6);assert.equal(h.overBy.TPM,2);
});
test('Electorate party with no list votes is overhang; independents take a seat off the top',()=>{
  const poll=[40,40,0,0,0,0,0,20];
  let h=E.allocateHouse(poll,{NAT:30,LAB:30,TTT:1},O);assert.equal(h.overBy.TTT,1);assert.equal(h.house,121);
  h=E.allocateHouse(poll,{NAT:30,LAB:30,IND:1},O);assert.equal(h.house,120);assert.equal(h.total.NAT+h.total.LAB,119);
});
test('Simulation: every seat has N outcomes and overrides are respected',()=>{
  const r=E.simulate(PREP,[28,28,14,10,9,2,7,2],O,{'Ilam':'LAB'});
  r.wins.forEach(w=>assert.equal(Object.values(w).reduce((a,b)=>a+b,0),O.sims));
  assert.equal(r.wins[D.seats.findIndex(s=>s.n==='Ilam')].LAB,O.sims);
  assert.ok(r.pNatOver>=0&&r.pNatOver<=1);
});
test('Special cases: Port Waikato has no candidate effect; party-switching MPs get their own bucket',()=>{
  const pw=PREP.find(ps=>ps.seat.n==='Port Waikato');Object.values(pw.resid).forEach(v=>assert.equal(v,0));
  assert.equal(PREP.find(ps=>ps.seat.n==='Te Tai Tokerau').special,'TTT');
  assert.equal(PREP.find(ps=>ps.seat.n==='Te Tai Tonga').special,'IND');
});
console.log(checks+' checks passed.');
