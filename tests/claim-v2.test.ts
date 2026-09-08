import test from 'node:test';
import assert from 'node:assert/strict';
import {decisions,decodeV2,runClaimV2} from '../src/claim-v2.ts';
test('combined decisions decode without allowing inconsistent claim and kind',()=>{
 for(const [decision,expected] of Object.entries(decisions))assert.deepEqual(decodeV2({decision}),expected);
 for(const input of [{decision:'scheduled'}, {decision:'scheduled_reset',reset_kind:null},{decision:'__proto__'},null])assert.throws(()=>decodeV2(input));
});
test('combined scheduled decision retains independent time selection and normalization',async()=>{
 const stages:string[]=[];
 const result=await runClaimV2({text:'Banked resets arrive in 2 hours.',posted_at:'2026-09-08T12:00:00.000Z'},async(stage)=>{stages.push(stage);return stage==='claim'?{decision:'scheduled_banked_reset'}:{delivery_time_id:'t0'};});
 assert.deepEqual(stages,['claim','time']);assert.equal(result.reset_kind,'banked_reset');assert.equal(result.temporal.kind,'instant');
 if(result.temporal.kind==='instant')assert.equal(result.temporal.at,'2026-09-08T14:00:00Z');
});
test('truncated sources still bypass both stages',async()=>{
 const result=await runClaimV2({text:'reset in 2 hours',posted_at:'2026-09-08T12:00:00.000Z',truncated:true},async()=>{throw new Error('must not call');});assert.equal(result.bypassed,true);
});
