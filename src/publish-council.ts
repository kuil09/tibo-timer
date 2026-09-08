import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {accepted, validateClaim, type Claim} from './openrouter.ts';

type Row = Record<string, any>;
const object = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const date = (x: unknown) => typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : null;
const modelId = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+$/.test(x) && x.length < 200;
export const emptyCouncil = () => ({schema_version:1, run_at:null, status:'unavailable', source_id:null, source_hash:null, run_url:null, attempts:[], result:'unresolved', source_last_success_at:null});

// Drafts may be semantically invalid, but never publish arbitrary provider text.
function draft(x: unknown, source: string): Claim | null {
  if (!object(x) || !['reset','banked_reset','unknown'].includes(x.event_type) || !['scheduled','completed','retrospective','unknown'].includes(x.state) || typeof x.conditional !== 'boolean' || !['posted_at','explicit_calendar','condition_completion','unclear','none'].includes(x.time_basis)) return null;
  for (const key of ['condition','evidence','time_expression']) if (typeof x[key] !== 'string' || x[key].length > 4000 || (x[key] && !source.includes(x[key]))) return null;
  return {event_type:x.event_type,state:x.state,conditional:x.conditional,condition:x.condition,evidence:x.evidence,time_expression:x.time_expression,time_basis:x.time_basis};
}
function failure(x: unknown) {
  const value = typeof x === 'string' ? x : '';
  if (/timeout|timed out/i.test(value)) return {status:'timeout',error:'timeout'};
  if (/claim|review|JSON|response/i.test(value)) return {status:'invalid',error:'invalid_response'};
  return {status:'error',error:'request_failed'};
}
export function projectCouncil(report: unknown, events: unknown, runUrl?: string) {
  if (!object(report) || !/^openrouter-council-v\d+$/.test(report.version) || !Array.isArray(report.results) || !Array.isArray(report.abandoned) || !Array.isArray(report.calls) || !object(events) || events.schema_version !== 1 || !Array.isArray(events.events)) throw new Error('Invalid council publication input');
  const runAt = date(report.run_at) ?? date(report.completed_at);
  if (!runAt) throw new Error('Missing council timestamp');
  const last = report.results.at(-1) ?? report.abandoned.at(-1);
  if (!object(last) || typeof last.id !== 'string' || !/^\d{1,30}$/.test(last.id)) throw new Error('No evaluated source');
  const post = events.events.find((p: any) => p.id === last.id);
  if (!object(post?.source) || typeof post.source.text !== 'string') throw new Error('Source missing');
  const sourceHash = hash(post.source.text);
  const calls = report.calls.filter((c: any) => object(c) && object(c.input?.source) && c.input.source.text === post.source.text && c.input.source.url === post.source.url && !Object.hasOwn(c.input, 'candidate'));
  if ((last.source_hash && last.source_hash !== sourceHash) || (!last.source_hash && !calls.length)) throw new Error('Source changed or unverified');
  const records = [...report.abandoned.filter((a: any) => a.id === last.id), ...report.results.filter((r: any) => r.id === last.id && Array.isArray(r.models))];
  if (!records.length) throw new Error('Missing attempt records');
  const attempts = records.map((record: Row) => {
    if (!Number.isInteger(record.attempt) || record.attempt < 1 || record.attempt > 3 || !Array.isArray(record.models) || record.models.length !== 3 || !record.models.every(modelId) || new Set(record.models).size !== 3 || !Array.isArray(record.claims)) throw new Error('Invalid attempt');
    const models = record.models.map((id: string, index: number) => {
      const parsed = draft(record.claims[index], post.source.text);
      if (parsed) {
        try {validateClaim(record.claims[index], post.source.text); return {id,claim:parsed,status:'valid'};} catch {return {id,claim:parsed,status:'invalid',error:'invalid_response'};}
      }
      if (record.failed_model !== id) return {id,claim:null,status:'not_run'};
      const matching = calls.filter((c: Row) => c.model === id);
      let recovered: Claim | null = null;
      for (const call of matching) {
        if (typeof call.content !== 'string') continue;
        try {recovered = draft(JSON.parse(call.content.trim().replace(/^```(?:json)?\s*|\s*```$/g,'')),post.source.text);} catch { /* Keep provider output private. */ }
      }
      return {id,claim:recovered,...failure(record.error)};
    });
    const corroborated = record.status === 'corroborated' && models.every((m: Row) => m.status === 'valid') && Array.isArray(record.reviews) && accepted(models.map((m: Row) => m.claim),record.reviews);
    return {attempt:record.attempt,models,status:corroborated?'corroborated':record.failed_model?'failed':'unresolved'};
  });
  const safeUrl = typeof runUrl === 'string' && /^https:\/\/github\.com\/kuil09\/tibo-timer\/actions\/runs\/\d+$/.test(runUrl) ? runUrl : null;
  return {schema_version:1,run_at:runAt,status:report.status==='completed'?'completed':'failed',source_id:last.id,source_hash:sourceHash,run_url:safeUrl,attempts,result:attempts.at(-1)?.status==='corroborated'?'corroborated':'unresolved',source_last_success_at:date(report.source_last_success_at)};
}
export async function publishCouncil(input: string, output: string, runUrl?: string) {
  const publication = projectCouncil(JSON.parse(await readFile(input,'utf8')),JSON.parse(await readFile('data/events.json','utf8')),runUrl);
  await mkdir(dirname(output),{recursive:true});
  const temporary = `${output}.tmp`;
  await writeFile(temporary,JSON.stringify(publication,null,2)+'\n');
  await rename(temporary,output);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) publishCouncil(process.argv[2] ?? '.cache/openrouter/council.json',process.argv[3] ?? 'data/council.json',process.argv[4]).catch(() => {console.error('Council publication failed; previous snapshot preserved.');process.exitCode=1;});
