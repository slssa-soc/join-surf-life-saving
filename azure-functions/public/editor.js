let pageEditor=null;

const pageFields={title:'Club name',summary:'Short summary',imageAlt:'Image description',suburb:'Suburb',region:'Region',memberSize:'Membership size',website:'Club website',junior:'Nippers / junior activities',youth:'Youth',patrolling:'Lifesaving and patrols',accessibility:'Accessibility',adaptive:'Adaptive participation',multicultural:'Multicultural participation',firstNations:'First Nations participation',otherPrograms:'Other programs (one per line)'};

const pageFacilities={gym:'Gym',restaurant:'Club restaurant',accessibleFacilities:'Accessible facilities',beachAccess:'Accessible beach access'};

const pageLimits={title:180,summary:1000,imageAlt:250,suburb:120,region:120,memberSize:120,website:500,junior:1500,youth:1500,patrolling:1500,accessibility:1000,adaptive:2000,multicultural:2000,firstNations:2000,otherPrograms:4000};

function canLeaveEditor(){return !pageEditor?.saving&&(!pageEditor?.dirty||confirm('Discard the unpublished changes to this club page?'));}

window.addEventListener('beforeunload',event=>{if(pageEditor?.dirty){event.preventDefault();event.returnValue='';}});

function photoUrl(value){return value.startsWith('/api/')?value:'https://join.surflifesavingsa.com.au'+value;}

function safeEditorHtml(value){return DOMPurify.sanitize(value,{ALLOWED_TAGS:['p','br','strong','b','em','i','u','h2','h3','ul','ol','li','blockquote','a'],ALLOWED_ATTR:['href','title','rel']});}

function pageField(key,value){const multi=['summary','junior','youth','patrolling','accessibility','adaptive','multicultural','firstNations','otherPrograms'].includes(key);return `<label>${esc(pageFields[key])}${multi?`<textarea id="page-${key}" rows="${key==='summary'?3:2}" maxlength="${pageLimits[key]}">${esc(value)}</textarea>`:`<input id="page-${key}" maxlength="${pageLimits[key]}" value="${esc(value)}" ${key==='website'?'type="url"':''}>`}</label>`;}

function readPageDraft(){const content={...pageEditor.page.content,image:pageEditor.draftImage};for(const key of Object.keys(pageFields))content[key]=$('page-'+key).value;for(const key of Object.keys(pageFacilities))content[key]=$('page-facility-'+key).checked;content.html=safeEditorHtml(pageEditor.quill.getSemanticHTML());return content;}

function markPageDirty(){if(!pageEditor)return;pageEditor.dirty=true;$('page-save-state').textContent='Unpublished changes';}

async function mountClubEditor(run){

  pageEditor=null;

  const pages=await api('club-pages');if(run!==serial)return;

  $('content').innerHTML=panel('Club page editor','<p>Choose a club to update its public page text and main photo. Every publication requires a reason and records your name, time and the previous content.</p><p class="footnote">Changes apply regardless of enquiry delivery mode. Facility switches update the club listing and facility search filters. Other browse categories, map locations and enquiry email routing are managed separately.</p>')+`<div class="club-editor-layout"><details class="club-selector" id="club-selector" open><summary>Choose a club <span id="club-selection-label">${pages.length} clubs</span></summary><div class="club-selector-body"><label for="club-search">Find a club</label><input id="club-search" type="search" placeholder="Search club names" autocomplete="off"><p id="club-search-count" class="footnote" role="status">${pages.length} clubs</p><nav id="club-page-list" aria-label="Club pages">${pages.map(p=>`<button type="button" class="club-page-choice" data-club-slug="${esc(p.slug)}">${esc(p.title)}</button>`).join('')}</nav><p id="club-search-empty" hidden>No clubs match your search.</p></div></details><div id="page-editor-content"><section class="panel"><h2>Select a club to begin</h2><p>Choose a club from the list to view its page, edit its content and review its change history.</p></section></div></div>`;

  $('club-search').oninput=()=>{const query=$('club-search').value.trim().toLocaleLowerCase();let count=0;for(const button of document.querySelectorAll('[data-club-slug]')){button.hidden=!button.textContent.toLocaleLowerCase().includes(query);if(!button.hidden)count++;}$('club-search-count').textContent=count+' of '+pages.length+' clubs';$('club-search-empty').hidden=count>0;};

  $('club-page-list').onclick=async event=>{const button=event.target.closest('[data-club-slug]');if(!button||button.disabled||button.dataset.clubSlug===pageEditor?.page.slug)return;if(canLeaveEditor())await openClubPage(button.dataset.clubSlug,run);};

}

