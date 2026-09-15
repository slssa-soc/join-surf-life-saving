const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createContentStore,cleanHtml,photoBytes,publicPage,validateContent,pack,unpack}=require('../src/lib/club-content');
const jpeg=require('../node_modules/jpeg-js');
const baseline=require('../data/club-pages.json');
function fakeTable(){
  let version=0;const entities=new Map();let fail=false;
  const key=e=>e.partitionKey+'/'+e.rowKey;
  return{entities,setFail:value=>fail=value,createTable:async()=>{},getEntity:async(p,r)=>{const row=entities.get(p+'/'+r);if(!row)throw{statusCode:404};return structuredClone(row);},
    submitTransaction:async actions=>{
      if(fail)throw Error('storage unavailable');
      const copy=new Map(entities);
      for(const [operation,row,mode,options]of actions){const old=copy.get(key(row));if(operation==='create'&&old)throw{statusCode:409};if(operation==='update'&&(!old||old.etag!==options.etag))throw{statusCode:412};copy.set(key(row),{...row,etag:String(++version)});}
      entities.clear();for(const [k,v]of copy)entities.set(k,v);
    },listEntities:async function*(){for(const row of entities.values())yield structuredClone(row);}
  };
}
const actor={id:'user-one',name:'Dashboard editor'},slug='glenelg-slsc';
async function setup(){const table=fakeTable(),uploads=[];const store=createContentStore({getTable:()=>table,uploadPhoto:async(...args)=>uploads.push(args)}),page=await store.read(slug);const body={baseVersion:page.version,requestId:randomUUID(),notes:'Requested by the club secretary to update the introduction.',content:{...page.content,summary:'Updated summary approved by the club.'}};return{table,store,page,body,uploads};}
test('sanitiser removes active HTML, unsafe links and style attributes while retaining formatting',()=>{
  const clean=cleanHtml('<h2>About</h2><p onclick="bad()" style="color:red"><strong>Safe</strong><img src=x onerror=bad()><script>bad()</script><a href="javascript:bad()">Bad link</a><a href="https://club.example">Club</a></p><svg><animate href=x></animate></svg>');
  assert.ok(clean.includes('<strong>Safe</strong>'));assert.ok(clean.includes('https://club.example'));assert.ok(!/script|onclick|onerror|javascript:|<svg|<img|style=/.test(clean));
});
test('all 23 existing pages import; unsafe URLs, unknown clubs and oversized HTML are rejected',()=>{
  for(const [key,p]of Object.entries(baseline))assert.ok(validateContent(p.content,key).html);
  assert.throws(()=>validateContent(baseline[slug].content,'__proto__'));
  assert.throws(()=>validateContent({...baseline[slug].content,website:'javascript:alert(1)'},slug));
  assert.throws(()=>validateContent({...baseline[slug].content,html:'x'.repeat(50001)},slug));
  assert.throws(()=>validateContent({...baseline[slug].content,image:'https://untrusted.example/photo.jpg'},slug));
});
test('publishing requires notes and atomically records the original and new content',async()=>{
  const {store,table,page,body}=await setup();await assert.rejects(store.save(slug,{...body,notes:''},actor),e=>e.status===400);assert.equal(table.entities.size,0);
  const result=await store.save(slug,body,actor);assert.equal(result.content.summary,body.content.summary);assert.equal(table.entities.size,2);
  const r=await store.revision(slug,result.version);assert.equal(r.before.summary,page.content.summary);assert.equal(r.content.summary,body.content.summary);assert.equal(r.notes,body.notes);assert.equal(r.actor,actor.name);
});
test('failed storage transactions cannot publish content without its audit revision',async()=>{
  const {store,table,body,page}=await setup();table.setFail(true);await assert.rejects(store.save(slug,body,actor));assert.equal(table.entities.size,0);assert.equal((await store.read(slug)).version,page.version);
});
test('stale editors cannot overwrite a newer publication',async()=>{
  const {store,body}=await setup();await store.save(slug,body,actor);await assert.rejects(store.save(slug,{...body,requestId:randomUUID()},actor),e=>e.status===409);
});
test('retrying the same save is idempotent and cannot be reused by another actor',async()=>{
  const {store,table,body}=await setup();await store.save(slug,body,actor);const again=await store.save(slug,body,actor);assert.equal(again.replayed,true);assert.equal(table.entities.size,2);await assert.rejects(store.save(slug,body,{id:'other',name:'Other'}),e=>e.status===409);
});
test('safe photo upload is published in the same transaction and rejects disguised SVG',async()=>{
  const {store,table,body,uploads}=await setup();
  const jpg=jpeg.encode({width:1,height:1,data:Buffer.from([30,80,100,255])},85).data;
  const photo='data:image/jpeg;base64,'+jpg.toString('base64');
  const result=await store.save(slug,{...body,photo},actor);assert.equal(uploads.length,1);assert.match(result.content.image,/^\/api\/club-images\/glenelg-slsc\/[a-f0-9]{64}\.jpg$/);assert.equal(table.entities.size,3);
  assert.throws(()=>photoBytes('data:image/png;base64,'+Buffer.from('<svg onload="bad()"/>').toString('base64')));
});
test('public response excludes audit identities and notes; unicode snapshots round trip',()=>{
  const value={html:'<p>'+('🌊'.repeat(20000))+'</p>'};assert.deepEqual(unpack(pack('data',value),'data'),value);
  const result=publicPage({slug,version:'one',content:{title:'Club'},updatedBy:'Private name',notes:'Private notes'});assert.deepEqual(Object.keys(result),['slug','version','content']);
});
test('facility switches persist with before/after history and reject non-boolean values',async()=>{
  const {store,body,page}=await setup();
  body.content={...page.content,gym:!page.content.gym,restaurant:!page.content.restaurant};
  const saved=await store.save(slug,body,actor);
  assert.equal(saved.content.gym,!page.content.gym);
  assert.equal((await store.read(slug)).content.restaurant,!page.content.restaurant);
  const revision=await store.revision(slug,saved.version);
  assert.equal(revision.before.gym,page.content.gym);
  assert.equal(revision.content.gym,!page.content.gym);
  assert.throws(()=>validateContent({...page.content,gym:'false'},slug));
});
test('older saved pages inherit existing facility values without losing saved text',async()=>{
  const {store,table,body}=await setup();
  await store.save(slug,body,actor);
  const row=table.entities.get(slug+'/current'),content=unpack(row,'content');
  for(const key of ['gym','restaurant','accessibleFacilities','beachAccess'])delete content[key];
  Object.assign(row,pack('content',content));
  const loaded=await store.read(slug);
  assert.equal(loaded.content.summary,body.content.summary);
  assert.equal(loaded.content.gym,baseline[slug].content.gym);
});

