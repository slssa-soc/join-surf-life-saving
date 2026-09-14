document.addEventListener('input',event=>{const form=event.target.closest('#campaign-link-form');if(form)form.dataset.dirty='true';});
function reportRows(result){const t=result.tables?.[0];return t?t.rows.map(row=>Object.fromEntries(t.columns.map((c,i)=>[c.name,row[i]]))):[];}
function mergeCounts(entries,mapper){const m=new Map();for(const [name,n]of entries){const key=mapper(name);m.set(key,(m.get(key)||0)+n);}return [...m].sort((a,b)=>b[1]-a[1]);}
function sourceSummary(entries){return mergeCounts(entries,name=>JoinAttribution.classify(name).source);}
function sourceEnquiries(){return group(records.map(r=>({...r,source:r.source?JoinAttribution.classify(r.source,r.campaignMedium).source:'Not recorded'})),'source');}
function campaignPerformance(items){
  const sessions=new Map(items('campaign')),enquiries=new Map(group(records.filter(r=>r.campaign),'campaign'));
  const names=[...new Set([...sessions.keys(),...enquiries.keys()])];
  if(!names.length)return empty('No tagged campaign activity yet. Use campaign links to distinguish social posts, ads and emails.');
  return table(['Campaign','Tracked sessions','Saved enquiries'],names.map(name=>`<tr><td>${esc(name)}</td><td>${esc(sessions.get(name)||0)}</td><td>${esc(enquiries.get(name)||0)}</td></tr>`));
}
function clubEngagement(items){
  const views=new Map(items('clubViews')),exits=new Map(items('clubExits')),leads=new Map(group(records,'clubSlug'));
  const names=[...new Set([...views.keys(),...exits.keys(),...leads.keys()])].filter(Boolean);
  if(!names.length)return empty('Club engagement will appear as people browse and enquire.');
  return table(['Club','Profile views','Club website clicks','Saved enquiries'],names.sort((a,b)=>(leads.get(b)||0)-(leads.get(a)||0)).map(slug=>`<tr><td>${esc(records.find(r=>r.clubSlug===slug)?.clubName||slug.replaceAll('-',' '))}</td><td>${views.get(slug)||0}</td><td>${exits.get(slug)||0}</td><td>${leads.get(slug)||0}</td></tr>`));
}
function trafficTrend(entries){
  if(!entries.length)return empty('No page views recorded for this period.');
  const values=[...entries].sort((a,b)=>a[0].localeCompare(b[0]));
  const max=Math.max(...values.map(x=>x[1]),1),width=800,height=130,step=width/values.length;
  return `<svg class="traffic-chart" viewBox="0 0 800 150" role="img" aria-label="Daily page views, Adelaide dates">${values.map(([date,count],i)=>`<rect x="${i*step+1}" y="${height-count/max*height}" width="${Math.max(step-2,1)}" height="${Math.max(count/max*height,1)}" fill="#248187"><title>${esc(date)}: ${count} page views</title></rect>`).join('')}</svg><p class="footnote">${esc(values[0][0])} – ${esc(values.at(-1)[0])} · Page views per day (Adelaide). Hover over a bar for its count.</p>`;
}
function campaignLinkForm(){return `<form id="campaign-link-form" class="form-stack"><p>Create labelled links for social posts, adverts and emails. Use consistent campaign names. Do not enter personal details.</p><label>Source<select id="link-source"><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="google">Google</option><option value="newsletter">Newsletter</option><option value="linkedin">LinkedIn</option></select></label><label>Channel<select id="link-medium"><option value="social">Social media</option><option value="paid_social">Paid social</option><option value="email">Email</option><option value="cpc">Paid search</option></select></label><label>Campaign name<input id="link-campaign" required maxlength="100" pattern="[A-Za-z0-9_.-]+" placeholder="summer-2026"></label><button type="submit">Create campaign link</button><label>Campaign link<input id="campaign-link-output" readonly aria-label="Campaign link"></label></form>`;}
document.addEventListener('submit',event=>{if(event.target.id!=='campaign-link-form')return;event.preventDefault();const url=new URL('https://join.surflifesavingsa.com.au/');url.searchParams.set('utm_source',$('link-source').value);url.searchParams.set('utm_medium',$('link-medium').value);url.searchParams.set('utm_campaign',$('link-campaign').value);$('campaign-link-output').value=url.href;$('campaign-link-output').select();});
