async function mountDirectorySettings(run){
  const notifications=view==='settings-changes',resource=notifications?'change-notifications':'directory-settings';
  let config=await api(resource);if(run!==serial)return;
  $('content').innerHTML=settingsNavigation()+panel(notifications?'Change notifications':'Website options',notifications?`<form id="directory-settings-form" class="form-stack"><p>Email these addresses whenever dashboard settings, club contact details or club pages are saved. This list starts empty and is independent of enquiry delivery mode. Recipients are hidden from one another.</p><label>Notification email addresses<textarea id="change-recipients" rows="6" placeholder="One email address per line">${esc(config.recipients.join('\n'))}</textarea></label><p>Up to 50 addresses. Changes to this list notify the previously saved recipients.</p><button type="submit">Save notification settings</button><p id="directory-status" role="status"></p></form>`:`<form id="directory-settings-form" class="form-stack"><nav class="directory-section-nav" aria-label="Jump to website options section">${['activities','interests'].map(key=>`<button type="button" class="directory-section-link secondary" data-directory-jump="${key}"><strong>${key==='activities'?'Club offerings':'Enquiry form options'} <span aria-hidden="true">↓</span></strong><span>${key==='activities'?'Tags on club cards and profiles':'Choices in Send my details'}</span><small data-directory-count="${key}"></small></button>`).join('')}</nav><p>Choose either section above to jump directly to its list. Club offerings and enquiry form options are managed separately.</p>${['activities','interests'].map(key=>`<fieldset id="directory-section-${key}" class="directory-section"><legend id="directory-heading-${key}" tabindex="-1">${key==='activities'?'Club offerings':'Enquiry form options'}</legend><p>${key==='activities'?'These labels describe what a club offers. They appear on club results cards and profiles. After adding a label here, open Club pages and select it under Club offerings for the relevant clubs.':'These are the choices visitors see under “What are you interested in?” when they select Send my details. A visitor selects these to tell the club what they want to do. The same choices appear in every club’s enquiry form.'}</p><div class="directory-section-layout"><div class="directory-section-editor"><ul id="options-${key}" class="directory-list"></ul><button type="button" class="secondary" data-option-add="${key}">Add ${key==='activities'?'club offering':'enquiry option'}</button></div><div role="complementary" id="placement-${key}" class="directory-placement" aria-label="${key==='activities'?'Club offering placement examples':'Enquiry option placement examples'}"></div></div></fieldset>`).join('')}<button type="submit" id="directory-save" disabled>Save website options</button><p id="directory-status" role="status"></p></form>`);
  let editing=null;
  const previewFocus={};
  function renderPlacement(key){$('placement-'+key).innerHTML=directoryPlacementPreview(key,config[key],previewFocus[key]);}
  function dirty(){ $('directory-save').disabled=false;$('directory-status').textContent='Unsaved changes. Save website options to publish.'; }
  function render(key){
    document.querySelector('[data-directory-count="'+key+'"]').textContent=config[key].length+(key==='activities'?' offerings':' form options');
    $('options-'+key).innerHTML=config[key].map((item,i)=>`<li class="directory-option"><span class="directory-option-name" id="option-${key}-${i}">${esc(item.label)}</span><div class="directory-option-actions"><button type="button" class="secondary" data-option-edit="${key}" data-option-index="${i}" aria-describedby="option-${key}-${i}">Edit</button><button type="button" class="secondary" data-option-remove="${key}" data-option-index="${i}" aria-describedby="option-${key}-${i}">Remove</button></div></li>`).join('')||'<li class="directory-list-empty">No options added yet.</li>';
    renderPlacement(key);
  }
  if(!notifications){
    $('content').insertAdjacentHTML('beforeend',`<dialog id="directory-edit" aria-labelledby="directory-edit-title"><form id="directory-edit-form"><h2 id="directory-edit-title">Edit activity</h2><label for="directory-label">Name</label><textarea id="directory-label" rows="3" maxlength="200" required></textarea><p id="directory-edit-error" role="alert"></p><p class="footnote">Apply this label, then save the list to publish your changes.</p><div class="directory-dialog-actions"><button type="button" class="secondary" id="directory-edit-cancel">Cancel</button><button type="submit">Apply</button></div></form></dialog>`);
    for(const key of ['activities','interests'])render(key);
    $('directory-edit-cancel').onclick=()=>$('directory-edit').close();
    $('directory-edit').addEventListener('close',()=>{if(editing?.trigger?.isConnected)editing.trigger.focus();});
    $('directory-settings-form').onclick=e=>{
      const jump=e.target.closest('[data-directory-jump]');
      if(jump){const key=jump.dataset.directoryJump;$('directory-heading-'+key).focus({preventScroll:true});$('directory-section-'+key).scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}

      const add=e.target.closest('[data-option-add]'),edit=e.target.closest('[data-option-edit]'),remove=e.target.closest('[data-option-remove]');
      if(!add&&!edit&&!remove)return;
      const key=add?.dataset.optionAdd||edit?.dataset.optionEdit||remove.dataset.optionRemove,index=Number((edit||remove)?.dataset.optionIndex);
      if(remove){config[key].splice(index,1);render(key);dirty();const buttons=$('options-'+key).querySelectorAll('[data-option-remove]');(buttons[Math.min(index,buttons.length-1)]||document.querySelector('[data-option-add="'+key+'"]')).focus();return;}
      editing={key,index:add?null:index,trigger:add||edit};
      if(edit){previewFocus[key]=config[key][index].id;renderPlacement(key);}
      $('directory-edit-title').textContent=(add?'Add ':'Edit ')+(key==='activities'?'club offering':'enquiry option');
      $('directory-label').value=add?'':config[key][index].label;$('directory-edit-error').textContent='';$('directory-edit').showModal();$('directory-label').focus();
    };
    $('directory-edit-form').onsubmit=e=>{
      e.preventDefault();const label=$('directory-label').value.trim(),{key,index}=editing;
      if(!label){$('directory-edit-error').textContent='Enter a name.';return;}
      if(config[key].some((item,i)=>i!==index&&item.label.toLowerCase()===label.toLowerCase())){$('directory-edit-error').textContent='This name is already in the list.';return;}
      if(index===null)config[key].push({id:'option-'+crypto.randomUUID(),label});else config[key][index].label=label;
      previewFocus[key]=config[key][index??config[key].length-1].id;
      render(key);editing.trigger=$('options-'+key).querySelectorAll('[data-option-edit]')[index??config[key].length-1];dirty();$('directory-edit').close();
    };
  }
  $('directory-settings-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{const body=notifications?{etag:config.etag,recipients:$('change-recipients').value.split(/[\n,;]+/).map(v=>v.trim()).filter(Boolean)}:{activities:config.activities,interests:config.interests,etag:config.etag};config=await api(resource,body);if(run===serial){if(!notifications)$('directory-save').disabled=true;$('directory-status').textContent='Settings saved.';}}catch(error){if(run===serial)$('directory-status').textContent=error.message;}finally{e.submitter.disabled=!notifications&&$('directory-status').textContent==='Settings saved.';}};
}

function directoryPlacementPreview(key,items,focused){
  const offering=key==='activities';
  const featured=items.find(item=>item.id===focused)||items.find(item=>item.label==='Silver Salties')||items[0];
  const samples=featured?[featured,...items.filter(item=>item.id!==featured.id)].slice(0,3):[];
  const bars='<span class="placement-line placement-line-title"></span><span class="placement-line"></span><span class="placement-line placement-line-short"></span>';
  const tags=samples.map(item=>`<span class="placement-tag">${esc(item.label)}</span>`).join('')||'<span class="placement-empty">Your offering labels appear here</span>';
  const choices=samples.map((item,i)=>`<div class="placement-choice"><span class="placement-checkbox ${i===0?'placement-checkbox-selected':''}" aria-hidden="true">${i===0?'✓':''}</span><span>${esc(item.label)}</span></div>`).join('')||'<span class="placement-empty">Your enquiry options appear here</span>';
  const context=profile=>`<div class="placement-context ${profile?'placement-context-profile':''}" aria-hidden="true"><span class="placement-photo"></span><div>${bars}</div></div>`;
  const form=`<div class="placement-enquiry"><div class="placement-form-title">Send my details</div><div class="placement-fields" aria-hidden="true"><span></span><span></span></div><div class="placement-target"><strong>What are you interested in?</strong>${choices}</div><span class="placement-submit" aria-hidden="true"></span></div>`;
  return `<h3>Where this appears</h3><p class="placement-intro">${offering?'These tags tell visitors what a club offers.':'These checkboxes let visitors tell the club what interests them.'}</p>${[false,true].map(profile=>`<figure class="placement-figure"><figcaption>${profile?'Club profile':'Results page'}</figcaption><div class="placement-screen">${context(profile)}${offering?`<div class="placement-target"><span class="placement-target-caption">Club offerings</span><div class="placement-tags">${tags}</div></div>`:form}</div></figure>`).join('')}<p class="placement-note">${offering?'Example tags only. Choose which labels each club displays in Club pages → Club offerings.':'The same enquiry options appear for every club, from either page.'}</p><p class="placement-note">Illustrative preview using sample labels from your list. Apply an edit to preview it; save website options to publish.</p>`;
}
