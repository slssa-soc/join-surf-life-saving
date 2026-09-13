const { app } = require('@azure/functions');
const { TableClient, odata } = require('@azure/data-tables');
const { DefaultAzureCredential } = require('@azure/identity');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { authenticate } = require('../lib/auth');
const settings = require('../lib/settings');
const { retryDelay, cachedReport } = require('../lib/report-cache');
const credential = new DefaultAzureCredential();
const subscription = process.env.DASHBOARD_SUBSCRIPTION_ID || 'e2b00106-f5be-47d3-9709-589887295fd6';
function table(name) { return TableClient.fromConnectionString(process.env.AzureWebJobsStorage, name); }
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
function json(status, body) { return { status, headers, jsonBody: body }; }
async function azure(url, scope, body) {
  const token = await credential.getToken(scope);
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json', ClientType:'JoinSLSSADashboard' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw Object.assign(new Error(`Azure returned ${res.status}. ${res.status === 429 ? 'Billing requests are temporarily limited.' : 'The report could not be loaded.'}`), { status: res.status === 429 ? 429 : 502, retryMs:retryDelay(res.headers) });
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
app.http('dashboard-assets', {
  methods: ['GET'], authLevel: 'anonymous', route: 'dashboard/{asset?}',
  handler: async request => {
    const asset = request.params.asset || 'index.html';
    if (asset === 'config') return json(200, { tenantId: process.env.DASHBOARD_TENANT_ID || '', clientId: process.env.DASHBOARD_CLIENT_ID || '' });
    const allowed = { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'reports.js': 'text/javascript; charset=utf-8', 'style.css': 'text/css; charset=utf-8', 'updates.css': 'text/css; charset=utf-8', 'favicon.svg': 'image/svg+xml', 'msal-browser.min.js': 'text/javascript; charset=utf-8' };
    if (!allowed[asset]) return json(404, { error: 'Not found' });
    return { status: 200, headers: { ...headers, 'Content-Type': allowed[asset], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://login.microsoftonline.com; frame-src https://login.microsoftonline.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", 'X-Frame-Options': 'DENY' }, body: fs.readFileSync(path.join(__dirname, '../../public', asset), 'utf8') };
  }
});
app.http('dashboard-data', {
  methods: ['GET', 'PUT'], authLevel: 'anonymous', route: 'dashboard-api/{resource}',
  handler: async (request, context) => {
    try {
      const actor = await authenticate(request);
      const resource = request.params.resource;
      const url = new URL(request.url);
      if (request.method === 'PUT') {
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json(415, { error: 'JSON required.' });
        const body = await request.json();
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
      if (resource === 'settings') return json(200, await settings.readSettings());
      if (resource === 'clubs') return json(200, await list(table(process.env.LEAD_ROUTE_TABLE_NAME || 'ClubLeadRouting'), odata`PartitionKey eq ${'club'}`));
      if (resource === 'leads') {
        const { since } = dateRange(url);
        const rows = await list(table(process.env.LEAD_TABLE_NAME || 'LeadSubmissions'), odata`submittedAt ge ${since}`);
        return json(200, rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(({ emailHash, ...row }) => row));
      }
      if (resource === 'audit') {
        const { since } = dateRange(url);
        try { return json(200, (await list(table('JoinDashboardAudit'), odata`at ge ${since}`)).sort((a, b) => b.at.localeCompare(a.at))); }
        catch (e) { if (e.statusCode === 404) return json(200, []); throw e; }
      }
      if (resource === 'analytics') {
        const { days } = dateRange(url);
        const appId = process.env.DASHBOARD_INSIGHTS_APP_ID || '170eb745-4899-4885-97b4-c6987d9830de';
        const query = `let p = pageViews | where timestamp > ago(${days}d) | where tostring(customDimensions.site) == 'join'; let e = customEvents | where timestamp > ago(${days}d) | where tostring(customDimensions.site) == 'join'; union (p | summarize value=count() by label='Page views' | extend category='total'), (p | summarize value=dcount(user_Id) by label='Visitors' | extend category='total'), (p | summarize value=dcount(session_Id) by label='Sessions' | extend category='total'), (p | summarize value=count() by label=format_datetime(timestamp,'yyyy-MM-dd') | extend category='daily'), (p | summarize value=count() by label=tostring(customDimensions.referrer) | extend category='source'), (p | summarize value=count() by label=tostring(customDimensions.device) | extend category='device'), (p | summarize value=count() by label=name | top 15 by value desc | extend category='page'), (e | summarize value=count() by label=name | extend category='event')`;
        return json(200, await azure(`https://api.applicationinsights.io/v1/apps/${appId}/query`, 'https://api.applicationinsights.io/.default', { query }));
      }
      if (resource === 'costs') {
        return json(200, await cachedReport(`costs-${new Date().toISOString().slice(0,7)}`, 6*3600000, async () => {
        const data = await azure(`https://management.azure.com/subscriptions/${subscription}/providers/Microsoft.CostManagement/query?api-version=2025-03-01`, 'https://management.azure.com/.default', { type: 'ActualCost', timeframe: 'MonthToDate', dataset: { granularity: 'Daily', aggregation: { totalCost: { name: 'Cost', function: 'Sum' } }, grouping: [{ type: 'Dimension', name: 'ServiceName' }] } });
        return { ...data, scope: 'Join System subscription', note: 'Billing figures refresh at most every six hours. Azure billing is delayed. Projections use average daily spend from completed days this month; 6 and 12 months assume the same daily rate.' };
        }));
      }
      return json(404, { error: 'Not found' });
    } catch (e) {
      context.error('Dashboard request failed', e.status || e.statusCode || 500, e.name);
      const status = e.status || ([409, 412].includes(e.statusCode) ? 409 : 500);
      return json(status, { error: status === 500 ? 'The service could not complete this request. Refresh to verify whether a change was applied.' : e.message });
    }
  }
});
