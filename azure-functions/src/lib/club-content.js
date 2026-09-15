const crypto=require('node:crypto');
const sanitize=require('sanitize-html');
const {TableClient,TableTransaction,odata}=require('@azure/data-tables');
const {BlobServiceClient}=require('@azure/storage-blob');
const jpeg=require('jpeg-js');
const {PNG}=require('pngjs');
const baseline=require('../../data/club-pages.json');
const ROOT='https://join.surflifesavingsa.com.au';
const fields={title:180,summary:1000,imageAlt:250,suburb:120,region:120,memberSize:120,website:500,junior:1500,youth:1500,patrolling:1500,adaptive:2000,multicultural:2000,firstNations:2000,otherPrograms:4000,accessibility:1000};
const facilityFields=['gym','restaurant','accessibleFacilities','beachAccess'];
const withFacilities=(content,slug)=>({...Object.fromEntries(facilityFields.map(key=>[key,baseline[slug].content[key]])),...content});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function cleanHtml(html){return sanitize(html,{allowedTags:['p','br','strong','b','em','i','u','h2','h3','ul','ol','li','blockquote','a'],allowedAttributes:{a:['href','title','rel']},allowedSchemes:['http','https','mailto','tel'],allowProtocolRelative:false,transformTags:{a:(tag,attrs)=>({tagName:'a',attribs:{...attrs,rel:'noopener noreferrer'}})}});}
function validateContent(input,slug){
  if(!Object.hasOwn(baseline,slug))throw fail('Club page not found.',404);
  if(!input||typeof input!=='object')throw fail('Page content is required.');
  const result={};
  for(const key of facilityFields){if(typeof input[key]!=='boolean')throw fail('Choose on or off for '+key+'.');result[key]=input[key];}
  for(const [name,max]of Object.entries(fields)){
    if(typeof input[name]!=='string'||input[name].length>max)throw fail(`Invalid ${name} (maximum ${max} characters).`);
    result[name]=input[name].trim();
  }
  if(!result.title||!result.summary||!result.imageAlt)throw fail('Club name, summary and image description are required.');
  if(result.website){let url;try{url=new URL(result.website);}catch{throw fail('Enter a complete club website URL.');}if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw fail('Use an http or https club website URL.');}
  if(typeof input.html!=='string'||input.html.length>50000)throw fail('Page text must be under 50,000 characters.');
  result.html=cleanHtml(input.html);
  if(!sanitize(result.html,{allowedTags:[],allowedAttributes:{}}).trim())throw fail('Page text cannot be empty.');
  if(typeof input.image!=='string'||!(input.image===baseline[slug].content.image||new RegExp('^/api/club-images/'+slug+'/[a-f0-9]{64}\\.jpg$').test(input.image)))throw fail('Choose a club photo using the image upload control.');
  result.image=input.image;
  return result;
}
function pack(prefix,value){const text=JSON.stringify(value),result={[prefix+'Parts']:Math.ceil(text.length/14000)};for(let i=0;i<result[prefix+'Parts'];i++)result[prefix+i]=text.slice(i*14000,(i+1)*14000);return result;}
function unpack(row,prefix){return JSON.parse(Array.from({length:row[prefix+'Parts']},(_,i)=>row[prefix+i]).join(''));}
function photoBytes(value){
  if(typeof value!=='string'||value.length>7000000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw fail('Choose a JPEG or PNG image up to 5 MB.');
  const bytes=Buffer.from(value.slice(value.indexOf(',')+1),'base64');
  if(bytes.length>5*1024*1024)throw fail('The photo must be no larger than 5 MB.');
  let pixels;
  try{
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
      const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
      if(!w||!h||w*h>12000000)throw Error('dimensions');
      pixels=PNG.sync.read(bytes,{checkCRC:true});
    }else if(bytes[0]===255&&bytes[1]===216){pixels=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:12,maxMemoryUsageInMB:128});}
    else throw Error('format');
    if(!pixels.width||!pixels.height||pixels.width*pixels.height>12000000)throw Error('dimensions');
    // Flatten transparency and re-encode to discard metadata and embedded payloads.
    for(let i=0;i<pixels.data.length;i+=4){const a=pixels.data[i+3]/255;for(let j=0;j<3;j++)pixels.data[i+j]=Math.round(pixels.data[i+j]*a+255*(1-a));pixels.data[i+3]=255;}
    return jpeg.encode(pixels,85).data;
  }catch{throw fail('This photo could not be read. Use a valid JPEG or PNG, no more than 12 megapixels.');}
}
function createContentStore({getTable,uploadPhoto}={}){
  getTable||=()=>TableClient.fromConnectionString(process.env.AzureWebJobsStorage,'JoinClubPages');
  uploadPhoto||=async(slug,digest,bytes)=>{
    const container=BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage).getContainerClient('join-club-images');
    await container.createIfNotExists();
    await container.getBlockBlobClient(`${slug}/${digest}.jpg`).uploadData(bytes,{blobHTTPHeaders:{blobContentType:'image/jpeg',blobCacheControl:'public, max-age=31536000, immutable'}});
  };
  async function get(t,slug,key){try{return await t.getEntity(slug,key);}catch(e){if(e.statusCode===404)return null;throw e;}}
  function initial(slug){if(!Object.hasOwn(baseline,slug))throw fail('Club page not found.',404);return{...baseline[slug],content:validateContent(baseline[slug].content,slug),updatedAt:null,updatedBy:null};}
  async function read(slug){const start=initial(slug),row=await get(getTable(),slug,'current');return row?{slug,version:row.version,content:withFacilities(unpack(row,'content'),slug),updatedAt:row.at,updatedBy:row.actor}:start;}
  async function list(){const t=getTable(),rows=new Map();try{for await(const row of t.listEntities({queryOptions:{filter:odata`RowKey eq ${'current'}`}}))rows.set(row.partitionKey,row);}catch(e){if(e.statusCode!==404)throw e;}
    return Object.keys(baseline).map(slug=>{const row=rows.get(slug),page=row?{slug,version:row.version,content:withFacilities(unpack(row,'content'),slug),updatedAt:row.at,updatedBy:row.actor}:initial(slug);return page;});}
  async function save(slug,body,actor){
    initial(slug);
    if(typeof body.notes!=='string'||body.notes.trim().length<10||body.notes.length>2000)throw fail('Explain why this page changed (10–2,000 characters), including who requested it where relevant.');
    if(typeof body.requestId!=='string'||!/^[-0-9a-f]{36}$/i.test(body.requestId))throw fail('Invalid save reference.');
    const content=validateContent(body.content,slug),t=getTable();
    const fingerprint=hash(JSON.stringify({baseVersion:body.baseVersion,content,notes:body.notes.trim(),photo:body.photo?hash(body.photo):null}));
    const previous=await get(t,slug,'revision-'+body.requestId);
    if(previous){if(previous.actorId!==actor.id||previous.fingerprint!==fingerprint)throw fail('This save reference has already been used.',409);return{...(await read(slug)),savedVersion:body.requestId,replayed:true};}
    const row=await get(t,slug,'current'),before=row?{version:row.version,content:withFacilities(unpack(row,'content'),slug)}:initial(slug);
    if(body.baseVersion!==before.version)throw fail('This page was changed by another editor. Reload the latest page before publishing; your current text has been kept.',409);
    let photo;
    if(body.photo){photo=photoBytes(body.photo);const digest=hash(photo);content.image=`/api/club-images/${slug}/${digest}.jpg`;}
    else if(content.image.startsWith('/api/club-images/')){const key=content.image.split('/').pop().slice(0,-4);if(!await get(t,slug,'image-'+key))throw fail('This image is not a published photo for the selected club.');}
    const changed=Object.keys(content).filter(key=>content[key]!==before.content[key]);
    if(!changed.length)throw fail('No changes to publish.');
    await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});
    if(photo)await uploadPhoto(slug,hash(photo),photo);
    const at=new Date().toISOString(),version=body.requestId;
    const revision={partitionKey:slug,rowKey:'revision-'+version,version,at,actor:actor.name,actorId:actor.id,notes:body.notes.trim(),changed:JSON.stringify(changed),fingerprint,...pack('before',before.content),...pack('content',content)};
    const current={partitionKey:slug,rowKey:'current',version,at,actor:actor.name,...pack('content',content)};
    const transaction=new TableTransaction();
    transaction.createEntity(revision);
    if(row)transaction.updateEntity(current,'Replace',{etag:row.etag});else transaction.createEntity(current);
    if(photo)transaction.upsertEntity({partitionKey:slug,rowKey:'image-'+hash(photo),publishedAt:at},'Merge');
    try{await t.submitTransaction(transaction.actions);}catch(e){
      const applied=await get(t,slug,'revision-'+version);
      if(applied?.fingerprint===fingerprint&&applied.actorId===actor.id)return{...(await read(slug)),savedVersion:version,replayed:true};
      if([409,412].includes(e.statusCode))throw fail('Another editor saved this page first. Reload before publishing.',409);
      throw e;
    }
    return{slug,version,savedVersion:version,content,updatedAt:at,updatedBy:actor.name};
  }
  async function history(slug){initial(slug);const rows=[];try{for await(const r of getTable().listEntities({queryOptions:{filter:odata`PartitionKey eq ${slug} and RowKey ge ${'revision-'} and RowKey lt ${'revision.'}`,select:['version','at','actor','notes','changed']}}))rows.push({version:r.version,at:r.at,actor:r.actor,notes:r.notes,changed:JSON.parse(r.changed)});}catch(e){if(e.statusCode!==404)throw e;}return rows.sort((a,b)=>b.at.localeCompare(a.at));}
  async function revision(slug,version){initial(slug);if(!/^[-0-9a-f]{36}$/i.test(version))throw fail('Invalid revision.',400);const r=await get(getTable(),slug,'revision-'+version);if(!r)throw fail('Revision not found.',404);return{version:r.version,at:r.at,actor:r.actor,notes:r.notes,before:withFacilities(unpack(r,'before'),slug),content:withFacilities(unpack(r,'content'),slug)};}
  async function image(slug,file){initial(slug);if(!/^[a-f0-9]{64}\.jpg$/.test(file)||!await get(getTable(),slug,'image-'+file.slice(0,-4)))throw fail('Image not found.',404);return BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage).getContainerClient('join-club-images').getBlobClient(`${slug}/${file}`).download();}
  async function audit(since){const rows=[];try{for await(const r of getTable().listEntities({queryOptions:{filter:odata`RowKey ge ${'revision-'} and RowKey lt ${'revision.'} and at ge ${since}`,select:['PartitionKey','version','at','actor','notes','changed']}}))rows.push({at:r.at,actor:r.actor,action:'club-page',result:'published',detail:JSON.stringify({club:r.partitionKey,notes:r.notes,fields:JSON.parse(r.changed),version:r.version})});}catch(e){if(e.statusCode!==404)throw e;}return rows;}
  return{read,list,save,history,revision,image,audit};
}
const store=createContentStore();
function publicPage(page){return{slug:page.slug,version:page.version,content:page.content};}
module.exports={store,createContentStore,validateContent,cleanHtml,photoBytes,pack,unpack,publicPage,ROOT,fields};
