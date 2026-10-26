// node --test tests/recent-edits-audit.test.cjs
// All audit findings are ordinary regression tests; no TODO/expected failures.
// Executes actual page functions; DOM stubs test handlers/markup, NOT browser layout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function setup(){
 const nodes={},events={},storage={};
 const node=id=>nodes[id]||(nodes[id]={value:'',checked:false,innerHTML:'',textContent:'',addEventListener(type,fn){events[id+':'+type]=fn}});
 const e={URLSearchParams,location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},document:{activeElement:null,getElementById:node,querySelector:node}};
 vm.createContext(e);
 function block(a,b){assert.ok(html.indexOf(a)>=0&&html.indexOf(b)>html.indexOf(a));vm.runInContext(html.slice(html.indexOf(a),html.indexOf(b)),e)}
 block('var ROSTER=','function hemiSeats(');
 block('function loadState(','function initTheme(');
 block('// ---- paste parser','// ---- paste UI');
 block('function pasteSum(','$("pasteBox").addEventListener');
 block('function seatKey(','function copyText(');
 block('var SWING_SIDES=','var lastSwing=');
 block('function renderNat(','function laneOrder(');
 block('var DEFAULT_ROWS=','function gripHTML(');
 vm.runInContext('function vote(n){return parseFloat(st.votes[n])||0} function by(n){return res.parties.find(p=>p.name===n)}',e);
 e.renderInputs=()=>{};e.render=()=>{e.res=e.compute({...e.st,votes:e.swungVotes().votes})};
 vm.runInContext(html.split('\n').find(l=>l.startsWith('document.querySelector(".top-actions").addEventListener')),e);
 e.st=e.loadState('test');return {e,nodes,events,storage,node};
}
const plain=x=>JSON.parse(JSON.stringify(x));
const party=(r,n)=>r.parties.find(p=>p.name===n);
const members=r=>r.parties.reduce((a,p)=>a+p.total,0);
function issue(id,name,fn){test(`${id}: ${name}`,fn)}

