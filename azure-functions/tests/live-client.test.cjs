const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function client(fetch){
  const listeners=new Map(),document={hidden:false,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
  const context={document,navigator:{onLine:true},fetch,AbortController,TextDecoder,JSON,setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/live.js'),'utf8'),context);
  return{start:context.startDashboardLive,document,listeners};
}
test('client parses fragmented events, suppresses duplicate snapshots and recovers unchanged data',async()=>{
  const messages=[
    'event: connected\ndata: {}\n\n',
    'event: snapshot\ndata: {"resource":"leads","data":[1]}\n\n',
    'event: snapshot\ndata: {"resource":"leads","data":[1]}\n\n',
    'event: report-error\ndata: {"resource":"leads","message":"Temporary"}\n\n',
    'event: snapshot\ndata: {"resource":"leads","data":[1]}\n\n'
  ].join('');
  let stopped=false,request;
  const c=client(async(url,options)=>{request={url,options};return{ok:true,body:new ReadableStream({start(controller){const bytes=new TextEncoder().encode(messages);for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));options.signal.addEventListener('abort',()=>{stopped=true;controller.close();});}})};});
  const snapshots=[],errors=[],statuses=[];
  const stop=c.start({getToken:async()=>'test-token',query:'view=leads&days=30',onSnapshot:(r,d)=>snapshots.push([r,d]),onError:(r,m)=>errors.push(m),onStatus:s=>statuses.push(s)});
  await new Promise(r=>setTimeout(r,20));stop();
  assert.equal(snapshots.length,2);assert.equal(errors.length,1);assert.ok(statuses.includes('Live connection'));
  assert.equal(request.options.headers.Authorization,'Bearer test-token');assert.ok(!request.url.includes('test-token'));assert.equal(stopped,true);assert.equal(c.listeners.size,0);
});
test('hidden tab does not open a connection until visible',async()=>{
  let calls=0;
  const c=client(async(url,options)=>{calls++;return{ok:true,body:new ReadableStream({start(controller){options.signal.addEventListener('abort',()=>controller.close());}})};});
  c.document.hidden=true;
  const stop=c.start({getToken:async()=>'test',query:'view=settings',onSnapshot:()=>{},onError:()=>{},onStatus:()=>{}});
  assert.equal(calls,0);c.document.hidden=false;c.listeners.get('visibilitychange')();await new Promise(r=>setTimeout(r,5));assert.equal(calls,1);stop();
});
