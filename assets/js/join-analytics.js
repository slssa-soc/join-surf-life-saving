/* Campaign labels and page paths only; enquiry fields are never tracked. */
(()=>{
  if(location.hostname!=='join.surflifesavingsa.com.au'||!window.JoinAttribution)return;
  let previous;try{previous=JSON.parse(sessionStorage.getItem('joinCampaignAttribution'));}catch{}
  const attribution=JoinAttribution.capture(location.href,document.referrer,previous);
  try{sessionStorage.setItem('joinCampaignAttribution',JSON.stringify(attribution));}catch{}
  window.joinGetAttribution=()=>JoinAttribution.normalise(attribution);
  if(!window.Microsoft?.ApplicationInsights)return;
  const ai=new Microsoft.ApplicationInsights.ApplicationInsights({config:{connectionString:'InstrumentationKey=137c6df9-d303-46d7-a3ef-fcb05dff08f6;IngestionEndpoint=https://australiasoutheast-0.in.applicationinsights.azure.com/;ApplicationId=170eb745-4899-4885-97b4-c6987d9830de',disableAjaxTracking:true,disableFetchTracking:true,disableExceptionTracking:true,enableAutoRouteTracking:false,autoTrackPageVisitTime:false,enableRequestHeaderTracking:false,enableResponseHeaderTracking:false,disableCookiesUsage:false}});
  ai.loadAppInsights();let dataMode='unknown';
  const cleanPath=location.pathname,club=cleanPath.startsWith('/clubs/')?cleanPath.split('/')[2]:'';
  ai.addTelemetryInitializer(item=>{
    item.baseData||={};item.baseData.properties||={};const suppliedMode=item.baseData.properties.dataMode;
    Object.assign(item.baseData.properties,window.joinGetAttribution(),{site:'join',trackingVersion:'2',dataMode:suppliedMode||dataMode,clubSlug:club,device:/Mobi|Android/i.test(navigator.userAgent)?'Mobile':'Desktop / tablet'});
    item.baseData.uri=location.origin+cleanPath;item.baseData.refUri=attribution.referrer?'https://'+attribution.referrer+'/':'';
  });
  const modeReady=fetch('https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/tracking-config',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok?r.json():{}).then(r=>{if(['test','production'].includes(r.mode))dataMode=r.mode;}).catch(()=>{});
  modeReady.then(()=>{ai.trackPageView({name:cleanPath,uri:location.origin+cleanPath});if(club)ai.trackEvent({name:'club_view'});});
  let started=false;
  document.addEventListener('input',event=>{if(!started&&event.target.closest('[data-lead-form]')){started=true;modeReady.then(()=>ai.trackEvent({name:'form_started'}));}});
  document.addEventListener('click',event=>{const link=event.target.closest('.club-profile__actions a[target="_blank"]');if(link&&club)modeReady.then(()=>ai.trackEvent({name:'club_website_click'}));});
  window.joinTrackLead=mode=>{ai.trackEvent({name:'lead_submitted',properties:{dataMode:['production','test'].includes(mode)?mode:'unknown'}});started=false;};
})();
