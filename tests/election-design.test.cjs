// index.html (the post-election design): same calculator as index-election.html, plus the design and electorate changes.
const assert=require('node:assert/strict'),{test}=require('node:test');
const {page}=require('./election-page.test.cjs');
const design=opts=>page({...opts,file:'index.html',key:'coalitionlab-election-design'});
const act=(p,a)=>p.node('scnList').dispatch('click',{target:{closest:sel=>sel==='[data-scn-act]'?{dataset:{scnAct:a}}:null}});
const ids=p=>p.scenarios().list.map(s=>s.id);
test('Design page runs the same calculator',()=>{
 const p=design();assert.match(p.node('house').textContent,/^131.*majority 66/);
 p.preset('final');assert.match(p.node('house').textContent,/^132/);
});
test('Scenarios move up and down with buttons and Alt+arrows, and the order is saved',()=>{
 const p=design();p.node('scnAdd').dispatch('click');p.node('scnAdd').dispatch('click');
 assert.deepEqual(ids(p),['s1','s2','s3']);assert.equal(p.scenarios().active,'s3');
 act(p,'up');assert.deepEqual(ids(p),['s1','s3','s2']);
 act(p,'up');act(p,'up');assert.deepEqual(ids(p),['s3','s1','s2']);// stops at the top
 p.node('scnList').dispatch('keydown',{altKey:true,key:'ArrowDown',target:{closest:sel=>sel==='[data-scn]'?{dataset:{scn:'s1'}}:null}});
 assert.deepEqual(ids(p),['s3','s2','s1']);
 const again=design({store:p.storage});assert.deepEqual(ids(again),['s3','s2','s1']);
});
test('Cards show each scenario’s assumptions and its seat differences from the current one',()=>{
 const p=design();p.node('scnAdd').dispatch('click');p.preset('final');p.flip('55');// Wairarapa is general seat 55
 const list=p.node('scnList').innerHTML;
 assert.match(list,/Specials 100% · Wairarapa flipped/);assert.match(list,/No specials lean/);
 assert.match(list,/vs current: <b>NAT \+1<\/b>/);
});
test('Up to 12 scenarios',()=>{
 const p=design();for(let i=0;i<15;i++)p.node('scnAdd').dispatch('click');assert.equal(p.scenarios().list.length,12);
});
const rows=p=>p.node('rows').textContent;
test('Every electorate counts: election night splits Labour, Greens and ACT correctly with unchanged totals',()=>{
 const p=design();assert.match(p.node('house').textContent,/^131.*majority 66/);
 assert.match(rows(p),/Labour29\.4%21 elect · 15 list36/);assert.match(rows(p),/Green13\.3%2 elect · 14 list16/);assert.match(rows(p),/ACT10\.9%1 elect · 12 list13/);
 assert.equal(p.node('genSum').textContent,'NAT 42 · LAB 19 · GRN 2 · ACT 1');assert.equal(p.node('natElect').textContent,'42');
 assert.equal(Object.keys(p.state().gen).length,64);
});
test('Flips: Wellington Bays changes the split only; Epsom to National keeps ACT at 13 but adds a National overhang seat',()=>{
 const p=design(),before=p.node('house').textContent;
 p.flip('58');assert.match(rows(p),/Labour29\.4%20 elect · 16 list36/);assert.match(rows(p),/Green13\.3%3 elect · 13 list16/);assert.equal(p.node('house').textContent,before);
 p.node('genGrid').dispatch('click',{target:{closest:sel=>sel==='[data-gen]'?{dataset:{gen:'10'}}:null}});
 assert.equal(p.state().gen.Epsom,'National');assert.match(rows(p),/ACT10\.9%0 elect · 13 list13/);// ACT keeps 13 (above 5%)
 assert.match(p.node('house').textContent,/^132/);assert.match(rows(p),/National29\.2%43 elect · 0 list43 \+8/);// National already overhangs: one more seat
 p.node('genReset').dispatch('click');assert.equal(p.node('genSum').textContent,'NAT 42 · LAB 19 · GRN 2 · ACT 1');
});
test('2023 preset uses the notional 2023 seat winners',()=>{
 const p=design();p.preset('2023');assert.match(p.node('house').textContent,/122.*majority 62/);assert.match(p.node('genSum').textContent,/^NAT 44 · LAB 15 · GRN 3 · ACT 2/);
});
test('Links: new seat codes, named parties, legacy close codes and count-only links',()=>{
 const m='LAB=29.3699&NAT=29.219&GRN=13.3096&ACT=10.9206&TOP=5.9663&NZF=9.7839&TPM=0.5724&OTH=0.8583&m=TPM.LAB.TPM.TPM.TPM.TPM.LAB';
 let p=design({hash:'#'+m+'&ne=41&fl=55.10:NAT'});assert.equal(p.state().gen.Wairarapa,'Labour');assert.equal(p.state().gen.Epsom,'National');assert.equal(p.state().natElect,42);
 p=design({hash:'#'+m+'&ne=41&fl=WRP'});assert.equal(p.state().gen.Wairarapa,'Labour');assert.equal(p.state().natElect,41);
 p=design({hash:'#'+m+'&ne=40'});assert.equal(p.state().natElect,40);assert.equal(p.state().gen.Wairarapa,'Labour');assert.equal(p.state().gen['Hamilton East'],'Labour');// closest two
});
test('Old saved states with only a National count are converted to seat winners',()=>{
 const store=new Map([['coalitionlab-election-design',JSON.stringify({votes:{Labour:29.3699,National:29.219,Green:13.3096,ACT:10.9206,'Opportunity (TOP)':5.9663,'NZ First':9.7839,'Te Pāti Māori':0.5724,'Others (below 5%)':0.8583},natElect:41,flips:{WRP:true}})]]);
 const p=design({store});assert.equal(p.state().natElect,41);assert.equal(p.state().gen.Wairarapa,'Labour');assert.equal(p.state().flips,undefined);
});
test('A link copied from the page reproduces the same result (lean, flips, Māori winner)',()=>{
 // the exact link the page produced in the browser for: Expected final, lean 137%, Wairarapa and Te Tai Tokerau flipped
 const link='#LAB=29.3699&NAT=29.219&GRN=13.3096&ACT=10.9206&TOP=5.9663&NZF=9.7839&TPM=0.5724&OTH=0.8583&m=GRN.LAB.TPM.TPM.TPM.TPM.LAB&ne=41&sp=1.37&fl=55';// links keep 4 dp
 const a=design();a.preset('final');a.flip('55');a.flip('TTK');a.lean(137);
 const b=design({hash:link});
 for(const id of ['house','genSum','maoriSum','spRead','turn'])assert.equal(b.node(id).textContent,a.node(id).textContent,id);
 assert.equal(b.node('rows').textContent,a.node('rows').textContent);
});
test('Links can give a seat to an independent or to no one',()=>{
 const p=design({hash:'#LAB=29.3699&NAT=29.219&GRN=13.3096&ACT=10.9206&TOP=5.9663&NZF=9.7839&TPM=0.5724&OTH=0.8583&m=TPM.LAB.TPM.TPM.TPM.TPM.LAB&ne=42&fl=10:IND.1:NA'});
 assert.equal(p.state().gen.Epsom,'Independent');assert.equal(p.state().gen['Auckland Central'],'N/A');
 assert.match(p.node('genSum').textContent,/IND 1/);assert.match(p.node('electOnly').textContent,/Independent/);
});
test('Each scenario keeps its own electorate winners',()=>{
 const p=design();p.flip('55');p.node('scnAdd').dispatch('click');p.node('genReset').dispatch('click');
 assert.equal(p.scenarios().list[0].state.gen.Wairarapa,'Labour');assert.equal(p.state().gen.Wairarapa,'National');
 p.node('scnList').dispatch('click',{target:{closest:sel=>sel==='[data-scn]'?{dataset:{scn:'s1'}}:null}});
 assert.equal(p.state().gen.Wairarapa,'Labour');assert.match(p.node('genSum').textContent,/1 flipped/);
});
test('“What changes from election night” lists seat changes and flipped electorates',()=>{
 const p=design();assert.equal(p.node('changes').hidden,true);// nothing to show on election night
 p.preset('final');p.flip('55');p.flip('58');const t=p.node('changes').textContent;
 assert.equal(p.node('changes').hidden,false);
 assert.match(t,/SeatsGRN \+1TOP \+1NAT −1NZF −1/);// gains first, as in the mock-up
 assert.match(t,/Wairarapa to LAB NAT led by 139/);assert.match(t,/Wellington Bays to GRN LAB led by 140/);
 p.preset('night');assert.equal(p.node('changes').hidden,true);
});
test('The changes strip stays compact with many flips: closest first, no margins, at most four seats',()=>{
 const p=design();for(const n of ['46','29','63','15','12'])p.flip(n);// Takanini, Nelson, Whangārei, Hutt South, Hamilton East
 const t=p.node('changes').textContent;
 assert.match(t,/ElectoratesHamilton East to LABHutt South to NATWhangārei to LABNelson to LAB\+1 more/);// harness drops spaces between tags
 assert.doesNotMatch(t,/led by/);
});
