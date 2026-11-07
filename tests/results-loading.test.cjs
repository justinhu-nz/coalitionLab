// Exercise the real results button handler with controllable asynchronous feeds.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.slice(html.indexOf('var RESULTS_BASE='),html.indexOf('initTheme($("themeBtn"))'));
function page(){
 const button={addEventListener(type,fn){this.click=fn}},messages=[];
 let resolve,reject;
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no});
 const context={scn:{active:'s1'},st:{votes:{National:40},winners:{},swing:2},
  $:()=>button,wikiMsg:msg=>messages.push(msg),esc:String,
  renderInputs(){},render(){},Object,Promise};
 context.snapshot=()=>context.st;
 vm.createContext(context);vm.runInContext(source,context);
 context.loadResultsRef=()=>Promise.resolve({});
 context.loadCount=()=>pending;
 context.resultsFromFeed=(ref,count)=>count; // Conversion has separate allocation tests.
 let applied=0;
 context.applyResults=()=>applied++;
 const flush=()=>new Promise(done=>setImmediate(done));
 return{context,button,messages,resolve,reject,applied:()=>applied,flush};
}
test('Results apply once and the button recovers after a successful fetch',async()=>{
 const p=page();p.button.click();assert.equal(p.button.disabled,true);
 p.resolve({});await p.flush();assert.equal(p.applied(),1);
 assert.equal(p.button.disabled,false);assert.equal(p.button.textContent,'↻ Latest results');
});
test('A pending fetch never overwrites a switched or edited scenario',async()=>{
 for(const change of [p=>p.context.scn.active='s2',p=>p.context.st.votes.National=50]){
  const p=page();p.button.click();change(p);const before=JSON.stringify(p.context.st);
  p.resolve({});await p.flush();assert.equal(p.applied(),0);
  assert.equal(JSON.stringify(p.context.st),before);assert.equal(p.button.disabled,false);
  assert.match(p.messages.at(-1),/scenario changed/);
 }
});
test('Failed and empty counts leave the scenario unchanged and allow retry',async()=>{
 for(const fail of [false,true]){
  const p=page(),before=JSON.stringify(p.context.st);p.button.click();
  if(fail)p.reject(new Error('HTTP 503'));
  else{p.context.resultsFromFeed=()=>null;p.resolve({})}
  await p.flush();assert.equal(p.applied(),0);assert.equal(JSON.stringify(p.context.st),before);
  assert.equal(p.button.disabled,false);assert.match(p.messages.at(-1),/unchanged/);
 }
});
