const { TableClient } = require('@azure/data-tables');
const { createHmac, randomBytes } = require('node:crypto');
const { START } = require('./rating-availability');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function store(){return TableClient.fromConnectionString(process.env.AzureWebJobsStorage,'JoinEnquiryRatings');}
async function invite(email,mode,now=new Date()) {
  if(now<new Date(START))return null;
  const secret=process.env.ENQUIRY_RATING_SECRET;
  if(!secret||secret.length<32)throw Error('A stable ENQUIRY_RATING_SECRET of at least 32 characters is required.');
  if(!['test','production'].includes(mode)||!email)throw Error('Invalid invitation');
  const key=createHmac('sha256',secret).update(String(email).trim().toLowerCase()).digest('hex');
  const token=randomBytes(32).toString('hex'),t=store();
  await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
  // Atomically reserve one invitation per normalised email, across all enquiries/devices.
  // The keyed email fingerprint is kept separately and has no link to the response token.
  try {await t.submitTransaction([
    ['create',{partitionKey:mode,rowKey:`invite-${key}`,invitedAt:now.toISOString()}],
    ['create',{partitionKey:mode,rowKey:`response-${token}`,invitedAt:now.toISOString(),mode}]
  ]);}catch(e){if(e.statusCode===409)return null;throw e;}
  return {token,mode};
}
async function submit(body,now=new Date()) {
  if(now<new Date(START))throw fail('Ratings are available from 22 September 2026.',403);
  if(!body||Object.keys(body).some(k=>!['rating','token','mode'].includes(k))||!Number.isInteger(body.rating)||body.rating<1||body.rating>5||!/^[a-f0-9]{64}$/.test(body.token||'')||!['production','test'].includes(body.mode))throw fail('Choose a rating from 1 to 5 using your enquiry invitation.');
  const t=store();let row;
  try{row=await t.getEntity(body.mode,`response-${body.token}`);}catch(e){if(e.statusCode===404)throw fail('This rating invitation is not valid.',404);throw e;}
  if(new Date(row.invitedAt)<new Date(START))throw fail('This rating invitation predates the rating start date.',410);
  if(row.rating)return {ok:true};
  if(now-new Date(row.invitedAt)>30*86400000)throw fail('This rating invitation has expired.',410);
  try {await t.updateEntity({partitionKey:row.partitionKey,rowKey:row.rowKey,rating:body.rating,submittedAt:now.toISOString()},'Merge',{etag:row.etag});}
  catch(e){if(e.statusCode!==412)throw e;const latest=await t.getEntity(row.partitionKey,row.rowKey);if(!latest.rating)throw e;}
  return {ok:true};
}
module.exports={invite,submit};
