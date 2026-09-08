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
test('parallel failures stay aligned with their seats and preserve successful peers',()=>{
 const report:any=fixture();
 report.abandoned[0]={...report.abandoned[0],claims:[null,claim,null],failed_models:[{id:models[2],stage:'draft',error:'timeout private-provider'},{id:models[0],stage:'draft',error:'Invalid JSON private-secret'}],failed_model:models[2],reviews:[{author:1,reviewer:0,verdict:'unavailable'},{author:1,reviewer:2,verdict:'unavailable'}]};
 const result=projectCouncil(report,events);
 const seats=result.attempts[0].models;
 assert.deepEqual(seats.map(seat=>seat.status),['invalid','valid','timeout']);
 assert.equal(seats[0].claim,null); // A legacy raw call must not be recovered into a parallel attempt.
 assert.deepEqual(seats[1].claim,claim);
 assert.equal(seats[2].claim,null);
 assert.deepEqual(seats[1].reviews,[{reviewer:models[0],verdict:'unavailable'},{reviewer:models[2],verdict:'unavailable'}]);
 assert.equal(result.attempts[0].status,'failed');
 assert.doesNotMatch(JSON.stringify(result),/private|secret/);
});
test('review failure retains its draft and publishes sanitized peer results only',()=>{
 const report:any=fixture();
 report.abandoned[0]={...report.abandoned[0],claims:[claim,claim,claim],failed_models:[{id:models[1],stage:'review',error:'timeout private'}],reviews:[
  {author:0,reviewer:1,verdict:'error',provider_error:'private'},
  {author:0,reviewer:2,verdict:'supported',evidence:'private'},
  {author:0,reviewer:0,verdict:'supported'},
  {author:0,reviewer:7,verdict:'supported'},
  {author:0,reviewer:1,verdict:'private'},
  {author:2,reviewer:0,verdict:'uncertain'},
 ]};
 const result=projectCouncil(report,events);
 const seats=result.attempts[0].models;
 assert.deepEqual(seats.map(seat=>seat.status),['valid','timeout','valid']);
 assert.deepEqual(seats[1].claim,claim);
 assert.deepEqual(seats[0].reviews,[{reviewer:models[1],verdict:'error'},{reviewer:models[2],verdict:'supported'}]);
 assert.deepEqual(seats[2].reviews,[{reviewer:models[0],verdict:'uncertain'}]);
 assert.equal(result.result,'unresolved');
 assert.doesNotMatch(JSON.stringify(result),/private/);
});
test('parallel failed drafts recover only aligned sanitized raw claims',()=>{
 const report:any=fixture();
 report.abandoned[0]={...report.abandoned[0],claims:[null,claim,null],raw_claims:[{...claim,time_basis:'unclear',private:'secret'},null,{...claim,evidence:'invented private quotation'}],failed_models:[{id:models[0],stage:'draft',error:'Inconsistent claim private'},{id:models[2],stage:'draft',error:'Invalid claim private'}]};
 const seats=projectCouncil(report,events).attempts[0].models;
 assert.equal(seats[0].status,'invalid');
 assert.equal(seats[0].claim?.time_basis,'unclear');
 assert.deepEqual(seats[1].claim,claim);
 assert.equal(seats[2].claim,null);
 assert.doesNotMatch(JSON.stringify(seats),/private|secret|invented/);
});
