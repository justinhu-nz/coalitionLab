// Runtime checks for index-election.html (post-election calculator), using the same minimal DOM double as
// page-runtime.test.cjs. Verifies startup, presets, special votes, close seats and share links, not layout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),nodeTest=require('node:test').test;
// Imported by election-design.test.cjs for page(): only register these tests when run directly.
const test=require.main===module?nodeTest:()=>{};
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=read('index-election.html');
const KEY='coalitionlab-election';
function page({hash='',store,file,key=KEY}={}){const src=file?read(file):html;
 const nodes=new Map(),storage=store||new Map();
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
 vm.runInNewContext(src.match(/<script>([\s\S]*)<\/script>/)[1],context);
 const preset=name=>node('.top-actions').dispatch('click',{target:{closest:()=>({dataset:{preset:name}})}});
 const flip=code=>node('close').dispatch('click',{target:{closest:()=>({dataset:{close:code}})}});
 const lean=pct=>{node('spK').value=String(pct);node('spK').dispatch('input')};
 const state=()=>JSON.parse(storage.get(key));
 const scenarios=()=>JSON.parse(storage.get(key+'-scenarios'));
 return {node,preset,flip,lean,state,scenarios,storage};
}
module.exports={page};

test('Starts on the election-night count: 42 National seats, Te Tai Tokerau to TPM, no lean',()=>{
 const p=page(),st=p.state();
 assert.match(p.node('house').textContent,/^131.*majority 66/);
 assert.equal(st.natElect,42);assert.equal(st.sp.k,0);assert.deepEqual(st.flips,{});
 assert.equal(st.winners['Te Tai Tokerau'],'Te Pāti Māori');assert.equal(st.winners['Te Tai Tonga'],'Labour');
 assert.equal(st.votes.Labour,29.3699);assert.equal(st.votes.National,29.219);
 assert.match(p.node('spRead').textContent,/Election-night count/);
 assert.match(p.node('turn').textContent,/Right \(NAT \+ ACT \+ NZF\): majority now · loses a majority at 74% lean/);
 assert.doesNotMatch(html,/data-preset="verian"|VERIAN/);
});
test('Expected final leans specials like 2011–23 and moves seats; 2023 turns the lean off',()=>{
 const p=page();p.preset('final');
 assert.equal(p.state().sp.k,1);assert.match(p.node('house').textContent,/^132.*majority 67/);
 assert.match(p.node('turn').textContent,/Left \+ TOP take 59\.3% of specials · 49\.2% on election night/);
 assert.match(p.node('spRead').textContent,/\+389,000 special votes · 100% lean/);
 p.lean(0);assert.match(p.node('house').textContent,/^131/);
 p.preset('2023');assert.equal(p.state().sp.k,0);assert.equal(p.state().natElect,44);assert.match(p.node('house').textContent,/122.*majority 62/);
});
test('Picking a pattern at 0% lean also sets the lean to 100%',()=>{
 const p=page();p.node('spYears').dispatch('click',{target:{closest:()=>({dataset:{spy:'2020'}})}});
 assert.deepEqual(p.state().sp,{n:389000,k:1,y:'2020'});
 p.node('spReset').dispatch('click');assert.equal(p.state().sp.k,0);assert.equal(p.state().sp.y,'2020');
});
test('Close seats flip to the runner-up and back without drifting the National count',()=>{
 const p=page();p.preset('final');
 p.flip('WRP');assert.equal(p.state().natElect,41);assert.deepEqual(p.state().flips,{WRP:true});
 assert.match(p.node('turn').textContent,/Left \+ TOP: majority now/);
 p.flip('RSK');assert.equal(p.state().natElect,42);assert.deepEqual(p.state().flips,{WRP:true,RSK:true});
 assert.match(p.node('house').textContent,/^132/);
 p.flip('TTK');assert.equal(p.state().winners['Te Tai Tokerau'],'Green');assert.match(p.node('house').textContent,/^131/);// one fewer TPM overhang
 p.flip('TTK');p.flip('RSK');p.flip('WRP');
 assert.equal(p.state().natElect,42);assert.deepEqual(p.state().flips,{});assert.equal(p.state().winners['Te Tai Tokerau'],'Te Pāti Māori');
 p.flip('WRP');p.preset('night');assert.deepEqual(p.state().flips,{});assert.equal(p.state().natElect,42);
});
test('Share links carry the lean, pattern, count and flips; links without sp keep the typed votes',()=>{
 const m='m=TPM.LAB.TPM.TPM.TPM.TPM.LAB';
 let p=page({hash:'#LAB=29.3699&NAT=29.219&GRN=13.3096&ACT=10.9206&TOP=5.9663&NZF=9.7839&TPM=0.5724&OTH=0.8583&'+m+'&ne=41&sp=1.2&spn=400000&spy=2017&fl=WRP.ZZZ'});
 assert.deepEqual(p.state().sp,{n:400000,k:1.2,y:'2017'});assert.deepEqual(p.state().flips,{WRP:true});assert.equal(p.state().natElect,41);
 p=page({hash:'#LAB=29.3699&NAT=29.219&GRN=13.3096&ACT=10.9206&TOP=5.9663&NZF=9.7839&TPM=0.5724&OTH=0.8583&'+m+'&ne=42&sp=9&spy=1999'});
 assert.deepEqual(p.state().sp,{n:389000,k:2,y:'mean'});
 p=page({hash:'#LAB=30&NAT=30&'+m+'&ne=42'});assert.equal(p.state().sp.k,0);assert.deepEqual(p.state().flips,{});
});
test('Uses its own storage keys, leaving the pre-election calculator untouched',()=>{
 const store=new Map([['coalitionlab-protoA','{"votes":{"Labour":1}}'],['coalitionlab-scenarios','{"x":1}']]);
 const p=page({store});p.preset('final');
 assert.equal(store.get('coalitionlab-protoA'),'{"votes":{"Labour":1}}');assert.equal(store.get('coalitionlab-scenarios'),'{"x":1}');
 assert.ok(store.get('coalitionlab-election-scenarios'));
 const again=page({store});assert.equal(again.state().sp.k,1);assert.match(again.node('house').textContent,/^132/);
});