async function openClubPage(slug,run){

  const selector=$('club-selector');const buttons=[...selector.querySelectorAll('[data-club-slug]')];buttons.forEach(button=>button.disabled=true);selector.setAttribute('aria-busy','true');

  try{

    const page=await api('club-pages?slug='+encodeURIComponent(slug));if(run!==serial)return;

    renderPageEditor(page);

    if(matchMedia('(max-width: 900px)').matches){selector.open=false;$('page-editor-content').scrollIntoView({block:'start'});document.querySelector('#page-editor-content h2')?.focus({preventScroll:true});}

    await loadPageHistory();

  }catch(e){if(run===serial)$('status').textContent=e.message;}

  finally{if(run===serial){buttons.forEach(button=>button.disabled=false);selector.removeAttribute('aria-busy');}}

}

function updateClubSelection(page){

  for(const button of document.querySelectorAll('[data-club-slug]')){const selected=button.dataset.clubSlug===page.slug;button.setAttribute('aria-current',selected?'page':'false');if(selected)button.textContent=page.content.title;}

  $('club-selection-label').textContent=page.content.title;

}

function renderPageEditor(page){

  updateClubSelection(page);

  pageEditor={page,draftImage:page.content.image,dirty:false,saving:false,photo:null,requestId:null};const c=page.content;

  $('page-editor-content').innerHTML=panel(c.title,`<p id="page-save-state" class="subtle">${page.updatedAt?'Last published '+esc(time(page.updatedAt))+' by '+esc(page.updatedBy):'Original website content — no editor changes yet'}</p><form id="club-page-form" class="page-form">

    ${pageField('title',c.title)}${pageField('summary',c.summary)}

    <section class="page-photo"><h3>Main club photo</h3><img id="page-photo-preview" src="${esc(photoUrl(c.image))}" alt="${esc(c.imageAlt)}"><label>Replace photo<input id="page-photo" type="file" accept="image/jpeg,image/png"></label><p class="footnote">JPEG or PNG, up to 5 MB. Photos are resized for the website and metadata is removed. Use an image the club has approved for public use.</p><p id="page-photo-status" role="status"></p><button type="button" id="page-photo-reset" class="secondary" hidden>Keep published photo</button>${pageField('imageAlt',c.imageAlt)}</section>

    <section><h3 id="page-body-label">Club page text</h3><div id="page-toolbar" class="page-toolbar" role="toolbar" aria-label="Text formatting"><select class="ql-header" aria-label="Paragraph style"><option value="" selected>Paragraph</option><option value="2">Heading</option><option value="3">Subheading</option></select><button type="button" class="ql-bold" aria-label="Bold">Bold</button><button type="button" class="ql-italic" aria-label="Italic">Italic</button><button type="button" class="ql-underline" aria-label="Underline">Underline</button><button type="button" class="ql-list" value="bullet" aria-label="Bullet list">Bullets</button><button type="button" class="ql-list" value="ordered" aria-label="Numbered list">Numbers</button><button type="button" class="ql-blockquote" aria-label="Quotation">Quote</button><button type="button" class="ql-link" aria-label="Edit link">Link</button><button type="button" id="page-undo">Undo</button><button type="button" id="page-redo">Redo</button></div><div id="page-body" aria-labelledby="page-body-label"></div></section>

    <fieldset class="page-facilities"><legend>Club facilities</legend><p>Turn on the facilities this club offers. These settings control the facilities shown on its page and whether it matches website facility filters.</p><div class="page-facility-grid">${Object.entries(pageFacilities).map(([key,label])=>`<label class="page-facility-toggle"><input type="checkbox" role="switch" id="page-facility-${key}" ${c[key]?'checked':''}><span>${esc(label)}</span><span class="facility-state" aria-hidden="true"></span></label>`).join('')}</div><p class="footnote">Also update any references in the page text, such as restaurant hours, gym access or accessibility details. Switching a facility off does not rewrite that text.</p></fieldset>

    <details class="page-support"><summary>Location, website and supporting text</summary><div class="page-field-grid">${Object.keys(pageFields).filter(k=>!['title','summary','imageAlt'].includes(k)).map(k=>pageField(k,c[k])).join('')}</div><p class="footnote">If session times or programs change, update both the main page text and these supporting details.</p></details>

    <div class="page-actions"><button type="button" id="page-preview-button" class="secondary">Preview page</button><button type="submit" id="page-publish-button">Review and publish</button><a href="https://join.surflifesavingsa.com.au/clubs/${esc(page.slug)}/" target="_blank" rel="noopener noreferrer">View public page</a></div></form>`)+ '<section id="page-preview" class="panel" hidden></section>'+panel('Change history','<div id="page-history">Loading history…</div>')+

    `<dialog id="page-review"><h2>Publish club page</h2><p id="page-review-summary"></p><form id="page-review-form"><label>Why has this page changed?<textarea id="page-change-notes" required minlength="10" maxlength="2000" rows="4" placeholder="For example: Updated Nippers times at the request of Jane Smith, Club Secretary, by email on 14 September."></textarea></label><p class="footnote">Record who requested the change where relevant. These notes are visible to the dashboard team, not public website visitors.</p><p>This will publish the reviewed text and photo to the public website. It does not send an enquiry email.</p><p id="page-publish-status" role="status"></p><div class="page-actions"><button type="button" id="page-review-cancel" class="secondary">Keep editing</button><button type="submit" id="page-confirm">Publish changes</button></div></form></dialog>

    <dialog id="page-link-dialog"><h2>Edit link</h2><form id="page-link-form"><label>Link address<input id="page-link-url" placeholder="https://example.com"></label><p id="page-link-error" role="status"></p><div class="page-actions"><button type="button" id="page-link-cancel" class="secondary">Cancel</button><button type="submit">Apply link</button><button type="button" id="page-link-remove" class="secondary">Remove link</button></div></form></dialog>

    <dialog id="page-revision"><button type="button" id="page-revision-close" class="secondary">Close</button><div id="page-revision-content"></div></dialog>`;

  document.querySelector('#page-editor-content h2')?.setAttribute('tabindex','-1');

  const q=pageEditor.quill=new Quill('#page-body',{theme:null,formats:['header','bold','italic','underline','list','blockquote','link'],modules:{toolbar:{container:'#page-toolbar',handlers:{link:()=>openPageLink()}},history:{userOnly:true}}});

  q.clipboard.dangerouslyPasteHTML(safeEditorHtml(c.html));q.history.clear();q.blur();q.root.setAttribute('aria-label','Club page text');q.root.setAttribute('role','textbox');q.root.setAttribute('aria-multiline','true');

  q.on('text-change',(_,__,source)=>{if(source==='user')markPageDirty();});

  $('club-page-form').addEventListener('input',markPageDirty);

  $('page-undo').onclick=()=>q.history.undo();$('page-redo').onclick=()=>q.history.redo();

  $('page-photo').onchange=choosePagePhoto;

  $('page-photo-reset').onclick=()=>{pageEditor.photo=null;pageEditor.photoError=false;pageEditor.draftImage=pageEditor.page.content.image;$('page-photo-preview').src=photoUrl(pageEditor.page.content.image);$('page-photo').value='';$('page-photo-reset').hidden=true;$('page-photo-status').textContent='Published photo retained.';markPageDirty();};

  $('page-preview-button').onclick=()=>{$('page-preview').hidden=false;$('page-preview').innerHTML='<h2>Page preview · not yet published</h2>'+pagePreview(readPageDraft(),pageEditor.photo);$('page-preview').scrollIntoView({behavior:'smooth',block:'start'});};

  $('club-page-form').onsubmit=reviewPage;

  $('page-review-cancel').onclick=()=>$('page-review').close();

  $('page-review-form').onsubmit=publishPage;

  $('page-review').addEventListener('cancel',e=>{if(pageEditor.saving)e.preventDefault();});

  $('page-revision-close').onclick=()=>$('page-revision').close();

  $('page-link-cancel').onclick=()=>$('page-link-dialog').close();

  $('page-link-remove').onclick=()=>applyPageLink(false);

  $('page-link-form').onsubmit=e=>{e.preventDefault();const value=$('page-link-url').value.trim();if(!/^(https?:\/\/|mailto:|tel:)/i.test(value)){ $('page-link-error').textContent='Use an http, https, mailto or tel link.';return;}applyPageLink(value);};

}

