// Explicit migration of the original imported program prose into activity names.
// No substring matching: unrecognised custom IDs and labels stay untouched.
const imports=require('../../data/activity-import-map.json');
const byId=new Map(imports.map(item=>[item.id,item]));
function normaliseActivities(ids){return [...new Set(ids.map(id=>byId.has(id)?byId.get(id).target:id).filter(Boolean))];}
function cleanImportedOptions(options){
  const activities=new Map();
  for(const item of options.activities){
    const old=byId.get(item.id);
    const next=old&&old.source===item.label?(old.target?{id:old.target,label:old.label}:null):item;
    if(next&&!activities.has(next.id))activities.set(next.id,next);
  }
  return {...options,activities:[...activities.values()]};
}
function activityIdsForLabels(labels){
  const known=new Map();
  for(const item of imports){known.set(item.source,item.target);if(item.target)known.set(item.label,item.target);}
  return [...new Set(labels.map(label=>known.get(label)).filter(Boolean))];
}
module.exports={normaliseActivities,cleanImportedOptions,activityIdsForLabels};
