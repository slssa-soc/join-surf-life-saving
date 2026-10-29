const crypto = require('node:crypto');
async function recordLogin(table, actor, sessionId) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw Object.assign(new Error('A valid dashboard session is required.'), { status: 400 });
  }
  await table.createTable().catch(e => { if (e.statusCode !== 409) throw e; });
  const key = crypto.createHash('sha256').update(actor.id + ':' + sessionId).digest('hex');
  try {
    await table.createEntity({partitionKey:'audit',rowKey:'login-'+key,at:new Date().toISOString(),actorId:actor.id,actor:actor.name,actorEmail:actor.email||'',action:'login',result:'success',detail:JSON.stringify({account:actor.email||actor.name,method:'Microsoft account — dashboard session started'})});
  } catch(e) { if (e.statusCode !== 409) throw e; }
  return {ok:true};
}
module.exports={recordLogin};
