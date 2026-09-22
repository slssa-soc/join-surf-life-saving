'use strict';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function monthlyReportSettings() {
  const run=serial;
  let s=await api('monthly-report-settings');
  if(run!==serial||view!=='settings-monthly')return;
  const labels={'accepted':'Accepted by Microsoft 365 (inbox delivery is not confirmed)','not-sent':'Not sent','sending':'Send in progress or outcome uncertain — check sender mailbox','needs-review':'Needs review — check sender mailbox before any resend'};
  $('content').insertAdjacentHTML('beforeend',panel('Monthly reporting',`<p>Send an anonymous summary for the previous calendar month on the first day of every month, from 9 am Adelaide time. Includes enquiries, clubs, selected age groups, interests and Enquiry Experience Rating.</p><form id="monthly-form" class="form-stack"><label class="check"><input id="monthly-enabled" type="checkbox" ${s.enabled?'checked':''}>Enable scheduled monthly reports</label><label>Report recipients<textarea id="monthly-recipients" rows="4" placeholder="One email address per line">${esc(s.recipients.join('\n'))}</textarea></label><p class="footnote">Up to 50 addresses. Recipients are hidden from one another.</p><label>Separate test email address<input id="monthly-test-recipient" type="email" maxlength="180" value="${esc(s.testRecipient)}"></label><button type="submit">Save reporting settings</button></form><p>Latest scheduled report (${esc(s.latest.month)}): ${esc(labels[s.latest.status]||s.latest.status)}.</p><p>Test emails use real data and are labelled “TEST — OUT-OF-SEQUENCE”. Save settings before testing. A test does not change the monthly schedule.</p><button id="monthly-send-test" class="secondary" ${s.testRecipient?'':'disabled'}>Send test report</button><p id="monthly-status" role="status"></p>`));
  let requestId=crypto.randomUUID();
  $('monthly-form').addEventListener('input',()=>{$('monthly-send-test').disabled=true;$('monthly-status').textContent='Save your reporting settings before sending a test.';});
  $('monthly-form').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    try {s=await api('monthly-report-settings',{enabled:$('monthly-enabled').checked,recipients:$('monthly-recipients').value.split(/[\n,;]+/).map(v=>v.trim()).filter(Boolean),testRecipient:$('monthly-test-recipient').value,etag:s.etag});if(run!==serial)return;$('monthly-send-test').disabled=!s.testRecipient;$('monthly-status').textContent='Reporting settings saved.';}
    catch(e){if(run===serial)$('monthly-status').textContent=e.message;}finally{button.disabled=false;}
  };
  $('monthly-send-test').onclick=async event=>{
    const button=event.target;button.disabled=true;$('monthly-status').textContent='Preparing the previous month’s report…';
    try {const result=await api('monthly-report-test',{requestId});if(run!==serial)return;$('monthly-status').textContent=result.status==='accepted'?'Test report accepted by Microsoft 365. Inbox delivery is not confirmed.':labels[result.status]||result.status;if(result.status==='accepted')requestId=crypto.randomUUID();}
    catch(e){if(run===serial)$('monthly-status').textContent=e.message;}finally{button.disabled=false;}
  };
}
let auth, scope, view = 'overview', currentSettings, records = [], clubs = [], serial = 0;
const filterState = {};
const isSettingsView=()=>['settings','settings-monthly','settings-email'].includes(view);
function settingsNavigation(){return '<nav class="settings-navigation" aria-label="Settings pages">'+[['settings','All settings'],['settings-monthly','Monthly report'],['settings-email','Email delivery']].map(([id,label])=>`<button class="secondary" data-open-view="${id}" ${view===id?'aria-current="page"':''}>${label}</button>`).join('')+'</nav>';}
function settingsHome(){return '<div class="settings-options">'+[['settings-monthly','Monthly report','Choose report recipients, manage the monthly schedule and send a test report.'],['settings-email','Email delivery','Manage enquiry delivery mode, the test recipient and whether enquiry emails are enabled.']].map(([id,title,description])=>`<button class="settings-option" data-open-view="${id}"><span><strong>${title}</strong><span>${description}</span></span><span class="settings-option-arrow" aria-hidden="true">→</span></button>`).join('')+'</div>';}
let stopLive = () => {}, liveReports = {}, liveErrors = {};
function overviewMetrics(){return metric('Enquiries received',records.length,$('show-test-data').checked?'Includes test data':'Test data hidden') + metric('People enquiring',new Set(records.map(r=>String(r.email||'').toLowerCase()).filter(Boolean)).size,'Distinct email addresses; not members') + metric('Clubs receiving enquiries',new Set(records.map(r=>r.clubSlug)).size,'Within the reporting filter') + metric('Email failures',records.filter(r=>r.emailDeliveryStatus==='failed').length,$('show-test-data').checked?'Includes test data':'Test data hidden');}
function liveState(text){const errors=Object.keys(liveErrors);$('live-status').textContent=errors.length&&text==='Live connection'?'Connected · report unavailable':text;$('live-status').dataset.connected=String(text==='Live connection'&&!errors.length);$('live-status').title=errors.length?errors.map(r=>titles[r]+': '+liveErrors[r]).join('\n'):'Reports update in place. Enquiries are checked about every 20 seconds, traffic about every 90 seconds. Billing uses cached source data.';}
function applySnapshot(resource,data){
  delete liveErrors[resource];
  if($('status').dataset.liveError===resource){$('status').textContent='';delete $('status').dataset.liveError;}
  liveReports[resource]=data;
  if(resource==='settings'){banner(data);if(view!=='settings-email')currentSettings=data;else if(data.etag!==currentSettings.etag)$('status').textContent='Email delivery settings changed elsewhere. Your form has been kept. Select Update now to load the latest version before saving.';}
  if(resource==='clubs'){
    if($('routing-health'))$('routing-health').innerHTML=routingWarning(data);
    const versions=rows=>JSON.stringify(rows.map(r=>[r.rowKey,r.etag]).sort((a,b)=>a[0].localeCompare(b[0])));
    if(view==='clubs'&&versions(data)!==versions(clubs))$('status').textContent='Club contacts changed. Your edits have been kept. Select Update now to load the latest contacts before saving.';
  }
  if(resource==='leads'){
    records=data;
    if($('overview-metrics'))$('overview-metrics').innerHTML=overviewMetrics();
    if($('overview-clubs'))$('overview-clubs').innerHTML=bars(group(records,'clubName'));
    if($('overview-email'))$('overview-email').innerHTML=bars(group(records,'emailDeliveryStatus'));
    if($('lead-table')){
      const existing=new Set([...$('club-filter').options].map(o=>o.value));
      for(const [name] of group(records,'clubName'))if(!existing.has(name))$('club-filter').add(new Option(name,name));
      filterLeads();
    }
  }
  if((resource==='analytics'||resource==='leads')&&liveReports.analytics){
    if(view==='overview'&&$('overview-insights'))$('overview-insights').innerHTML=analyticsReport(liveReports.analytics,true);
    if(view==='analytics')$('content').innerHTML=analyticsReport(liveReports.analytics);
  }
  if(resource==='costs'){if(view==='overview'&&$('overview-costs'))$('overview-costs').innerHTML=costReport(data,true);if(view==='costs')$('content').innerHTML=costReport(data);}
  if(resource==='audit'&&view==='audit')$('content').innerHTML=auditReport(data);
  $('updated').textContent='Last data update '+time(new Date())+' · Traffic may take a few minutes to arrive. Billing refreshes at most every six hours.';
}
function auditReport(rows){return panel('Settings and contact changes',rows.length ? table(['Time (Adelaide)','Person','Action','Result','Details'],rows.map(r=>`<tr><td>${esc(time(r.at))}</td><td>${esc(r.actor)}</td><td>${esc(r.action)}</td><td>${esc(r.result)}</td><td>${esc(r.detail)}</td></tr>`)) : empty('No dashboard changes recorded for this period.'));}
function connectLive(){
  stopLive();liveErrors={};
  const run=serial;
  const query=new URLSearchParams({view:isSettingsView()?'settings':view,days:$('period').value,includeTest:String($('show-test-data').checked)});
  stopLive=startDashboardLive({getToken:token,query,onStatus:liveState,onSnapshot:(resource,data)=>{if(run===serial)applySnapshot(resource,data);},onError:(resource,message)=>{if(run!==serial)return;liveErrors[resource]=message;$('status').dataset.liveError=resource;liveState('Live connection');$('status').textContent=(titles[resource]||resource)+': '+message+' Last available data is retained; retrying automatically.';}});
}
const filterIds = ['search','club-filter','mode-filter','status-filter','from-filter','to-filter'];
const titles = { overview:'Overview', leads:'Enquiries', clubs:'Club contacts', pages:'Club pages', analytics:'Website insights', campaigns:'Campaign links', costs:'System costs', settings:'Settings', 'settings-monthly':'Monthly report', 'settings-email':'Email delivery', audit:'Activity log' };
const time = value => value ? new Date(value).toLocaleString('en-AU', { timeZone:'Australia/Adelaide', dateStyle:'medium', timeStyle:'short' }) : '—';
async function token() {
  const account = auth.getAllAccounts()[0];
  if (!account) throw new Error('Please sign in again.');
  try { return (await auth.acquireTokenSilent({ scopes:[scope], account })).accessToken; }
  catch (e) { if (e instanceof msal.InteractionRequiredAuthError) { await auth.acquireTokenRedirect({scopes:[scope], account}); } throw e; }
}
async function api(resource, body) {
  if (!body && /^(leads|analytics)(\?|$)/.test(resource)) resource += (resource.includes('?')?'&':'?')+'includeTest='+$('show-test-data').checked;
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
  return table(['Received (Adelaide)','Enquirer','Club','Mode','Email status','Enquiry'], rows.map(row=>`<tr><td>${esc(time(row.submittedAt))}</td><td>${esc(row.name)}<small>${esc(row.email)}</small></td><td>${esc(row.clubName || row.clubSlug)}</td><td><span class="pill">${esc(row.leadApiMode || 'Unknown')}</span></td><td><span class="pill ${row.emailDeliveryStatus === 'failed' ? 'failed' : row.emailDeliveryStatus === 'sent' ? 'sent' : ''}">${esc(statusLabel(row))}</span></td><td><button class="secondary" data-lead="${esc(row.rowKey)}">View enquiry</button></td></tr>`));
}
function group(rows,key) { const counts = new Map(); rows.forEach(r=>counts.set(r[key] || 'Unknown',(counts.get(r[key] || 'Unknown') || 0)+1)); return [...counts].sort((a,b)=>b[1]-a[1]); }
function banner(s = currentSettings) {
  const isTest = s.mode === 'test';
  if(!isTest && s.emailEnabled){$('mode-banner').className='production-status';$('mode-banner').innerHTML='<span>Production · Emails go to clubs</span><button class="link" data-open-view="settings-email">Manage delivery</button>';return;}
  $('mode-banner').className = 'mode-notice ' + (isTest ? 'test-mode' : s.emailEnabled ? 'live-mode' : 'paused-mode');
  const heading = isTest ? 'TEST MODE IS ON' : s.emailEnabled ? 'PRODUCTION MODE' : 'EMAILS ARE PAUSED';
  const message = !s.emailEnabled ? 'No enquiry emails are being sent. Enquiries are still saved.' : isTest ? 'No emails are sent to clubs.' : 'Enquiry emails are sent to club contacts.';
  $('mode-banner').innerHTML = '<strong>' + heading + '</strong><span>' + message + '</span>' + (isTest ? '<span>Test recipient: <b>' + esc(s.testRecipient) + '</b></span>' : '') + '<button class="secondary" data-open-view="settings-email">Email delivery</button>';
}
async function load() {
  const run = ++serial;
  stopLive();liveReports={};
  $('report-options').hidden=!['overview','leads','analytics'].includes(view);
  $('period-control').hidden=!['overview','leads','analytics','audit'].includes(view);
  $('report-scope').textContent=$('show-test-data').checked?'Data: includes test activity':'Data: production';
  $('title').textContent = titles[view];
    $('subtitle').textContent = {"overview":"Enquiries, website activity and delivery health.","leads":"Find enquiries and check their email delivery status.","pages":"Manage the information shown on each club page.","clubs":"Manage club contacts and enquiry routing.","analytics":"Understand website visits, traffic sources and campaigns.","campaigns":"Create tracked links for your Club Directory campaigns.","costs":"Reported spending and estimates for the Club Directory system.","settings":"Manage monthly reports and enquiry email delivery.","settings-monthly":"Manage report recipients, scheduling and test reports.","settings-email":"Manage delivery mode and where enquiry emails are sent.","audit":"Review changes to dashboard settings and club contacts."}[view];
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
        $('content').innerHTML = '<div id="routing-health"></div><div id="overview-metrics" class="metrics">' + overviewMetrics() + '</div>' + panel('Website insights','<div id="overview-insights">' + empty('Loading website insights…') + '</div>') + panel('System costs','<div id="overview-costs">' + empty('Loading billing figures…') + '</div>') + panel('Latest enquiries','<p class="footnote">Enquiries express interest in membership. Completed memberships take place outside this website and are not recorded here.</p>'+enquiryFilters()) + '<div class="grid">' + panel('Enquiries by club','<div id="overview-clubs">'+bars(group(records,'clubName'))+'</div>') + panel('Email activity','<div id="overview-email">'+bars(group(records,'emailDeliveryStatus'))+'</div>' + '<p class="footnote">“Sent” means accepted by the email service. Inbox delivery is not confirmed.</p>') + '</div>';
        bindFilters();
        const section = async (id, resource, render) => {
          try { const result = await api(resource); if (run===serial && $(id)) $(id).innerHTML=render(result); }
          catch(e) { if (run===serial && $(id)) $(id).innerHTML='<div class="banner error">'+esc(e.message)+'</div>'; }
        };
        await Promise.allSettled([
          section('routing-health','clubs',routingWarning),
          section('overview-insights','analytics?days='+days,r=>analyticsReport(r,true)),
          section('overview-costs','costs',r=>costReport(r,true))
        ]);
      } else {
        $('content').innerHTML = panel('Enquiries',enquiryFilters());
        bindFilters();
      }
    } else if (view === 'pages') {
      await mountClubEditor(run);
    } else if (view === 'campaigns') {
      $('content').innerHTML=campaignLinksPage();
    } else if (view === 'clubs') {
      clubs = await api('clubs');
      if (run !== serial) return;
      $('content').innerHTML = routingWarning(clubs) + panel('Club email routing', '<p>Updates apply to new enquiries. Disabling a club stops its enquiry submissions.</p>'+table(['Club','Email recipient','Accepting enquiries',''],clubs.sort((a,b)=>(a.clubName || '').localeCompare(b.clubName || '')).map((c,i)=>`<tr class="${routingError(c) ? 'invalid-club' : ''}"><td>${esc(c.clubName)}<small>${esc(c.rowKey)}</small></td><td><input id="email-${i}" required aria-invalid="${Boolean(routingError(c))}" aria-label="${esc(c.clubName)} email" type="email" value="${esc(c.recipientEmail)}">${routingError(c) ? '<p class="field-error">' + esc(routingError(c)) + '</p>' : ''}</td><td><input id="enabled-${i}" aria-label="Accept enquiries for ${esc(c.clubName)}" type="checkbox" ${c.enabled ? 'checked':''}></td><td><button data-save-club="${i}">Save</button></td></tr>`)));
    } else if (view === 'settings') {
      $('content').innerHTML=settingsHome();
    } else if (view === 'settings-monthly') {
      $('content').innerHTML=settingsNavigation();
      await monthlyReportSettings();
    } else if (view === 'settings-email') {
      const s = currentSettings;
      $('content').innerHTML = panel('Email delivery', `<p>This controls the whole live Club Directory system. Changes apply to enquiries that start after saving; emails already in progress may still complete using their original settings.</p><form id="settings-form" class="form-stack"><label>Delivery mode<select id="delivery-mode"><option value="test" ${s.mode==='test'?'selected':''}>Test — send to test recipient</option><option value="production" ${s.mode==='production'?'selected':''}>Production — send to clubs</option></select></label><label>Test recipient<input id="test-recipient" required type="email" maxlength="180" value="${esc(s.testRecipient)}"></label><label class="check"><input id="email-enabled" type="checkbox" ${s.emailEnabled?'checked':''}>Enable enquiry emails</label><div class="banner">In test mode, no emails will be sent to clubs. Enquiries remain saved and are marked as test enquiries.</div><button type="submit">Save delivery settings</button><p class="footnote">${s.updatedBy ? `Last changed by ${esc(s.updatedBy)} · ${esc(time(s.updatedAt))}` : 'Using the existing email configuration.'}</p></form>`);
      $('settings-form').addEventListener('submit',saveSettings);
      $('content').insertAdjacentHTML('afterbegin',settingsNavigation());
    } else if (view === 'analytics') {
      const [result, leadRows] = await Promise.all([api('analytics?days='+days),api('leads?days='+days)]);
      if (run !== serial) return;
      records=leadRows;
      $('content').innerHTML = analyticsReport(result);
    } else if (view === 'costs') {
      const result = await api('costs');
      if (run !== serial) return;
      $('content').innerHTML = costReport(result);
    } else if (view === 'audit') {
      const rows = await api(`audit?days=${days}`);
      if (run !== serial) return;
      $('content').innerHTML = panel('Settings and contact changes', rows.length ? table(['Time (Adelaide)','Person','Action','Result','Details'],rows.map(r=>`<tr><td>${esc(time(r.at))}</td><td>${esc(r.actor)}</td><td>${esc(r.action)}</td><td>${esc(r.result)}</td><td>${esc(r.detail)}</td></tr>`)) : empty('No dashboard changes recorded for this period.'));
    }
    if (run === serial) { $('updated').textContent = `Updated ${time(new Date())} · Reports update in place over a live connection. Traffic may take a few minutes to arrive; billing refreshes at most every six hours.`; connectLive(); }
  } catch(e) { if (run === serial) { $('status').textContent = e.message; $('content').innerHTML = empty('Data could not be loaded. Check the message above and try Update now.'); } }
  finally { if(run === serial) $('refresh').disabled = false; }
}
function bindFilters() {
  filterIds.forEach(id=>{
    $(id).value=filterState[id] || '';
    $(id).addEventListener('input',()=>{filterState[id]=$(id).value; filterLeads();});
  });
  $('clear-filters').onclick=()=>{filterIds.forEach(id=>{filterState[id]=''; $(id).value='';}); filterLeads();};
  filterLeads();
}
function filterLeads() {
  const text = $('search').value.toLowerCase(), club = $('club-filter').value, mode = $('mode-filter').value, status = $('status-filter').value;
  const from=$('from-filter').value, to=$('to-filter').value;
  if (from && to && from>to) { $('enquiry-count').textContent='The From date must be before the To date.'; $('lead-table').innerHTML=''; return; }
  const dayFormat = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Adelaide',year:'numeric',month:'2-digit',day:'2-digit'});
  const matches = records.filter(r=>{
    const day = dayFormat.format(new Date(r.submittedAt));
    return (!from || day>=from) && (!to || day<=to) && (!club || r.clubName===club) && (!mode || r.leadApiMode===mode) && (!status || r.emailDeliveryStatus===status) && [r.name,r.email,r.phone,r.suburb,r.about,r.filtersJson].join(' ').toLowerCase().includes(text);
  });
  const displayed=view==='overview' ? matches.slice(0,10) : matches;
  $('enquiry-count').textContent='Showing '+displayed.length+' of '+matches.length+' matching enquiries within the selected reporting period.';
  $('lead-table').innerHTML=leadTable(displayed);
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
    let preferences = row.filtersJson;
    try { preferences = JSON.parse(row.filtersJson || '[]').map(f=>f.name+': '+f.value).join('\n'); } catch {}
    const fields = [['Received',time(row.submittedAt)],['Name',row.name],['Email',row.email],['Phone',row.phone],['Suburb',row.suburb],['Club',row.clubName],['About',row.about],['Preferences',preferences],['Consent',row.consent?'Given':'Not recorded'],['Traffic source',row.source||'Not recorded'],['Channel',row.channel||'Not recorded'],['Campaign',row.campaign||'Not recorded'],['Landing page',row.landingPage||'Not recorded'],['Source page',row.sourcePage],['Mode',row.leadApiMode],['Email status',statusLabel(row)],['Reference',row.rowKey]];
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
function setMenu(open){$('sidebar').classList.toggle('menu-open',open);$('menu-toggle').setAttribute('aria-expanded',String(open));$('menu-toggle').textContent=open?'Close menu':'Menu';}
$('menu-toggle').onclick=()=>setMenu($('menu-toggle').getAttribute('aria-expanded')!=='true');
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('sidebar').classList.contains('menu-open')){setMenu(false);$('menu-toggle').focus();}});
function navigate(next) { if(view==='pages'&&!canLeaveEditor())return;if(view==='pages')pageEditor=null;const mobileMenu=$('menu-toggle').getAttribute('aria-expanded')==='true';setMenu(false);if(mobileMenu)$('title').focus({preventScroll:true});view=next; document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===(isSettingsView()?'settings':view))); load(); }
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>navigate(button.dataset.view));
document.addEventListener('click',event=>{const button=event.target.closest('[data-open-view]'); if(button) navigate(button.dataset.openView);});
$('show-test-data').onchange=()=>{filterState['mode-filter']='';$('report-options').open=false;load();};
$('period').onchange=load; $('refresh').onclick=()=>{if(view!=='pages'||canLeaveEditor())load();};
$('sign-in').onclick=()=>auth.loginRedirect({scopes:[scope]});
$('sign-out').onclick=()=>auth.logoutRedirect({postLogoutRedirectUri:location.origin+'/api/dashboard'});
(async()=>{
  try {
    const config = await (await fetch('/api/dashboard/config')).json();
    if (!config.clientId || !config.tenantId) throw new Error('Microsoft sign-in is awaiting configuration.');
    scope = `api://${config.clientId}/Dashboard.Access`;
    auth = new msal.PublicClientApplication({auth:{clientId:config.clientId,authority:`https://login.microsoftonline.com/${config.tenantId}`,redirectUri:location.origin+'/api/dashboard'},cache:{cacheLocation:'sessionStorage'}});
    await auth.initialize(); await auth.handleRedirectPromise();
    if (auth.getAllAccounts().length) {
      const me = await api('me'); $('user').textContent = me.name;
      $('login').hidden=true; $('workspace').hidden=false; load();
    }
  } catch(e) { $('login-status').textContent=e.message; $('sign-in').disabled=!auth; }
})();
