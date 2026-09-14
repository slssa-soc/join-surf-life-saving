(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.JoinAttribution=value;})(typeof window==='object'?window:globalThis,()=>{
  const clean=value=>String(value||'').replace(/[^a-zA-Z0-9 _./-]/g,'').trim().slice(0,100);
  function classify(source,medium=''){
    const s=String(source||'').toLowerCase().replace(/^www\./,''),m=String(medium||'').toLowerCase();
    const match=d=>s===d||s.endsWith('.'+d);
    let platform='';
    if(['facebook','fb'].includes(s)||match('facebook.com')||match('fb.com'))platform='Facebook';
    else if(['instagram','ig','insta'].includes(s)||match('instagram.com'))platform='Instagram';
    else if(s==='tiktok'||match('tiktok.com'))platform='TikTok';
    else if(s==='linkedin'||match('linkedin.com')||match('lnkd.in'))platform='LinkedIn';
    else if(['twitter','x'].includes(s)||match('twitter.com')||match('x.com')||match('t.co'))platform='X / Twitter';
    else if(s==='youtube'||match('youtube.com')||match('youtu.be'))platform='YouTube';
    else if(s==='pinterest'||match('pinterest.com')||match('pin.it'))platform='Pinterest';
    else if(s==='reddit'||match('reddit.com'))platform='Reddit';
    let search='';
    if(s==='google'||/(^|\.)google\.(com|com\.au|co\.uk|co\.nz)$/.test(s))search='Google';
    else if(s==='bing'||match('bing.com'))search='Bing';
    else if(s==='duckduckgo'||match('duckduckgo.com'))search='DuckDuckGo';
    else if(s==='yahoo'||match('yahoo.com'))search='Yahoo';
    const paid=['cpc','ppc','paid','paid_social','paidsocial','paid_search','paidsearch'].includes(m);
    if(['email','newsletter'].includes(m))return{source:platform||search||clean(source)||'Email',channel:'Email'};
    if(platform)return{source:platform,channel:paid?'Paid social':'Social media'};
    if(search)return{source:search,channel:paid?'Paid search':'Organic search'};
    if(['paid_social','paidsocial'].includes(m))return{source:clean(source)||'Unknown platform',channel:'Paid social'};
    if(['social','organic_social','social-media'].includes(m))return{source:clean(source)||'Unknown platform',channel:'Social media'};
    if(paid)return{source:clean(source)||'Unknown source',channel:'Paid advertising'};
    if(!s||['direct','direct / unknown','(direct)'].includes(s))return{source:'Direct / unknown',channel:'Direct / unknown'};
    return{source:clean(source),channel:'Referral'};
  }
  function capture(href,referrer,previous,now=Date.now()){
    const url=new URL(href);let ref='';try{ref=new URL(referrer).hostname.toLowerCase();}catch{}
    const external=ref&&ref!==url.hostname,tagged=['utm_source','utm_medium','utm_campaign'].some(k=>url.searchParams.has(k));
    if(!tagged&&!external&&previous&&now-previous.lastSeen<1800000)return{...previous,lastSeen:now};
    const medium=clean(url.searchParams.get('utm_medium')),source=clean(url.searchParams.get('utm_source'))||(external?ref:'Direct / unknown');
    return{...classify(source,medium),medium,campaign:clean(url.searchParams.get('utm_campaign')),content:clean(url.searchParams.get('utm_content')),term:clean(url.searchParams.get('utm_term')),referrer:external?ref:'',landingPage:url.pathname.slice(0,250),lastSeen:now};
  }
  function normalise(value){const input=value&&typeof value==='object'?value:{},result={};for(const key of ['source','channel','medium','campaign','content','term','referrer','landingPage'])result[key]=clean(input[key]);return result;}
  return{classify,capture,normalise};
});
