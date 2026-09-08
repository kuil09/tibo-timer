import test from 'node:test';
import assert from 'node:assert/strict';
import {runTwoStage,validateClaim} from '../src/two-stage.ts';
import {wholePostTimes} from '../src/whole-post-times.ts';
const post={text:'A banked reset is coming. It lands in 3 hours. Sign up by 8pm PT.',posted_at:'2026-09-08T12:00:00Z'};
test('two-stage selection links whole-post delivery without sentence IDs',async()=>{
 const calls:string[]=[];
 const result=await runTwoStage(post,async(stage)=>{calls.push(stage);return stage==='claim'?{claim:'scheduled',reset_kind:'banked_reset'}:{delivery_time_id:'t0'};});
 assert.deepEqual(calls,['claim','time']);assert.equal(result.temporal.at,'2026-09-08T15:00:00Z');
});
test('non-scheduled and no-time announcements skip stage two',async()=>{
 for(const selection of [{claim:'not_announcement',reset_kind:null},{claim:'uncertain',reset_kind:null},{claim:'completed',reset_kind:'reset'},{claim:'retrospective',reset_kind:'reset'},{claim:'scheduled',reset_kind:'reset'}]){
  let calls=0;const r=await runTwoStage({...post,text:'A usage reset.'},async()=>{calls++;return selection;});assert.equal(calls,1);assert.equal(r.claim,selection.claim);assert.equal(r.temporal.kind,'unresolved');
 }
});
test('truncated source bypasses both stages',async()=>{
 let calls=0;const r=await runTwoStage({...post,truncated:true},async()=>{calls++;return {};});assert.equal(calls,0);assert.equal(r.claim,'uncertain');assert.equal(r.temporal.kind,'unresolved');
});
test('inconsistent classifications and nonexistent times are rejected',async()=>{
 assert.throws(()=>validateClaim({claim:'uncertain',reset_kind:'reset'}),/inconsistent/);
 await assert.rejects(runTwoStage(post,async(s)=>s==='claim'?{claim:'scheduled',reset_kind:'reset'}:{delivery_time_id:'invented'}),/unknown_time_id/);
});
test('whole-post scan preserves qualifiers and does not borrow signup timezone',()=>{
 const ts=wholePostTimes('Banked grant\nlands by end of day. Sign up by 8pm PT.');assert.equal(ts[0].text,'by end of day');assert.equal(ts[0].time_zone,null);assert.equal(ts[1].time_zone,'PT');
});
