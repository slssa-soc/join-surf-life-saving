const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('public facility changes replace static filter data and reapply current filters',async()=>{
  const card={dataset:{facilities:'gym|restaurant'},querySelector:selector=>selector==='[data-lead-club]'?{dataset:{leadClub:'example'}}:null};
  let filtered;
  const context={document:{querySelector:()=>null,querySelectorAll:()=>[card]},fetch:async()=>({ok:true,json:async()=>[{slug:'example',content:{title:'Example',gym:false,restaurant:true,accessibleFacilities:true,beachAccess:false}}]}),AbortSignal,applyFilters:()=>{filtered=card.dataset.facilities;}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../../assets/js/club-pages-live.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(filtered,'restaurant|accessible-facilities');
});

