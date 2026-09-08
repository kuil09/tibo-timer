import {runClaimV3,claimV3Prompt,CLAIM_V3_VERSION} from '../src/claim-v3.ts';
import {runClaimV2,decodeV2,claimV2Prompt,CLAIM_V2_VERSION} from '../src/claim-v2.ts';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runTwoStage,localStageCall,claimPrompt,timePrompt,TWO_STAGE_VERSION,type StageTrace} from '../src/two-stage.ts';
import {wholePostTimes} from '../src/whole-post-times.ts';
const v3=process.env.CLAIM_VERSION==='v3';
const v2=process.env.CLAIM_VERSION==='v2';
const selectedPrompt=v3?claimV3Prompt:v2?claimV2Prompt:claimPrompt;
const version=v3?CLAIM_V3_VERSION:v2?CLAIM_V2_VERSION:TWO_STAGE_VERSION;
const modelId=process.env.LOCAL_MODEL??'lfm26exp';
const systemPrefix=modelId==='exaone35'?'You are EXAONE model from LG AI Research, a helpful assistant.':'';
const outputDir=v3?`.cache/local-lab/${modelId}-v3`:v2?`.cache/local-lab/${modelId}-v2`:modelId==='lfm26exp'?'.cache/local-lab/two-stage':`.cache/local-lab/${modelId}`;
const mode=process.argv.includes('--fresh')?'fresh':process.argv.includes('--pairs')?'pairs':'dev';
const fixturePath=mode==='fresh'?'eval/claims-fresh-v2.json':mode==='pairs'?'eval/claim-minimal-pairs.json':'eval/claims-dev.json';
const fixture=await readFile(fixturePath,'utf8');const gold=JSON.parse(fixture).cases;
const original=JSON.parse(await readFile('eval/cases.json','utf8'));const byId=new Map(original.map((c:any)=>[c.id,c]));
const cases=gold.map((g:any)=>({...((mode==='dev'?byId.get(g.id):{}) as object),...g}));
const results:any[]=[];const started=performance.now();
const canonical=(x:string)=>x.toLowerCase().replace(/^at /,'').replace(/\s+/g,' ').trim();
for(const c of cases){
 const traces:StageTrace[]=[];let result:any=null,error:string|null=null;
 try{result=await (v3?runClaimV3:v2?runClaimV2:runTwoStage)(c,localStageCall(traces,undefined,systemPrefix));}catch(e){error=e instanceof Error?e.message:String(e);}
 const raw=traces.find(t=>t.stage==='claim')?.parsed as any;
 let rawClaim=raw; if(v2&&raw){try{rawClaim=decodeV2(raw);}catch{rawClaim=null;}}
 const classCorrect=!error&&result?.claim===c.claim&&result?.reset_kind===c.reset_kind;
 const temporalCorrect=!!result&&Object.entries(c.expected_temporal).every(([k,v])=>['at','from','until'].includes(k)?Date.parse(result.temporal[k])===Date.parse(String(v)):result.temporal[k]===v);
 const selected=wholePostTimes(c.text).find(t=>t.id===result?.time_id)?.text??'';
 const timeCorrect=c.claim!=='scheduled'?result?.time_id===null:c.expected_time_expression===''?selected==='':
  (!!selected&&temporalCorrect&&(result.temporal.kind!=='unresolved'||canonical(selected)===canonical(c.expected_time_expression)));
 const r={id:c.id,text:c.text,expected:{claim:c.claim,reset_kind:c.reset_kind,temporal:c.expected_temporal,time_expression:c.expected_time_expression},result,error,traces,class_correct:classCorrect,temporal_correct:temporalCorrect,time_correct:timeCorrect,passed:classCorrect&&temporalCorrect&&timeCorrect,
 false_scheduled:rawClaim?.claim==='scheduled'&&c.claim!=='scheduled',false_completed:rawClaim?.claim==='completed'&&c.claim!=='completed',false_time:!!result&&result.temporal.kind!=='unresolved'&&(!temporalCorrect||!timeCorrect)};
 results.push(r);console.log(JSON.stringify({id:r.id,passed:r.passed,claim:result?.claim,error}));
}
const report={version:1,model:modelId,prompt_version:version,mode,total:results.length,correct:results.filter(r=>r.passed).length,class_correct:results.filter(r=>r.class_correct).length,errors:results.filter(r=>r.error).length,false_scheduled:results.filter(r=>r.false_scheduled).length,false_completed:results.filter(r=>r.false_completed).length,false_time:results.filter(r=>r.false_time).length,claim_calls:results.reduce((n,r)=>n+r.traces.filter((t:StageTrace)=>t.stage==='claim').length,0),time_calls:results.reduce((n,r)=>n+r.traces.filter((t:StageTrace)=>t.stage==='time').length,0),elapsed_ms:performance.now()-started,release_eligible:false,identity:{fixture_sha256:createHash('sha256').update(fixture).digest('hex'),system_prefix:systemPrefix,claim_prompt:systemPrefix?systemPrefix+'\n\n'+selectedPrompt:selectedPrompt,time_prompt:systemPrefix?systemPrefix+'\n\n'+timePrompt:timePrompt,model:JSON.parse(await readFile('config/local-models.json','utf8'))[modelId],runtime:JSON.parse(await readFile('config/local-runtime.json','utf8')).runtime},results};
await mkdir(outputDir,{recursive:true});await writeFile(`${outputDir}/${mode}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined,identity:undefined}));
