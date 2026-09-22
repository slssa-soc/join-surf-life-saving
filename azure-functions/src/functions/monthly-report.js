const { app } = require('@azure/functions');
const reporting = require('../lib/monthly-report');
const enquiryRating = require('../lib/enquiry-rating');
app.timer('monthly-report', {
  schedule:'0 */30 * * * *', useMonitor:true, runOnStartup:false,
  handler:async()=>{
    const now=new Date(), p=reporting.localParts(now);
    if(p.day==='01' && +p.hour>=9)await reporting.deliver({now});
  }
});
app.http('enquiry-rating', {
  methods:['POST','OPTIONS'], authLevel:'anonymous', route:'enquiry-rating',
  handler:async request=>{
    const origin=request.headers.get('origin');
    const allowed=(process.env.ALLOWED_ORIGINS||'https://join.surflifesavingsa.com.au').split(',').map(s=>s.trim());
    const headers={'Cache-Control':'no-store','Vary':'Origin',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{})};
    const response=(status,jsonBody)=>({status,headers,jsonBody});
    if(!allowed.includes(origin))return response(403,{error:'Origin not allowed.'});
    if(request.method==='OPTIONS')return {status:204,headers};
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return response(415,{error:'JSON required.'});
    try{
      const raw=await request.text();if(raw.length>300)return response(413,{error:'Request too large.'});
      let body;try{body=JSON.parse(raw);}catch{return response(400,{error:'Invalid JSON.'});}
      return response(200,await enquiryRating.submit(body));
    }catch(e){return response(e.status||503,{error:e.status?e.message:'Rating could not be saved. Please try again.'});}
  }
});
