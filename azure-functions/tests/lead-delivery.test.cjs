const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { AsyncLocalStorage } = require('node:async_hooks');
function harness(configs,invite=async()=>null) {
  let handler;
  const stored = [], sent = [];
  const sandbox = {
    process: { env: { AzureWebJobsStorage:'mock', JOIN_MAIL_TENANT_ID:'mock', JOIN_MAIL_CLIENT_ID:'mock', JOIN_MAIL_CLIENT_SECRET:'mock', JOIN_MAIL_SENDER:'join@example.com' } },
    require(name) {
      if (name==='@azure/functions') return { app: {http:(_,options)=>{handler=options.handler;}} };
      if (name==='@azure/data-tables') return {TableClient:{fromConnectionString:()=>({
        createTable:async()=>{}, getEntity:async(_,slug)=>({rowKey:slug,clubName:slug,recipientEmail:`${slug}@example.com`,enabled:true}),
        createEntity:async e=>{stored.push(e); await new Promise(r=>setTimeout(r,5));}, updateEntity:async()=>{}
      })}};
      if (name==='@azure/identity') return {ClientSecretCredential:class{async getToken(){return {token:'mock'};}}};
      if (name==='../lib/settings') return {readSettings:async()=>{const c=configs.shift(); if(c instanceof Error) throw c; return c;}};
      if (name==='../lib/enquiry-rating') return {invite};
      if (name==='../../public/attribution') return require('../public/attribution');
      if (name==='node:async_hooks') return {AsyncLocalStorage};
      return require(name);
    },
    fetch:async(_,request)=>{sent.push(JSON.parse(request.body));return {status:202};},
    console, setTimeout
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/functions/lead.js'),'utf8'),sandbox);
  const request = (slug,wantExperienceRating=false)=>({method:'POST',headers:new Headers(),json:async()=>({clubSlug:slug,name:'Test',email:'person@example.com',consent:true,wantExperienceRating})});
  const context={log(){},warn(){},error(){}};
  return {run:(slug,wantExperienceRating)=>handler(request(slug,wantExperienceRating),context),stored,sent};
}
test('concurrent test and production requests retain their own delivery snapshot',async()=>{
  const h=harness([{mode:'test',testRecipient:'test@example.com',emailEnabled:true},{mode:'production',testRecipient:'test@example.com',emailEnabled:true}]);
  const results=await Promise.all([h.run('alpha'),h.run('beta')]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);
  assert.deepEqual(h.stored.map(r=>r.leadApiMode),['test','production']);
  assert.deepEqual(h.sent.map(r=>r.message.toRecipients[0].emailAddress.address),['test@example.com','beta@example.com']);
});
test('unavailable settings stop submissions before storage or email',async()=>{
  const h=harness([new Error('storage offline')]);
  assert.equal((await h.run('alpha')).status,503);
  assert.equal(h.stored.length,0); assert.equal(h.sent.length,0);
});
test('paused email delivery still captures an enquiry without sending',async()=>{
  const h=harness([{mode:'production',testRecipient:'test@example.com',emailEnabled:false}]);
  assert.equal((await h.run('alpha')).status,200);
  assert.equal(h.stored.length,1); assert.equal(h.sent.length,0);
});
test('only rating-capable clients receive invitations after success; feedback failure never fails the enquiry',async()=>{
  let invitations=0;
  const config={mode:'production',testRecipient:'test@example.com',emailEnabled:true};
  const h=harness([config,config,config],async()=>{invitations++;if(invitations===2)throw Error('feedback unavailable');return {token:'a'.repeat(64),mode:'production'};});
  assert.equal((await h.run('alpha')).status,200);assert.equal(invitations,0);
  const result=await h.run('alpha',true);assert.equal(result.status,200);
  assert.equal(result.jsonBody?.ratingInvitation?.token || JSON.parse(result.body).ratingInvitation.token,'a'.repeat(64));
  assert.equal((await h.run('alpha',true)).status,200);assert.equal(invitations,2);
});
