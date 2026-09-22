const { app } = require('@azure/functions');
app.setup({ enableHttpStream: true });
const { snapshotStream } = require('../lib/live-stream');
const { TableClient, odata } = require('@azure/data-tables');
const { DefaultAzureCredential } = require('@azure/identity');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { authenticate } = require('../lib/auth');
const settings = require('../lib/settings');
const monthlyReport = require('../lib/monthly-report');
const {store:clubPages,publicPage}=require('../lib/club-content');
const { retryDelay, cachedReport } = require('../lib/report-cache');
const { analyticsQuery } = require('../lib/analytics-query');
const credential = new DefaultAzureCredential();
const subscription = process.env.DASHBOARD_SUBSCRIPTION_ID || 'e2b00106-f5be-47d3-9709-589887295fd6';
function table(name) { return TableClient.fromConnectionString(process.env.AzureWebJobsStorage, name); }
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
function json(status, body) { return { status, headers, jsonBody: body }; }
async function azure(url, scope, body) {
  const token = await credential.getToken(scope);
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json', ClientType:'JoinSLSSADashboard' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw Object.assign(new Error(`The reporting service returned ${res.status}. ${res.status === 429 ? 'Billing requests are temporarily limited.' : 'The report could not be loaded.'}`), { status: res.status === 429 ? 429 : 502, retryMs:retryDelay(res.headers) });
  return res.json();
}
async function audit(actor, action, detail, result = 'requested') {
  const t = table('JoinDashboardAudit');
  await t.createTable().catch(e => { if (e.statusCode !== 409) throw e; });
  await t.createEntity({ partitionKey: 'audit', rowKey: `${Date.now()}-${crypto.randomUUID()}`, at: new Date().toISOString(), actorId: actor.id, actor: actor.name, action, detail: JSON.stringify(detail), result });
}
async function list(t, filter, limit = 10000) {
  const rows = [];
  for await (const row of t.listEntities({ queryOptions: { filter } })) {
    rows.push(row);
    if (rows.length > limit) throw Object.assign(new Error('Too many records. Choose a shorter date range.'), { status: 422 });
  }
  return rows;
}
function dateRange(url) {
  const days = Number(url.searchParams.get('days') || 30);
  if (![7, 30, 90, 365].includes(days)) throw Object.assign(new Error('Invalid date range.'), { status: 400 });
  return { days, since: new Date(Date.now() - days * 86400000).toISOString() };
}
app.http('tracking-config',{methods:['GET'],authLevel:'anonymous',route:'tracking-config',handler:async()=>{
  let mode='unknown';try{mode=(await settings.readSettings()).mode;}catch{}
  return {status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://join.surflifesavingsa.com.au','Cache-Control':'no-store'},jsonBody:{mode}};
}});
app.http('dashboard-assets', {
  methods: ['GET'], authLevel: 'anonymous', route: 'dashboard/{asset?}',
  handler: async request => {
    const asset = request.params.asset || 'index.html';
    if (asset === 'config') return json(200, { tenantId: process.env.DASHBOARD_TENANT_ID || '', clientId: process.env.DASHBOARD_CLIENT_ID || '' });
    const allowed = { 'editor.js':'text/javascript; charset=utf-8','editor.css':'text/css; charset=utf-8','quill.js':'text/javascript; charset=utf-8','quill.core.css':'text/css; charset=utf-8','purify.min.js':'text/javascript; charset=utf-8', 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'live.js': 'text/javascript; charset=utf-8', 'reports.js': 'text/javascript; charset=utf-8', 'attribution.js': 'text/javascript; charset=utf-8', 'campaign.js': 'text/javascript; charset=utf-8', 'style.css': 'text/css; charset=utf-8', 'updates.css': 'text/css; charset=utf-8', 'favicon.svg': 'image/svg+xml', 'msal-browser.min.js': 'text/javascript; charset=utf-8' };
    if (!allowed[asset]) return json(404, { error: 'Not found' });
    return { status: 200, headers: { ...headers, 'Content-Type': allowed[asset], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://join.surflifesavingsa.com.au; connect-src 'self' https://login.microsoftonline.com; frame-src https://login.microsoftonline.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", 'X-Frame-Options': 'DENY' }, body: fs.readFileSync(path.join(__dirname, '../../public', asset), 'utf8') };
  }
});
async function dashboardData(request, context) {
    try {
      const actor = await authenticate(request);
      const resource = request.params.resource;
      const url = new URL(request.url);
      if (request.method === 'PUT') {
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json(415, { error: 'JSON required.' });
        const raw=await request.text();
        if(raw.length>7500000)return json(413,{error:'The request is too large. Use a photo below 5 MB.'});
        let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'Invalid JSON.'});}
        if(resource==='monthly-report-settings'){
          monthlyReport.validate(body);
          await audit(actor,'monthly-report-settings',{enabled:body.enabled},'requested');
          const result=await monthlyReport.saveSettings(body);
          await audit(actor,'monthly-report-settings',{enabled:result.enabled},'completed');
          return json(200,result);
        }
        if(resource==='monthly-report-test'){
          await audit(actor,'monthly-report-test',{},'requested');
          const result=await monthlyReport.deliver({test:true,requestId:body.requestId});
          await audit(actor,'monthly-report-test',result,'completed');
          return json(200,result);
        }
        if(resource==='club-pages')return json(200,await clubPages.save(url.searchParams.get('slug'),body,actor));
        if (resource === 'settings') {
          let value;
          try { value = settings.validateSettings(body); } catch (e) { return json(400, { error: e.message }); }
          const t = settings.client();
          await t.createTable().catch(e => { if (e.statusCode !== 409) throw e; });
          const before = await settings.readSettings();
          if ((before.etag || null) !== (body.etag || null)) return json(409, { error: 'Settings changed. Refresh before saving.' });
          await audit(actor, 'delivery-settings', { before: { mode: before.mode, testRecipient: before.testRecipient, emailEnabled: before.emailEnabled }, after: value });
          const entity = { partitionKey: 'settings', rowKey: 'delivery', ...value, updatedAt: new Date().toISOString(), updatedBy: actor.name };
          if (before.etag) await t.updateEntity(entity, 'Replace', { etag: before.etag }); else await t.createEntity(entity);
          await audit(actor, 'delivery-settings', value, 'completed');
          return json(200, await settings.readSettings());
        }
        if (resource === 'clubs') {
          if (typeof body.slug !== 'string' || typeof body.recipientEmail !== 'string' || body.recipientEmail.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipientEmail) || typeof body.enabled !== 'boolean' || !body.etag) return json(400, { error: 'A valid club, email, enabled flag and current version are required.' });
          const t = table(process.env.LEAD_ROUTE_TABLE_NAME || 'ClubLeadRouting');
          const before = await t.getEntity('club', body.slug);
          if (before.etag !== body.etag) return json(409, { error: 'Club changed. Refresh before saving.' });
          await audit(actor, 'club-routing', { slug: body.slug, before: { recipientEmail: before.recipientEmail, enabled: before.enabled }, after: { recipientEmail: body.recipientEmail, enabled: body.enabled } });
          await t.updateEntity({ partitionKey: 'club', rowKey: body.slug, recipientEmail: body.recipientEmail.trim(), enabled: body.enabled }, 'Merge', { etag: before.etag });
          await audit(actor, 'club-routing', { slug: body.slug, recipientEmail: body.recipientEmail, enabled: body.enabled }, 'completed');
          return json(200, { ok: true });
        }
        return json(404, { error: 'Not found' });
      }
      if (resource === 'me') return json(200, actor);
      if(resource==='monthly-report-settings')return json(200,{...await monthlyReport.readSettings(),latest:await monthlyReport.latest()});
      if(resource==='club-pages'){
        const slug=url.searchParams.get('slug');
        if(!slug)return json(200,(await clubPages.list()).map(p=>({slug:p.slug,title:p.content.title,updatedAt:p.updatedAt,updatedBy:p.updatedBy})));
        if(url.searchParams.get('revision'))return json(200,await clubPages.revision(slug,url.searchParams.get('revision')));
        if(url.searchParams.get('history')==='true')return json(200,await clubPages.history(slug));
        return json(200,await clubPages.read(slug));
      }
      if (resource === 'settings') return json(200, await settings.readSettings());
      if (resource === 'clubs') return json(200, await list(table(process.env.LEAD_ROUTE_TABLE_NAME || 'ClubLeadRouting'), odata`PartitionKey eq ${'club'}`));
      if (resource === 'leads') {
        const { since } = dateRange(url);
        const rows = await list(table(process.env.LEAD_TABLE_NAME || 'LeadSubmissions'), odata`submittedAt ge ${since}`);
        return json(200, rows.filter(r=>url.searchParams.get('includeTest')==='true'||r.leadApiMode!=='test').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(({ emailHash, ...row }) => row));
      }
      if (resource === 'audit') {
        const { since } = dateRange(url);
        let rows=[];try{rows=await list(table('JoinDashboardAudit'),odata`at ge ${since}`);}catch(e){if(e.statusCode!==404)throw e;}
        return json(200,[...rows,...await clubPages.audit(since)].sort((a,b)=>b.at.localeCompare(a.at)));
      }
      if (resource === 'analytics') {
        const { days } = dateRange(url);
        const appId = process.env.DASHBOARD_INSIGHTS_APP_ID || '170eb745-4899-4885-97b4-c6987d9830de';
        const query = analyticsQuery(days, url.searchParams.get('includeTest')==='true');
        return json(200, await azure(`https://api.applicationinsights.io/v1/apps/${appId}/query`, 'https://api.applicationinsights.io/.default', { query }));
      }
      if (resource === 'costs') {
        return json(200, await cachedReport(`costs-${new Date().toISOString().slice(0,7)}`, 6*3600000, async () => {
        const data = await azure(`https://management.azure.com/subscriptions/${subscription}/providers/Microsoft.CostManagement/query?api-version=2025-03-01`, 'https://management.azure.com/.default', { type: 'ActualCost', timeframe: 'MonthToDate', dataset: { granularity: 'Daily', aggregation: { totalCost: { name: 'Cost', function: 'Sum' } }, grouping: [{ type: 'Dimension', name: 'ServiceName' }] } });
        return { ...data, scope: 'Join system', note: 'Billing figures refresh at most every six hours. Billing data can be delayed. Projections use average daily spend from completed days this month; 6 and 12 months assume the same daily rate.' };
        }));
      }
      return json(404, { error: 'Not found' });
    } catch (e) {
      context.error('Dashboard request failed', e.status || e.statusCode || 500, e.name);
      const status = e.status || ([409, 412].includes(e.statusCode) ? 409 : 500);
      return json(status, { error: status === 500 ? 'The service could not complete this request. Refresh to verify whether a change was applied.' : e.message });
    }
}
app.http('dashboard-data', { methods: ['GET','PUT'], authLevel:'anonymous', route:'dashboard-api/{resource}', handler:dashboardData });