function openPageLink(){pageEditor.range=pageEditor.quill.getSelection(true);$('page-link-url').value=pageEditor.quill.getFormat().link||'';$('page-link-error').textContent='';$('page-link-dialog').showModal();$('page-link-url').focus();}

function applyPageLink(value){const q=pageEditor.quill;$('page-link-dialog').close();if(pageEditor.range)q.setSelection(pageEditor.range);q.format('link',value,'user');}

async function choosePagePhoto(){

  const file=$('page-photo').files[0];if(!file)return;const session=pageEditor;session.processing=true;session.photoError=false;$('page-photo-status').textContent='Preparing photo…';

  try{

    if(!['image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a JPEG or PNG up to 5 MB.');

    const image=await createImageBitmap(file);if(image.width*image.height>12000000){image.close();throw Error('Choose a photo no more than 12 megapixels.');}

    const scale=Math.min(1,2000/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);image.close();

    if(pageEditor!==session)return;session.photo=canvas.toDataURL('image/jpeg',0.85);$('page-photo-preview').src=session.photo;$('page-photo-status').textContent='Replacement photo ready. It is not published until you review and save.';$('page-photo-reset').hidden=false;markPageDirty();

  }catch(e){if(pageEditor===session){session.photoError=true;$('page-photo-status').textContent=e.message;$('page-photo-reset').hidden=false;}}

  finally{session.processing=false;}

}

function pagePreview(c,photo){return `<article class="club-preview"><img src="${esc(photo||photoUrl(c.image))}" alt="${esc(c.imageAlt)}"><h2>${esc(c.title)}</h2><p class="page-preview-summary">${esc(c.summary)}</p><p>${[c.suburb,c.region,c.memberSize].filter(Boolean).map(esc).join(' · ')}</p><div class="page-prose">${safeEditorHtml(c.html)}</div><h3>Club facilities</h3><p>${Object.entries(pageFacilities).filter(([key])=>c[key]).map(([,label])=>esc(label)).join('  /  ')||'No facilities listed'}</p><h3>At a glance</h3><dl>${['junior','youth','patrolling','accessibility','adaptive','multicultural','firstNations','otherPrograms'].filter(k=>c[k]&&(k!=='accessibility'||c.accessibleFacilities||c.beachAccess)).map(k=>`<dt>${esc(pageFields[k])}</dt><dd>${esc(c[k])}</dd>`).join('')}</dl></article>`;}

function reviewPage(event){

  event.preventDefault();if(pageEditor.processing){$('status').textContent='Wait for the photo to finish processing.';return;}if(pageEditor.photoError){$('status').textContent='Choose a valid replacement photo or select Keep published photo before publishing.';return;}

  const draft=readPageDraft();for(const key of ['title','summary','imageAlt'])if(!draft[key].trim()){$('status').textContent=pageFields[key]+' is required.';$('page-'+key).focus();return;}

  if(!pageEditor.quill.getText().trim()){$('status').textContent='Add the club page text before publishing.';return;}

  const changed=Object.keys(draft).filter(k=>draft[k]!==pageEditor.page.content[k]);if(pageEditor.photo)changed.push('image');

  if(!changed.length){$('status').textContent='No changes to publish.';return;}

  pageEditor.pending={content:draft,photo:pageEditor.photo};pageEditor.requestId=crypto.randomUUID();

  $('page-review-summary').textContent=pageEditor.page.content.title+' — changed: '+changed.map(k=>pageFields[k]||pageFacilities[k]||({html:'Page text',image:'Main photo'})[k]||k).join(', ')+'.';

  $('page-publish-status').textContent='';$('page-change-notes').value='';$('page-change-notes').readOnly=false;$('page-review').showModal();$('page-change-notes').focus();

}

async function publishPage(event){

  event.preventDefault();if(pageEditor.saving)return;

  const session=pageEditor;session.saving=true;const notes=$('page-change-notes').value.trim();

  if(notes.length<10){session.saving=false;$('page-publish-status').textContent='Please explain the change in at least 10 characters.';return;}

  $('page-confirm').disabled=true;$('page-review-cancel').disabled=true;$('page-change-notes').readOnly=true;$('page-publish-status').textContent='Publishing and recording the change…';

  try{

    const result=await api('club-pages?slug='+encodeURIComponent(session.page.slug),{...session.pending,baseVersion:session.page.version,requestId:session.requestId,notes});

    session.dirty=false;$('page-review').close();renderPageEditor(result);await loadPageHistory();$('status').textContent=result.version===result.savedVersion?'Club page published and change history recorded. New website visits will show the updated content.':'Your change was saved; another editor has since published a newer version, shown here.';

  }catch(e){$('page-publish-status').textContent=e.message+' Your changes have been kept. If the connection failed, retry to check the same save reference.';$('page-confirm').disabled=false;$('page-review-cancel').disabled=false;}

  finally{session.saving=false;}

}

async function loadPageHistory(){

  const session=pageEditor;

  try{const rows=await api('club-pages?slug='+encodeURIComponent(session.page.slug)+'&history=true');if(pageEditor!==session)return;

    $('page-history').innerHTML=rows.length?table(['Published','Editor','Change notes',''],rows.map(r=>`<tr><td>${esc(time(r.at))}</td><td>${esc(r.actor)}</td><td>${esc(r.notes)}<small>${r.changed.map(k=>esc(pageFields[k]||pageFacilities[k]||({html:'Page text',image:'Main photo'})[k]||k)).join(', ')}</small></td><td><button type="button" class="secondary" data-page-revision="${esc(r.version)}">View change</button></td></tr>`)):empty('No changes recorded through the editor yet.');

    $('page-history').onclick=async e=>{const button=e.target.closest('[data-page-revision]');if(button)await viewPageRevision(button.dataset.pageRevision);};

  }catch(e){if(pageEditor===session)$('page-history').textContent='History could not be loaded: '+e.message;}

}

async function viewPageRevision(version){

  const session=pageEditor;

  try{const r=await api('club-pages?slug='+encodeURIComponent(session.page.slug)+'&revision='+encodeURIComponent(version));if(pageEditor!==session)return;

    $('page-revision-content').innerHTML='<h2>Club page change</h2><p>'+esc(time(r.at))+' · '+esc(r.actor)+'</p><p><strong>Reason:</strong> '+esc(r.notes)+'</p><details><summary>Before this change</summary>'+pagePreview(r.before)+'</details><details open><summary>Published version</summary>'+pagePreview(r.content)+'</details><button type="button" id="page-restore-before" class="secondary">Use the previous content as a draft</button><button type="button" id="page-restore-version">Use this published version as a draft</button>';

    const restore=content=>{if(!canLeaveEditor())return;const current=session.page;$('page-revision').close();renderPageEditor({...current,content});pageEditor.page=current;markPageDirty();loadPageHistory();$('status').textContent='Historical content loaded as an unpublished draft. Review it and supply new change notes to publish.';};

    $('page-restore-version').onclick=()=>restore(r.content);$('page-restore-before').onclick=()=>restore(r.before);

    $('page-revision').showModal();

  }catch(e){$('status').textContent=e.message;}

}

