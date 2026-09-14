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

function campaignLinkForm(){return `<form id="campaign-link-form" class="form-stack">
<label>Source — where the link will appear<select id="link-source"><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="google">Google</option><option value="newsletter">Newsletter</option><option value="linkedin">LinkedIn</option><option value="print">Print / QR code</option><option value="partner">Partner organisation</option></select></label>
<label>Channel — how you are promoting it<select id="link-medium"><option value="social">Social media (unpaid)</option><option value="paid_social">Paid social advert</option><option value="email">Email</option><option value="cpc">Paid search advert</option><option value="qr">Print / QR code</option><option value="referral">Partner referral</option></select></label>
<label>Campaign name<input id="link-campaign" required maxlength="100" pattern="[a-z0-9_.-]+" placeholder="summer-2026" aria-describedby="campaign-name-help"></label><p id="campaign-name-help" class="footnote">Use lowercase letters, numbers and hyphens. Reuse exactly the same name across all channels for one campaign.</p>
<label>Post or creative label (optional)<input id="link-content" maxlength="100" pattern="[a-z0-9_.-]*" placeholder="nippers-video-a"></label>
<button type="submit">Create campaign link</button><label>Ready-to-use link<input id="campaign-link-output" readonly aria-label="Campaign link"></label><button id="copy-campaign-link" type="button" class="secondary" disabled>Copy link</button><p id="campaign-link-status" role="status"></p></form>`;}
function campaignLinksPage(){return panel('What campaign links are for',`<p>A campaign link is the normal Join website address with a few reporting labels added to the end. Visitors see the same website. The labels help the project team understand which posts, adverts, emails and printed materials bring people to the website and generate club enquiries.</p><p>Without labels, some social and email apps hide where a visitor came from. That activity can appear as direct or unknown traffic. A labelled link gives the dashboard a clearer source and campaign name.</p>`)+
'<div class="campaign-layout">'+panel('Create a campaign link',campaignLinkForm())+panel('Choose the labels',`<dl class="campaign-guide"><dt>Source</dt><dd>The platform or sender: Facebook, Instagram, your newsletter or a partner organisation.</dd><dt>Channel</dt><dd>The type of promotion. Select unpaid social for an ordinary post, paid social for an advert, email for a newsletter, or paid search for a Google advert. A link in an ordinary Google search result cannot be labelled here.</dd><dt>Campaign name</dt><dd>The shared name of the project or campaign, for example <code>summer-2026</code>. Use the same spelling everywhere so results group together.</dd><dt>Post or creative label</dt><dd>An optional way to distinguish versions, such as <code>nippers-video-a</code> and <code>family-photo-b</code>. This label is carried by the link for later analysis; a creative-level comparison is not currently shown in the dashboard.</dd></dl>`)+ '</div>'+
panel('How to use the links',`<ol class="campaign-steps"><li><strong>Agree a campaign name.</strong> Keep a shared campaign plan listing the name, channel, post label and link. This builder does not save a register of generated links.</li><li><strong>Create a separate link for each source and channel.</strong> A Facebook advert and an Instagram post should have different labels, even when they belong to the same campaign.</li><li><strong>Copy the complete link.</strong> Paste it into the post, advert or email instead of the plain Join website address. For print, use the complete link as the destination in your QR-code tool; this page does not create the QR image.</li><li><strong>Check the destination before publishing.</strong> Confirm that the full link opens the Join website and retains its labels. Do not submit a test enquiry while production emails are enabled unless you intend the club to receive it.</li><li><strong>Review the results.</strong> Open Website insights and choose the reporting period. Traffic sources and channels show where visits came from. Campaign performance compares tracked sessions and saved enquiries. Each enquiry also shows its recorded source and campaign.</li></ol>`)+
panel('Example: one campaign, two channels',`<p>For a summer recruitment campaign, use <code>summer-2026</code> on both links. Choose Facebook / Paid social for the paid advert, then Newsletter / Email for the newsletter. Both contribute to the same campaign total, while the source reports distinguish Facebook from the newsletter.</p><p>The generated address contains <code>utm_source</code>, <code>utm_medium</code> and <code>utm_campaign</code>. These are standard campaign labels. An optional creative label uses <code>utm_content</code>.</p>`)+
panel('What the figures can and cannot tell you',`<ul class="campaign-steps"><li>Links measure website activity and enquiries expressing interest. They do not confirm that someone became a member or that a club followed up.</li><li>Reporting starts after a labelled link is used. Labels cannot be added to earlier visits retrospectively. New traffic can take a few minutes to appear.</li><li>Browser privacy settings and blocked tracking can reduce visitor and session counts. Saved enquiries and tracked submissions may therefore differ.</li><li>A forwarded or reused link keeps its original labels. Use a new link for a different placement. Avoid adding campaign labels to navigation within the Join website.</li><li>Use descriptive campaign labels only. Never put a person's name, email address, phone number or other personal details in a link.</li><li>Creating a link does not publish a post, send an email, start advertising, change delivery mode or change the reporting test-data filter.</li><li>Actual Google search terms require a separate Search Console connection, which is not currently configured. This builder does not reveal them.</li></ul>`);}
document.addEventListener('submit',event=>{
  if(event.target.id!=='campaign-link-form')return;
  event.preventDefault();
  const url=new URL('https://join.surflifesavingsa.com.au/');
  url.searchParams.set('utm_source',$('link-source').value);
  url.searchParams.set('utm_medium',$('link-medium').value);
  url.searchParams.set('utm_campaign',$('link-campaign').value);
  if($('link-content').value)url.searchParams.set('utm_content',$('link-content').value);
  $('campaign-link-output').value=url.href;
  $('copy-campaign-link').disabled=false;
  $('campaign-link-status').textContent='Link created. Copy it into your campaign plan and use the complete address in your promotion.';
});
document.addEventListener('input',event=>{
  if(event.target.closest('#campaign-link-form') && event.target.id!=='campaign-link-output'){
    $('campaign-link-output').value='';$('copy-campaign-link').disabled=true;$('campaign-link-status').textContent='Create the link again to apply your changes.';
  }
});
document.addEventListener('click',async event=>{
  if(event.target.id!=='copy-campaign-link')return;
  try{await navigator.clipboard.writeText($('campaign-link-output').value);$('campaign-link-status').textContent='Copied to clipboard.';}
  catch{$('campaign-link-output').select();$('campaign-link-status').textContent='Select and copy the address above.';}
});
