const {test}=require('node:test');
const assert=require('node:assert/strict');
const {snapshotStream}=require('../src/lib/live-stream');
const decode=value=>new TextDecoder().decode(value);
test('stream sends initial data, suppresses unchanged reports and delivers changes',async()=>{
  let version=1,reads=0;
  const reader=snapshotStream({resources:['leads'],intervalMs:8,durationMs:1000,read:async()=>{reads++;return{status:200,jsonBody:{version}};}}).getReader();
  assert.match(decode((await reader.read()).value),/event: connected/);
  assert.match(decode((await reader.read()).value),/"version":1/);
  assert.match(decode((await reader.read()).value),/event: heartbeat/);
  assert.match(decode((await reader.read()).value),/event: heartbeat/);
  version=2;
  assert.match(decode((await reader.read()).value),/"version":2/);
  await reader.cancel();const before=reads;await new Promise(r=>setTimeout(r,30));assert.equal(reads,before);
});
test('expired authentication closes the connection without emitting report data',async()=>{
  const reader=snapshotStream({resources:['leads'],read:async()=>({status:401,jsonBody:{error:'Sign in again'}})}).getReader();
  await reader.read();assert.match(decode((await reader.read()).value),/event: report-error/);assert.equal((await reader.read()).done,true);
});
test('connection ends within its lifetime even if a report is slow',async()=>{
  let finish;
  const reader=snapshotStream({resources:['leads'],durationMs:15,read:()=>new Promise(r=>finish=r)}).getReader();
  await reader.read();assert.equal((await reader.read()).done,true);
  finish({status:200,jsonBody:[]});await new Promise(r=>setTimeout(r,5));
});
test('a recovered report is emitted even when its contents have not changed',async()=>{
  let reads=0;
  const reader=snapshotStream({resources:['leads'],intervalMs:5,read:async()=>++reads===2?{status:500,jsonBody:{error:'Temporary'}}:{status:200,jsonBody:[]}}).getReader();
  let snapshots=0,errors=0;
  while(snapshots<2){const text=decode((await reader.read()).value);if(text.includes('event: snapshot'))snapshots++;if(text.includes('event: report-error'))errors++;}
  assert.equal(errors,1);await reader.cancel();
});
