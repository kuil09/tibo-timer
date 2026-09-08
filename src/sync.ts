import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { extract, PROMPT_VERSION, SCHEMA_VERSION } from './inference.ts';
import { normalizeTemporal } from './temporal.ts';
import { fetchFeed, postsFromFeed, hash, type SourcePost, type Feed } from './source.ts';
import { readJson, writeJson } from './storage.ts';
import { validateExtraction, type EventRecord } from './types.ts';
interface State {schema_version:1;processed:Record<string,string>;last_success_at:string|null;last_attempt_at:string|null;last_error:string|null;}
interface Document {schema_version:1;last_success_at:string|null;events:EventRecord[];}
interface Selection {enabled:boolean;model:string|null;reason:string;}
export function sourceOnly(post:SourcePost, reason:string):EventRecord {
  return { id:post.id,source:{url:post.url,text:post.text,posted_at:post.posted_at,truncated:post.truncated},
    event:{type:/\bbanked\b/i.test(post.text)?'banked_reset':/\breset\w*\b/i.test(post.text)?'reset':'unknown',state:'unknown',audience:[]},
    temporal:{kind:'unresolved',precision:'unspecified',original:'',reason},interpretation:{method:'source-only'},...(post.observation?{observation:post.observation}:{}) };
}
export async function interpret(post:SourcePost, model:string, infer=extract):Promise<EventRecord> {
  if (post.truncated) return sourceOnly(post,'source_truncated');
  try {
    const extraction = validateExtraction(await infer(post.text));
    const temporal = normalizeTemporal(extraction,post);
    // Invalid supporting evidence cannot establish a completion announcement either.
    if (!extraction.evidence || !post.text.includes(extraction.evidence) || (extraction.time_expression && !extraction.evidence.includes(extraction.time_expression))) return sourceOnly(post,'invalid_evidence');
    return {...sourceOnly(post,''),event:{type:extraction.event_type,state:extraction.state,audience:extraction.audience},temporal,interpretation:{method:'cpu-model',model},extraction} as EventRecord;
  } catch(error) {return sourceOnly(post,error instanceof Error?error.message:'inference_failed');}
}
export async function planSync() {
  const selection=await readJson<Selection>('config/selection.json');
  const state=await readJson<State>('data/state.json');
  try {
    const feed=await fetchFeed();
    const posts=postsFromFeed(feed);
    const lock=JSON.parse(await readFile('config/models.lock.json','utf8'));
    const identity=selection.enabled&&selection.model?{runtime:lock.runtime,model:lock.models[selection.model]}:null;
    const revision=hash({model:selection.enabled?selection.model:null,identity,prompt:PROMPT_VERSION,schema:SCHEMA_VERSION});
    const pending=posts.filter(p=>state.processed[p.id]!==hash({post:p,revision}));
    await writeJson('.cache/pending.json',{feed,posts,pending,revision,selection});
    if(process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,`inference=${selection.enabled&&pending.some(p=>!p.truncated)}\nmodel=${selection.model??''}\n`);
    console.log(JSON.stringify({phase:'fetch',posts:posts.length,pending:pending.length,inference:selection.enabled}));
  } catch(error) {
    state.last_attempt_at=new Date().toISOString();state.last_error=error instanceof Error?error.message:'fetch_failed';
    await writeJson('data/state.json',state);
    throw error;
  }
}
export async function applySync() {
  const plan=await readJson<{feed:Feed;posts:SourcePost[];pending:SourcePost[];revision:string;selection:Selection}>('.cache/pending.json');
  const state=await readJson<State>('data/state.json');
  const doc=await readJson<Document>('data/events.json');
  const records=new Map(doc.events.map(e=>[e.id,e]));
  const deadline=Date.now()+Number(process.env.SYNC_BUDGET_MS??360_000);
  const log=[];
  for(const post of plan.pending) {
    const old=records.get(post.id);
    // Immediately invalidate modified source, even if the inference budget is exhausted.
    if(old && hash(old.source)!==hash({url:post.url,text:post.text,posted_at:post.posted_at,truncated:post.truncated})) {
      await writeJson(`data/history/${post.id}-${hash(old)}.json`,old);
      records.set(post.id,sourceOnly(post,'pending_inference'));
      doc.events=[...records.values()].sort((a,b)=>b.source.posted_at.localeCompare(a.source.posted_at));
      await writeJson('data/events.json',doc);
    }
    const withinBudget=Date.now()<deadline;
    const cpuUnavailable=plan.selection.enabled&&process.env.CPU_READY==='failure';
    const event=withinBudget&&!cpuUnavailable&&plan.selection.enabled&&plan.selection.model?
      await interpret(post,plan.selection.model):sourceOnly(post,!withinBudget?'pending_budget':cpuUnavailable?'pending_cpu':'model_not_approved');
    records.set(post.id,event);
    if(withinBudget&&!cpuUnavailable) state.processed[post.id]=hash({post,revision:plan.revision});
    // Write event before its processed marker: interruption can repeat work, never skip it.
    doc.events=[...records.values()].sort((a,b)=>b.source.posted_at.localeCompare(a.source.posted_at));
    await writeJson('data/events.json',doc);
    await writeJson('data/state.json',state);
    log.push({id:post.id,method:event.interpretation.method,kind:event.temporal.kind,reason:event.temporal.reason});
  }
  // Persist raw snapshots only when semantic source content changes, not likes or fetch timestamps.
  const rawKey=hash(plan.posts);
  await mkdir('data/raw',{recursive:true});
  try {await readFile(`data/raw/${rawKey}.json`);} catch {await writeJson(`data/raw/${rawKey}.json`,plan.feed);}
  const now=new Date().toISOString();
  doc.events=[...records.values()].sort((a,b)=>b.source.posted_at.localeCompare(a.source.posted_at));
  doc.last_success_at=now;state.last_success_at=now;state.last_attempt_at=now;state.last_error=null;
  await writeJson('data/events.json',doc); await writeJson('data/state.json',state);
  await writeJson('.cache/sync-report.json',{at:now,processed:log,pending:plan.pending.length-log.filter(e=>e.reason!=='pending_budget'&&e.reason!=='pending_cpu').length});
  console.log(JSON.stringify({phase:'persist',events:doc.events.length,processed:log.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const mode=process.argv[2];
  if(mode==='plan') await planSync();
  else if(mode==='apply') await applySync();
  else {await planSync();await applySync();}
}
