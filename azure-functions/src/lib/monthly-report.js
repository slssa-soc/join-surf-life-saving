const { TableClient, odata } = require('@azure/data-tables');
const { ClientSecretCredential } = require('@azure/identity');
const baseline = require('../../data/club-pages.json');
const { render } = require('./monthly-email');
const ratingAvailability = require('./rating-availability');
const table = name => TableClient.fromConnectionString(process.env.AzureWebJobsStorage, name);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const zone = 'Australia/Adelaide';
function localParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-AU', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23' }).formatToParts(date).map(p => [p.type,p.value]));
}
function monthStart(year, month) {
  const wall = Date.UTC(year, month - 1, 1);
  let result = wall;
  for (let i=0;i<3;i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-AU', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(result)).map(p=>[p.type,p.value]));
    result += wall - Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
  }
  return new Date(result).toISOString();
}
function period(now = new Date(), offset = 1) {
  const p=localParts(now), d=new Date(Date.UTC(+p.year,+p.month-1-offset,1));
  const year=d.getUTCFullYear(), month=d.getUTCMonth()+1;
  return { key:`${year}-${String(month).padStart(2,'0')}`, label:d.toLocaleDateString('en-AU',{timeZone:'UTC',month:'long',year:'numeric'}), start:monthStart(year,month), end:monthStart(month===12?year+1:year,month===12?1:month+1) };
}
function validate(body) {
  if(!body||typeof body!=='object')throw fail('Report settings are required.');
  if(typeof body.enabled!=='boolean')throw fail('Choose whether monthly reporting is enabled.');
  const recipients=Array.isArray(body.recipients)?[...new Set(body.recipients.map(v=>typeof v==='string'?v.trim().toLowerCase():''))]:[];
  const email=v=>typeof v==='string'&&v.length<=180&&/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v);
  if(recipients.length>50 || recipients.some(v=>!email(v)) || (body.enabled&&!recipients.length))throw fail('Enter 1–50 valid report recipients before enabling reports.');
  const testRecipient=typeof body.testRecipient==='string'?body.testRecipient.trim().toLowerCase():'';
  if(testRecipient&&!email(testRecipient))throw fail('Enter a valid separate test email address.');
  if(testRecipient&&recipients.includes(testRecipient))throw fail('Use a separate test address outside the report recipient list.');
  return {enabled:body.enabled,recipients,testRecipient};
}
async function readSettings() {
  try {const r=await table('JoinDashboardSettings').getEntity('settings','monthly-report');return {...validate({...r,recipients:JSON.parse(r.recipientsJson)}),etag:r.etag};}
  catch(e){if(e.statusCode===404)return {enabled:false,recipients:[],testRecipient:'',etag:null};throw e;}
}
async function saveSettings(body) {
  const value=validate(body), t=table('JoinDashboardSettings');
  await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
  const before=await readSettings();
  if((body.etag||null)!==before.etag)throw fail('Report settings changed. Refresh before saving.',409);
  const entity={partitionKey:'settings',rowKey:'monthly-report',enabled:value.enabled,testRecipient:value.testRecipient,recipientsJson:JSON.stringify(value.recipients)};
  if(before.etag)await t.updateEntity(entity,'Replace',{etag:before.etag});else await t.createEntity(entity);
  return readSettings();
}
// Only recognised directory categories may appear in emails; never echo submitted text.
const ages={nippers:'Nippers (5–13)', 'nippers (5–13)':'Nippers (5–13)', 'nippers (5-13)':'Nippers (5–13)', youth:'Youth (13–18)', 'youth (13–18)':'Youth (13–18)', 'youth (13-18)':'Youth (13–18)', adults:'Adults (18+)', 'adults (18+)':'Adults (18+)', families:'Families', 'all ages':'All ages'};
const interests={nippers:'Nippers','lifesaving-patrols':'Lifesaving / patrols','lifesaving / patrols':'Lifesaving / patrols','lifesaving & patrols':'Lifesaving / patrols','surf-sports':'Surf sports','surf sports':'Surf sports',training:'Training',volunteering:'Volunteering',community:'Community',inclusive:'Inclusive programs','inclusive programs':'Inclusive programs','silver-salties':'Silver Salties','silver salties':'Silver Salties'};
Object.assign(interests,{'lifesaving and patrols':'Lifesaving / patrols','training and new skills':'Training','community involvement':'Community','inclusive-programs':'Inclusive programs'});
function aggregate(rows) {
  const result={total:0,unclassified:0,clubs:{},ages:{},interests:{},failed:0};
  const add=(group,key)=>group[key]=(group[key]||0)+1;
  for(const row of rows){
    if(row.leadApiMode==='test')continue;
    result.total++;if(row.leadApiMode!=='production')result.unclassified++;
    add(result.clubs,baseline[row.clubSlug]?.content.title||'Unrecognised club');
    if(row.emailDeliveryStatus==='failed')result.failed++;
    let filters=[];try{filters=JSON.parse(row.filtersJson||'[]');}catch{}
    if(!Array.isArray(filters))filters=[];
    for(const [group,names,allowed] of [['ages',['age','age group','who is joining?'],ages],['interests',['interest','interests'],interests]]){
      const values=new Set(filters.filter(f=>f&&names.includes(String(f.name).toLowerCase())).map(f=>{const key=String(f.value).trim().toLowerCase();return Object.hasOwn(allowed,key)?allowed[key]:null;}).filter(Boolean));
      if(!values.size)values.add('Not recorded / unrecognised');
      for(const value of values)add(result[group],value);
    }
  }
  return result;
}
async function rowsFor(name,p,select) {
  const rows=[];
  try {for await(const row of table(name).listEntities({queryOptions:{filter:odata`submittedAt ge ${p.start} and submittedAt lt ${p.end}`,select}}))rows.push(row);}
  catch(e){if(e.statusCode!==404)throw e;}
  return rows;
}
async function build(now=new Date()) {
  const p=period(now), previous=period(now,2), fields=['clubSlug','filtersJson','leadApiMode','emailDeliveryStatus'];
  const ratingWindow=ratingAvailability.windowFor(p);
  const [current,prior,feedback]=await Promise.all([rowsFor(process.env.LEAD_TABLE_NAME||'LeadSubmissions',p,fields),rowsFor(process.env.LEAD_TABLE_NAME||'LeadSubmissions',previous,fields),ratingWindow.status==='unavailable'?[]:rowsFor('JoinEnquiryRatings',ratingWindow,['rating','mode'])]);
  const ratings=feedback.filter(r=>r.mode==='production'&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5).map(r=>r.rating);
  return {period:p,...aggregate(current),previousTotal:aggregate(prior).total,ratings:{status:ratingWindow.status,availableFrom:ratingAvailability.START,count:ratings.length,average:ratings.length?Number((ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)):null}};
}
async function send(report,recipients,test) {
  const credential=new ClientSecretCredential(process.env.JOIN_MAIL_TENANT_ID,process.env.JOIN_MAIL_CLIENT_ID,process.env.JOIN_MAIL_CLIENT_SECRET);
  const token=await credential.getToken('https://graph.microsoft.com/.default');
  if(!process.env.JOIN_MAIL_SENDER)throw Error('Mail sender is not configured.');
  const response=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.JOIN_MAIL_SENDER)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token.token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({message:{subject:`${test?'[TEST · OUT-OF-SEQUENCE] ':''}Club Directory monthly report — ${report.period.label}`,body:{contentType:'HTML',content:render(report,test)},bccRecipients:recipients.map(address=>({emailAddress:{address}}))},saveToSentItems:true})});
  if(response.status!==202)throw Error(`Report mail request returned ${response.status}.`);
}
async function deliver({test=false,requestId,now=new Date()}={}) {
  const s=await readSettings();
  if(test&&!s.testRecipient)throw fail('Save a separate test email address first.');
  if(!test&&!s.enabled)return {status:'disabled'};
  if(test&&!/^[0-9a-f-]{36}$/i.test(requestId||''))throw fail('A test request reference is required.');
  const t=table('JoinMonthlyReportRuns');
  const key={partitionKey:test?'test':'scheduled',rowKey:test?requestId:period(now).key};
  try{return {status:(await t.getEntity(key.partitionKey,key.rowKey)).status};}
  catch(e){if(e.statusCode!==404)throw e;}
  const report=await build(now);
  await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
  // Claim before calling Graph. Never automatically resend an uncertain submission.
  try{await t.createEntity({...key,status:'sending',at:now.toISOString(),month:report.period.key});}
  catch(e){if(e.statusCode===409)return {status:(await t.getEntity(key.partitionKey,key.rowKey)).status};throw e;}
  try {await send(report,test?[s.testRecipient]:s.recipients,test);}
  catch(e){await t.updateEntity({...key,status:'needs-review'},'Merge');throw fail('Email acceptance could not be confirmed. Check the sender mailbox before trying another test.',502);}
  await t.updateEntity({...key,status:'accepted'},'Merge');
  return {status:'accepted'};
}
async function latest(now=new Date()) {
  try {const r=await table('JoinMonthlyReportRuns').getEntity('scheduled',period(now).key);return {month:r.month,status:r.status,at:r.at};}
  catch(e){if(e.statusCode===404)return {month:period(now).key,status:'not-sent'};throw e;}
}
module.exports={period,localParts,validate,readSettings,saveSettings,aggregate,build,render,deliver,latest};
