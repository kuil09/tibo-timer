import test from 'node:test';
import assert from 'node:assert/strict';
import { extract, InferenceError, type InferenceDiagnostic } from '../src/inference.ts';
const source='The reset is complete.';
const valid={event_type:'reset',state:'completed',sentence_id:'s0',time_id:null};
test('selection inference preserves diagnostics and enforces boundaries',async t=>{
 const originalFetch=globalThis.fetch,originalUrl=process.env.LLAMA_URL;
 t.after(()=>{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.LLAMA_URL;else process.env.LLAMA_URL=originalUrl;});
 process.env.LLAMA_URL='http://127.0.0.1:8080';
 function mock(tokens:unknown,content:unknown=valid,finish_reason='stop'){
  const requests:{url:string;options?:RequestInit}[]=[];
  globalThis.fetch=(async(url,options)=>{requests.push({url:String(url),options});return new Response(JSON.stringify(String(url).endsWith('/tokenize')?{tokens}:{choices:[{finish_reason,message:{content:JSON.stringify(content)}}]}));}) as typeof fetch;
  return requests;
 }
 await t.test('source IDs resolve into original evidence without invented audience',async()=>{
  const requests=mock([]);let diagnostic:InferenceDiagnostic|undefined;
  const result=await extract(source,d=>{diagnostic=d;});
  assert.equal(result.evidence,source);assert.deepEqual(result.audience,[]);
  assert.equal(result.state,'completed');assert.equal(diagnostic?.raw_output,JSON.stringify(valid));
  const payload=JSON.parse(String(requests[1].options?.body));
  assert.equal(JSON.parse(payload.messages[1].content).sentences[0].text,source);
  assert.deepEqual(payload.response_format.json_schema.schema.properties.sentence_id.enum,[null,'s0']);
  assert.ok(requests.every(r=>r.options?.redirect==='error'));
 });
 await t.test('context overflow stops before generation',async()=>{
  const requests=mock(Array(3201).fill(0));await assert.rejects(extract(source),/input_context_exceeded/);assert.equal(requests.length,1);
 });
 await t.test('truncated and invalid selections retain raw output',async()=>{
  for(const [content,finish] of [[valid,'length'],[{...valid,sentence_id:'s999'},'stop']] as const){
   mock([],content,finish);await assert.rejects(extract(source),(error:unknown)=>{
    assert.ok(error instanceof InferenceError);assert.equal(error.diagnostic.raw_output,JSON.stringify(content));assert.ok(error.diagnostic.failure_reason);return true;
   });
  }
 });
 await t.test('nonloopback and credentialed URLs fail before access',async()=>{
  for(const url of ['https://example.com','ftp://localhost','http://user:secret@localhost']){
   process.env.LLAMA_URL=url;const requests=mock([]);await assert.rejects(extract(source),/loopback/);assert.equal(requests.length,0);
  }
 });
});
