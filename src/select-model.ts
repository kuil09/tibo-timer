import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeJson } from './storage.ts';

type Json = Record<string, any>;
export interface ModelCandidate { key: 'qwen25' | 'qwen3'; holdout: Json | null; benchmark: Json | null; }
export interface ModelLock { runtime: { version: string; sha256: string }; models: Record<string,{file:string;revision:string;sha256:string}>; }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function selectModel(candidates: ModelCandidate[], lock: ModelLock, evidenceUrl: string, evaluationCommit = '') {
  const reviewed = candidates.map(({key,holdout:h,benchmark:b})=>{
    const reasons:string[]=[];
    const expected=lock.models[key];
    if (!h || !b || !expected) reasons.push('missing_report_or_model_config');
    const warm=Array.isArray(b?.rounds)?b.rounds.find((r:Json)=>r?.label==='warm_five'):undefined;
    if (h) {
      if(h.model!==key||h.split!=='holdout'||h.total!==20) reasons.push('holdout_identity_or_size_mismatch');
      if(h.quality_passed!==true||!finite(h.accuracy)||h.accuracy<.95||h.accuracy>1||h.false_completed!==0||h.false_time!==0||h.errors!==0) reasons.push('quality_gate_failed');
      if(!Number.isInteger(h.correct)||h.correct<19||h.correct>20||h.accuracy!==h.correct/20) reasons.push('inconsistent_quality_counts');
    }
    if(b) {
      if(b.model!==key||b.prepared?.model!==key||typeof b.prepared?.model_path!=='string'||basename(b.prepared.model_path)!==expected?.file) reasons.push('benchmark_model_mismatch');
      if(b.performance_passed!==true||!finite(b.cold_total_seconds)||b.cold_total_seconds<=0||b.cold_total_seconds>=600||!finite(warm?.seconds)||warm.seconds<=0||warm.seconds>=300||!finite(b.server_peak_rss_kib)||b.server_peak_rss_kib<=0||b.prepared?.model_cache_hit!==false) reasons.push('performance_gate_failed');
      if(!Array.isArray(b.rounds)||b.rounds.length!==2||!b.rounds.some((r:Json)=>r?.label==='cold_first_five')||b.rounds.some((r:Json)=>r?.errors!==0)) reasons.push('benchmark_rounds_failed');
      // Older artifacts trace verified downloads through the pinned preparation script at the run commit.
      const identities={runtime_sha256:lock.runtime.sha256,runtime_version:lock.runtime.version,model_sha256:expected?.sha256,model_revision:expected?.revision};
      if(Object.entries(identities).some(([field,value])=>b.prepared?.[field]!==undefined&&b.prepared[field]!==value)) reasons.push('runtime_or_model_identity_mismatch');
    }
    return {model:key,passed:reasons.length===0,reasons,accuracy:h?.accuracy??null,correct:h?.correct??null,false_completed:h?.false_completed??null,false_time:h?.false_time??null,errors:h?.errors??null,warm_five_seconds:warm?.seconds??null,cold_total_seconds:b?.cold_total_seconds??null,server_peak_rss_kib:b?.server_peak_rss_kib??null,identity_evidence:b?.prepared?.runtime_sha256?'report_metadata_and_pinned_preparation':'pinned_preparation_at_evaluation_commit; hashes not included in legacy report',expected_runtime:lock.runtime,expected_model:expected};
  });
  const eligible=reviewed.filter(r=>r.passed).sort((a,b)=>(b.correct-a.correct)||(a.warm_five_seconds-b.warm_five_seconds)||a.model.localeCompare(b.model));
  const selected=eligible[0];
  const selection={enabled:!!selected,model:selected?.model??null,reason:selected?'Passed fixed holdout quality and CPU performance gates.':'No CPU model passed all verified quality, performance, and model configuration gates; source-only publication remains enabled.'};
  return {selection,summary:{schema_version:1,evaluation_run_url:evidenceUrl,evaluation_commit:evaluationCommit,selection,candidates:reviewed}};
}
async function readOptional(file:string):Promise<Json|null>{try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
export async function main() {
  const directory=process.argv[2]??'.cache/reports';
  const lock=JSON.parse(await readFile('config/models.lock.json','utf8')) as ModelLock;
  const candidates:ModelCandidate[]=[];
  for(const key of ['qwen25','qwen3'] as const){
    const path=join(directory,`evaluation-${key}`);
    candidates.push({key,holdout:await readOptional(join(path,`${key}-holdout.json`)),benchmark:await readOptional(join(path,`${key}-benchmark.json`))});
  }
  const result=selectModel(candidates,lock,process.env.EVALUATION_RUN_URL??'',process.env.EVALUATION_COMMIT??'');
  await writeJson('config/selection.json',result.selection);
  await writeJson('docs/model-evaluation.json',{...result.summary,generated_at:new Date().toISOString()});
  console.log(JSON.stringify(result.summary,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) await main();
