import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyCompletion,completionPrompt,completionSchema,COMPLETION_VERSION} from '../src/verify-completion.ts';
import {localStageCall,type StageTrace} from '../src/two-stage.ts';
import {claimV3Prompt} from '../src/claim-v3.ts';
const rows:any[]=[];const inputs:any[]=[];const started=performance.now();
const model=JSON.parse(await readFile('config/local-models.json','utf8')).qwen359b;
for(const mode of ['pairs','dev','fresh']){
 const path=`docs/evaluation/local-lab/qwen359b-v3/${mode}.json`,bytes=await readFile(path,'utf8'),base=JSON.parse(bytes);
 if(base.prompt_version!=='claims-v3'||base.identity.claim_prompt!==claimV3Prompt||base.identity.model.sha256!==model.sha256)throw new Error('baseline_identity_mismatch');
 inputs.push({mode,path,sha256:createHash('sha256').update(bytes).digest('hex')});
 for(const row of base.results){
  if(row.error||!row.result)throw new Error('baseline_error_cannot_replay');
  const traces:StageTrace[]=[];
  const result=await verifyCompletion({text:row.text},row.result,localStageCall(traces,process.env.LLAMA_URL??'http://127.0.0.1:8083'));
  const classCorrect=result.claim===row.expected.claim&&result.reset_kind===row.expected.reset_kind;
  const passed=result.verification.needed&&!result.verification.accepted?classCorrect&&row.expected.temporal.kind==='unresolved':row.passed;
  rows.push({...row,mode,initial:row.result,result,traces,baseline_passed:row.passed,passed,false_completed:result.claim==='completed'&&row.expected.claim!=='completed',true_completed:row.expected.claim==='completed',retained_completed:row.expected.claim==='completed'&&result.claim==='completed',verification_ms:traces.reduce((s,t)=>s+t.ms,0)});
  if(result.verification.needed)console.log(JSON.stringify({id:row.id,expected:row.expected.claim,verdict:result.verification,final_claim:result.claim}));
 }
}
const summary={total:rows.length,baseline_correct:rows.filter(x=>x.baseline_passed).length,correct:rows.filter(x=>x.passed).length,baseline_false_completed:rows.filter(x=>x.initial.claim==='completed'&&x.expected.claim!=='completed').length,false_completed:rows.filter(x=>x.false_completed).length,true_completed:rows.filter(x=>x.true_completed).length,retained_completed:rows.filter(x=>x.retained_completed).length,verification_calls:rows.reduce((n,x)=>n+x.traces.length,0),abstentions_added:rows.filter(x=>x.result.verification.needed&&!x.result.verification.accepted).length,elapsed_ms:performance.now()-started,verification_errors:rows.filter(x=>x.traces.some((t:StageTrace)=>t.error)).length};
const report={version:COMPLETION_VERSION,mode:'replay_locked_v3_first_stage_then_live_completion_verification',release_eligible:false,identity:{model,baseline_files:inputs,prompt:completionPrompt,schema:completionSchema,temperature:0,seed:42,reasoning:'off'},summary,rows};
await mkdir('docs/evaluation/local-lab/qwen359b-verified',{recursive:true});await writeFile('docs/evaluation/local-lab/qwen359b-verified/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(summary));
