const { TableClient, odata } = require('@azure/data-tables');
const { ClientSecretCredential } = require('@azure/identity');
const { readSettings: deliverySettings } = require('./settings');
const KEYWORDS = ['Boat Licence','Vacswim','Pool Lifeguard','First Aid','CPR','Surf Babies','Welcome to SA Shores','Migrant','First Nations','Community Surf Rescue','Mental Health First Aid','Low Voltage','Surf Education','Employment','Casual Employment','Job','Work','Requal','Requalification','Update','Refresher'];
const email = s => typeof s === 'string' && s.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const table = name => TableClient.fromConnectionString(process.env.AzureWebJobsStorage,name);
const leads = () => table(process.env.LEAD_TABLE_NAME || 'LeadSubmissions');
function validateRecipients(value) {
  if(!Array.isArray(value)||value.length>50)throw fail('Enter up to 50 notification email addresses.');
  const recipients=[];
  for(const entry of value){if(typeof entry!=='string'||/[\r\n]/.test(entry)||!email(entry.trim()))throw fail('Enter valid notification email addresses, one per line.');const address=entry.trim().toLowerCase();if(!recipients.includes(address))recipients.push(address);}
  return recipients;
}
function validateKeywords(value) {
  if(!Array.isArray(value)||value.length>100)throw fail('Enter up to 100 keywords or phrases.');
  const result=[],seen=new Set();
  for(const entry of value){
    if(typeof entry!=='string')throw fail('Each keyword must be text.');
    const word=entry.normalize('NFKC').replace(/\s+/g,' ').trim();
    if(!word||word.length>120||/[\p{Cc}\p{Cf}]/u.test(word)||!/[\p{L}\p{N}]/u.test(word))throw fail('Each keyword must contain a letter or number and be 1–120 characters long.');
    const key=word.toLowerCase();if(!seen.has(key)){seen.add(key);result.push(word);}
  }
  return result;
}
function matches(payload, keywords=KEYWORDS) {
  const fields = [payload.about, ...(payload.filters || []).map(f => f.value)];
  return keywords.filter(word => fields.some(field => new RegExp('(?<![\\p{L}\\p{N}_])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+')+'(?![\\p{L}\\p{N}_])','iu').test(String(field || '').normalize('NFKC'))));
}
async function readSettings() {
  try {const r=await table('JoinDashboardSettings').getEntity('settings','quarantine');return {...r,recipients:validateRecipients(r.recipientsJson===undefined?JSON.parse(r.reviewersJson||'[]').map(user=>user.email):JSON.parse(r.recipientsJson)),keywords:r.keywordsJson===undefined?[...KEYWORDS]:validateKeywords(JSON.parse(r.keywordsJson))};}
  catch(e){if(e.statusCode===404)return {enabled:false,recipients:[],etag:null,keywords:KEYWORDS};throw e;}
}
async function graph(path,body) {
  if(process.env.JOIN_MAIL_TENANT_ID !== process.env.DASHBOARD_TENANT_ID)throw fail('Directory and dashboard tenants must match.',503);
  const c=new ClientSecretCredential(process.env.JOIN_MAIL_TENANT_ID,process.env.JOIN_MAIL_CLIENT_ID,process.env.JOIN_MAIL_CLIENT_SECRET);
  const token=await c.getToken('https://graph.microsoft.com/.default');
  const r=await fetch('https://graph.microsoft.com/v1.0/'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token.token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),...(body?{body:JSON.stringify(body)}:{})});
  if(r.status!==202)throw fail('Microsoft 365 did not accept the email. Check Sent Items before any retry.',502);
}
async function saveSettings(body,actor) {
  if(typeof body.enabled!=='boolean')throw fail('Choose whether quarantine is enabled.');
  const recipients=validateRecipients(body.recipients);
  const before=await readSettings();if((before.etag||null)!==(body.etag||null))throw fail('Settings changed. Refresh before saving.',409);
  const keywords=validateKeywords(body.keywords===undefined?before.keywords:body.keywords);
  if(body.enabled&&!keywords.length)throw fail('Add at least one keyword before enabling quarantine.');
  if(body.enabled&&!recipients.length)throw fail('Add at least one notification email address before enabling quarantine.');
  const t=table('JoinDashboardSettings');await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
  const row={partitionKey:'settings',rowKey:'quarantine',enabled:body.enabled,recipientsJson:JSON.stringify(recipients),keywordsJson:JSON.stringify(keywords),updatedBy:actor.name,updatedAt:new Date().toISOString()};
  if(before.etag)await t.updateEntity(row,'Replace',{etag:before.etag});else await t.createEntity(row);
  return readSettings();
}
async function send(recipients,subject,content,contentType='Text') {
  if(!recipients.length||recipients.some(r=>!email(r)))throw fail('Valid email recipients are required.',503);
  await graph('users/'+encodeURIComponent(process.env.JOIN_MAIL_SENDER)+'/sendMail',{message:{subject,body:{contentType,content},bccRecipients:[...new Set(recipients)].map(address=>({emailAddress:{address}}))},saveToSentItems:true});
}
async function notifyHeld(ref,config,delivery) {
  let status='disabled';
  if(delivery.emailEnabled){
    try {
      const r=await leads().getEntity(ref.partitionKey,ref.rowKey);
      const url=process.env.QUARANTINE_DASHBOARD_URL || 'https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/dashboard';
      const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const link=url.split('#')[0]+'#quarantine?'+new URLSearchParams({partitionKey:ref.partitionKey,rowKey:ref.rowKey});
      await send(delivery.mode==='test'?[delivery.testRecipient]:config.recipients,(delivery.mode==='test'?'[TEST] ':'')+'Enquiry awaiting quarantine review',`<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#202124"><p>An enquiry has been held for review. Release it to the club, send it to another email address, or send the full enquiry to both.</p><p><strong>Selected club:</strong> ${escape(r.clubName||'')}<br><strong>Enquirer:</strong> ${escape(r.name||'')}<br><strong>Matched keywords:</strong> ${escape(JSON.parse(r.quarantineMatchesJson||'[]').join(', '))}</p><p style="white-space:pre-wrap">${escape(r.about||'')}</p><p><strong>Preferences:</strong> ${escape(r.filtersJson||'[]')}</p><p><a href="${escape(link)}" style="color:#0046ad;text-decoration:underline;font-weight:600">View enquiry</a> — sign in if prompted; this opens the specific enquiry.</p><p>Reference: ${escape(ref.rowKey)}</p></div>`,'HTML');status='accepted';
    }catch{status='needs-review';}
  }
  await leads().updateEntity({...ref,quarantineNotificationStatus:status},'Merge');
}
async function list() {
  const rows=[];
  try {for await(const {emailHash,...r} of leads().listEntities({queryOptions:{filter:odata`quarantineStatus ne ${''}`}})){if(r.quarantineStatus)rows.push(r);if(rows.length>5000)throw fail('Quarantine has too many records to load.',422);}}
  catch(e){if(e.statusCode!==404)throw e;}
  return rows.sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));
}
async function decide(body,actor,record=async()=>{}) {
  if(!actor?.id)throw fail('Sign in to review enquiries.',401);
  if(!['release','block','forward-release'].includes(body.action)||!body.etag||typeof body.partitionKey!=='string'||typeof body.rowKey!=='string')throw fail('Select an enquiry and a review action.');
  const forwards=body.action!=='release', releases=body.action!=='block';
  if(forwards&&(!email(body.forwardTo)||typeof body.notes!=='string'||!body.notes.trim()||body.notes.length>4000))throw fail('Enter a forwarding email address and notes (up to 4,000 characters).');
  if(body.action==='forward-release'&&(typeof body.clubNotice!=='string'||!body.clubNotice.trim()||body.clubNotice.length>2000))throw fail('Enter a note for the club (up to 2,000 characters).');
  const t=leads(),r=await t.getEntity(body.partitionKey,body.rowKey);
  if(r.etag!==body.etag||r.quarantineStatus!=='held')throw fail('This enquiry has changed or has already been reviewed. Refresh the queue.',409);
  const delivery=await deliverySettings();if(!delivery.emailEnabled)throw fail('Enquiry emails are paused. Enable delivery before reviewing.',409);
  const mode=r.leadApiMode==='test'||delivery.mode!=='production'?'test':'production';
  let recipient=body.forwardTo;
  if(releases){
    const club=await table(process.env.LEAD_ROUTE_TABLE_NAME||'ClubLeadRouting').getEntity('club',r.clubSlug);
    if(!club.enabled||!email(club.recipientEmail))throw fail('The selected club is disabled or has no valid email address.',409);
    recipient=club.recipientEmail;
  }
  if(mode==='test')recipient=delivery.testRecipient;
  if(!email(recipient))throw fail('A valid delivery recipient is required.');
  const ref={partitionKey:r.partitionKey,rowKey:r.rowKey};
  const forwardRecipient=mode==='test'?delivery.testRecipient:body.forwardTo;
  const decision={quarantineAction:body.action,quarantineReviewedBy:actor.name,quarantineReviewerId:actor.id,quarantineReviewedAt:new Date().toISOString(),quarantineNotes:forwards?body.notes.trim():'',quarantineForwardTo:forwards?body.forwardTo:'',quarantineClubNotice:body.action==='forward-release'?body.clubNotice.trim():'',quarantineDeliveryRecipient:recipient,quarantineForwardRecipient:forwards?forwardRecipient:'',quarantineDeliveryMode:mode,quarantineForwardStatus:forwards?'not-sent':'not-applicable',quarantineClubStatus:releases?'not-sent':'not-applicable'};
  // Claim before sending. A crash or ambiguous mail response must never trigger an automatic resend.
  await t.updateEntity({...ref,...decision,quarantineStatus:'sending'},'Merge',{etag:r.etag});
  const content=`${mode==='test'?'TEST — delivered only to the test recipient.\n\n':''}Selected club: ${r.clubName}\nName: ${r.name}\nEmail: ${r.email}\nPhone: ${r.phone||''}\nSuburb: ${r.suburb||''}\nSelections: ${r.filtersJson||'[]'}\nMatched keywords: ${JSON.parse(r.quarantineMatchesJson||'[]').join(', ')}\n\nMessage:\n${r.about||''}\n\nReference: ${r.rowKey}`;
  const outcomes={quarantineForwardStatus:decision.quarantineForwardStatus,quarantineClubStatus:decision.quarantineClubStatus};
  const deliver=async(kind,address,subject,message)=>{
    const key=kind==='forward'?'quarantineForwardStatus':'quarantineClubStatus';
    outcomes[key]='sending';await t.updateEntity({...ref,...outcomes},'Merge');
    try{await send([address],`${mode==='test'?'[TEST] ':''}${subject} – ${r.clubName}`,message);outcomes[key]='accepted';}
    catch{outcomes[key]='needs-review';throw fail('Email outcome needs review.',502);}
    await t.updateEntity({...ref,...outcomes},'Merge');
    await record({enquiry:r.rowKey,partitionKey:r.partitionKey,action:kind==='forward'?'forward':'release',recipient:address,mode,notes:kind==='forward'?decision.quarantineNotes:decision.quarantineClubNotice},'completed');
  };
  try {
    if(forwards)await deliver('forward',forwardRecipient,body.action==='block'?'Forwarded enquiry':'Forwarded enquiry — also going to club',`Note to recipient:\n${decision.quarantineNotes}\n\n${body.action==='block'?'This enquiry is being sent only to you. No email will be sent to the selected club.':'The full enquiry will also be sent to the selected club with a separate note after this forward is accepted.'}\n\n${content}`);
    if(releases)await deliver('release',recipient,'New membership enquiry',`${decision.quarantineClubNotice?'Note to the club:\n'+decision.quarantineClubNotice+'\n\n':''}${content}`);
  } catch {
    await t.updateEntity({...ref,...outcomes,quarantineStatus:'needs-review',emailDeliveryStatus:outcomes.quarantineClubStatus==='accepted'?'sent':outcomes.quarantineForwardStatus==='accepted'?'forwarded':'quarantined'},'Merge');
    await record({enquiry:r.rowKey,action:body.action,...outcomes},'needs-review');
    throw fail('Review needs attention. Check the recorded forwarding and club outcomes and Sent Items; automatic resend is disabled.',502);
  }
  const status=body.action==='forward-release'?'forwarded-released':releases?'released':'blocked';
  await t.updateEntity({...ref,quarantineStatus:status,emailDeliveryStatus:releases?'sent':'forwarded',quarantineEmailStatus:'accepted'},'Merge');
  return {ok:true,status,mode,...outcomes};
}
module.exports={KEYWORDS,validateKeywords,matches,readSettings,saveSettings,validateRecipients,notifyHeld,list,decide};
