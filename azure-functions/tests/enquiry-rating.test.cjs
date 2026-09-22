const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(){
  const rows=new Map();let version=0;
  const ctx={module:{exports:{}},Date,process:{env:{ENQUIRY_RATING_SECRET:'x'.repeat(32)}},require:name=>{
    if(name==='./rating-availability')return require('../src/lib/rating-availability');
    if(name==='@azure/data-tables')return {TableClient:{fromConnectionString:()=>({createTable:async()=>{},
      submitTransaction:async actions=>{for(const [,e]of actions)if(rows.has(e.partitionKey+'/'+e.rowKey))throw {statusCode:409};for(const [,e]of actions)rows.set(e.partitionKey+'/'+e.rowKey,{...e,etag:String(++version)});},
      getEntity:async(p,r)=>{const e=rows.get(p+'/'+r);if(!e)throw {statusCode:404};return {...e};},
      updateEntity:async(e,mode,options)=>{const key=e.partitionKey+'/'+e.rowKey,old=rows.get(key);if(old.etag!==options.etag)throw {statusCode:412};rows.set(key,{...old,...e,etag:String(++version)});}
    })}};
    return require(name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/lib/enquiry-rating.js'),'utf8'),ctx);
  return {rating:ctx.module.exports,rows};
}
test('one invitation per email across enquiries/devices, even without a response; test is separate',async()=>{
  const h=harness();const invitations=await Promise.all([h.rating.invite('Person@example.org','production'),h.rating.invite(' PERSON@EXAMPLE.ORG ','production')]);
  assert.equal(invitations.filter(Boolean).length,1);assert.equal(h.rows.size,2);
  assert.equal(await h.rating.invite('person@example.org','production'),null);
  assert.ok(await h.rating.invite('person@example.org','test'));
  assert.doesNotMatch(JSON.stringify([...h.rows.values()]),/person|@|email|leadId/i);
  const response=[...h.rows.values()].find(r=>r.rowKey.startsWith('response-'));
  assert.deepEqual(Object.keys(response).sort(),['etag','invitedAt','mode','partitionKey','rowKey']);
});
test('only issued invitations can rate; response is immutable under retries/concurrent submissions',async()=>{
  const h=harness(),invitation=await h.rating.invite('a@example.org','production');
  await assert.rejects(h.rating.submit({token:'f'.repeat(64),mode:'production',rating:5}),e=>e.status===404);
  await Promise.all([h.rating.submit({...invitation,rating:4}),h.rating.submit({...invitation,rating:1})]);
  await h.rating.submit({...invitation,rating:2});
  const ratings=[...h.rows.values()].filter(r=>r.rating);assert.equal(ratings.length,1);assert.equal(ratings[0].rating,4);
  for(const change of [{rating:0},{rating:6},{rating:'5'},{email:'a@example.org'},{mode:'unknown'}])await assert.rejects(h.rating.submit({...invitation,rating:5,...change}),e=>e.status===400);
});
test('expired invitations cannot be used and do not generate repeat invitations',async()=>{
  const h=harness(),invitation=await h.rating.invite('a@example.org','production',new Date('2026-09-22'));
  await assert.rejects(h.rating.submit({...invitation,rating:5},new Date('2026-11-02')),e=>e.status===410);
  assert.equal(await h.rating.invite('a@example.org','production'),null);
});
test('invitations and responses are gated by the fixed Adelaide launch date',async()=>{
  const h=harness(),before=new Date('2026-09-21T14:29:59.999Z'),start=new Date('2026-09-21T14:30:00.000Z');
  assert.equal(await h.rating.invite('a@example.org','production',before),null);assert.equal(h.rows.size,0);
  await assert.rejects(h.rating.submit({rating:5,mode:'production',token:'a'.repeat(64)},before),e=>e.status===403);
  const invitation=await h.rating.invite('a@example.org','production',start);assert.ok(invitation);assert.equal((await h.rating.submit({...invitation,rating:5},start)).ok,true);
});
test('scheduler gates first-day Adelaide sends, and rating route validates origin/JSON before submission',async()=>{
  let timer,http,parts={day:'02',hour:'09'},runs=0,calls=0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/functions/monthly-report.js'),'utf8'),{Date,process:{env:{}},require:name=>{
    if(name==='@azure/functions')return {app:{timer:(_,o)=>timer=o,http:(_,o)=>http=o.handler}};
    if(name==='../lib/monthly-report')return {localParts:()=>parts,deliver:async()=>runs++};
    return {submit:async()=>{calls++;return {ok:true};}};
  }});
  assert.equal(timer.runOnStartup,false);await timer.handler();assert.equal(runs,0);
  parts={day:'01',hour:'08'};await timer.handler();assert.equal(runs,0);
  parts={day:'01',hour:'09'};await timer.handler();assert.equal(runs,1);
  const req=(origin,raw='{}')=>({method:'POST',headers:new Headers({origin,'content-type':'application/json'}),text:async()=>raw});
  assert.equal((await http(req('https://elsewhere.example'))).status,403);
  assert.equal((await http(req('https://join.surflifesavingsa.com.au','bad-json'))).status,400);assert.equal(calls,0);
  assert.equal((await http(req('https://join.surflifesavingsa.com.au'))).status,200);assert.equal(calls,1);
});