test('National count clamps blank, negative, fractional and oversized inputs',()=>{
 const {e}=setup();for(const [input,expected] of [[undefined,0],['',0],['abc',0],[-1,0],[0,0],[12.6,12],[64,64],[999,64]])assert.equal(e.natGeneral({natElect:input}),expected);
});
test('National threshold exemption, zero vote and combined Māori/general seats',()=>{
 const {e}=setup();for(const coattail of [true,false]){const s={...e.st,votes:{Labour:96,National:4},coattail,natElect:2},r=e.compute(s);assert.equal(party(r,'National').qualifies,coattail);assert.equal(members(r),r.house)}
 const s={...e.st,votes:{Labour:100,National:0},natElect:64,winners:Object.fromEntries(e.MAORI.map(m=>[m.seat,'National']))};
 const r=e.compute(s);assert.equal(party(r,'National').elect,71);assert.equal(party(r,'National').overhang,71);assert.equal(members(r),r.house);
});
test('500 seeded scenarios conserve seats and match independently ranked quotients',()=>{
 const {e}=setup();let seed=271026;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let i=0;i<500;i++){
  const weights=Array.from(e.ROSTER,()=>random()),sum=weights.reduce((a,b)=>a+b,0);
  const choices=Array.from(e.WINNER_PARTIES,p=>p.name).concat('N/A');
  const s={...e.st,votes:Object.fromEntries(Array.from(e.ROSTER,(p,j)=>[p.name,weights[j]/sum*100])),winners:Object.fromEntries(Array.from(e.MAORI,m=>[m.seat,choices[Math.floor(random()*choices.length)]])),natElect:Math.floor(random()*65),coattail:random()>.5,seats:1+Math.floor(random()*150)};
  const r=e.compute(s),eligible=r.parties.filter(p=>p.name!=='Independent'&&p.qualifies&&p.votes>0),quotients=[];
  eligible.forEach(p=>{for(let k=0;k<r.allocationBase;k++)quotients.push({name:p.name,q:p.votes/(2*k+1)})});quotients.sort((a,b)=>b.q-a.q);
  const reference={};quotients.slice(0,r.allocationBase).forEach(q=>reference[q.name]=(reference[q.name]||0)+1);
  for(const o of [r,...(r.tie?r.tie.outcomes:[])]){assert.equal(members(o),o.house);assert.equal(o.majority,Math.floor(o.house/2)+1);for(const p of o.parties){assert.ok(Number.isInteger(p.total)&&p.total>=0);assert.ok(p.total>=p.elect);assert.equal(p.total,p.list+p.elect)}}
  for(const p of eligible)assert.equal(p.entitlement,reference[p.name]||0);
 }
});
test('New links round-trip seats with zero/default/max electorates and custom swing',()=>{
 for(const ne of [0,44,64])for(const sw of [-10,0,10]){
  const {e}=setup();e.st.natElect=ne;e.st.swing=sw;e.st.swingSides={National:'left',Labour:'right'};const want=e.seatKey(e.st.votes),hash=e.shareHash();
  e.st=e.loadState('fresh');e.location.hash='#'+hash;assert.equal(e.applyShareHash(),true);assert.equal(e.st.natElect,ne);assert.equal(e.seatKey(e.st.votes),want);
 }
});
test('Malformed links and electorate counts are bounded',()=>{
 const {e}=setup();for(const [raw,expected] of [['-4',0],['999',64],['12.6',12],['abc',0],['1e2',64],['12junk',0]]){e.location.hash='#LAB=50&NAT=50&ne='+raw;assert.equal(e.applyShareHash(),true);assert.equal(e.st.natElect,expected)}
 const before=plain(e.st);e.location.hash='#anchor';assert.equal(e.applyShareHash(),false);assert.deepEqual(plain(e.st),before);
});
test('Paste replacement, keep mode, remainder and escaping',()=>{
 const {e,node}=setup();node('pasteBox').value='Labour 40, National 35';e.applyPaste();assert.equal(e.st.votes.Labour,40);assert.equal(e.st.votes.Green,'');assert.equal(e.st.votes[e.OTHERS],25);
 node('pasteKeep').checked=true;node('pasteBox').value='Green 10';e.applyPaste();assert.equal(e.st.votes.Labour,40);assert.equal(e.st.votes.Green,10);assert.equal(e.st.votes[e.OTHERS],25);
 node('pasteBox').value='<img src=x onerror=alert(1)> unknown 12';e.pastePreview();assert.ok(!node('pastePreview').innerHTML.includes('<img'));
});
test('Party order removes unknowns/duplicates and keeps Others last',()=>{
 const {e}=setup();e.st.partyOrder=['Green','Green','bogus',e.OTHERS,'National'];const order=Array.from(e.partyOrder());assert.equal(order[0],'Green');assert.equal(order.at(-1),e.OTHERS);assert.equal(new Set(order).size,e.ROSTER.length);
});
test('National bar stays finite and bounded with entitlement or wins above 64',()=>{
 const {e,node}=setup();for(const [votes,winners] of [[{National:100},e.st.winners],[{Labour:100},Object.fromEntries(e.MAORI.map(m=>[m.seat,'National']))]]){
  e.st={...e.st,votes,winners,natElect:64};e.render();e.renderNat();const markup=node('natBar').innerHTML;assert.doesNotMatch(markup,/NaN|Infinity/);for(const m of markup.matchAll(/(?:width|left):([\d.]+)%/g))assert.ok(+m[1]<=100);
 }
});

