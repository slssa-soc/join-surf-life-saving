const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const muted='color:#686870;font-size:12px;line-height:1.5';
const card='background:#fff;border:1px solid #e3e3e8;border-radius:18px';
const {windowFor,LABEL}=require('./rating-availability');
function render(r,test=false) {
  const delta=r.total-r.previousTotal;
  const change=delta===0?'— No change':`${delta>0?'▲':'▼'} ${Math.abs(delta)} ${delta>0?'more':'fewer'}`;
  const changeNote=`<span style="font-weight:600;color:${delta>0?'#237a46':delta<0?'#b42332':'#686870'}">${escape(change)}</span><br><span>vs previous month (${r.previousTotal})</span>`;
  const ratingStatus=windowFor(r.period).status;
  const ratingValue=ratingStatus==='unavailable'?'—':r.ratings.count?`${r.ratings.average} / 5`:'—';
  const ratingNote=ratingStatus==='unavailable'?`Not available · Starts ${LABEL}`:r.ratings.count?`${r.ratings.count} star-rating responses`:'No ratings yet';
  const metric=(label,value,note,noteHtml=false)=>`<td width="50%" valign="top" style="padding:6px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${card}"><tr><td class="metric" style="padding:22px"><p style="margin:0 0 12px;height:36px;line-height:18px;font-size:13px;color:#56565d;font-weight:600">${escape(label)}</p><p style="margin:0 0 8px;font-size:36px;font-weight:700;letter-spacing:-1px;color:#1d1d1f">${escape(value)}</p><p style="margin:0;min-height:36px;${muted}">${noteHtml?note:escape(note)}</p></td></tr></table></td>`;
  const breakdown=(title,entries)=>{
    const sorted=Object.entries(entries).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const max=Math.max(1,...sorted.map(([,n])=>n));
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${card}"><tr><td style="padding:24px"><h2 style="margin:0 0 18px;font-size:18px;letter-spacing:-.3px">${escape(title)}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${sorted.map(([name,n])=>`<tr><td style="padding:0 12px 7px 0;font-size:13px;line-height:1.5">${escape(name.replace('Surf Life Saving Club','SLSC'))}</td><td align="right" valign="top" style="font-size:14px;font-weight:600;white-space:nowrap">${n}</td></tr><tr><td colspan="2" style="padding-bottom:16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf1f5;border-radius:4px"><tr><td width="${Math.max(1,Math.round(n/max*100))}%" height="6" style="background:#6688b7;border-radius:4px;font-size:1px;line-height:6px">&nbsp;</td>${n<max?'<td style="font-size:1px;line-height:6px">&nbsp;</td>':''}</tr></table></td></tr>`).join('')||'<tr><td style="font-size:13px;color:#686870">No enquiries this month.</td></tr>'}</table></td></tr></table>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Join monthly report</title><style>@media(max-width:520px){.outer{padding:18px 10px!important}.metric{padding:16px!important}.column{display:block!important;width:100%!important;box-sizing:border-box}.heading{font-size:28px!important}}</style></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d1d1f">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="outer" align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="680"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px">
<tr><td style="padding:0 6px 22px"><p style="margin:0 0 20px;font-size:22px;font-weight:700;letter-spacing:-.6px">Join <span style="font-weight:400;color:#686870">/ SLSSA</span></p><h1 class="heading" style="margin:0 0 8px;font-size:32px;letter-spacing:-1px">Monthly report</h1><p style="margin:0;font-size:15px;color:#686870">${escape(r.period.label)}</p></td></tr>
${test?'<tr><td style="padding:0 6px 12px"><p style="margin:0;padding:14px 16px;background:#fff2dc;border:1px solid #e5cd9f;border-radius:12px;font-size:12px;line-height:1.6;color:#875313"><strong>TEST — OUT-OF-SEQUENCE REPORT</strong><br>Real data · Previous month · Scheduled send unchanged.</p></td></tr>':''}
<tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr>${metric('Enquiries',r.total,changeNote,true)}${metric('Clubs receiving enquiries',Object.keys(r.clubs).filter(k=>k!=='Unrecognised club').length,'Across the directory')}</tr><tr>${metric('Enquiry Experience Rating',ratingValue,ratingNote)}${metric('Email failures',r.failed,'Enquiry delivery')}</tr></table></td></tr>
<tr><td style="padding:14px 6px 6px">${breakdown('Enquiries by club',r.clubs)}</td></tr>
<tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr><td class="column" width="50%" valign="top" style="padding:6px">${breakdown('Selected age groups',r.ages)}</td><td class="column" width="50%" valign="top" style="padding:6px">${breakdown('Selected interests',r.interests)}</td></tr></table></td></tr>
<tr><td style="padding:18px 8px 0;${muted}">Ratings available from ${LABEL}${ratingStatus==='partial'?' · Partial month (22–30 Sep).':'.'}<br>Test enquiries excluded. Counts are enquiries, not memberships. Selections may overlap. Ratings are voluntary feedback.${r.unclassified?` Includes ${r.unclassified} enquiries with unclassified test/production status.`:''}<p style="margin:12px 0 0;color:#929299;font-size:11px">Surf Life Saving SA</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
module.exports={render};
