// Run with RUN_EDITOR_STORAGE_TEST=1 and a local Azurite instance. No cloud data is used.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {TableClient}=require('../node_modules/@azure/data-tables');
const {BlobServiceClient}=require('../node_modules/@azure/storage-blob');
const {createContentStore}=require('../src/lib/club-content');
const jpeg=require('../node_modules/jpeg-js');
test('real storage transaction, ETags, history projections and private photo publication',{skip:process.env.RUN_EDITOR_STORAGE_TEST!=='1'},async()=>{
  process.env.AzureWebJobsStorage='UseDevelopmentStorage=true';
  const table=TableClient.fromConnectionString('UseDevelopmentStorage=true','EditorTest'+Date.now());
  const store=createContentStore({getTable:()=>table}),slug='glenelg-slsc',actor={id:'local-test',name:'Local test'};
  try{
    const page=await store.read(slug);const body={requestId:randomUUID(),baseVersion:page.version,notes:'Local automated verification of the editor transaction.',content:{...page.content,summary:'Local test summary'}};
    const result=await store.save(slug,body,actor);const history=await store.history(slug);assert.equal(history.length,1);assert.equal(history[0].version,result.version);assert.equal((await store.list()).find(p=>p.slug===slug).content.summary,body.content.summary);
    const draft={...body,baseVersion:result.version,requestId:randomUUID(),content:{...result.content,summary:'Second local revision'}};
    const outcomes=await Promise.allSettled([store.save(slug,draft,actor),store.save(slug,{...draft,requestId:randomUUID(),content:{...draft.content,summary:'Competing edit'}},actor)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await store.history(slug)).length,2);
    const current=await store.read(slug),bytes=jpeg.encode({width:1,height:1,data:Buffer.from([0,100,150,255])},85).data;
    const imageResult=await store.save(slug,{...body,requestId:randomUUID(),baseVersion:current.version,content:current.content,photo:'data:image/jpeg;base64,'+bytes.toString('base64')},actor);
    const image=await store.image(slug,imageResult.content.image.split('/').pop());let size=0;for await(const chunk of image.readableStreamBody)size+=chunk.length;assert.ok(size>0);
    assert.equal((await store.audit('2020-01-01T00:00:00Z')).length,3);
    const revision=await store.revision(slug,imageResult.version);assert.equal(revision.notes,body.notes);
  }finally{await table.deleteTable();await BlobServiceClient.fromConnectionString('UseDevelopmentStorage=true').getContainerClient('join-club-images').deleteIfExists();}
});
