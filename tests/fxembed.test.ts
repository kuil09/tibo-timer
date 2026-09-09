import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHOR, parseTimeline, collectTimeline, type Checkpoint } from '../src/sources/fxembed.ts';
const now=Math.floor(Date.now()/1000)-3600;
const iso=(s:number)=>new Date(s*1000).toISOString();
const row=(id='123',s=now)=>({type:'status',id,url:`https://x.com/thsottiaux/status/${id}`,text:'Usage will reset soon.',raw_text:{text:'Usage will reset soon.'},author:{id:AUTHOR.id,screen_name:AUTHOR.handle},created_at:new Date(s*1000).toUTCString(),created_timestamp:s,is_note_tweet:false});
const page=(rows:unknown[],cursor:string|null=null)=>({code:200,results:rows,cursor:{bottom:cursor}});
const response=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('filters other conversation authors and preserves only the author original, not quote or translation',()=>{
 const own={...row(),text:'Translated / expanded text',raw_text:{text:'@someone Original https://t.co/test'},replying_to:{status:'456'},quote:{...row('456'),text:'Invented completion'}};
 const other={...row('456'),author:{id:'999',screen_name:'someone'}};
 const parsed=parseTimeline(page([other,own]));
 assert.equal(parsed.posts.length,1);assert.equal(parsed.posts[0].text,own.raw_text.text);assert.equal(parsed.posts[0].kind,'reply');assert.equal(parsed.posts[0].truncated,false);
 assert.ok(!JSON.stringify(parsed.raw).includes('Invented completion'));
});
test('checks pinned numeric identity, source URL, timestamps and cursor schema',()=>{
 for(const invalid of [
  {...row(),id:123}, {...row(),author:{id:'999',screen_name:AUTHOR.handle}},
  {...row(),author:{id:AUTHOR.id,screen_name:'renamed'}}, {...row(),url:'https://evil.test/123'},
  {...row(),created_at:'bad'}, {...row(),created_timestamp:1}, {...row(),created_timestamp:Date.now()},
  {...row(),text:''}, {...row(),raw_text:{text:''}}, {type:'thread'}, null
 ]) assert.throws(()=>parseTimeline(page([invalid])));
 assert.throws(()=>parseTimeline({...page([row()]),code:500}));
 assert.throws(()=>parseTimeline({...page([row()]),cursor:{bottom:123}}));
});
test('IDs stay strings; duplicates are deduplicated, conflicting duplicates rejected',()=>{
 const r=row('2097494113012863197');assert.equal(parseTimeline(page([r,r])).posts.length,1);
 assert.equal(parseTimeline(page([r])).posts[0].id,'2097494113012863197');
 assert.throws(()=>parseTimeline(page([r,{...r,raw_text:{text:'Changed'}}])),/conflicting/);
});
test('long original note text survives; incomplete sources cannot enter inference',()=>{
 const long='A long original announcement. '.repeat(40);
 assert.equal(parseTimeline(page([{...row(),is_note_tweet:true,raw_text:{text:long}}])).posts[0].text,long);
 for(const r of [{...row(),truncated:true},{...row(),raw_text:null},{...row(),is_note_tweet:true},{...row(),raw_text:{text:'Reset later… https://t.co/xyz'}}]) assert.equal(parseTimeline(page([r])).posts[0].truncated,true);
});
test('head is re-read without since; one old pinned item at the start does not stop pagination',async()=>{
 const urls:string[]=[];
 const request=async(input:RequestInfo|URL)=>{urls.push(String(input));return response(urls.length===1?page([row('1',now-10000),row('2',now)],'next'):page([row('3',now-2000)]));};
 const batch=await collectTimeline({watermark:iso(now-1000),pending:null},request as typeof fetch);
 assert.equal(urls.length,2);assert.ok(urls[1].includes('cursor=next'));assert.ok(urls.every(u=>u.includes('with_replies=1')&&!u.includes('since=')));
 assert.equal(batch.posts.length,3);assert.equal(batch.coverage,'complete');assert.equal(batch.upstream_at,null);
});
test('three-page cap retains cursor and watermark; resuming cannot jump over a newer head gap',async()=>{
 const checkpoint:Checkpoint={watermark:iso(now-10000),pending:null};let calls=0;
 const batch=await collectTimeline(checkpoint,(async()=>response(page([row(String(++calls),now-calls)],`c${calls}`))) as typeof fetch);
 assert.equal(calls,3);assert.equal(batch.coverage,'partial');assert.equal(batch.checkpoint?.watermark,checkpoint.watermark);assert.equal(batch.checkpoint?.pending?.cursor,'c3');
 const expectedTarget=batch.checkpoint!.pending!.target;const urls:string[]=[];
 const resumed=await collectTimeline(batch.checkpoint,(async(input:RequestInfo|URL)=>{
  urls.push(String(input));return response(urls.length===1?page([row('100',now+100)],'head-next'):page([row('4',now-20000)]));
 }) as typeof fetch);
 assert.ok(urls[1].includes('cursor=c3'));assert.equal(resumed.coverage,'complete');assert.equal(resumed.checkpoint?.watermark,expectedTarget);assert.equal(resumed.checkpoint?.pending,null);
 assert.ok(resumed.posts.some(p=>p.id==='100'));
});
test('an unchanged head does not discard an unfinished older cursor',async()=>{
 let calls=0;
 const batch=await collectTimeline({watermark:iso(now),pending:{cursor:'resume',boundary:iso(now-1000),target:iso(now)}},(async(input:RequestInfo|URL)=>{
  calls++;if(calls===2)assert.ok(String(input).includes('cursor=resume'));
  return response(calls===1?page([row('1',now-60)],'other'):page([row('2',now-2000)]));
 }) as typeof fetch);
 assert.equal(calls,2);assert.equal(batch.checkpoint?.watermark,iso(now));
});
test('pagination overlaps do not override the freshest head with stale cursor text',async()=>{
 let calls=0;const r=row();
 const batch=await collectTimeline(undefined,(async()=>response(++calls===1?page([r],'next'):page([{...r,raw_text:{text:'Stale cached text'}}]))) as typeof fetch);
 assert.equal(batch.posts.length,1);assert.equal(batch.posts[0].text,r.raw_text.text);
});
test('rejects unsolicited 204, 403, 429, timeout and malformed content without retries',async()=>{
 for(const status of [204,403,429,500]){
  let calls=0;await assert.rejects(collectTimeline(undefined,(async()=>{calls++;return new Response(null,{status});}) as typeof fetch),new RegExp(`fx_http_${status}`));assert.equal(calls,1);
 }
 await assert.rejects(collectTimeline(undefined,(async()=>{throw new Error('timeout');}) as typeof fetch),/timeout/);
 await assert.rejects(collectTimeline(undefined,(async()=>new Response('<html>challenge</html>')) as typeof fetch),/not_json/);
 await assert.rejects(collectTimeline(undefined,(async()=>new Response('{bad',{headers:{'Content-Type':'application/json'}})) as typeof fetch));
});
test('fails closed on empty target, source error code and repeated cursors',async()=>{
 await assert.rejects(collectTimeline(undefined,(async()=>response(page([]))) as typeof fetch),/empty_target/);
 await assert.rejects(collectTimeline(undefined,(async()=>response({code:500,results:[],cursor:{}})) as typeof fetch),/invalid_timeline/);
 await assert.rejects(collectTimeline(undefined,(async()=>response(page([row()],'same'))) as typeof fetch),/cursor_loop/);
});
test('oversized and stale cached responses are rejected',async()=>{
 await assert.rejects(collectTimeline(undefined,(async()=>new Response(' '.repeat(2_000_001),{headers:{'Content-Type':'application/json'}})) as typeof fetch),/too_large/);
 await assert.rejects(collectTimeline(undefined,(async()=>new Response('{}',{headers:{'Content-Type':'application/json',Age:'3601'}})) as typeof fetch),/expired/);
});
test('checkpoint validation fails before any HTTP request',async()=>{
 let calls=0;await assert.rejects(collectTimeline({watermark:'bad',pending:null},(async()=>{calls++;return response(page([row()]));}) as typeof fetch),/checkpoint/);assert.equal(calls,0);
});