issue('R1a','Negative pasted vote must not become positive',()=>{const {e}=setup();for(const sign of ['-','−']){const r=e.parsePoll('Labour '+sign+'5, National 30');assert.ok(!('Labour' in r.votes));assert.ok(r.bad.length)}});
issue('R1b','Leading-dot pasted decimal retains its magnitude',()=>{const {e}=setup();assert.equal(e.parsePoll('Labour .5%, National 30').votes.Labour,.5)});
issue('R2','Less-than threshold must not become exact qualifying share',()=>{const {e}=setup();for(const text of ['TOP <5%, Labour 50, National 45','TOP\tLAB\tNAT\n<5%\t50\t45'])assert.ok(!(e.parsePoll(text).votes['Opportunity (TOP)']>=5))});
issue('R3','Multiple value-first pairs preserve party/value alignment',()=>{const {e}=setup();assert.deepEqual(plain(e.parsePoll('30% National, 29% Labour').votes),{National:30,Labour:29})});
issue('R4','Legacy share links preserve original electorate assumptions',()=>{
 const {e}=setup();e.st.natElect=0;const want=e.seatKey(e.st.votes),legacy=e.shareHash().replace(/&ne=0/,'');e.location.hash='#'+legacy;e.applyShareHash();assert.equal(e.seatKey(e.st.votes),want);
});
issue('R5','As 2023 electorate preset matches top 2023 preset',()=>{
 const {e,events}=setup();events['.top-actions:click']({target:{closest:()=>({dataset:{preset:'2023'}})}});assert.deepEqual(plain(e.MAORI_PRESETS[0].w),plain(e.st.winners));
});
issue('R6','2023 benchmark preset clears previously applied swing',()=>{
 const {e,events}=setup();e.st.swing=10;events['.top-actions:click']({target:{closest:()=>({dataset:{preset:'2023'}})}});assert.equal(e.res.house,122);assert.equal(party(e.res,'National').total,48);
});
issue('R7','Clear/incomplete data cannot claim an unexplained fully allocated House',()=>{
 const {e}=setup();e.st.votes={};const r=e.compute(e.st);assert.equal(r.incomplete,true);assert.equal(r.house,null);assert.equal(r.majority,null);assert.equal(r.overhang,null);assert.equal(r.unallocated,120);assert.equal(members(r),50);assert.deepEqual(Array.from(e.findPaths(r)),[]);assert.deepEqual(Array.from(e.partnersFor(r,{},[])),[]);
});
issue('R8','Saved scenarios without natElect preserve prior outcome on migration',()=>{
 const {e,storage}=setup();const old={...e.st};delete old.natElect;const want=e.compute(old).house;storage.legacy=JSON.stringify(old);assert.equal(e.compute(e.loadState('legacy')).house,want);
});


