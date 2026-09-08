import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyClaim,runVerifiedClaimOnce,runVerifiedClaimAll} from '../src/verify-claim.ts';
const initial={claim:'scheduled' as const,reset_kind:'reset' as const,time_id:'t0',temporal:{kind:'unresolved' as const,precision:'unspecified' as const,original:'',reason:'test'},bypassed:false};
test('all nontruncated claim classes receive exactly one independent verification',async()=>{
 for(const claim of ['scheduled','completed','retrospective','not_announcement','uncertain'] as const){
 const kind=claim==='uncertain'||claim==='not_announcement'?null:'reset';const time=claim==='scheduled'?'t0':null;let n=0;
 const r=await verifyClaim({text:'Usage reset in 2 hours.'},{...initial,claim,reset_kind:kind,time_id:time},async(stage,prompt,input)=>{n++;assert.equal(stage,'verify');assert.deepEqual(Object.keys(input as object).sort(),['source_text','time_candidates']);return {claim,reset_kind:kind,delivery_time_id:time,evidence:'Usage reset'};});assert.equal(n,1);assert.equal(r.verification.accepted,true);
 }
});
test('time disagreement and invented evidence fail closed without retry',async()=>{
 for(const a of [{claim:'scheduled',reset_kind:'reset',delivery_time_id:null,evidence:'Usage'}, {claim:'scheduled',reset_kind:'reset',delivery_time_id:'t0',evidence:'fabricated'}]){
 let n=0;const r=await verifyClaim({text:'Usage reset in 2 hours.'},initial,async()=>{n++;return a;});assert.equal(n,1);assert.equal(r.claim,'uncertain');assert.equal(r.temporal.kind,'unresolved');}
});
test('truncated source bypasses verification and failed first pass cannot be promoted',async()=>{
 const r=await verifyClaim({text:'Usage',truncated:true},initial,async()=>{throw new Error('must not call');});assert.equal(r.verification.needed,false);
 const stages:string[]=[];const result=await runVerifiedClaimOnce({text:'Usage reset.',posted_at:'2026-09-08T12:00:00Z'},async(stage)=>{stages.push(stage);if(stage==='claim')throw new Error('timeout');return {claim:'completed',reset_kind:'reset',delivery_time_id:null,evidence:'Usage reset.'};});assert.deepEqual(stages,['claim','verify']);assert.equal(result.claim,'uncertain');assert.equal(result.verification.accepted,false);
});

test('verification loop stops at agreement and never exceeds three total attempts',async()=>{
 for(const succeeds of [true,false]){
 let claims=0,verifications=0;
 const r=await runVerifiedClaimAll({text:'Usage reset.',posted_at:'2026-09-08T12:00:00Z'},async(stage)=>{
 if(stage==='claim'){claims++;return {claim:'completed',reset_kind:'reset'};}
 verifications++;return {claim:succeeds&&verifications===2?'completed':'not_announcement',reset_kind:succeeds&&verifications===2?'reset':null,delivery_time_id:null,evidence:'Usage reset.'};
 });
 assert.equal(claims,succeeds?2:3);assert.equal(verifications,claims);assert.equal(r.attempt_count,claims);assert.equal(r.exhausted,!succeeds);assert.equal(r.claim,succeeds?'completed':'uncertain');
 }
});
