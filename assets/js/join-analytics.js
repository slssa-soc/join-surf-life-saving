/* Join website usage only. Never send enquiry fields or query strings. */
(() => {
  if (location.hostname !== 'join.surflifesavingsa.com.au' || !window.Microsoft?.ApplicationInsights) return;
  const ai = new Microsoft.ApplicationInsights.ApplicationInsights({ config: {
    connectionString: 'InstrumentationKey=137c6df9-d303-46d7-a3ef-fcb05dff08f6;IngestionEndpoint=https://australiasoutheast-0.in.applicationinsights.azure.com/;ApplicationId=170eb745-4899-4885-97b4-c6987d9830de',
    disableAjaxTracking: true, disableFetchTracking: true, disableExceptionTracking: true,
    enableAutoRouteTracking: false, autoTrackPageVisitTime: false,
    enableRequestHeaderTracking: false, enableResponseHeaderTracking: false,
    enableAjaxErrorStatusText: false, disableCookiesUsage: false
  }});
  ai.loadAppInsights();
  let referrer = 'Direct / unknown';
  try { if (document.referrer) referrer = new URL(document.referrer).hostname; } catch {}
  const cleanPath = location.pathname;
  ai.addTelemetryInitializer(item => {
    item.baseData ||= {};
    item.baseData.properties ||= {};
    item.baseData.properties.site = 'join';
    item.baseData.properties.referrer = referrer;
    item.baseData.properties.device = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop / tablet';
    item.baseData.uri = location.origin + cleanPath;
    item.baseData.refUri = referrer === 'Direct / unknown' ? '' : `https://${referrer}/`;
    if (item.ext?.web) item.ext.web.browserLang = navigator.language;
  });
  ai.trackPageView({ name: cleanPath, uri: location.origin + cleanPath });
  if (cleanPath.startsWith('/clubs/')) ai.trackEvent({name:'club_view'});
  let started = false;
  document.addEventListener('input',event=>{
    if (!started && event.target.closest('[data-lead-form]')) { started=true; ai.trackEvent({name:'form_started'}); }
  });
  window.joinTrackLead = () => { ai.trackEvent({name:'lead_submitted'}); started=false; };
})();
