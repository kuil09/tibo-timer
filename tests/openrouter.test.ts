import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freeReasoning,selectModels,validateClaim,accepted,fatalProviderError} from '../src/openrouter.ts';
const model=(id:string,score:number)=>({id,pricing:{prompt:'0',completion:'0'},supported_parameters:['reasoning','max_tokens'],context_length:32768,architecture:{input_modalities:['text'],output_modalities:['text']},benchmarks:{artificial_analysis:{intelligence_index:score}}});
test('selection excludes paid, unscored and duplicate authors',()=>{
 const paid=model('paid/x:free',100);paid.pricing.prompt='0.01';
 const noScore=model('missing/x:free',NaN);
 assert.deepEqual(selectModels([paid,noScore,model('a/x:free',9),model('a/y:free',8),model('b/x:free',7),model('c/x:free',6)]).map(m=>m.id),['a/x:free','b/x:free','c/x:free']);
 assert.equal(freeReasoning({...model('a/x:free',9),pricing:{prompt:'0',completion:'0',request:'1'}}),false);
 assert.equal(freeReasoning(model('openrouter/free',9)),false);
});
const text='If tests pass, we will reset in 2 hours.';
const claim={event_type:'reset',state:'scheduled',conditional:true,condition:'If tests pass',evidence:text,time_expression:'in 2 hours',time_basis:'unclear'};
test('source and semantic constraints reject invented or inconsistent times',()=>{
 assert.equal(validateClaim(claim,text).state,'scheduled');
 assert.throws(()=>validateClaim({...claim,time_expression:'in 3 hours'},text));
 assert.throws(()=>validateClaim({...claim,time_expression:'',time_basis:'posted_at'},text));
 assert.throws(()=>validateClaim({...claim,state:'completed'},text));
 assert.throws(()=>validateClaim({...claim,conditional:false},text));
});
test('acceptance requires three matching drafts and six distinct non-self approvals',()=>{
 const c=validateClaim(claim,text);
 const reviews=[0,1,2].flatMap(author=>[0,1,2].filter(reviewer=>reviewer!==author).map(reviewer=>({author,reviewer,verdict:'supported'})));
 assert.equal(accepted([c,c,c],reviews),true);
 assert.equal(accepted([c,c,null],reviews),false);
 assert.equal(accepted([c,c,c],reviews.slice(1)),false);
 assert.equal(accepted([c,c,c],[...reviews.slice(1),reviews[1]]),false);
 assert.equal(accepted([c,c,{...c,time_basis:'posted_at'}],reviews),false);
});

test('embedded and HTTP provider errors share account-stop policy',()=>{
 assert.equal(fatalProviderError(429,'daily account quota'),true);
 assert.equal(fatalProviderError(429,'upstream_provider_shared_pool'),false);
 assert.equal(fatalProviderError(401,'invalid key'),true);
 assert.equal(fatalProviderError(402,'budget exhausted'),true);
 assert.equal(fatalProviderError(403,'model restricted'),false);
});
