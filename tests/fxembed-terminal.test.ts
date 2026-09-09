import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHOR, collectTimeline, parseTimeline } from '../src/sources/fxembed.ts';
const seconds=Math.floor(Date.now()/1000)-60;
const post={type:'status',id:'123',url:'https://x.com/thsottiaux/status/123',text:'Reset soon.',raw_text:{text:'Reset soon.'},author:{id:AUTHOR.id,screen_name:AUTHOR.handle},created_timestamp:seconds,created_at:new Date(seconds*1000).toUTCString()};
const response=(results:unknown[],cursor:string|null)=>new Response(JSON.stringify({code:200,results,cursor:{bottom:cursor}}),{headers:{'Content-Type':'application/json'}});

test('empty cursor response ends provider pagination even if the cursor is repeated',async()=>{
 let calls=0;
 const batch=await collectTimeline(undefined,(async()=>++calls===1?response([post],'terminal'):response([],'terminal')) as typeof fetch);
 assert.equal(calls,2);assert.equal(batch.coverage,'complete');assert.equal(batch.checkpoint?.pending,null);
 assert.equal(batch.posts.length,1);assert.equal(batch.checkpoint?.watermark,new Date(seconds*1000).toISOString());
 // Completion is of the available provider scan, not proof of a full X archive.
 assert.equal(batch.upstream_at,null);
});
test('empty terminal page also ends a saved backlog after retaining the fresh head',async()=>{
 let calls=0;const target=new Date((seconds-100)*1000).toISOString();
 const batch=await collectTimeline({watermark:null,pending:{cursor:'terminal',boundary:new Date((seconds-86400)*1000).toISOString(),target}},(async()=>++calls===1?response([post],'head'):response([],'terminal')) as typeof fetch);
 assert.equal(batch.coverage,'complete');assert.equal(batch.checkpoint?.watermark,target);assert.equal(batch.posts[0].id,'123');
});
test('foreign-only repeated-cursor pages are not mistaken for terminal empty responses',async()=>{
 const foreign={...post,author:{id:'999',screen_name:'someone'}};
 assert.equal(parseTimeline({code:200,results:[foreign],cursor:{bottom:'same'}}).empty,false);
 let calls=0;
 await assert.rejects(collectTimeline(undefined,(async()=>response(++calls===1?[post]:[foreign],'same')) as typeof fetch),/fx_cursor_loop/);
});
