import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runVerificationLoop} from '../src/verify-claim.ts';
import {localStageCall,type StageTrace} from '../src/two-stage.ts';
import {wholePostTimes} from '../src/whole-post-times.ts';
const path='docs/evaluation/local-lab/qwen359b-all-verified/report.json';
const input=await readFile(path,'utf8'),base=JSON.parse(input),rows:any[]=[];const started=performance.now();
const originals=JSON.parse(await readFile('eval/cases.json','utf8'));const fresh=JSON.parse(await readFile('eval/claims-fresh-v2.json','utf8')).cases;const pairs=JSON.parse(await readFile('eval/claim-minimal-pairs.json','utf8')).cases;
const sources=new Map([...originals,...fresh,...pairs].map(x=>[x.id,x]));
for(const row of base.rows){
 const post=sources.get(row.id);if(!post||post.text!==row.text)throw new Error('source_mismatch');
 const traces:StageTrace[]=[];
 const result=await runVerificationLoop(post,localStageCall(traces,process.env.LLAMA_URL??'http://127.0.0.1:8083'),row.result);
 const e=row.expected;const cls=result.claim===e.claim&&result.reset_kind===e.reset_kind;
 const temporal=Object.entries(e.temporal).every(([k,v])=>['at','from','until'].includes(k)?Date.parse((result.temporal as any)[k])===Date.parse(String(v)):(result.temporal as any)[k]===v);
 const phrase=wholePostTimes(post.text).find(t=>t.id===result.time_id)?.text??'';
 const canonical=(s:string)=>s.toLowerCase().replace(/^at /,'').replace(/\s+/g,' ').trim();
 const time=e.claim!=='scheduled'?result.time_id===null:!e.time_expression?!phrase:!!phrase&&temporal&&(result.temporal.kind!=='unresolved'||canonical(phrase)===canonical(e.time_expression));
 const passed=cls&&temporal&&time;
 rows.push({id:row.id,mode:row.mode,text:row.text,expected:e,first:row.result,result,traces,passed});
 console.log(JSON.stringify({id:row.id,attempts:result.attempt_count,exhausted:result.exhausted,passed}));
}
const summary={total:rows.length,correct:rows.filter(x=>x.passed).length,false_completed:rows.filter(x=>x.result.claim==='completed'&&x.expected.claim!=='completed').length,false_scheduled:rows.filter(x=>x.result.claim==='scheduled'&&x.expected.claim!=='scheduled').length,accepted_wrong:rows.filter(x=>x.result.verification.accepted&&!x.passed).length,exhausted:rows.filter(x=>x.result.exhausted).length,extra_model_calls:rows.reduce((n,x)=>n+x.traces.length,0),attempt_distribution:[1,2,3].map(n=>({attempts:n,count:rows.filter(x=>x.result.attempt_count===n).length})),additional_elapsed_ms:performance.now()-started};
await mkdir('docs/evaluation/local-lab/qwen359b-loop',{recursive:true});await writeFile('docs/evaluation/local-lab/qwen359b-loop/report.json',JSON.stringify({version:'all-claims-loop-v1',release_eligible:false,baseline_sha256:createHash('sha256').update(input).digest('hex'),mode:'reuse_locked_first_attempt_live_retries',max_total_attempts:3,summary,rows},null,2));console.log(JSON.stringify(summary));