app.http('dashboard-live', {
  methods:['GET'], authLevel:'anonymous', route:'dashboard-live',
  handler: async (request, context) => {
    try {
      await authenticate(request);
      const url = new URL(request.url);
      dateRange(url);
      const resourcesByView = {
        overview:['settings','leads','clubs','analytics','costs'],
        leads:['settings','leads'], analytics:['settings','leads','analytics'],
        costs:['settings','costs'], clubs:['settings','clubs'],
        pages:['settings'], settings:['settings'], campaigns:['settings'], audit:['settings','audit']
      };
      const resources = resourcesByView[url.searchParams.get('view')];
      if (!resources) return json(400,{error:'Invalid dashboard view.'});
      const body = snapshotStream({ resources, read: resource => dashboardData({
        method:'GET', params:{resource}, url:request.url, headers:request.headers
      },context) });
      return {status:200,headers:{...headers,'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'},body};
    } catch(e) { return json(e.status || 500,{error:e.status ? e.message : 'Live connection unavailable.'}); }
  }
});
app.http('public-club-pages',{
  methods:['GET'],authLevel:'anonymous',route:'club-pages/{slug?}',
  handler:async request=>{
    try{
      const slug=request.params.slug;
      const value=slug?publicPage(await clubPages.read(slug)):(await clubPages.list()).map(p=>({slug:p.slug,version:p.version,content:Object.fromEntries(Object.entries(p.content).filter(([key])=>['title','summary','image','imageAlt','suburb','region','memberSize','gym','restaurant','accessibleFacilities','beachAccess'].includes(key)))}));
      return {status:200,headers:{...headers,'Access-Control-Allow-Origin':'https://join.surflifesavingsa.com.au'},jsonBody:value};
    }catch(e){return json(e.status||503,{error:e.status?e.message:'Club content is temporarily unavailable.'});}
  }
});
app.http('public-club-image',{
  methods:['GET'],authLevel:'anonymous',route:'club-images/{slug}/{file}',
  handler:async request=>{
    try{const result=await clubPages.image(request.params.slug,request.params.file);return {status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'},body:result.readableStreamBody};}
    catch(e){return json(e.status||503,{error:e.status?e.message:'Image temporarily unavailable.'});}
  }
});
