'use strict';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let auth, scope, view = 'overview', currentSettings, records = [], clubs = [], serial = 0;
const titles = { overview:'Overview', leads:'Enquiries', clubs:'Club contacts', analytics:'Website insights', costs:'Azure costs', settings:'Delivery settings', audit:'Activity log' };
const time = value => value ? new Date(value).toLocaleString('en-AU', { timeZone:'Australia/Adelaide', dateStyle:'medium', timeStyle:'short' }) : '—';
async function token() {
  const account = auth.getAllAccounts()[0];
  if (!account) throw new Error('Please sign in again.');
  try { return (await auth.acquireTokenSilent({ scopes:[scope], account })).accessToken; }
  catch (e) { if (e instanceof msal.InteractionRequiredAuthError) { await auth.acquireTokenRedirect({scopes:[scope], account}); } throw e; }
}
async function api(resource, body) {
  const response = await fetch(`/api/dashboard-api/${resource}`, { method:body ? 'PUT':'GET', headers:{ Authorization:`Bearer ${await token()}`, ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function metric(label, value, note='') { return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`; }
function panel(title, body) { return `<section class="panel"><h2>${esc(title)}</h2>${body}</section>`; }
function empty(message) { return `<div class="empty">${esc(message)}</div>`; }
function bars(entries) {
  if (!entries.length) return empty('No data for this period.');
  const max = Math.max(...entries.map(x => x[1]), 1);
  return entries.map(([label,value])=>`<div class="bar-row"><span>${esc(label || 'Direct / unknown')}</span><progress max="${max}" value="${value}" aria-label="${esc(label)}"></progress><b>${esc(value)}</b></div>`).join('');
}
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
function statusLabel(row) { return row.emailDeliveryStatus === 'sent' ? 'Accepted by email service' : row.emailDeliveryStatus || 'Unknown'; }
function leadTable(rows) {
  if (!rows.length) return empty('No enquiries match this period and filters.');
  return table(['Received (Adelaide)','Enquirer','Club','Mode','Email status'], rows.map(row=>`<tr><td>${esc(time(row.submittedAt))}</td><td><button class="link" data-lead="${esc(row.rowKey)}">${esc(row.name)}</button><small>${esc(row.email)}</small></td><td>${esc(row.clubName || row.clubSlug)}</td><td><span class="pill">${esc(row.leadApiMode || 'Unknown')}</span></td><td><span class="pill ${row.emailDeliveryStatus === 'failed' ? 'failed' : row.emailDeliveryStatus === 'sent' ? 'sent' : ''}">${esc(statusLabel(row))}</span></td></tr>`));
}
function group(rows,key) { const counts = new Map(); rows.forEach(r=>counts.set(r[key] || 'Unknown',(counts.get(r[key] || 'Unknown') || 0)+1)); return [...counts].sort((a,b)=>b[1]-a[1]); }
function banner() {
  const s = currentSettings;
  $('mode-banner').className = `banner ${s.mode === 'production' && s.emailEnabled ? 'production' : ''}`;
  $('mode-banner').textContent = !s.emailEnabled ? 'EMAILS PAUSED · Enquiries are saved, but no emails are sent.' : s.mode === 'test' ? `TEST MODE · No emails will be sent to clubs. All enquiry emails go to ${s.testRecipient}.` : 'PRODUCTION MODE · Enquiry emails are sent to the configured club contacts.';
}
async function load() {
  const run = ++serial;
  $('title').textContent = titles[view];
  $('status').textContent = '';
  $('content').innerHTML = empty('Loading…');
  $('refresh').disabled = true;
  try {
    currentSettings = await api('settings');
    if (run !== serial) return;
    banner();
    const days = $('period').value;
    if (view === 'overview' || view === 'leads') {
      records = await api(`leads?days=${days}`);
      if (run !== serial) return;
      if (view === 'overview') {
        const production = records.filter(r=>r.leadApiMode === 'production');
        $('content').innerHTML = `<div class="metrics">${metric('Enquiries received',records.length,'Includes test enquiries')}${metric('Production enquiries',production.length)}${metric('Clubs receiving enquiries',new Set(production.map(r=>r.clubSlug)).size,'Production enquiries only')}${metric('Email failures',records.filter(r=>r.emailDeliveryStatus==='failed').length,'All modes')}</div><div class="grid">${panel('Enquiries by club',bars(group(production,'clubName')))}${panel('Email activity',bars(group(records,'emailDeliveryStatus'))+'<p class="footnote">“Sent” means accepted by the email service. Inbox delivery is not confirmed.</p>')}</div>${panel('Latest enquiries',leadTable(records.slice(0,10)))}`;
      } else {
        $('content').innerHTML = `<div class="filters"><label>Search<input id="search" type="search" placeholder="Name, email, suburb or interests"></label><label>Club<select id="club-filter"><option value="">All clubs</option>${group(records,'clubName').map(([name])=>`<option>${esc(name)}</option>`).join('')}</select></label><label>Mode<select id="mode-filter"><option value="">All modes</option><option value="production">Production</option><option value="test">Test</option></select></label><label>Email status<select id="status-filter"><option value="">All statuses</option><option value="failed">Failed</option><option value="sent">Accepted by email service</option><option value="pending">Pending</option><option value="disabled">Disabled</option></select></label></div><div class="panel" id="lead-table">${leadTable(records)}</div>`;
        ['search','club-filter','mode-filter','status-filter'].forEach(id=>$(id).addEventListener('input',filterLeads));
      }
    } else if (view === 'clubs') {
      clubs = await api('clubs');
      if (run !== serial) return;
      $('content').innerHTML = panel('Club email routing', '<p>Updates apply to new enquiries. Disabling a club stops its enquiry submissions.</p>'+table(['Club','Email recipient','Accepting enquiries',''],clubs.sort((a,b)=>(a.clubName || '').localeCompare(b.clubName || '')).map((c,i)=>`<tr><td>${esc(c.clubName)}<small>${esc(c.rowKey)}</small></td><td><input id="email-${i}" aria-label="${esc(c.clubName)} email" type="email" value="${esc(c.recipientEmail)}"></td><td><input id="enabled-${i}" aria-label="Accept enquiries for ${esc(c.clubName)}" type="checkbox" ${c.enabled ? 'checked':''}></td><td><button data-save-club="${i}">Save</button></td></tr>`)));
    } else if (view === 'settings') {
      const s = currentSettings;
      $('content').innerHTML = panel('Email delivery', `<p>This controls the whole live Join system. Changes apply to enquiries that start after saving; emails already in progress may still complete using their original settings.</p><form id="settings-form" class="form-stack"><label>Delivery mode<select id="delivery-mode"><option value="test" ${s.mode==='test'?'selected':''}>Test — send to test recipient</option><option value="production" ${s.mode==='production'?'selected':''}>Production — send to clubs</option></select></label><label>Test recipient<input id="test-recipient" required type="email" maxlength="180" value="${esc(s.testRecipient)}"></label><label class="check"><input id="email-enabled" type="checkbox" ${s.emailEnabled?'checked':''}>Enable enquiry emails</label><div class="banner">In test mode, no emails will be sent to clubs. Enquiries remain saved and are marked as test enquiries.</div><button type="submit">Save delivery settings</button><p class="footnote">${s.updatedBy ? `Last changed by ${esc(s.updatedBy)} · ${esc(time(s.updatedAt))}` : 'Using the existing Azure email configuration.'}</p></form>`);
      $('settings-form').addEventListener('submit',saveSettings);
    } else if (view === 'analytics') {
      const result = await api(`analytics?days=${days}`);
      if (run !== serial) return;
      const t = result.tables?.[0], values = t ? t.rows.map(row=>Object.fromEntries(t.columns.map((c,i)=>[c.name,row[i]]))) : [];
      const items = kind=>values.filter(r=>r.kind===kind).map(r=>[r.label,r.value]).sort((a,b)=>b[1]-a[1]);
      const totals = Object.fromEntries(items('total'));
      const events = Object.fromEntries(items('event'));
      const conversion = totals.Sessions ? `${((events.lead_submitted || 0)/totals.Sessions*100).toFixed(1)}%` : '—';
      $('content').innerHTML = `<div class="metrics">${metric('Page views',totals['Page views'] || 0)}${metric('Visitors',totals.Visitors || 0,'Browser-based estimate')}${metric('Sessions',totals.Sessions || 0)}${metric('Enquiries per session',conversion,'Tracked submissions ÷ sessions')}</div>${!totals['Page views'] ? '<div class="banner">No website traffic recorded yet for this period. Tracking begins when the website integration is published.</div>' : ''}<div class="grid">${panel('Popular pages',bars(items('page')))}${panel('Traffic sources',bars(items('source')))}${panel('Enquiry journey',bars(items('event')))}${panel('Devices',bars(items('device')))}</div><p class="footnote">Analytics can take a few minutes to appear and may be blocked by browsers. Lead records are the source of truth for enquiries. Form content and contact details are not collected in analytics.</p>`;
    } else if (view === 'costs') {
      const result = await api('costs');
      if (run !== serial) return;
      const p = result.properties;
      const rows = p.rows.map(r=>Object.fromEntries(p.columns.map((c,i)=>[c.name,r[i]])));
      const currencies = [...new Set(rows.map(r=>r.Currency).filter(Boolean))];
      if (currencies.length > 1) throw new Error('Multiple billing currencies returned; totals cannot be combined.');
      const currency = currencies[0] || 'AUD';
      const amount = r=>Number(r.Cost ?? r.PreTaxCost ?? 0);
      const total = rows.reduce((n,r)=>n+amount(r),0);
      const today = new Date(), utcDay = today.getUTCDate(), daysInMonth = new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+1,0)).getUTCDate();
      const todayKey = Number(today.toISOString().slice(0,10).replaceAll('-',''));
      const completed = rows.filter(r=>Number(r.UsageDate)<todayKey);
      const daily = utcDay>1 && completed.length ? completed.reduce((n,r)=>n+amount(r),0)/(utcDay-1) : null;
      const money = v=>v === null ? '—' : new Intl.NumberFormat('en-AU',{style:'currency',currency}).format(v);
      const services = new Map(); rows.forEach(r=>services.set(r.ServiceName,(services.get(r.ServiceName)||0)+amount(r)));
      $('content').innerHTML = `<p class="subtle">Join System subscription · Current billing month · ${esc(currency)}</p><div class="metrics">${metric('Month to date',money(total),'Reported actual cost')}${metric('Month-end estimate',money(daily === null ? null : daily*daysInMonth),'Average daily spend')}${metric('Next 6 months',money(daily === null ? null : daily*365.25/2),'Estimated at current daily rate')}${metric('Next 12 months',money(daily === null ? null : daily*365.25),'Estimated at current daily rate')}</div>${panel('Cost by Azure service',rows.length ? table(['Service',`Cost (${currency})`],[...services].sort((a,b)=>b[1]-a[1]).map(([name,value])=>`<tr><td>${esc(name)}</td><td>${esc(money(value))}</td></tr>`)) : empty('No billing data returned yet.'))}<div class="panel cost-note"><h2>How estimates work</h2><p>${esc(result.note)}</p><p>Estimates exclude future changes in traffic, pricing and resources. Early-month estimates can be unstable; missing billing data can understate the daily rate. They are projections, not an Azure bill or guaranteed forecast.</p></div>`;
    } else if (view === 'audit') {
      const rows = await api(`audit?days=${days}`);
      if (run !== serial) return;
      $('content').innerHTML = panel('Settings and contact changes', rows.length ? table(['Time (Adelaide)','Person','Action','Result','Details'],rows.map(r=>`<tr><td>${esc(time(r.at))}</td><td>${esc(r.actor)}</td><td>${esc(r.action)}</td><td>${esc(r.result)}</td><td>${esc(r.detail)}</td></tr>`)) : empty('No dashboard changes recorded for this period.'));
    }
    if (run === serial) $('updated').textContent = `Updated ${time(new Date())} · Auto-refresh every 60 seconds on reporting pages.`;
  } catch(e) { if (run === serial) { $('status').textContent = e.message; $('content').innerHTML = empty('Data could not be loaded. Check the message above and try Refresh.'); } }
  finally { if(run === serial) $('refresh').disabled = false; }
}
function filterLeads() {
  const text = $('search').value.toLowerCase(), club = $('club-filter').value, mode = $('mode-filter').value, status = $('status-filter').value;
  $('lead-table').innerHTML = leadTable(records.filter(r=>(!club || r.clubName===club) && (!mode || r.leadApiMode===mode) && (!status || r.emailDeliveryStatus===status) && [r.name,r.email,r.phone,r.suburb,r.about,r.filtersJson].join(' ').toLowerCase().includes(text)));
}
async function saveSettings(event) {
  event.preventDefault();
  const body = { mode:$('delivery-mode').value, testRecipient:$('test-recipient').value.trim(), emailEnabled:$('email-enabled').checked, etag:currentSettings.etag || null };
  const warning = !body.emailEnabled ? 'Pause all enquiry emails? Leads will still be saved.' : body.mode==='production' ? 'Enable PRODUCTION? New enquiry emails will be sent to club contacts.' : `Enable TEST mode? No emails will be sent to clubs. Emails will go to ${body.testRecipient}.`;
  if (!confirm(warning)) return;
  const button = event.submitter; button.disabled = true;
  try { await api('settings',body); await load(); $('status').textContent = 'Delivery settings saved.'; }
  catch(e) { $('status').textContent = e.message; button.disabled = false; }
}
$('content').addEventListener('click',async event=>{
  const lead = event.target.closest('[data-lead]');
  if (lead) {
    const row = records.find(r=>r.rowKey===lead.dataset.lead);
    const fields = [['Received',time(row.submittedAt)],['Name',row.name],['Email',row.email],['Phone',row.phone],['Suburb',row.suburb],['Club',row.clubName],['About',row.about],['Preferences',row.filtersJson],['Consent',row.consent?'Given':'Not recorded'],['Source page',row.sourcePage],['Mode',row.leadApiMode],['Email status',statusLabel(row)],['Reference',row.rowKey]];
    $('detail-content').innerHTML = `<h2>Enquiry details</h2><dl>${fields.map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(value || '—')}</dd>`).join('')}</dl>`;
    $('detail').showModal();
  }
  const save = event.target.closest('[data-save-club]');
  if (save) {
    const i = save.dataset.saveClub, c = clubs[i], email = $(`email-${i}`);
    if (!email.reportValidity() || !email.value.trim()) return;
    const enabled = $(`enabled-${i}`).checked;
    if (!confirm(`Update ${c.clubName} to ${email.value.trim()} and ${enabled?'accept':'stop accepting'} new enquiries?`)) return;
    save.disabled = true;
    try { await api('clubs',{slug:c.rowKey,recipientEmail:email.value.trim(),enabled,etag:c.etag}); await load(); $('status').textContent='Club contact saved.'; }
    catch(e) { $('status').textContent=e.message; save.disabled=false; }
  }
});
$('close-detail').onclick = ()=>$('detail').close();
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{ view=button.dataset.view; document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b===button)); load(); });
$('period').onchange=load; $('refresh').onclick=load;
$('sign-in').onclick=()=>auth.loginRedirect({scopes:[scope]});
$('sign-out').onclick=()=>auth.logoutRedirect({postLogoutRedirectUri:location.origin+'/api/dashboard'});
setInterval(()=>{if(auth?.getAllAccounts().length && !['settings','clubs','leads'].includes(view) && !$('detail').open && !document.hidden) load();},60000);
(async()=>{
  try {
    const config = await (await fetch('/api/dashboard/config')).json();
    if (!config.clientId || !config.tenantId) throw new Error('Microsoft sign-in is awaiting Azure configuration.');
    scope = `api://${config.clientId}/Dashboard.Access`;
    auth = new msal.PublicClientApplication({auth:{clientId:config.clientId,authority:`https://login.microsoftonline.com/${config.tenantId}`,redirectUri:location.origin+'/api/dashboard'},cache:{cacheLocation:'sessionStorage'}});
    await auth.initialize(); await auth.handleRedirectPromise();
    if (auth.getAllAccounts().length) {
      const me = await api('me'); $('user').textContent = me.name;
      $('login').hidden=true; $('workspace').hidden=false; load();
    }
  } catch(e) { $('login-status').textContent=e.message; $('sign-in').disabled=!auth; }
})();
