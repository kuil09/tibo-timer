import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {baseline} from './baseline.ts';
import {interpret} from './sync.ts';
import {extract,PROMPT_VERSION,SCHEMA_VERSION} from './inference.ts';
import {scoreCase,type GoldCase} from './scoring.ts';
import type {Extraction} from './types.ts';
interface EvaluationCase extends GoldCase {id:string;split:'dev'|'holdout';category:string;posted_at:string;}
const flag=(name:string,fallback:string)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];};
const model=flag('model','baseline'),split=flag('split','holdout');
const lock=JSON.parse(await readFile('config/models.lock.json','utf8'));
if((model!=='baseline'&&!lock.models[model])||!['dev','holdout'].includes(split))throw new Error('Use configured --model and --split dev|holdout');
const fixture=await readFile(new URL('../eval/cases.json',import.meta.url),'utf8');
const all=JSON.parse(fixture) as EvaluationCase[];
if(all.length!==40||new Set(all.map(c=>c.id)).size!==40||['dev','holdout'].some(s=>all.filter(c=>c.split===s).length!==20))throw new Error('Expected frozen regression fixture with unique 20/20 split');
const cases=all.filter(c=>c.split===split),results:Record<string,unknown>[]=[];
let correct=0,false_completed=0,false_time=0,unresolved=0,errors=0,semantic_correct=0,strict_correct=0,invocation_count=0;
const started=performance.now();
for(const sample of cases){
 const start=performance.now();let extraction:Extraction|null=null,diagnostic:unknown=null,error:string|null=null,invocations=0;
 const infer=async(text:string)=>{
  invocations++;invocation_count++;
  try{
   extraction=model==='baseline'?baseline(text):await extract(text,d=>{diagnostic=d;});
   if(model==='baseline')diagnostic={raw_output:JSON.stringify(extraction),parsed_output:extraction,failure_reason:null,prompt_version:'baseline'};
   return extraction;
  }catch(e){error=e instanceof Error?e.message:String(e);if(e&&typeof e==='object'&&'diagnostic' in e)diagnostic=e.diagnostic;throw e;}
 };
 const event=await interpret({id:sample.id,text:sample.text,posted_at:sample.posted_at,truncated:sample.truncated,url:'https://example.invalid/regression',kind:'regression'},model,infer);
 const score=scoreCase(sample,event,extraction,invocations,error!==null);
 correct+=Number(score.operational_correct);semantic_correct+=Number(score.semantic_class_match);strict_correct+=Number(score.strict_match);
 false_completed+=Number(score.false_completed);false_time+=Number(score.false_time);unresolved+=Number(event.temporal.kind==='unresolved');errors+=Number(error!==null);
 results.push({id:sample.id,category:sample.category,passed:score.operational_correct,...score,expected:sample.expected,extraction,temporal:event.temporal,production_event:event,invocations,diagnostic,error,elapsed_ms:Math.round(performance.now()-start)});
}
const report={version:2,model,split,evaluation_role:'regression',release_eligible:false,quality_passed:false,
 release_blocker:'These previously exposed cases are regression evidence only. A fresh unseen acceptance set is required for publication eligibility.',
 regression_threshold_passed:correct/cases.length>=.95&&false_completed===0&&false_time===0&&errors===0,
 generated_at:new Date().toISOString(),total:cases.length,correct,accuracy:correct/cases.length,semantic_class_correct:semantic_correct,legacy_strict_correct:strict_correct,legacy_strict_accuracy:strict_correct/cases.length,false_completed,false_time,unresolved,errors,invocation_count,
 identity:{prompt_version:PROMPT_VERSION,schema_version:SCHEMA_VERSION,fixture_sha256:createHash('sha256').update(fixture).digest('hex'),runtime:lock.runtime,model_config:lock.models[model]??null},
 elapsed_ms:Math.round(performance.now()-started),evaluator_max_rss_kib:process.resourceUsage().maxRSS,memory_scope:'Evaluator process only; server memory is measured separately.',
 hardware:{platform:process.platform,architecture:process.arch,cpus:os.cpus().length,cpu_model:os.cpus()[0]?.model,total_memory_bytes:os.totalmem(),runner:process.env.RUNNER_NAME??null},results};
await mkdir('.cache/evaluation',{recursive:true});const path=`.cache/evaluation/${model}-${split}.json`;
await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:undefined,report:path},null,2));
