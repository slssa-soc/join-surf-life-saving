async function mountDirectorySettings(run){
  const notifications=view==='settings-changes',resource=notifications?'change-notifications':'directory-settings';
  let config=await api(resource);if(run!==serial)return;
  $('content').innerHTML=settingsNavigation()+panel(notifications?'Change notifications':'Website options',notifications?`<form id="directory-settings-form" class="form-stack"><p>Email these addresses whenever dashboard settings, club contact details or club pages are saved. This list starts empty and is independent of enquiry delivery mode. Recipients are hidden from one another.</p><label>Notification email addresses<textarea id="change-recipients" rows="6" placeholder="One email address per line">${esc(config.recipients.join('\n'))}</textarea></label><p>Up to 50 addresses. Changes to this list notify the previously saved recipients.</p><button type="submit">Save notification settings</button><p id="directory-status" role="status"></p></form>`:`<form id="directory-settings-form" class="form-stack"><p>Manage two parts of the website below: what clubs offer, and what visitors can choose in an enquiry.</p><p>A program such as Silver Salties can appear in both lists. Each list is managed separately, so adding it to one does not add it to the other.</p>${['activities','interests'].map(key=>`<fieldset><legend>${key==='activities'?'Club offerings':'Enquiry form options'}</legend><p>${key==='activities'?'These labels describe what a club offers. They appear on club results cards and profiles. After adding a label here, open Club pages and select it under Club offerings for the relevant clubs.':'These are the choices visitors see under “What are you interested in?” when they select Send my details. A visitor selects these to tell the club what they want to do. The same choices appear in every club’s enquiry form.'}</p><ul id="options-${key}" class="directory-list"></ul><button type="button" class="secondary" data-option-add="${key}">Add ${key==='activities'?'club offering':'enquiry option'}</button></fieldset>`).join('')}<button type="submit" id="directory-save" disabled>Save website options</button><p id="directory-status" role="status"></p></form>`);
  let editing=null;
  function dirty(){ $('directory-save').disabled=false;$('directory-status').textContent='Unsaved changes. Save website options to publish.'; }
  function render(key){
    $('options-'+key).innerHTML=config[key].map((item,i)=>`<li class="directory-option"><span class="directory-option-name" id="option-${key}-${i}">${esc(item.label)}</span><div class="directory-option-actions"><button type="button" class="secondary" data-option-edit="${key}" data-option-index="${i}" aria-describedby="option-${key}-${i}">Edit</button><button type="button" class="secondary" data-option-remove="${key}" data-option-index="${i}" aria-describedby="option-${key}-${i}">Remove</button></div></li>`).join('')||'<li class="directory-list-empty">No options added yet.</li>';
  }
  if(!notifications){
    $('content').insertAdjacentHTML('beforeend',`<dialog id="directory-edit" aria-labelledby="directory-edit-title"><form id="directory-edit-form"><h2 id="directory-edit-title">Edit activity</h2><label for="directory-label">Name</label><textarea id="directory-label" rows="3" maxlength="200" required></textarea><p id="directory-edit-error" role="alert"></p><p class="footnote">Apply this label, then save the list to publish your changes.</p><div class="directory-dialog-actions"><button type="button" class="secondary" id="directory-edit-cancel">Cancel</button><button type="submit">Apply</button></div></form></dialog>`);
    for(const key of ['activities','interests'])render(key);
    $('directory-edit-cancel').onclick=()=>$('directory-edit').close();
    $('directory-edit').addEventListener('close',()=>{if(editing?.trigger?.isConnected)editing.trigger.focus();});
    $('directory-settings-form').onclick=e=>{
      const add=e.target.closest('[data-option-add]'),edit=e.target.closest('[data-option-edit]'),remove=e.target.closest('[data-option-remove]');
      if(!add&&!edit&&!remove)return;
      const key=add?.dataset.optionAdd||edit?.dataset.optionEdit||remove.dataset.optionRemove,index=Number((edit||remove)?.dataset.optionIndex);
      if(remove){config[key].splice(index,1);render(key);dirty();const buttons=$('options-'+key).querySelectorAll('[data-option-remove]');(buttons[Math.min(index,buttons.length-1)]||document.querySelector('[data-option-add="'+key+'"]')).focus();return;}
      editing={key,index:add?null:index,trigger:add||edit};
      $('directory-edit-title').textContent=(add?'Add ':'Edit ')+(key==='activities'?'club offering':'enquiry option');
      $('directory-label').value=add?'':config[key][index].label;$('directory-edit-error').textContent='';$('directory-edit').showModal();$('directory-label').focus();
    };
    $('directory-edit-form').onsubmit=e=>{
      e.preventDefault();const label=$('directory-label').value.trim(),{key,index}=editing;
      if(!label){$('directory-edit-error').textContent='Enter a name.';return;}
      if(config[key].some((item,i)=>i!==index&&item.label.toLowerCase()===label.toLowerCase())){$('directory-edit-error').textContent='This name is already in the list.';return;}
      if(index===null)config[key].push({id:'option-'+crypto.randomUUID(),label});else config[key][index].label=label;
      render(key);editing.trigger=$('options-'+key).querySelectorAll('[data-option-edit]')[index??config[key].length-1];dirty();$('directory-edit').close();
    };
  }
  $('directory-settings-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{const body=notifications?{etag:config.etag,recipients:$('change-recipients').value.split(/[\n,;]+/).map(v=>v.trim()).filter(Boolean)}:{activities:config.activities,interests:config.interests,etag:config.etag};config=await api(resource,body);if(run===serial){if(!notifications)$('directory-save').disabled=true;$('directory-status').textContent='Settings saved.';}}catch(error){if(run===serial)$('directory-status').textContent=error.message;}finally{e.submitter.disabled=!notifications&&$('directory-status').textContent==='Settings saved.';}};
}
