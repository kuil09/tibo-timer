import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceOnly, interpret, planSync, applySync } from '../src/sync.ts';
import { writeJson, readJson } from '../src/storage.ts';
import type { SourcePost } from '../src/source.ts';
import type { Extraction } from '../src/types.ts';
const post:SourcePost={id:'123',url:'https://x.com/thsottiaux/status/123',text:'Usage will reset in 3 hours.',posted_at:'2026-09-08T12:00:00Z',truncated:false,kind:'candidate'};
const extraction:Extraction={event_type:'reset',state:'scheduled',audience:[],time_expression:'in 3 hours',evidence:'Usage will reset in 3 hours',time_zone:null};
test('interpret handles supported time and preserves uncertainty on invalid schema/evidence',async()=>{
 const good=await interpret(post,'test',async()=>extraction); assert.equal(good.temporal.kind,'instant');
 for(const bad of [{...extraction,evidence:'Invented completion'}, {...extraction,state:'bad'}]){
  const event=await interpret(post,'test',async()=>bad as Extraction);assert.equal(event.event.state,'unknown');assert.equal(event.temporal.kind,'unresolved');
 }
 const timeout=await interpret(post,'test',async()=>{throw new Error('timeout')});assert.equal(timeout.temporal.reason,'timeout');
});
test('truncated sources never invoke model or declare completion',async()=>{
 let calls=0;const event=await interpret({...post,truncated:true},'test',async()=>{calls++;return {...extraction,state:'completed'}});
 assert.equal(calls,0);assert.equal(event.source.truncated,true);assert.equal(event.temporal.kind,'unresolved');assert.equal(event.event.state,'unknown');
});
test('banked source-only display is not an immediate completed usage reset',()=>{
 const event=sourceOnly({...post,text:'Banked reset has landed.'},'model_not_approved');assert.equal(event.event.type,'banked_reset');assert.equal(event.event.state,'unknown');
});
test('sync deduplicates, retains absent history, invalidates edits with exhausted budget, and preserves good data on failure',async(t)=>{
 const previous=process.cwd(),budget=process.env.SYNC_BUDGET_MS,cpuReady=process.env.CPU_READY;
 const folder=await mkdtemp(join(tmpdir(),'tibo-sync-test-'));process.chdir(folder);
 t.after(()=>{process.chdir(previous);if(cpuReady===undefined) delete process.env.CPU_READY;else process.env.CPU_READY=cpuReady;if(budget===undefined) delete process.env.SYNC_BUDGET_MS;else process.env.SYNC_BUDGET_MS=budget;});
 await writeJson('config/source.json',{provider:'codex-reset'});
 await writeJson('config/selection.json',{enabled:false,model:null,reason:'test'});await writeJson('config/models.lock.json',{runtime:{sha256:'runtime'},models:{qwen25:{sha256:'model'}}});
 await writeJson('data/state.json',{schema_version:1,processed:{},last_success_at:null,last_attempt_at:null,last_error:null});
 await writeJson('data/events.json',{schema_version:1,last_success_at:null,events:[sourceOnly({...post,id:'999'},'historic')]});
 let source={version:1,stale:false,fetched_at:new Date().toISOString(),tweets:[{id:post.id,url:post.url,text:post.text,at:post.posted_at}],events:[]};
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(source)));
 await planSync();await applySync();await planSync();
 assert.equal((await readJson<any>('.cache/pending.json')).pending.length,0);
 assert.equal((await readJson<any>('data/events.json')).events.length,2);
 source.tweets[0].text='Correction: no reset time is available.';process.env.SYNC_BUDGET_MS='0';
 await planSync();await applySync();
 const events=await readJson<any>('data/events.json');const edited=events.events.find((e:any)=>e.id==='123');
 assert.equal(edited.source.text,source.tweets[0].text);assert.equal(edited.temporal.reason,'pending_budget');assert.equal(edited.temporal.kind,'unresolved');
 assert.equal((await readdir('data/history')).length,1);
 await planSync();assert.equal((await readJson<any>('.cache/pending.json')).pending.length,1);
 process.env.SYNC_BUDGET_MS='60000';process.env.CPU_READY='failure';
 await writeJson('config/selection.json',{enabled:true,model:'qwen25',reason:'test'});
 await planSync();await applySync();
 assert.equal((await readJson<any>('data/events.json')).events.find((e:any)=>e.id==='123').temporal.reason,'pending_cpu');
 await planSync();assert.equal((await readJson<any>('.cache/pending.json')).pending.length,1);
 const before=await readFile('data/events.json','utf8');source={...source,stale:true};await assert.rejects(planSync());
 assert.equal(await readFile('data/events.json','utf8'),before);assert.match((await readJson<any>('data/state.json')).last_error,/stale/);
});

test('FxEmbed partial sync preserves freshness, resumes backlog, and deduplicates semantic content',async(t)=>{
 const previous=process.cwd();const folder=await mkdtemp(join(tmpdir(),'tibo-fx-sync-'));process.chdir(folder);t.after(()=>process.chdir(previous));
 await writeJson('config/source.json',{provider:'fxembed'});
 await writeJson('config/selection.json',{enabled:false,model:null,reason:'test'});
 await writeJson('config/models.lock.json',{runtime:{},models:{}});
 const previousSuccess='2026-08-01T00:00:00.000Z';
 await writeJson('data/state.json',{schema_version:1,processed:{},last_success_at:previousSuccess,last_attempt_at:previousSuccess,last_error:null});
 await writeJson('data/events.json',{schema_version:1,last_success_at:previousSuccess,events:[]});
 const seconds=Math.floor(Date.now()/1000)-3600;
 const r={type:'status',id:'123',url:'https://x.com/thsottiaux/status/123',text:'Reset soon.',raw_text:{text:'Reset soon.'},author:{id:'1953337039510003712',screen_name:'thsottiaux'},created_at:new Date(seconds*1000).toUTCString(),created_timestamp:seconds};
 let requestCount=0,partial=true,failed=false,likes=0;
 t.mock.method(globalThis,'fetch',async()=>{
  requestCount++;if(failed)return new Response('challenge',{status:403});
  return new Response(JSON.stringify({code:200,results:[{...r,likes}],cursor:{bottom:partial?`c${requestCount}`:null}}),{headers:{'content-type':'application/json'}});
 });
 await planSync();await applySync();
 let state=await readJson<any>('data/state.json');assert.equal(state.last_success_at,previousSuccess);assert.equal(state.last_error,'collection_partial');assert.equal(state.collection.checkpoint.pending.cursor,'c3');
 assert.equal((await readJson<any>('data/events.json')).last_success_at,previousSuccess);
 partial=false;await planSync();assert.equal((await readJson<any>('.cache/pending.json')).pending.length,0);await applySync();
 state=await readJson<any>('data/state.json');assert.equal(state.collection.coverage,'complete');assert.equal(state.last_error,null);assert.notEqual(state.last_success_at,previousSuccess);
 likes=999;await planSync();assert.equal((await readJson<any>('.cache/pending.json')).pending.length,0);
 const before=await readFile('data/events.json','utf8'),checkpoint=JSON.stringify(state.collection.checkpoint);failed=true;
 await assert.rejects(planSync(),/fx_http_403/);assert.equal(await readFile('data/events.json','utf8'),before);
 assert.equal(JSON.stringify((await readJson<any>('data/state.json')).collection.checkpoint),checkpoint);
});
