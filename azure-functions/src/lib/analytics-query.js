function analyticsQuery(days,includeTest=false){
  if(![7,30,90,365].includes(days))throw new Error('Invalid period');
  const scope=includeTest?'':'| where tostring(customDimensions.dataMode) != "test"';
  return `let p=materialize(pageViews | where timestamp > ago(${days}d) | where tostring(customDimensions.site)=='join' ${scope});
let e=materialize(customEvents | where timestamp > ago(${days}d) | where tostring(customDimensions.site)=='join' ${scope});
union
(p | summarize value=count() | extend label='Page views',category='total'),
(p | summarize value=dcount(user_Id) | extend label='Visitors',category='total'),
(p | summarize value=dcount(session_Id) | extend label='Sessions',category='total'),
(p | where tostring(customDimensions.dataMode) !in ('test','production') | summarize value=count() | extend label='Unclassified views',category='total'),
(p | summarize value=count() by label=format_datetime(datetime_utc_to_local(timestamp,'Australia/Adelaide'),'yyyy-MM-dd') | extend category='daily'),
(p | summarize value=dcount(session_Id) by label=coalesce(tostring(customDimensions.source),tostring(customDimensions.referrer),'Direct / unknown') | extend category='source'),
(p | summarize value=dcount(session_Id) by label=tostring(customDimensions.channel) | extend category='channel'),
(p | where isnotempty(tostring(customDimensions.campaign)) | summarize value=dcount(session_Id) by label=tostring(customDimensions.campaign) | extend category='campaign'),
(p | where isnotempty(tostring(customDimensions.term)) | summarize value=dcount(session_Id) by label=tostring(customDimensions.term) | extend category='term'),
(p | summarize value=count() by label=tostring(customDimensions.device) | extend category='device'),
(p | summarize value=count() by label=name | top 15 by value desc | extend category='page'),
(p | where isnotempty(tostring(customDimensions.landingPage)) | summarize value=dcount(session_Id) by label=tostring(customDimensions.landingPage) | top 15 by value desc | extend category='landing'),
(e | summarize value=count() by label=name | extend category='event'),
(e | summarize value=dcount(session_Id) by label=name | extend category='eventSessions'),
(e | where name=='club_view' | summarize value=count() by label=tostring(customDimensions.clubSlug) | extend category='clubViews'),
(e | where name=='club_website_click' | summarize value=count() by label=tostring(customDimensions.clubSlug) | extend category='clubExits')`;
}
module.exports={analyticsQuery};
