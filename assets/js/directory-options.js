// One source of interest choices for every enquiry entry point.
(()=>{
  const api='https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net';
  async function load(){
    try{
      const response=await fetch(api+'/api/directory-options',{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('unavailable');
      const options=await response.json();
      for(const container of document.querySelectorAll('[data-lead-interest-options]')){
        const selected=new Set([...container.querySelectorAll('input:checked')].map(input=>input.value));
        container.replaceChildren();
        for(const item of options.interests){
          const label=document.createElement('label');label.className='lead-preference-option';
          const input=document.createElement('input');input.type='checkbox';input.name='leadInterest';input.value=item.id;input.dataset.leadInterest='';input.dataset.leadInterestLabel=item.label;input.checked=selected.has(item.id);
          const span=document.createElement('span');span.textContent=item.label;label.append(input,span);container.append(label);
        }
      }
    }catch{ /* Keep the shared static choices when the service is unavailable. */ }
  }
  void load();
})();
