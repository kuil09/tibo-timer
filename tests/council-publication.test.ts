import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectCouncil,emptyCouncil} from '../src/publish-council.ts';
const source={url:'https://x.com/thsottiaux/status/123',text:'We reset usage.',posted_at:'2026-09-08T00:00:00Z'};
const events={schema_version:1,events:[{id:'123',source}]};
const claim={event_type:'reset',state:'completed',conditional:false,condition:'',evidence:source.text,time_expression:'',time_basis:'none'};
const models=['a/model:free','b/model:free','c/model:free'];
function fixture() {return {version:'openrouter-council-v2',run_at:'2026-09-08T12:00:00Z',status:'failed',abandoned:[{id:'123',attempt:1,models,claims:[],failed_model:models[0],error:'Inconsistent claim sk-secret-private'}],results:[{id:'123',status:'unresolved'}],calls:[{model:models[0],input:{source},content:JSON.stringify({...claim,time_basis:'unclear'}),id:'private-request-id',provider_error:'private-account-data'}]};}
test('invalid model drafts remain visible but are not promoted; uncalled peers stay not_run',()=>{
 const result=projectCouncil(fixture(),events);
 assert.equal(result.result,'unresolved');
 assert.equal(result.attempts[0].models[0].claim?.state,'completed');
 assert.equal(result.attempts[0].models[0].status,'invalid');
 assert.equal(result.attempts[0].models[1].status,'not_run');
 assert.equal('error' in result.attempts[0].models[0] ? result.attempts[0].models[0].error : null,'invalid_response');
 assert.doesNotMatch(JSON.stringify(result),/private|sk-secret/);
});
test('timeout and unsafe run URL expose no provider details',()=>{
 const report=fixture();report.abandoned[0].error='timeout private';report.calls=[];
 assert.throws(()=>projectCouncil(report,events));
 report.calls=[{model:models[0],input:{source},content:'',id:'private',provider_error:'private'}];
 const result=projectCouncil(report,events,'https://evil.test/account');
 assert.equal(result.run_url,null);assert.equal(result.attempts[0].models[0].status,'timeout');
});
test('changed source and malformed report cannot replace a snapshot',()=>{
 assert.throws(()=>projectCouncil(fixture(),{...events,events:[{id:'123',source:{...source,text:'Edited source'}}]}));
 assert.throws(()=>projectCouncil({},events));
 assert.equal(emptyCouncil().status,'unavailable');
});
test('untrusted raw extras are excluded and corroboration requires all peer approvals',()=>{
 const report:any=fixture();report.abandoned=[];report.status='completed';
 report.results=[{id:'123',attempt:1,models,claims:[claim,claim,claim],reviews:[],status:'corroborated'}];
 assert.equal(projectCouncil(report,events).result,'unresolved');
 report.results[0].reviews=[0,1,2].flatMap(author=>[0,1,2].filter(reviewer=>reviewer!==author).map(reviewer=>({author,reviewer,verdict:'supported'})));
 assert.equal(projectCouncil(report,events).result,'corroborated');
});
test('empty snapshot explicitly represents missing evaluation',()=>{
 const result=emptyCouncil();
 assert.equal(result.schema_version,1);assert.deepEqual(result.attempts,[]);assert.equal(result.result,'unresolved');assert.equal(result.source_id,null);
});
