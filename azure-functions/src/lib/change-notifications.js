const {TableClient}=require('@azure/data-tables');
const {ClientSecretCredential}=require('@azure/identity');
const table=name=>TableClient.fromConnectionString(process.env.AzureWebJobsStorage,name);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function validate(body){
  if(!Array.isArray(body?.recipients)||body.recipients.length>50)throw fail('Use up to 50 notification addresses.');
  const recipients=body.recipients.map(v=>typeof v==='string'?v.trim().toLowerCase():'');
  if(recipients.some(v=>v.length>180||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v)))throw fail('Enter valid notification email addresses.');
  return{recipients:[...new Set(recipients)]};
}
async function send(recipients,change){
  const credential=new ClientSecretCredential(process.env.JOIN_MAIL_TENANT_ID,process.env.JOIN_MAIL_CLIENT_ID,process.env.JOIN_MAIL_CLIENT_SECRET);
  const token=await credential.getToken('https://graph.microsoft.com/.default');
  if(!process.env.JOIN_MAIL_SENDER)throw Error('Mail sender missing');
  const content=`A Club Directory change was saved.\n\nChanged by: ${change.actor}\nTime: ${change.at}\nArea: ${change.area}\n${change.slug?'Club: '+change.slug+'\n':''}${change.notes?'Reason: '+change.notes+'\n':''}\nReview changes in the dashboard Activity log.\nhttps://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/dashboard`;
  const res=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.JOIN_MAIL_SENDER)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token.token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({message:{subject:'Club Directory change — '+change.area,body:{contentType:'Text',content},bccRecipients:recipients.map(address=>({emailAddress:{address}}))},saveToSentItems:true})});
  if(res.status!==202)throw Error('Mail service did not accept the notification');
}
function createStore({getTable=table,sendMail=send}={}){
  async function read(){try{const r=await getTable('JoinDashboardSettings').getEntity('settings','change-notifications');return{...validate({recipients:JSON.parse(r.recipientsJson)}),etag:r.etag};}catch(e){if(e.statusCode===404)return{recipients:[],etag:null};throw e;}}
  async function save(body){const value=validate(body),before=await read(),t=getTable('JoinDashboardSettings');if((body.etag||null)!==before.etag)throw fail('Notification settings changed. Reload before saving.',409);await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});const row={partitionKey:'settings',rowKey:'change-notifications',recipientsJson:JSON.stringify(value.recipients)};if(before.etag)await t.updateEntity(row,'Replace',{etag:before.etag});else await t.createEntity(row);return read();}
  async function notify(change,recipients){
    if(!recipients.length)return{status:'no-recipients'};
    const t=getTable('JoinChangeNotifications'),key={partitionKey:'change',rowKey:change.id};
    try{
      await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
      try{await t.createEntity({...key,status:'sending',at:change.at,area:change.area,actor:change.actor});}catch(e){if(e.statusCode===409)return{status:'already-recorded'};throw e;}
      let status='accepted';try{await sendMail(recipients,change);}catch{status='needs-review';}
      await t.updateEntity({...key,status},'Merge');return{status};
    }catch{return{status:'needs-review'};}
  }
  return{read,save,notify};
}
module.exports={...createStore(),createStore,validate};
