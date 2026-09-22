// Post-enquiry feedback only. Server invitations enforce one request per email.
(()=>{
  'use strict';
  const key='join-enquiry-rating-invited-v1';let shown=false;
  window.joinWantsEnquiryRating=()=>{try{return !shown&&!localStorage.getItem(key);}catch{return !shown;}};
  window.joinShowEnquiryRating=(invitation,form)=>{
    if(!invitation||!/^[a-f0-9]{64}$/.test(invitation.token||'')||!['test','production'].includes(invitation.mode)||!form?.parentNode||!window.joinWantsEnquiryRating())return;
    shown=true;
    // Mark the invitation itself, including dismissal; do not keep asking non-responders.
    try{if(invitation.mode==='production')localStorage.setItem(key,'shown');}catch{}
    const section=document.createElement('section');section.className='enquiry-experience';
    section.style.cssText='margin:20px 0;padding:20px;border:1px solid #d5e0e5;border-radius:12px;background:#f5f9fa;color:#153443';
    section.setAttribute('aria-labelledby','enquiry-rating-heading');
    section.innerHTML='<h3 id="enquiry-rating-heading">How easy was it to find a club and send your enquiry?</h3><p>Your enquiry is complete. This optional rating helps us improve the website.</p><fieldset style="border:0;padding:0"><legend>1 star = very difficult · 5 stars = very easy</legend><div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">'+[1,2,3,4,5].map(n=>`<label style="display:grid;justify-items:center;gap:4px;cursor:pointer"><span aria-hidden="true" style="font-size:30px;color:#aab5bd">★</span><input type="radio" name="enquiry-experience-stars" value="${n}" aria-label="${n} ${n===1?'star':'stars'}"><span>${n}</span></label>`).join('')+'</div></fieldset><button type="button" data-send-rating disabled>Send rating</button> <button type="button" data-dismiss-rating>No thanks</button><p style="font-size:13px">Your rating is optional. No name or email is stored with your response, and we will not ask again for this email address.</p><p role="status" aria-live="polite"></p>';
    form.insertAdjacentElement('afterend',section);
    const send=section.querySelector('[data-send-rating]'),status=section.querySelector('[role="status"]');
    section.addEventListener('change',()=>{send.disabled=false;const selected=Number(section.querySelector('input:checked')?.value);for(const input of section.querySelectorAll('input'))input.previousElementSibling.style.color=Number(input.value)<=selected?'#a96b00':'#aab5bd';});
    section.querySelector('[data-dismiss-rating]').onclick=()=>section.remove();
    send.onclick=async()=>{
      send.disabled=true;
      for(const input of section.querySelectorAll('input'))input.disabled=true;
      try{
        const response=await fetch('https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/enquiry-rating',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:invitation.token,mode:invitation.mode,rating:Number(section.querySelector('input:checked').value)})});
        if(!response.ok)throw Error();
        status.textContent='Thank you. Your rating has been saved.';
        section.querySelector('fieldset').hidden=true;send.hidden=true;section.querySelector('[data-dismiss-rating]').hidden=true;
      }catch{status.textContent='Your rating could not be saved. Your enquiry is still complete. Please try the rating again.';send.disabled=false;for(const input of section.querySelectorAll('input'))input.disabled=false;}
    };
  };
})();
