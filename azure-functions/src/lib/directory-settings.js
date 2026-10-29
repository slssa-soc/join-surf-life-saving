const {TableClient}=require('@azure/data-tables');
const defaults=require('../../data/directory-options.json');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const getTable=()=>TableClient.fromConnectionString(process.env.AzureWebJobsStorage,'JoinDashboardSettings');
function validate(body){
  const value={};
  for(const key of ['activities','interests']){
    if(!Array.isArray(body?.[key])||body[key].length>150)throw fail('Use up to 150 '+key+'.');
    const ids=new Set(),labels=new Set();
    value[key]=body[key].map(item=>{
      if(!item||typeof item.id!=='string'||!/^[-a-z0-9]{1,80}$/.test(item.id)||typeof item.label!=='string'||!item.label.trim()||item.label.length>200)throw fail('Each option needs a unique ID and a label of 1–200 characters.');
      const label=item.label.trim();
      if(ids.has(item.id)||labels.has(label.toLowerCase()))throw fail('Option IDs and labels must be unique within each list.');
      ids.add(item.id);labels.add(label.toLowerCase());return{id:item.id,label};
    });
  }
  if(JSON.stringify(value).length>30000)throw fail('The option lists are too large. Shorten labels or remove unused options.');
  return value;
}
function createStore(table=getTable){
  async function read(){try{const row=await table().getEntity('settings','directory');return{...validate(JSON.parse(row.optionsJson)),etag:row.etag};}catch(e){if(e.statusCode===404)return{...structuredClone(defaults),etag:null};throw e;}}
  async function save(body){const value=validate(body),before=await read(),t=table();if((body.etag||null)!==before.etag)throw fail('Directory settings changed. Reload before saving.',409);await t.createTable().catch(e=>{if(e.statusCode!==409)throw e;});const row={partitionKey:'settings',rowKey:'directory',optionsJson:JSON.stringify(value)};if(before.etag)await t.updateEntity(row,'Replace',{etag:before.etag});else await t.createEntity(row);return read();}
  return{read,save};
}
module.exports={...createStore(),createStore,validate};