test('Ambiguous paste values block Apply without changing any existing state',()=>{
 const {e,node}=setup();for(const text of ['TOP <5%, Labour 50, National 45','National 30-32%, Labour 29','National 30 to 32%, Labour 29','National ≈30, Labour 29','National ~30, Labour 29','Labour -5, National 30','NAT\tLAB\n30–32\t29']){
  node('pasteBox').value=text;const before=plain(e.st),r=e.pastePreview();assert.ok(r.bad.length,text);assert.equal(node('pasteBtn').disabled,true);e.applyPaste();assert.deepEqual(plain(e.st),before);
 }
});
test('Leading decimals and signs behave consistently in tables and pairs',()=>{
 const {e}=setup();for(const text of ['LAB\tNAT\n.5\t30','0.5% Labour, +30% National','Labour .5 National 30','Labour: .5; National: 30'])assert.deepEqual(plain(e.parsePoll(text).votes),{Labour:.5,National:30});
 for(const text of ['LAB\tNAT\n-5\t30','LAB\tNAT\n−5\t30']){const r=e.parsePoll(text);assert.ok(r.bad.length);assert.ok(!('Labour' in r.votes))}
});
test('Unknown table categories are disclosed and sample size does not block Apply',()=>{
 const {e}=setup(),r=e.parsePoll('Sample size\tLAB\tNAT\tUndecided\n1002\t40\t35\t25');assert.deepEqual(plain(r.votes),{Labour:40,National:35});assert.ok(r.skipped.includes('Undecided'));assert.equal(r.bad.length,0);
});
test('Fresh, legacy, explicit saved and reloaded National defaults stay distinct',()=>{
 const {e,storage}=setup();assert.equal(e.st.natElect,44);
 storage.legacy=JSON.stringify({votes:e.VERIAN,winners:e.DEFAULT_WINNERS});const old=e.loadState('legacy');assert.equal(old.natElect,0);e.saveState('legacy',old);assert.equal(e.loadState('legacy').natElect,0);
 for(const raw of [0,44,64,'1e2','12junk']){storage.saved=JSON.stringify({...e.st,natElect:raw});assert.equal(e.loadState('saved').natElect,e.natGeneral({natElect:raw}))}
 assert.match(e.shareHash(),/&ne=44(?:&|$)/);
});
test('Historical, poll and Clear presets reset swing and custom sides',()=>{
 const {e,events}=setup();for(const preset of ['2023','verian','clear']){e.st.swing=10;e.st.swingSides={Labour:'right'};events['.top-actions:click']({target:{closest:()=>({dataset:{preset}})}});assert.equal(e.st.swing,0);assert.deepEqual(plain(e.st.swingSides),{});if(preset==='clear')assert.equal(e.res.incomplete,true)}
});
test('No eligible votes is incomplete; one eligible party or all-independent base recovers',()=>{
 const {e}=setup(),winners=Object.fromEntries(e.MAORI.map(m=>[m.seat,'N/A']));
 for(const votes of [{},{Labour:0,National:0},{Labour:4,National:4}]){const r=e.compute({...e.st,votes,winners,coattail:false});assert.equal(r.incomplete,true);assert.equal(r.house,null)}
 const r=e.compute({...e.st,votes:{Labour:100},winners});assert.equal(r.incomplete,false);assert.equal(members(r),r.house);
 const ind=e.compute({...e.st,votes:{},natElect:0,seats:1,winners:Object.fromEntries(e.MAORI.map(m=>[m.seat,'Independent']))});assert.equal(ind.incomplete,false);assert.equal(ind.house,7);
});
test('Loading a link clears stale swing sides and defaults missing winners deterministically',()=>{
 const {e}=setup();e.st.swingSides={Labour:'right'};e.st.winners=Object.fromEntries(e.MAORI.map(m=>[m.seat,'National']));e.location.hash='#LAB=50&NAT=50';e.applyShareHash();assert.deepEqual(plain(e.st.swingSides),{});assert.deepEqual(plain(e.st.winners),plain(e.DEFAULT_WINNERS));
});
test('A spaced hyphen separates party and figure; an attached sign stays negative',()=>{
 const {e}=setup();
 assert.deepEqual(plain(e.parsePoll('Labour - 30%\nNational - 29%').votes),{Labour:30,National:29});
 assert.deepEqual(plain(e.parsePoll('Labour – 30%, National — 29%').votes),{Labour:30,National:29});
 assert.deepEqual(plain(e.parsePoll('National 29 - Labour 30 - Green 14').votes),{National:29,Labour:30,Green:14});
 const r=e.parsePoll('Labour -5, National 30');assert.ok(!('Labour' in r.votes));assert.ok(r.bad.length);
});
test('Dash and n/a cells in a poll table are skipped, not errors',()=>{
 const {e}=setup();for(const blank of ['–','—','-','n/a','N/A']){
  const r=e.parsePoll('NAT\tLAB\tGRN\tTOP\n27.8\t28.2\t16\t'+blank);
  assert.deepEqual(plain(r.votes),{National:27.8,Labour:28.2,Green:16});assert.deepEqual(plain(r.bad),[]);assert.deepEqual(plain(r.skipped),['TOP (no figure)']);
 }
 assert.ok(e.parsePoll('NAT\tLAB\tTOP\n27.8\t28.2\t<5').bad.length,'bounded values are still flagged');
});
