function serviceLabel(name) { return String(name || 'Other services').replace(/\bAzure\b\s*/gi, '').trim(); }
function analyticsReport(result, compact = false) {
  const values=reportRows(result);
  const items=category=>values.filter(r=>r.category===category).map(r=>[r.label,r.value]).sort((a,b)=>b[1]-a[1]);
  const totals=Object.fromEntries(items('total')),eventSessions=Object.fromEntries(items('eventSessions'));
  const conversion=totals.Sessions ? ((eventSessions.lead_submitted||0)/totals.Sessions*100).toFixed(1)+'%' : '—';
  const summary='<div class="metrics">'+metric('Page views',totals['Page views']||0)+metric('Visitors',totals.Visitors||0,'Browser-based estimate')+metric('Sessions',totals.Sessions||0)+metric('Sessions with an enquiry',conversion,'Tracked submissions; not memberships')+'</div>';
  const note=!totals['Page views']?'<p class="banner">No traffic matches this period and test-data filter yet. New activity may take a few minutes to appear.</p>':'';
  const coverage=totals['Unclassified views']?'<p class="footnote">'+totals['Unclassified views']+' page views have no test/production tag and remain included. Older tracking cannot be separated retrospectively.</p>':'';
  const sources='<div class="grid">'+panel('Traffic sources · tracked sessions',bars(sourceSummary(items('source'))))+panel('Sources generating enquiries',bars(sourceEnquiries()))+'</div>';
  if(compact)return summary+note+coverage+sources+'<button class="secondary" data-open-view="analytics">View campaign and website insights</button>';
  const channelRows=items('channel').filter(([label])=>label);
  return summary+note+coverage+panel('Traffic over time',trafficTrend(items('daily')))+sources+'<div class="grid">'+panel('Traffic channels · tracked sessions',bars(channelRows))+panel('Enquiry journey · sessions',bars([['Visited the website',totals.Sessions||0],['Started an enquiry',eventSessions.form_started||0],['Submitted an enquiry',eventSessions.lead_submitted||0]]))+'</div>'+panel('Campaign performance',campaignPerformance(items))+panel('Club engagement',clubEngagement(items))+'<div class="grid">'+panel('Popular pages · views',bars(items('page')))+panel('Landing pages · sessions',bars(items('landing')))+panel('Devices · views',bars(items('device')))+panel('Tagged campaign terms',bars(items('term')))+'</div>'+panel('Google search terms','<p>Google search-query reporting needs a verified Search Console property. It is not connected. Campaign terms above are supplied in tagged links; they are not visitors’ actual Google searches.</p>')+panel('Campaign links','<p>Create labelled links for posts, adverts and emails, with examples and guidance.</p><button class="secondary" data-open-view="campaigns">Open campaign links</button>')+'<p class="footnote">Sources are identified from referring websites and campaign labels. Some apps hide the referring source; tagged links improve attribution. Sessions may appear under more than one source if a visitor returns through another campaign. Saved enquiries can include visitors whose browsers block analytics. These figures do not confirm membership enrolments.</p>';
}
function costReport(result, compact = false) {
  const notice = result.notice ? `<div class="banner">${esc(result.notice)}${result.retryAt ? ` Next update after ${esc(time(result.retryAt))}.` : ''}</div>` : '';
  if (result.unavailable || !result.properties) return notice + empty('Billing figures are not available yet. They will appear automatically when the next billing update is available.');
  const p = result.properties;
  const rows = p.rows.map(r=>Object.fromEntries(p.columns.map((c,i)=>[c.name,r[i]])));
  const currencies = [...new Set(rows.map(r=>r.Currency).filter(Boolean))];
  if (currencies.length>1) return empty('Multiple currencies returned. Costs cannot be combined.');
  const currency = currencies[0] || 'AUD';
  const amount = r=>Number(r.Cost ?? r.PreTaxCost ?? 0);
  const total = rows.reduce((n,r)=>n+amount(r),0);
  // Use the fetch date, not today's date, when displaying a cached snapshot.
  const asOf = new Date(result.fetchedAt), day = asOf.getUTCDate();
  const monthDays = new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()+1,0)).getUTCDate();
  const dateKey = Number(asOf.toISOString().slice(0,10).replaceAll('-',''));
  const completed = rows.filter(r=>Number(r.UsageDate)<dateKey);
  const daily = day>1 && completed.length ? completed.reduce((n,r)=>n+amount(r),0)/(day-1) : null;
  const money = v=>v === null ? '—' : new Intl.NumberFormat('en-AU',{style:'currency',currency}).format(v);
  const summary = `<div class="metrics">${metric('Month to date',money(total),'Reported actual cost')}${metric('Month-end estimate',money(daily===null ? null : daily*monthDays))}${metric('Next 6 months',money(daily===null ? null : daily*365.25/2),'At current daily rate')}${metric('Next 12 months',money(daily===null ? null : daily*365.25),'At current daily rate')}</div><p class="footnote">${esc(currency)} · Join system · Updated ${esc(time(result.fetchedAt))}. Billing refreshes at most every six hours; billing data can be delayed.</p>`;
  if (compact) return notice + summary + '<button class="secondary" data-open-view="costs">View cost breakdown</button>';
  const services = new Map(); rows.forEach(r=>services.set(r.ServiceName,(services.get(r.ServiceName)||0)+amount(r)));
  return notice + summary + panel('Cost by service',rows.length ? table(['Service',`Cost (${currency})`],[...services].sort((a,b)=>b[1]-a[1]).map(([name,value])=>`<tr><td>${esc(serviceLabel(name))}</td><td>${esc(money(value))}</td></tr>`)) : empty('No billed usage returned.')) + panel('How estimates work','<p>Estimates extend the average daily spend from completed days this month. They exclude future changes in traffic, pricing and resources. Billing delays can understate estimates, especially early in the month.</p>');
}
function routingError(c) {
  if (!String(c.recipientEmail || '').trim()) return 'Email address missing';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.recipientEmail)) return 'Email address is invalid';
  return '';
}
function routingWarning(rows) {
  const invalid = rows.filter(routingError);
  if (!invalid.length) return '';
  return `<div class="routing-warning" role="alert"><h2>${invalid.length} club${invalid.length===1?' needs':'s need'} an email address corrected</h2><p>Production emails cannot be sent to these club contacts.</p><ul>${invalid.map(c=>`<li><strong>${esc(c.clubName || c.rowKey)}</strong> — ${esc(routingError(c))}${c.enabled ? '' : ' (club currently disabled)'}</li>`).join('')}</ul><button class="secondary" data-open-view="clubs">Fix club contacts</button></div>`;
}
function enquiryFilters() {
  return `<div class="filters"><label>Search<input id="search" type="search" placeholder="Name, email, suburb or interests"></label><label>Club<select id="club-filter"><option value="">All clubs</option>${group(records,'clubName').map(([name])=>`<option>${esc(serviceLabel(name))}</option>`).join('')}</select></label><label>Mode<select id="mode-filter"><option value="">All modes</option><option value="production">Production</option><option value="test">Test</option></select></label><label>Email status<select id="status-filter"><option value="">All statuses</option><option value="failed">Failed</option><option value="sent">Accepted by email service</option><option value="pending">Pending</option><option value="disabled">Disabled</option></select></label><label>From (Adelaide)<input id="from-filter" type="date"></label><label>To (Adelaide)<input id="to-filter" type="date"></label><button id="clear-filters" class="secondary">Clear filters</button></div><p class="subtle" id="enquiry-count"></p><div id="lead-table"></div>`;
}
