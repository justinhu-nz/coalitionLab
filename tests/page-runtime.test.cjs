// Runs the complete inline script with a minimal DOM/event/storage test double.
// This verifies startup and render transitions, not browser layout or native focus.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function page(saved){
 const nodes=new Map(),storage=new Map(saved?[['coalitionlab-protoA',JSON.stringify(saved)]]:[]);
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
 const context={document,window,matchMedia:window.matchMedia,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},URLSearchParams,location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},CSS:{escape:x=>x},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);
 const preset=name=>node('.top-actions').dispatch('click',{target:{closest:()=>({dataset:{preset:name}})}});
 const state=()=>JSON.parse(storage.get('coalitionlab-protoA'));
 return {node,preset,state,document};
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
