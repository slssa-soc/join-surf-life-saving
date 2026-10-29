const sanitize=require('sanitize-html');
const ROOT='https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/dashboard';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields={title:'Club name',summary:'Short summary',html:'Club page text',image:'Main photo',imageAlt:'Image description',suburb:'Suburb',region:'Region',memberSize:'Membership size',website:'Club website',junior:'Nippers / junior activities',youth:'Youth program',patrolling:'Lifesaving and patrols',adaptive:'Adaptive participation',multicultural:'Multicultural participation',firstNations:'First Nations participation',otherPrograms:'Other programs',accessibility:'Accessibility details',activities:'Club offerings',gym:'Gym',restaurant:'Club restaurant',accessibleFacilities:'Accessible facilities',beachAccess:'Accessible beach access',mode:'Enquiry delivery mode',testRecipient:'Test email address',emailEnabled:'Enquiry emails',enabled:'Enabled',recipients:'Notification recipients',keywords:'Screening keywords',recipientEmail:'Club enquiry address'};
const areas={'directory-settings':'Website options','change-notifications':'Change notifications','quarantine-settings':'Quarantine settings','monthly-report-settings':'Monthly report settings',settings:'Email delivery settings',clubs:'Club contact details','club-pages':'Club page'};
function plain(html){
  return sanitize(String(html).replace(/<\/(?:p|h[1-6]|li|ul|ol|blockquote)>|<br\s*\/?>/gi,'\n'),{allowedTags:[],allowedAttributes:{}})
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[e])).trim();
}
function display(value,key,change){
  if(typeof value==='boolean')return value?'On':'Off';
  if(key==='html')return plain(value);
  if(key==='activities'){
    const labels=new Map((change.activityLabels||[]).map(item=>[item.id,item.label]));
    return (value||[]).map(id=>labels.get(id)||'Previously listed offering').join('\n')||'None selected';
  }
  if(Array.isArray(value))return value.join('\n')||'None';
  if(value===undefined||value===null||value==='')return 'Not set';
  if(key==='mode')return value==='production'?'Production — send to clubs':value==='test'?'Test — send to test address':String(value);
  return String(value);
}
function changes(change){
  if(!change.before||!change.after)return[];
  const rows=[];
  if(change.resource==='directory-settings'){
    for(const key of ['activities','interests']){
      const previousCount=rows.length;
      const before=new Map((change.before[key]||[]).map(item=>[item.id,item.label])),after=new Map((change.after[key]||[]).map(item=>[item.id,item.label]));
      for(const id of new Set([...before.keys(),...after.keys()]))if(before.get(id)!==after.get(id))rows.push({label:key==='activities'?'Club offering':'Enquiry form option',before:before.get(id)||'Not in list',after:after.get(id)||'Removed from list'});
      if(rows.length===previousCount&&JSON.stringify(change.before[key])!==JSON.stringify(change.after[key]))rows.push({label:key==='activities'?'Club offerings':'Enquiry form options',before:'Previous order',after:'List order updated'});
    }
    return rows;
  }
  const allowed=change.resource==='club-pages'?Object.keys(fields).filter(k=>!['mode','testRecipient','emailEnabled','enabled','recipients','keywords','recipientEmail'].includes(k)):
    change.resource==='settings'?['mode','testRecipient','emailEnabled']:
    change.resource==='monthly-report-settings'?['enabled','recipients','testRecipient']:
    change.resource==='quarantine-settings'?['enabled','recipients','keywords']:
    change.resource==='change-notifications'?['recipients']:
    change.resource==='clubs'?['recipientEmail','enabled']:[];
  for(const key of allowed)if(JSON.stringify(change.before[key])!==JSON.stringify(change.after[key])){
    let before=display(change.before[key],key,change),after=display(change.after[key],key,change);
    if(key==='image'){before='Previously published photo';after='Replacement photo published';}
    rows.push({label:change.resource==='monthly-report-settings'&&key==='recipients'?'Report recipients':fields[key],before,after});
  }
  return rows;
}
function render(change){
  const rows=changes(change),area=areas[change.resource]||change.area||'Dashboard',club=change.clubTitle||change.after?.title;
  const title=change.resource==='club-pages'?'Club page published':area+' updated';
  const time=Number.isNaN(new Date(change.at).valueOf())?'Time unavailable':new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Adelaide',dateStyle:'medium',timeStyle:'short'}).format(new Date(change.at))+' · Adelaide time';
  const clip=value=>{const text=String(value);return escape(text.length>1200?text.slice(0,1200)+'… [excerpt — full details in dashboard]':text).replace(/\n/g,'<br>');};
  const content=rows.slice(0,20).map(row=>`<tr><td style="padding:20px 0;border-top:1px solid #e7e7ec"><h3 style="margin:0 0 12px;font-size:15px;color:#26262c">${escape(row.label)}</h3><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td class="change-column" width="50%" valign="top" style="padding:12px;background:#f6f6f8;border:1px solid #e4e4e9;border-radius:8px;word-break:break-word;overflow-wrap:anywhere"><p style="font-size:11px;font-weight:700;color:#676770;margin:0 0 8px">BEFORE</p><div style="font-size:14px;line-height:1.65;color:#565660">${clip(row.before)}</div></td><td class="change-column" width="50%" valign="top" style="padding:12px;background:#edf4fd;border:1px solid #d5e3f6;border-radius:8px;word-break:break-word;overflow-wrap:anywhere"><p style="font-size:11px;font-weight:700;color:#315d91;margin:0 0 8px">AFTER</p><div style="font-size:14px;line-height:1.65;color:#233d5e">${clip(row.after)}</div></td></tr></table></td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>@media(max-width:520px){.outer{padding:16px 8px!important}.body-card{padding:20px!important}.change-column{display:block!important;width:100%!important;box-sizing:border-box}.email-title{font-size:26px!important}}</style></head><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d1d1f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="outer" style="padding:32px 16px" align="center"><!--[if mso]><table width="680"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px"><tr><td style="padding:0 6px 22px"><p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-.5px">Club Directory</p><p style="margin:0 0 8px;font-size:11px;letter-spacing:1.2px;font-weight:700;color:#52739c">CHANGE NOTIFICATION</p><h1 class="email-title" style="font-size:32px;letter-spacing:-.8px;line-height:1.2;margin:0 0 12px">${escape(title)}</h1><p style="font-size:15px;line-height:1.6;color:#62626c;margin:0">${club?escape(club):'A dashboard update has been saved.'}</p></td></tr><tr><td class="body-card" style="background:#fff;border:1px solid #e3e3e8;border-radius:16px;padding:28px"><p style="margin:0 0 20px;font-size:14px;line-height:1.8"><strong>Changed by</strong> ${escape(change.actor||'Dashboard editor')}<br><strong>Saved</strong> ${escape(time)}<br><strong>Area</strong> ${escape(area)}</p>${change.notes?`<div style="background:#f7f7f9;border-left:3px solid #b5c5db;padding:14px 16px;margin:0 0 24px"><p style="font-size:12px;font-weight:700;margin:0 0 6px;color:#61616b">REASON FOR CHANGE</p><div style="font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere">${clip(change.notes)}</div></div>`:''}<h2 style="font-size:19px;margin:0 0 6px">What changed${rows.length?` <span style="font-size:13px;font-weight:400;color:#767680">· ${rows.length} ${rows.length===1?'change':'changes'}</span>`:''}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${content||'<tr><td style="font-size:14px;color:#62626c;padding:16px 0">'+(change.before&&change.after?'No field values changed in this save.':'View the saved record in the dashboard for full details.')+'</td></tr>'}</table>${rows.length>20?`<p style="font-size:12px;color:#666">Showing 20 of ${rows.length} changes. Full details are available in the dashboard.</p>`:''}<p style="font-size:13px;color:#62626c;line-height:1.7;margin:20px 0">${change.resource==='club-pages'?'Open Club pages, select '+escape(club||'the club')+', then view Change history for the full publication.':'Open Activity log to review the saved change and its details.'}</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#006edc;border-radius:8px"><a href="${ROOT}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:600">Open dashboard →</a></td></tr></table></td></tr><tr><td style="padding:20px 8px;color:#7a7a84;font-size:11px;line-height:1.7">You receive these notifications because your address is listed in Settings → Change notifications.<br>Club Directory · Surf Life Saving SA</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
function subject(change){return ('Club Directory — '+(change.clubTitle||areas[change.resource]||change.area||'Dashboard')+' updated').replace(/\s+/g,' ').slice(0,240);}
module.exports={render,changes,plain,subject};
