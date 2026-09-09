import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { extract, PROMPT_VERSION, SCHEMA_VERSION, type InferenceDiagnostic } from './inference.ts';
import { normalizeTemporal } from './temporal.ts';
import { fetchSource, hash, type SourcePost, type SourceBatch } from './source.ts';
import type { Checkpoint } from './sources/fxembed.ts';
import { readJson, writeJson } from './storage.ts';
import { validateExtraction, type EventRecord } from './types.ts';
interface Collection {provider:string;checked_at:string;upstream_at:string|null;coverage:string;checkpoint?:Checkpoint;scope?:SourceBatch['scope'];}
interface State {schema_version:1;processed:Record<string,string>;last_success_at:string|null;last_attempt_at:string|null;last_error:string|null;collection?:Collection;analysis?:AnalysisState;}
interface Document {schema_version:1;last_success_at:string|null;events:EventRecord[];}
interface Selection {enabled:boolean;model:string|null;reason:string;max_posts?:number;}
interface AnalysisState {enabled:boolean;model:string|null;last_run_at:string|null;last_success_at:string|null;attempted:number;succeeded:number;failed:number;deferred:number;}
function inferenceLimit(selection:Selection):number {
  const limit=selection.max_posts??5;
  if(!Number.isInteger(limit) || limit<1 || limit>5) throw new Error('invalid_inference_limit');
  return limit;
}
export function sourceOnly(post:SourcePost, reason:string):EventRecord {
  return { id:post.id,source:{url:post.url,text:post.text,posted_at:post.posted_at,truncated:post.truncated},
    event:{type:/\bbanked\b/i.test(post.text)?'banked_reset':/\breset\w*\b/i.test(post.text)?'reset':'unknown',state:'unknown',audience:[]},
    temporal:{kind:'unresolved',precision:'unspecified',original:'',reason},interpretation:{method:'source-only'},...(post.observation?{observation:post.observation}:{}) };
}
export async function interpret(post:SourcePost, model:string, infer=extract):Promise<EventRecord> {
  if (post.truncated) return sourceOnly(post,'source_truncated');
  let diagnostic: InferenceDiagnostic | undefined;
  try {
    const extraction = validateExtraction(await infer(post.text, d => { diagnostic = d; }));
    const temporal = normalizeTemporal(extraction,post);
    if (((extraction.event_type !== 'unknown' || extraction.state !== 'unknown') && !extraction.evidence) || !post.text.includes(extraction.evidence) || (extraction.time_expression && !extraction.evidence.includes(extraction.time_expression))) return sourceOnly(post,'invalid_evidence');
    return {...sourceOnly(post,''),event:{type:extraction.event_type,state:extraction.state,audience:extraction.audience},temporal,interpretation:{method:'cpu-model',model},extraction} as EventRecord;
  } catch(error) {return sourceOnly(post,error instanceof Error?error.message:'inference_failed');}
  finally {
    if (diagnostic && infer === extract) {
      await mkdir('.cache',{recursive:true});
      await appendFile('.cache/inference-trace.jsonl',JSON.stringify({post_id:post.id,model,...diagnostic})+'\n');
    }
  }
}
export async function planSync() {
  const selection=await readJson<Selection>('config/selection.json');
  const state=await readJson<State>('data/state.json');
  inferenceLimit(selection);
  if(selection.enabled && !selection.model) throw new Error('enabled_model_missing');
  try {
    const batch=await fetchSource(state.collection?.provider==='fxembed'?state.collection.checkpoint:undefined);
    const posts=batch.posts.slice().sort((a,b)=>b.posted_at.localeCompare(a.posted_at));
    const lock=JSON.parse(await readFile('config/models.lock.json','utf8'));
    if(selection.enabled && !lock.models[selection.model!]) throw new Error('enabled_model_not_locked');
    const identity=selection.enabled&&selection.model?{runtime:lock.runtime,model:lock.models[selection.model]}:null;
    const revision=hash({model:selection.enabled?selection.model:null,identity,prompt:PROMPT_VERSION,schema:SCHEMA_VERSION});
    const pending=posts.filter(p=>state.processed[p.id]!==hash({post:p,revision}));
    await writeJson('.cache/pending.json',{batch,posts,pending,revision,selection});
    if(process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,`inference=${selection.enabled&&pending.some(p=>!p.truncated)}\nmodel=${selection.model??''}\n`);
    console.log(JSON.stringify({phase:'fetch',posts:posts.length,pending:pending.length,inference:selection.enabled}));
  } catch(error) {
    state.last_attempt_at=new Date().toISOString();state.last_error=error instanceof Error?error.message:'fetch_failed';
    await writeJson('.cache/sync-report.json',{at:state.last_attempt_at,phase:'fetch',error:state.last_error});
    await writeJson('data/state.json',state);
    throw error;
  }
}
export async function applySync(infer=extract) {
  const plan=await readJson<{batch:SourceBatch;posts:SourcePost[];pending:SourcePost[];revision:string;selection:Selection}>('.cache/pending.json');
  const state=await readJson<State>('data/state.json');
  const doc=await readJson<Document>('data/events.json');
  const records=new Map(doc.events.map(e=>[e.id,e]));
  const deadline=Date.now()+Number(process.env.SYNC_BUDGET_MS??360_000);
  const log=[];
  let attempted=0,succeeded=0,failed=0;
  const maxPosts=inferenceLimit(plan.selection);
  for(const post of plan.pending) {
    const old=records.get(post.id);
    if(old && hash(old.source)!==hash({url:post.url,text:post.text,posted_at:post.posted_at,truncated:post.truncated})) {
      await writeJson(`data/history/${post.id}-${hash(old)}.json`,old);
      records.set(post.id,sourceOnly(post,'pending_inference'));
      doc.events=[...records.values()].sort((a,b)=>b.source.posted_at.localeCompare(a.source.posted_at));
      await writeJson('data/events.json',doc);
    }
    const withinBudget=Date.now()<deadline && attempted<maxPosts;
    const cpuUnavailable=plan.selection.enabled&&['failure','cancelled','skipped'].includes(process.env.CPU_READY??'');
    let event:EventRecord;
    if(post.truncated) event=sourceOnly(post,'source_truncated');
    else if(withinBudget&&!cpuUnavailable&&plan.selection.enabled&&plan.selection.model) {
      attempted++;
      event=await interpret(post,plan.selection.model,infer);
      if(event.interpretation.method==='cpu-model') succeeded++;else failed++;
    } else event=sourceOnly(post,!withinBudget?'pending_budget':cpuUnavailable?'pending_cpu':'model_not_approved');
    if(!event.observation && old?.observation) event.observation=old.observation;
    records.set(post.id,event);
    // Failed inference remains retryable on the next poll, unlike a valid unknown answer.
    const done=post.truncated || event.interpretation.method==='cpu-model' || (!plan.selection.enabled&&withinBudget);
    if(done) state.processed[post.id]=hash({post,revision:plan.revision});
    // Write event before its processed marker: interruption can repeat work, never skip it.
    doc.events=[...records.values()].sort((a,b)=>b.source.posted_at.localeCompare(a.source.posted_at));
    await writeJson('data/events.json',doc);
    await writeJson('data/state.json',state);
    log.push({id:post.id,method:event.interpretation.method,kind:event.temporal.kind,reason:event.temporal.reason});
  }
  const rawKey=hash({provider:plan.batch.provider,posts:plan.posts});
  await mkdir('data/raw',{recursive:true});
  try {await readFile(`data/raw/${rawKey}.json`);} catch {await writeJson(`data/raw/${rawKey}.json`,plan.batch.raw);}
  const now=new Date().toISOString();
  doc.events=[...records.values()].sort((a,b)=>b.source.posted_at.localeCompare(a.source.posted_at));
  if(plan.batch.coverage==='complete') {doc.last_success_at=plan.batch.checked_at;state.last_success_at=plan.batch.checked_at;}
  state.last_attempt_at=plan.batch.checked_at;state.last_error=plan.batch.coverage==='partial'?'collection_partial':null;
  state.collection={provider:plan.batch.provider,checked_at:plan.batch.checked_at,upstream_at:plan.batch.upstream_at,coverage:plan.batch.coverage,...(plan.batch.checkpoint?{checkpoint:plan.batch.checkpoint}:{}),...(plan.batch.scope?{scope:plan.batch.scope}:{})};
  const deferred=plan.pending.filter(p=>state.processed[p.id]!==hash({post:p,revision:plan.revision})).length;
  state.analysis={enabled:plan.selection.enabled,model:plan.selection.model,last_run_at:attempted?now:state.analysis?.last_run_at??null,last_success_at:succeeded?now:state.analysis?.last_success_at??null,attempted,succeeded,failed,deferred};
  await writeJson('data/events.json',doc); await writeJson('data/state.json',state);
  await writeJson('.cache/sync-report.json',{at:now,provider:plan.batch.provider,coverage:plan.batch.coverage,posts:plan.posts.length,processed:log,pending:deferred,analysis:state.analysis});
  console.log(JSON.stringify({phase:'persist',events:doc.events.length,processed:log.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const mode=process.argv[2];
  if(mode==='plan') await planSync();
  else if(mode==='apply') await applySync();
  else {await planSync();await applySync();}
}
