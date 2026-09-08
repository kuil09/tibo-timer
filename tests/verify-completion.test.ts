import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCompletion} from '../src/verify-completion.ts';
const initial={claim:'completed' as const,reset_kind:'reset' as const,time_id:null,temporal:{kind:'unresolved' as const,precision:'unspecified' as const,original:'',reason:'not_a_schedule'},bypassed:false};
test('verifier sees source only and preserves literal matching confirmation',async()=>{
 let count=0;const r=await verifyCompletion({text:'Usage has been reset.'},initial,async(stage,prompt,input)=>{count++;assert.equal(stage,'verify');assert.deepEqual(input,{source_text:'Usage has been reset.'});return {verdict:'confirmed',reset_kind:'reset',evidence:'has been reset'};});assert.equal(count,1);assert.equal(r.claim,'completed');
});
test('conflict, fabricated evidence and failure become unresolved with no retry',async()=>{
 for(const a of [{verdict:'rejected',reset_kind:null,evidence:''},{verdict:'confirmed',reset_kind:'reset',evidence:'invented'},{verdict:'confirmed',reset_kind:'banked_reset',evidence:'Usage'},null]){
 let count=0;const r=await verifyCompletion({text:'Usage will reset.'},initial,async()=>{count++;if(a===null)throw new Error('timeout');return a;});assert.equal(count,1);assert.equal(r.claim,'uncertain');assert.equal(r.temporal.kind,'unresolved');}
});
test('non-completed results do not invoke verifier',async()=>{const r=await verifyCompletion({text:'Soon'}, {...initial,claim:'uncertain',reset_kind:null},async()=>{throw new Error('must not call');});assert.equal(r.verification.needed,false);});
