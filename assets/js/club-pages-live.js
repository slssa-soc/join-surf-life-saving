// Public content only. Editor notes, identities and revision history are never fetched here.

(()=>{

  'use strict';

  const api='https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net';

  const imageUrl=value=>value.startsWith('/api/club-images/')?api+value:value;

  const setText=(root,selector,value)=>{const el=root.querySelector(selector);if(el)el.textContent=value||'';};

  const displayTitle=title=>title.replace('Surf Life Saving Club','SLSC').replace('Life Saving Club','LSC');

  function image(root,selector,c){const img=root.querySelector(selector);if(img){img.src=imageUrl(c.image);img.alt=c.imageAlt||c.title;}}

  function detail(label,value,className='club-profile__glance-item'){

    const item=document.createElement('div');item.className=className;

    const heading=document.createElement(className==='club-profile__highlight'?'h3':'span');heading.className='club-profile__glance-label';heading.textContent=label;

    const text=document.createElement(className==='club-profile__highlight'?'p':'strong');text.textContent=value;item.append(heading,text);return item;

  }

  const facilityLabels={gym:'Gym',restaurant:'Club restaurant',accessibleFacilities:'Accessible facilities',beachAccess:'Accessible beach access'};

  async function load(){

    const profile=document.querySelector('.club-profile'),cards=[...document.querySelectorAll('[data-club-card]')];

    if(!profile&&!cards.length)return;

    const slug=profile?.querySelector('[data-lead-club]')?.dataset.leadClub;

    try{

      const response=await fetch(api+'/api/club-pages'+(slug?'/'+encodeURIComponent(slug):''),{cache:'no-store',signal:AbortSignal.timeout(8000)});

      if(!response.ok)throw Error('unavailable');const value=await response.json();

      if(profile){

        const c=value.content;setText(profile,'h1',displayTitle(c.title));setText(profile,'.club-profile__summary',c.summary);image(profile,'.club-profile__image img',c);

        document.title=displayTitle(c.title)+' | Club Directory';

        const meta=profile.querySelector('.club-profile__meta');if(meta){meta.replaceChildren();for(const label of [c.suburb,c.region,c.memberSize].filter(Boolean)){const span=document.createElement('span');span.textContent=label;meta.append(span);}}

        const prose=profile.querySelector('.prose');if(prose)prose.innerHTML=DOMPurify.sanitize(c.html,{ALLOWED_TAGS:['p','br','strong','b','em','i','u','h2','h3','ul','ol','li','blockquote','a'],ALLOWED_ATTR:['href','title','rel']});

        const actions=profile.querySelector('.club-profile__actions');let website=actions?.querySelector('a[target="_blank"]');if(c.website){if(!website){website=document.createElement('a');website.className='button button--outline';website.textContent='Visit club website';actions?.append(website);}website.href=c.website;website.target='_blank';website.rel='noopener noreferrer';}else website?.remove();

        const panel=profile.querySelector('.club-profile__panel');if(panel){panel.replaceChildren();const heading=document.createElement('h2');heading.textContent='At a glance';panel.append(heading);const glance=document.createElement('div');glance.className='club-profile__glance';for(const [key,label]of [['junior','Nippers / junior activities'],['youth','Youth'],['patrolling','Lifesaving and patrols'],['accessibility','Accessibility']])if(c[key]&&(key!=='accessibility'||c.accessibleFacilities||c.beachAccess))glance.append(detail(label,c[key]));panel.append(glance);const facilities=Object.entries(facilityLabels).filter(([key])=>c[key]).map(([,label])=>label);panel.append(detail('Club facilities',facilities.join('  /  ')||'No facilities listed'));for(const [key,label]of [['adaptive','Adaptive participation'],['multicultural','Multicultural participation'],['firstNations','First Nations participation']])if(c[key])panel.append(detail(label,c[key],'club-profile__highlight'));for(const text of c.otherPrograms.split('\n').filter(Boolean))panel.append(detail('Also available',text,'club-profile__highlight'));}

        setText(document,'[data-lead-club-name]',displayTitle(c.title));

      }else{

        const pages=new Map(value.map(p=>[p.slug,p.content]));

        for(const card of cards){const slug=card.querySelector('[data-lead-club]')?.dataset.leadClub,c=pages.get(slug);if(!c)continue;setText(card,'h2 a',c.title);setText(card,'.club-card__summary',c.summary);card.dataset.title=c.title;card.dataset.facilities=Object.entries({gym:'gym',restaurant:'restaurant',accessibleFacilities:'accessible-facilities',beachAccess:'beach-access'}).filter(([key])=>c[key]).map(([,id])=>id).join('|');image(card,'.club-card__image img',c);card.querySelector('.club-card__image')?.setAttribute('aria-label','View '+c.title);const meta=card.querySelector('.club-meta');if(meta){for(const span of [...meta.children])if(!span.hasAttribute('data-location-fallback')&&!span.hasAttribute('data-distance-label'))span.remove();for(const label of [c.suburb,c.region,c.memberSize].filter(Boolean)){const span=document.createElement('span');span.textContent=label;meta.insertBefore(span,meta.querySelector('[data-location-fallback]'));}}}

        if(typeof applyFilters==='function')applyFilters();

      }

    }catch{ /* Keep the original static page if the content service is temporarily unavailable. */ }

  }

  void load();

})();

