// Run with: node tests/mmp-allocation.test.cjs
// Exercises the standalone page's actual pure calculation functions without a browser dependency.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=process.argv[2]||path.join(__dirname,'..','index.html');
const html=fs.readFileSync(file,'utf8');new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const engine={};vm.createContext(engine);
vm.runInContext(html.slice(html.indexOf('var ROSTER='),html.indexOf('function hemiSeats(')),engine);
vm.runInContext('function vote(n){return parseFloat(st.votes[n])||0}\n'+html.slice(html.indexOf('var SWING_SIDES='),html.indexOf('var lastSwing=')),engine);
const names=Array.from(engine.ROSTER,p=>p.name),allLab=Object.fromEntries(engine.MAORI.map(m=>[m.seat,'Labour']));
const makeVotes=v=>Object.assign(Object.fromEntries(names.map(n=>[n,0])),v);
const state=(votes,winners=allLab)=>({votes:makeVotes(votes),winners,seats:120,thresh:5,coattail:true});
const party=(r,n)=>r.parties.find(p=>p.name===n);
const members=r=>r.parties.reduce((sum,p)=>sum+p.total,0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name)}
test('Independent reserves a seat, creates no overhang, and changes the tie cutoff',()=>{
 const r=engine.compute(state({Labour:50,National:50},{...allLab,'Te Tai Tonga':'Independent'}));
 assert.equal(r.allocationBase,119);assert.equal(r.independentSeats,1);assert.equal(r.house,120);assert.equal(members(r),120);assert.equal(r.overhang,0);assert.equal(party(r,'Independent').overhang,0);assert.equal(party(r,'Independent').list,0);
 assert.equal(r.tie.outcomes.length,2);r.tie.outcomes.forEach(o=>{assert.equal(o.house,120);assert.equal(members(o),120);assert.deepEqual([party(o,'Labour').total,party(o,'National').total].sort(),[59,60])});
 assert.equal(engine.coalitionTie(r,{Labour:true,Independent:true}).depends,true);
 assert.ok(engine.findPaths(r).some(p=>p.members.some(m=>m.name==='Independent')&&p.members.some(m=>m.name==='Labour')));
});
test('Multiple independents reserve multiple seats',()=>{
 const winners=Object.fromEntries(engine.MAORI.map(m=>[m.seat,'Independent'])),r=engine.compute(state({Labour:50,National:50},winners));
 assert.equal(r.allocationBase,113);assert.equal(r.independentSeats,7);assert.equal(r.house,120);assert.equal(members(r),120);assert.equal(r.overhang,0);
 const small=engine.compute({...state({Labour:50,National:50},winners),seats:1});assert.equal(small.allocationBase,0);assert.equal(small.house,7);assert.equal(members(small),7);assert.equal(small.tie,null);
});
test('Party overhang remains separate from independent reservation',()=>{
 const w=Object.fromEntries(engine.MAORI.map((m,i)=>[m.seat,i===0?'Independent':i<6?'Te Pāti Māori':'Labour']));
 const r=engine.compute(state({Labour:50,National:49,'Te Pāti Māori':1},w));assert.equal(r.allocationBase,119);assert.equal(r.overhang,4);assert.equal(r.house,124);assert.equal(members(r),124);assert.equal(party(r,'Independent').overhang,0);assert.equal(party(r,'Te Pāti Māori').total,5);
});
test('Registered party with zero votes still retains genuine overhang',()=>{
 const r=engine.compute(state({Labour:50,National:50},{...allLab,'Te Tai Tonga':'Te Tai Tokerau Party'}));assert.equal(r.allocationBase,120);assert.equal(r.overhang,1);assert.equal(r.house,121);assert.equal(party(r,'Te Tai Tokerau Party').overhang,1);
});
test('Swing keeps 4.998% below threshold and gives Labour–Green 63 seats',()=>{
 engine.st={...state({Labour:38.1,National:36.9,Green:10,ACT:8,'NZ First':5.1,'Others (below 5%)':1.9}),swing:-1};const sv=engine.swungVotes(),r=engine.compute({...engine.st,votes:sv.votes});
 near(sv.votes['NZ First'],4.998);assert.equal(party(r,'NZ First').qualifies,false);assert.equal(party(r,'NZ First').total,0);assert.deepEqual(Array.from(['Labour','National','Green','ACT'],n=>party(r,n).total),[50,47,13,10]);assert.equal(engine.blocSum(r,{Labour:true,Green:true}),63);assert.equal(r.majority,61);assert.equal(r.house,120);assert.equal(engine.st.votes['NZ First'],5.1);assert.equal(engine.formatShare(sv.votes['NZ First'],5),'4.998%');
});
test('Threshold is tested at full precision and electorate exemption survives',()=>{
 for(const share of [4.99,4.998,4.9999999999,5,5.01])for(const elect of [false,true]){const w=elect?{...allLab,'Waiariki':'Opportunity (TOP)'}:allLab,r=engine.compute(state({Labour:50,National:50-share,'Opportunity (TOP)':share},w));assert.equal(party(r,'Opportunity (TOP)').qualifies,elect||share>=5)}
});
test('Swing conserves votes, leaves unaligned shares unchanged, and caps depletion',()=>{
 let seed=81723;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
 for(let i=0;i<200;i++){const v=makeVotes({});names.forEach(n=>v[n]=random()*20);engine.st={...state(v),swing:(random()-.5)*20};let sv=engine.swungVotes();near(Object.values(sv.votes).reduce((a,b)=>a+b,0),Object.values(v).reduce((a,b)=>a+b,0));assert.equal(sv.votes['Opportunity (TOP)'],v['Opportunity (TOP)']);assert.equal(sv.votes['Others (below 5%)'],v['Others (below 5%)']);assert.ok(Object.values(sv.votes).every(x=>x>=-1e-12))}
 engine.st={...state({Labour:99,National:1}),swing:-10};const capped=engine.swungVotes();assert.equal(capped.moved,1);assert.equal(capped.votes.National,0);assert.equal(capped.votes.Labour,100);
});
test('Balancing preserves ratios and does not round TOP onto 5%',()=>{
 const raw=makeVotes({Labour:48,National:47.96,'Opportunity (TOP)':5.04}),balanced=engine.balanceShares(raw,names);near(Object.values(balanced).reduce((a,b)=>a+b,0),100);near(balanced['Opportunity (TOP)'],5.04/101*100);assert.equal(raw['Opportunity (TOP)'],5.04);assert.equal(party(engine.compute(state(balanced)),'Opportunity (TOP)').total,0);assert.equal(engine.formatShare(balanced['Opportunity (TOP)'],5),'4.99%');
});
test('Existing overhang tie keeps both House sizes and coalition verdicts',()=>{
 const w=Object.fromEntries(engine.MAORI.map((m,i)=>[m.seat,i<5?'Te Pāti Māori':'Labour']));const r=engine.compute(state({Labour:34,National:32,Green:11,ACT:8,'NZ First':9,'Te Pāti Māori':2,'Opportunity (TOP)':3,'Others (below 5%)':1},w));assert.equal(r.house,123);assert.deepEqual(Array.from(r.tie.outcomes,o=>o.house),[123,122]);assert.equal(engine.coalitionTie(r,{Labour:true,Green:true,'Te Pāti Māori':true}).depends,true);
});
test('2023 and 2020 seat benchmarks remain correct',()=>{
 const w=Object.fromEntries(engine.MAORI.map(m=>[m.seat,m.seat==='Ikaroa-Rāwhiti'?'Labour':'Te Pāti Māori']));const r=engine.compute(state(engine.ELECTION_2023,w));assert.equal(r.house,122);assert.equal(r.tie,null);assert.deepEqual(Array.from(['National','Labour','Green','ACT','NZ First','Te Pāti Māori'],n=>party(r,n).total),[48,34,15,11,8,6]);
 const counts={Labour:1443545,National:738275,Green:226757,ACT:219031,'NZ First':75020,'Te Pāti Māori':33630,'Opportunity (TOP)':43449,'Others (below 5%)':106713},votes={};Object.entries(counts).forEach(([n,v])=>votes[n]=v/2886420*100);const old=engine.compute(state(votes,{...allLab,'Waiariki':'Te Pāti Māori'}));assert.equal(old.house,120);assert.deepEqual(Array.from(['Labour','National','Green','ACT','Te Pāti Māori'],n=>party(old,n).total),[65,33,10,10,2]);
});
test('N/A electorate gives no one a seat, reserves nothing and creates no overhang',()=>{
 const r=engine.compute(state({Labour:50,National:50},{...allLab,'Te Tai Tonga':'N/A'}));assert.equal(r.allocationBase,120);assert.equal(r.independentSeats,0);assert.equal(r.overhang,0);assert.equal(r.house,120);assert.equal(party(r,'Labour').elect,6);
 const fallback=engine.compute(state({Labour:50,National:50},{}));assert.equal(engine.MAORI.find(m=>m.seat==='Te Tai Tonga').party,'N/A');assert.ok(!fallback.parties.some(p=>p.name==='N/A'));assert.equal(fallback.independentSeats,0);
});
test('Bloc partners skip parties each bloc rules out and use the fewest parties',()=>{
 const [left,right]=engine.BLOCS;
 // Verian default: National-led is 4 short; TPM (4) is ruled out, so TOP (7) is the partner
 const r=engine.compute(state(engine.VERIAN,engine.DEFAULT_WINNERS));
 assert.deepEqual(Array.from(engine.blocPartners(r,right),p=>p.name),['Opportunity (TOP)']);assert.deepEqual(Array.from(engine.blocPartners(r,left),p=>p.name),['Opportunity (TOP)']);
 // ruled-out parties are never suggested, whatever the numbers
 const big=engine.compute(state({National:30,Labour:30,Green:20,ACT:10,'NZ First':10},allLab));
 assert.ok(!engine.blocPartners(big,right).some(p=>right.never.includes(p.name)));assert.ok(!engine.blocPartners(big,left).some(p=>left.never.includes(p.name)));
 // a bloc with a majority needs no one; with no allowed party able to close the gap the answer is empty
 const maj=engine.compute(state({National:60,ACT:10,Labour:20,Green:10},allLab));assert.deepEqual(Array.from(engine.blocPartners(maj,right)),[]);
 assert.ok(!right.never.includes('Te Tai Tokerau Party'));const ttt=engine.compute(state({National:50,Labour:50},{...allLab,'Te Tai Tokerau':'Te Tai Tokerau Party'}));assert.deepEqual(Array.from(engine.blocPartners(ttt,right),p=>p.name),['Te Tai Tokerau Party']);
 const stuck=engine.compute(state({National:30,Green:40,'Te Pāti Māori':30},allLab));assert.deepEqual(Array.from(engine.blocPartners(stuck,right)),[]);
});
test('Your-coalition suggestions follow the same rules as the blocs',()=>{
 const [left,right]=engine.BLOCS,r=engine.compute(state(engine.VERIAN,engine.DEFAULT_WINNERS)),set=names=>Object.fromEntries(names.map(n=>[n,true]));
 // clicking a bloc selects its members: the suggestion must match Bloc check
 for(const b of [left,right]){const s=set(b.names.filter(n=>(party(r,n)||{}).total));assert.deepEqual(Array.from(engine.partnersFor(r,s,engine.neverFor(s)),p=>p.name),Array.from(engine.blocPartners(r,b),p=>p.name))}
 assert.deepEqual(Array.from(engine.neverFor(set(['National','ACT']))),['Green','Te Pāti Māori']);assert.deepEqual(Array.from(engine.neverFor(set(['Labour']))),['ACT','NZ First']);assert.deepEqual(Array.from(engine.neverFor(set(['Green','ACT']))),[]);assert.deepEqual(Array.from(engine.neverFor(set(['ACT']))),['Green','Te Pāti Māori']);assert.deepEqual(Array.from(engine.neverFor(set(['Te Tai Tokerau Party']))),['ACT','NZ First']);assert.deepEqual(Array.from(engine.neverFor({})),[]);
});
console.log(`${checks} regression groups passed, including 200 conservation cases.`);
