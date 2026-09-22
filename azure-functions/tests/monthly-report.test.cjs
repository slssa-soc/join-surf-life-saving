const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/lib/monthly-report.js'),'utf8');
function harness(){
  const tables=new Map(),sent=[];let version=0,mailStatus=202;
  const get=name=>{if(!tables.has(name))tables.set(name,new Map());return tables.get(name);};
  const ctx={module:{exports:{}},Intl,Date,AbortSignal,process:{env:{JOIN_MAIL_SENDER:'sender@example.org'}},require:name=>{
    if(name==='@azure/data-tables')return {odata:(parts,...args)=>parts.reduce((s,p,i)=>s+p+(args[i]===undefined?'':`'${args[i]}'`),''),TableClient:{fromConnectionString:(_,name)=>({
      createTable:async()=>{},getEntity:async(p,r)=>{const e=get(name).get(p+'/'+r);if(!e)throw {statusCode:404};return {...e};},
      createEntity:async e=>{const key=e.partitionKey+'/'+e.rowKey;if(get(name).has(key))throw {statusCode:409};get(name).set(key,{...e,etag:String(++version)});},
      updateEntity:async(e,mode,options)=>{const key=e.partitionKey+'/'+e.rowKey,old=get(name).get(key);if(options&&options.etag!==old?.etag)throw {statusCode:412};get(name).set(key,{...(mode==='Merge'?old:{}),...e,etag:String(++version)});},
      listEntities:async function*(options){const bounds=[...options.queryOptions.filter.matchAll(/'([^']+)'/g)].map(m=>m[1]);for(const e of get(name).values())if(e.submittedAt>=bounds[0]&&e.submittedAt<bounds[1])yield e;}
    })}};
    if(name==='@azure/identity')return {ClientSecretCredential:class{async getToken(){return {token:'fake'};}}};
    if(name==='./monthly-email')return require('../src/lib/monthly-email');
    if(name==='./rating-availability')return require('../src/lib/rating-availability');
    return require('../data/club-pages.json');
  },fetch:async(url,request)=>{sent.push(JSON.parse(request.body));return {status:mailStatus};}};
  vm.runInNewContext(source,ctx);
  return {report:ctx.module.exports,sent,tables,get,setMailStatus:n=>mailStatus=n};
}
test('Adelaide month boundaries handle summer, winter, leap years and year rollover',()=>{
  const {report:r}=harness();
  assert.equal(r.period(new Date('2026-01-31T14:00:00Z')).key,'2026-01');
  assert.equal(r.period(new Date('2026-01-31T14:00:00Z')).start,'2025-12-31T13:30:00.000Z');
  assert.equal(r.period(new Date('2026-09-01T00:00:00Z')).start,'2026-07-31T14:30:00.000Z');
  assert.equal(r.period(new Date('2024-03-01T00:00:00Z')).end,'2024-02-29T13:30:00.000Z');
  assert.equal(r.period(new Date('2026-01-01T00:00:00Z')).key,'2025-12');
  assert.equal(r.period(new Date('2026-11-01T00:00:00Z')).start,'2026-09-30T14:30:00.000Z');
  assert.equal(r.period(new Date('2026-11-01T00:00:00Z')).end,'2026-10-31T13:30:00.000Z');
});
test('settings validate recipient limits, deduplicate, separate test address and reject stale updates',async()=>{
  const {report:r}=harness(),s={enabled:true,recipients:['a@example.org','A@example.org'],testRecipient:'test@example.org'};
  const saved=await r.saveSettings(s);assert.equal(saved.recipients.length,1);
  await assert.rejects(r.saveSettings(s),e=>e.status===409);
  for(const value of [null,{...s,recipients:[]},{...s,testRecipient:'a@example.org'},{...s,recipients:['a@example.org\r\nBcc:x@example.org']},{...s,recipients:Array.from({length:51},(_,n)=>`${n}@example.org`)}])assert.throws(()=>r.validate(value));
});
test('aggregate counts enquiries once, excludes tests and never echoes personal or arbitrary fields',()=>{
  const {report:r}=harness();
  const row={clubSlug:'aldinga-bay-slsc',name:'SECRET PERSON',email:'secret@example.org',about:'SECRET NOTE',clubName:'SECRET CLUB',leadApiMode:'production',filtersJson:JSON.stringify([{name:'Age group',value:'Nippers'},{name:'Interest',value:'Training and new skills'},{name:'Interest',value:'Training and new skills'},{name:'Interest',value:'secret@example.org'}])};
  const a=r.aggregate([row,{...row,leadApiMode:'test'},{clubSlug:'secret@example.org',filtersJson:'broken'}]);
  assert.equal(a.total,2);assert.equal(a.interests.Training,1);assert.equal(a.ages['Nippers (5–13)'],1);assert.equal(a.unclassified,1);
  const html=r.render({...a,period:r.period(new Date('2026-09-01')),previousTotal:0,ratings:{count:0}},true);
  assert.match(html,/OUT-OF-SEQUENCE/);assert.doesNotMatch(html,/SECRET|secret@example|Engagement Score/);assert.match(html,/Not available/);
});
test('scheduled sends are claimed once across concurrent workers; tests use only separate recipient',async()=>{
  const h=harness(),r=h.report,now=new Date('2026-09-01T00:00:00Z');
  await r.saveSettings({enabled:true,recipients:['group@example.org'],testRecipient:'test@example.org'});
  await Promise.all([r.deliver({now}),r.deliver({now})]);assert.equal(h.sent.length,1);assert.equal(h.sent[0].message.bccRecipients[0].emailAddress.address,'group@example.org');
  const requestId='00000000-0000-4000-8000-000000000001';
  await r.deliver({test:true,requestId,now});await r.deliver({test:true,requestId,now});assert.equal(h.sent.length,2);
  assert.equal(h.sent[1].message.bccRecipients.length,1);assert.equal(h.sent[1].message.bccRecipients[0].emailAddress.address,'test@example.org');assert.match(h.sent[1].message.subject,/OUT-OF-SEQUENCE/);
});
test('uncertain delivery is held for review and is not automatically retried',async()=>{
  const h=harness(),r=h.report,now=new Date('2026-09-01T00:00:00Z');
  await r.saveSettings({enabled:true,recipients:['group@example.org'],testRecipient:''});h.setMailStatus(503);
  await assert.rejects(r.deliver({now}),e=>e.status===502);assert.equal((await r.deliver({now})).status,'needs-review');assert.equal(h.sent.length,1);
});
test('real period boundaries, test exclusion, previous month and rating denominator are respected',async()=>{
  const h=harness(),r=h.report;
  for(const [id,time,mode] of [['before','2026-07-31T14:29:59.999Z','production'],['start','2026-07-31T14:30:00.000Z','production'],['test','2026-08-05T00:00:00.000Z','test'],['end','2026-08-31T14:30:00.000Z','production']])h.get('LeadSubmissions').set(id,{submittedAt:time,leadApiMode:mode});
  h.get('JoinEnquiryRatings').set('one',{submittedAt:'2026-08-05T00:00:00.000Z',rating:5,mode:'production'});
  h.get('JoinEnquiryRatings').set('test',{submittedAt:'2026-08-05T00:00:00.000Z',rating:1,mode:'test'});
  const report=await r.build(new Date('2026-09-01T00:00:00Z'));assert.equal(report.total,1);assert.equal(report.previousTotal,1);assert.equal(report.ratings.count,0);assert.equal(report.ratings.average,null);assert.equal(report.ratings.status,'unavailable');
});
test('ratings start at Adelaide midnight on 22 September; launch month is partial and historical data excluded',async()=>{
  const h=harness(),r=h.report;
  for(const [id,date,rating,mode] of [['before','2026-09-21T14:29:59.999Z',1,'production'],['start','2026-09-21T14:30:00.000Z',5,'production'],['test','2026-09-22T00:00:00.000Z',1,'test'],['end','2026-09-30T14:30:00.000Z',1,'production']])h.get('JoinEnquiryRatings').set(id,{submittedAt:date,rating,mode});
  const launch=await r.build(new Date('2026-10-01'));assert.equal(launch.ratings.status,'partial');assert.equal(launch.ratings.count,1);assert.equal(launch.ratings.average,5);assert.match(r.render(launch),/Partial month \(22–30 Sep\)/);
  const next=await r.build(new Date('2026-11-01'));assert.equal(next.ratings.status,'available');assert.equal(next.ratings.count,1);assert.doesNotMatch(r.render(next),/Partial month/);
  const empty=await r.build(new Date('2026-12-01'));assert.equal(empty.ratings.status,'available');assert.match(r.render(empty),/No ratings yet/);
});
test('enquiry change uses directional colour and text; all headline figures use the same colour',()=>{
  const {report:r}=harness();const data={...r.aggregate([]),period:r.period(new Date('2026-09-01')),ratings:{count:18,average:4.4},previousTotal:10};
  const up=r.render({...data,total:12}),down=r.render({...data,total:8}),flat=r.render({...data,total:10});
  assert.match(up,/#237a46[^>]*>▲ 2 more/);assert.match(down,/#b42332[^>]*>▼ 2 fewer/);assert.match(flat,/— No change/);
  assert.doesNotMatch(up,/#0071e3|4\.4 \/ 5/);assert.match(up,/Not available · Starts 22 Sep 2026/);
});
