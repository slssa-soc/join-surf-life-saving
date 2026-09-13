// A shared, versioned cache prevents scaled Function workers and multiple users
// from each calling the billing API. Expiring leases recover from worker failure.
const { TableClient } = require('@azure/data-tables');
function retryDelay(headers, now = Date.now()) {
  const delays = [60000];
  for (const [name, value] of headers.entries()) {
    if (name.toLowerCase().includes('retry-after')) {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) delays.push(seconds * 1000);
      else { const date = Date.parse(value); if (Number.isFinite(date)) delays.push(date - now); }
    }
  }
  return Math.max(...delays);
}
function createReportCache(getTable, now = Date.now) {
  async function read(t, key) {
    try { return await t.getEntity('reports', key); }
    catch (e) { if (e.statusCode === 404) return null; throw e; }
  }
  function response(row, message) {
    let data;
    if (row?.parts) data = JSON.parse(Array.from({length:row.parts}, (_,i)=>row[`data${i}`]).join(''));
    return { ...(data || {}), unavailable: !data, stale: Boolean(data && message), ...(message ? {notice:message} : {}), fetchedAt:row?.fetchedAt || null, retryAt:row?.nextAttemptAt ? new Date(row.nextAttemptAt).toISOString() : null };
  }
  return async (key, ttl, fetchReport) => {
    const t = getTable();
    await t.createTable().catch(e=>{if(e.statusCode!==409) throw e;});
    const row = await read(t,key);
    if (row?.expiresAt > now() && row.parts) return response(row);
    if (row?.nextAttemptAt > now()) return response(row, 'Azure has delayed the next billing update. The dashboard will retry after the time shown.');
    if (row?.leaseUntil > now()) return response(row, 'A billing update is in progress.');
    const lease = {...row, partitionKey:'reports', rowKey:key, leaseUntil:now()+90000};
    delete lease.etag; delete lease.timestamp;
    try {
      if (row) await t.updateEntity(lease,'Replace',{etag:row.etag}); else await t.createEntity(lease);
    } catch(e) {
      if ([409,412].includes(e.statusCode)) return response(await read(t,key),'A billing update is in progress.');
      throw e;
    }
    const locked = await read(t,key);
    try {
      const data = await fetchReport();
      const serialized = JSON.stringify(data);
      if (serialized.length > 600000) throw new Error('Billing report is too large to cache.');
      const entity = {partitionKey:'reports',rowKey:key,leaseUntil:0,nextAttemptAt:0,expiresAt:now()+ttl,fetchedAt:new Date(now()).toISOString(),parts:Math.ceil(serialized.length/30000)};
      for(let i=0;i<entity.parts;i++) entity[`data${i}`]=serialized.slice(i*30000,(i+1)*30000);
      await t.updateEntity(entity,'Replace',{etag:locked.etag});
      return response(entity);
    } catch(e) {
      const cooldown = {...lease, leaseUntil:0, nextAttemptAt:now()+(e.retryMs || 300000)};
      await t.updateEntity(cooldown,'Replace',{etag:locked.etag}).catch(()=>{});
      if(e.status===429) return response(cooldown,'Azure is limiting billing requests. The last available figures are shown when available.');
      if(row?.parts) return response(cooldown,'The billing update failed. Showing the last successful figures.');
      throw e;
    }
  };
}
const cachedReport = createReportCache(()=>TableClient.fromConnectionString(process.env.AzureWebJobsStorage,'JoinDashboardReports'));
module.exports = { retryDelay, createReportCache, cachedReport };
