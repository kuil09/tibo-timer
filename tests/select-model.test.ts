import test from 'node:test';
import assert from 'node:assert/strict';
import {selectModel,type ModelCandidate,type ModelLock} from '../src/select-model.ts';
const lock:ModelLock={runtime:{version:'v1',sha256:'runtime'},models:{qwen25:{file:'a.gguf',sha256:'a',revision:'ra'},qwen3:{file:'b.gguf',sha256:'b',revision:'rb'}}};
function candidate(key:'qwen25'|'qwen3',correct=20,seconds=10):ModelCandidate {return {key,holdout:{model:key,split:'holdout',total:20,correct,accuracy:correct/20,errors:0,false_completed:0,false_time:0,quality_passed:true},benchmark:{model:key,performance_passed:true,prepared:{model:key,model_path:'/cache/'+lock.models[key].file,model_cache_hit:false,runtime_version:'v1',runtime_sha256:'runtime',model_sha256:lock.models[key].sha256,model_revision:lock.models[key].revision},cold_total_seconds:120,server_peak_rss_kib:1000,rounds:[{label:'cold_first_five',seconds:20,errors:0},{label:'warm_five',seconds,errors:0}]}};}
test('selects accuracy before speed and speed for equal accuracy',()=>{
 assert.equal(selectModel([candidate('qwen25',20,20),candidate('qwen3',19,10)],lock,'run').selection.model,'qwen25');
 assert.equal(selectModel([candidate('qwen25',20,20),candidate('qwen3',20,10)],lock,'run').selection.model,'qwen3');
});
test('rejects claimed pass when numeric evidence or runtime identity disagrees',()=>{
 for(const mutate of [ (c:ModelCandidate)=>{c.holdout!.false_time=1;},(c:ModelCandidate)=>{c.holdout!.accuracy='1';},(c:ModelCandidate)=>{c.holdout!.errors=1;},(c:ModelCandidate)=>{c.benchmark!.cold_total_seconds=600;},(c:ModelCandidate)=>{c.benchmark!.server_peak_rss_kib=0;},(c:ModelCandidate)=>{c.benchmark!.prepared.runtime_sha256='wrong';},(c:ModelCandidate)=>{c.benchmark!.prepared.model_cache_hit=true;}]){
 const c=candidate('qwen25');mutate(c);const result=selectModel([c],lock,'run');assert.equal(result.selection.enabled,false);assert.equal(result.selection.model,null);
 }
});
test('missing reports disable publication and preserve run evidence',()=>{
 const result=selectModel([{key:'qwen25',holdout:null,benchmark:null}],lock,'https://github.com/kuil09/tibo-timer/actions/runs/1');
 assert.equal(result.selection.enabled,false);assert.match(result.summary.evaluation_run_url,/runs\/1$/);assert.deepEqual(result.summary.candidates[0].reasons,['missing_report_or_model_config']);
});

test('legacy report uses pinned-run provenance without inventing direct hash evidence',()=>{
 const c=candidate('qwen25');delete c.benchmark!.prepared.runtime_sha256;
 const r=selectModel([c],lock,'run','151d96b');assert.equal(r.selection.enabled,true);assert.match(r.summary.candidates[0].identity_evidence,/legacy report/);assert.equal(r.summary.evaluation_commit,'151d96b');
});
