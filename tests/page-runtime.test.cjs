// Runs the complete inline script with a minimal DOM/event/storage test double.
// This verifies startup and render transitions, not browser layout or native focus.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function page(saved,{hash='',store}={}){
 const nodes=new Map(),storage=store||new Map(saved?[['coalitionlab-protoA',JSON.stringify(saved)]]:[]);
 class Element{
  constructor(){this.children=[];this.dataset={};this.listeners={};this.style={setProperty(k,v){this[k]=v}};this.classList={add(){},remove(){},toggle(){}};this.value='';this.hidden=false;this._html='';this._text='';this.attrs={}}
  set innerHTML(v){this._html=String(v);this._text=String(v).replace(/<[^>]*>/g,'');this.children=[]}get innerHTML(){return this._html}
  set textContent(v){this._text=String(v);this._html=String(v);this.children=[]}get textContent(){return this._text}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  dispatch(type,event={}){for(const fn of this.listeners[type]||[])fn({target:this,preventDefault(){},...event})}
  appendChild(child){this.children.push(child);return child}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}
  querySelectorAll(){return []}querySelector(){return null}getBoundingClientRect(){return {top:0,left:0,width:760,height:400}}focus(){}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 const document={getElementById:node,querySelector:node,querySelectorAll:()=>[],createElementNS:()=>new Element(),createElement:()=>new Element(),activeElement:null,body:new Element(),documentElement:new Element(),addEventListener(){}};
 const window=new Element();window.matchMedia=()=>({matches:false});
 const context={document,window,matchMedia:window.matchMedia,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},URLSearchParams,location:{hash,pathname:'/',search:''},history:{replaceState(){}},CSS:{escape:x=>x},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
 const preset=name=>node('.top-actions').dispatch('click',{target:{closest:()=>({dataset:{preset:name}})}});
 const state=()=>JSON.parse(storage.get('coalitionlab-protoA'));
 const scenarios=()=>JSON.parse(storage.get('coalitionlab-scenarios'));
 const pick=map=>({closest:sel=>map[sel]||null});
 return {node,preset,state,scenarios,pick,storage,document,window};
}
test('Full script starts, clears every result surface and recovers to the historical benchmark',()=>{
 const p=page();assert.match(p.node('house').textContent,/134/);assert.equal(p.state().natElect,44);
 p.node('swingSlider').value='10';p.node('swingSlider').dispatch('input');
 p.preset('clear');assert.match(p.node('house').textContent,/allocation incomplete/);assert.doesNotMatch(p.node('house').textContent,/170/);
 assert.equal(p.node('hemi').children.length,0);assert.equal(p.node('rows').innerHTML,'');assert.equal(p.node('lanes').hidden,true);assert.equal(p.node('tieNote').hidden,true);assert.equal(p.node('meterTick').hidden,true);
 assert.match(p.node('verdict').textContent,/incomplete/);assert.match(p.node('blocs').textContent,/Enter/);assert.match(p.node('paths').textContent,/Enter/);assert.doesNotMatch(p.node('natRead').textContent,/overhang.*\d/);
 p.preset('2023');assert.match(p.node('house').textContent,/122.*majority 62/);assert.equal(p.state().swing,0);assert.equal(p.node('lanes').hidden,false);assert.equal(p.node('meterTick').hidden,false);assert.ok(p.node('hemi').children.length>120);assert.ok(p.node('rows').innerHTML.length>0);
});
test('National typing, blur, stepper limits and saving all use the same count',()=>{
 const p=page(),input=p.node('natElect');p.document.activeElement=input;
 for(const [raw,want] of [['99',64],['12.6',12],['1e2',64],['',0],['12junk',0]]){input.value=raw;input.dispatch('input');input.dispatch('blur');assert.equal(+input.value,want);assert.equal(p.state().natElect,want)}
 p.document.activeElement=null;
 for(let i=0;i<70;i++)p.node('maoriSec').dispatch('click',{target:{closest:()=>({dataset:{nat:'1'}})}});
 assert.equal(+input.value,64);assert.equal(p.state().natElect,64);
});
test('Legacy saved state starts with the original 124-seat result',()=>{
 const initial=page().state();delete initial.natElect;const p=page(initial);assert.equal(p.state().natElect,0);assert.match(p.node('house').textContent,/124.*majority 63/);
});
test('Paste validation blocks both clicks and keyboard submission until corrected',()=>{
 const p=page(),box=p.node('pasteBox'),before=p.state();box.value='TOP <5%, Labour 50, National 45';box.dispatch('input');assert.equal(p.node('pasteBtn').disabled,true);
 box.dispatch('keydown',{key:'Enter',ctrlKey:true});assert.deepEqual(p.state(),before);assert.match(p.node('pasteMsg').textContent,/exact percentages/);
 box.value='30% National, 29% Labour';box.dispatch('input');assert.equal(p.node('pasteBtn').disabled,false);p.node('pasteBtn').dispatch('click');assert.equal(p.state().votes.National,30);assert.equal(p.state().votes.Labour,29);assert.equal(p.state().votes['Others (below 5%)'],41);
});
test('Vote arc can render an incomplete scenario and recover',()=>{
 const p=page();p.node('.viewsw').dispatch('click',{target:{closest:()=>({dataset:{view:'arc'}})}});p.preset('clear');assert.equal(p.node('arcWrap').hidden,false);assert.match(p.node('house').textContent,/incomplete/);p.preset('verian');assert.match(p.node('house').textContent,/134/);
});
test('Scenarios are discrete: each keeps its own votes, settings, swing and coalition',()=>{
 const p=page(),list=p.node('scnList');assert.equal(p.scenarios().list.length,1);assert.equal(p.scenarios().active,'s1');
 p.node('scnAdd').dispatch('click');assert.equal(p.scenarios().list.length,2);assert.equal(p.scenarios().active,'s2');assert.deepEqual(p.scenarios().list[1].state.votes,p.scenarios().list[0].state.votes);
 p.preset('2023');p.node('swingSlider').value='3';p.node('swingSlider').dispatch('input');
 p.node('lanes').dispatch('click',{target:p.pick({'.blk':{dataset:{name:'National'}}})});assert.equal(p.state().bloc.National,true);
 list.dispatch('click',{target:p.pick({'[data-scn]':{dataset:{scn:'s1'}}})});
 assert.equal(p.scenarios().active,'s1');assert.equal(p.state().votes.National,27.8);assert.equal(p.state().swing,0);assert.deepEqual(p.state().bloc,{});assert.match(p.node('house').textContent,/134/);
 const s2=p.scenarios().list[1].state;assert.equal(s2.votes.National,38.08);assert.equal(s2.swing,3);assert.equal(s2.bloc.National,true);
 assert.match(list.innerHTML,/Scenario 2/);assert.match(list.innerHTML,/NAT 51 · <span class="warn">11 short/);assert.match(list.innerHTML,/swing 3.0 right/);
 list.dispatch('click',{target:p.pick({'[data-scn]':{dataset:{scn:'s2'}}})});assert.equal(p.state().votes.National,38.08);assert.equal(p.state().swing,3);assert.equal(p.state().bloc.National,true);
});
test('Scenarios survive reloads, rename without re-rendering, and delete to a neighbour',()=>{
 const p=page();p.node('scnAdd').dispatch('click');p.preset('clear');
 const name={id:'scnName',value:'Labour surge',closest:()=>null};p.node('scnList').dispatch('input',{target:name});p.node('scnList').dispatch('change',{target:name});
 assert.equal(p.scenarios().list[1].name,'Labour surge');
 const q=page(null,{store:p.storage});assert.equal(q.scenarios().active,'s2');assert.match(q.node('house').textContent,/incomplete/);
 q.node('scnList').dispatch('click',{target:q.pick({'[data-scn-act]':{dataset:{scnAct:'del'}}})});
 assert.equal(q.scenarios().list.length,1);assert.equal(q.scenarios().active,'s1');assert.match(q.node('house').textContent,/134/);
 q.node('scnList').dispatch('click',{target:q.pick({'[data-scn-act]':{dataset:{scnAct:'del'}}})});assert.equal(q.scenarios().list.length,1);
});
test('A shared link opens as its own scenario without overwriting the current one',()=>{
 const p=page();p.preset('2023');
 const q=page(null,{store:p.storage,hash:'#NAT=40&LAB=30&GRN=10&ACT=10&m=TTT.NA.TPM.TPM.TPM.TPM.LAB&ne=44'});
 const sc=q.scenarios();assert.equal(sc.list.length,2);assert.equal(sc.active,'s2');assert.equal(sc.list[1].name,'Shared link');
 assert.equal(sc.list[0].state.votes.National,38.08);assert.equal(q.state().votes.National,40);
});
test('Scenarios column is hidden by default and remembers being opened',()=>{
 const p=page(),btn=p.node('scnToggle');assert.equal(btn.getAttribute('aria-pressed'),'false');
 btn.dispatch('click');assert.equal(btn.getAttribute('aria-pressed'),'true');assert.equal(p.storage.get('coalitionlab-scn-open'),'1');
 const q=page(null,{store:p.storage});assert.equal(q.node('scnToggle').getAttribute('aria-pressed'),'true');
 q.node('scnToggle').dispatch('click');assert.equal(q.storage.get('coalitionlab-scn-open'),'0');
});
test('Deleting a scenario needs no dialog and can be undone in place',()=>{
 const p=page(),list=p.node('scnList');p.node('scnAdd').dispatch('click');p.preset('2023');p.node('scnAdd').dispatch('click');
 list.dispatch('click',{target:p.pick({'[data-scn]':{dataset:{scn:'s2'}}})});
 list.dispatch('click',{target:p.pick({'[data-scn-act]':{dataset:{scnAct:'del'}}})});
 assert.deepEqual(p.scenarios().list.map(s=>s.id),['s1','s3']);assert.equal(p.scenarios().active,'s1');assert.match(list.innerHTML,/Deleted “Scenario 2”/);
 list.dispatch('click',{target:p.pick({'[data-scn-act]':{dataset:{scnAct:'undo'}}})});
 assert.deepEqual(p.scenarios().list.map(s=>s.id),['s1','s2','s3']);assert.equal(p.scenarios().active,'s2');assert.equal(p.state().votes.National,38.08);assert.doesNotMatch(list.innerHTML,/Deleted/);
});
test('Damaged saved scenarios keep every usable entry and never reuse an id',()=>{
 const p=page(),good=p.scenarios().list[0].state;
 p.storage.set('coalitionlab-scenarios',JSON.stringify({active:'gone',next:1,list:[null,{id:'s4',name:'Keep',state:good},{id:'s4',name:'Dupe',state:good},{id:'bad',state:good},{id:'s6',state:null},{id:'s9',name:'',state:{votes:{National:50,Labour:50}}}]}));
 const q=page(null,{store:p.storage}),sc=q.scenarios();
 assert.deepEqual(sc.list.map(s=>s.id+':'+s.name),['s4:Keep','s9:Scenario 9']);assert.equal(sc.active,'s4');
 q.node('scnAdd').dispatch('click');assert.equal(q.scenarios().active,'s10');
});
test('Another tab’s changes are adopted without losing this tab’s current scenario',()=>{
 const p=page();p.node('scnAdd').dispatch('click');p.preset('2023');
 const other=JSON.parse(p.storage.get('coalitionlab-scenarios'));other.list=other.list.filter(s=>s.id!=='s2');other.list.push({id:'s7',name:'From tab B',state:other.list[0].state});other.next=8;other.active='s7';
 p.storage.set('coalitionlab-scenarios',JSON.stringify(other));
 const before=p.storage.get('coalitionlab-scenarios');
 p.window.dispatch('storage',{key:'coalitionlab-scenarios'});
 assert.equal(p.storage.get('coalitionlab-scenarios'),before,'a storage event must not write back');
 assert.match(p.node('scnList').innerHTML,/From tab B/);assert.match(p.node('scnList').innerHTML,/data-scn="s2"/);
 p.node('scnAdd').dispatch('click');const sc=p.scenarios();assert.deepEqual(sc.list.map(s=>s.id),['s1','s7','s2','s8']);assert.equal(sc.list[2].state.votes.National,38.08);
});
