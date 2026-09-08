import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessResponse} from '../src/diagnose-feed.ts';
const good=()=>JSON.stringify({version:1,stale:false,fetched_at:new Date().toISOString(),tweets:[],events:[]});
test('diagnosis accepts only HTTP 200, JSON content type, and valid fresh feed schema',()=>{
 const base={status:200,content_type:'application/json; charset=utf-8',cf_mitigated:null,body:good()};
 assert.equal(assessResponse(base).valid_feed,true);
 assert.equal(assessResponse({...base,status:403,cf_mitigated:'challenge'}).valid_feed,false);
 assert.equal(assessResponse({...base,content_type:'text/html',body:'<html>Just a moment</html>'}).valid_feed,false);
 assert.equal(assessResponse({...base,body:'{"version":1}'}).valid_feed,false);
 assert.equal(assessResponse({...base,body:good().replace('"stale":false','"stale":true')}).valid_feed,false);
});
