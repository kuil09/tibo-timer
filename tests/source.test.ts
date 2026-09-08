import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeed, postsFromFeed, fetchFeed } from '../src/source.ts';
const tweet = { id:'123', url:'https://x.com/thsottiaux/status/123', text:'Usage will reset in 3 hours.', at:'2026-09-08T12:00:00Z' };
const feed = () => ({ version:1, stale:false, fetched_at:new Date().toISOString(), tweets:[{...tweet}], events:[] });
test('requires healthy fresh feed and timezone-aware original timestamps',()=>{
 assert.equal(validateFeed(feed()).tweets.length,1);
 for(const value of [null,{}, {...feed(),stale:true},{...feed(),fetched_at:'2020-01-01T00:00:00Z'}, {...feed(),tweets:[{...tweet,at:'2026-09-08T12:00:00'}]}, {...feed(),events:[null]}]) assert.throws(()=>validateFeed(value));
});
test('rejects duplicate identities and mismatched source links',()=>{
 assert.throws(()=>validateFeed({...feed(),tweets:[tweet,tweet]}));
 assert.throws(()=>validateFeed({...feed(),tweets:[{...tweet,url:'https://x.com/thsottiaux/status/999'}]}));
});
test('uses original text and timestamp, never upstream summary or official window',()=>{
 const f=validateFeed({...feed(),events:[{id:'123',summary:'reset in 1 hour',announced_at:'2026-09-08T15:00:00Z',official_window:{start:'wrong'}}]});
 const [post]=postsFromFeed(f); assert.equal(post.text,tweet.text); assert.equal(post.posted_at,tweet.at);
});
test('recognizes explicit and visible truncation',()=>{
 assert.equal(postsFromFeed(validateFeed({...feed(),tweets:[{...tweet,truncated:true}]}))[0].truncated,true);
 assert.equal(postsFromFeed(validateFeed({...feed(),tweets:[{...tweet,text:'The reset will…'}]}))[0].truncated,true);
});
test('fetch rejects HTTP and malformed JSON without treating them as healthy',async(t)=>{
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response('unavailable',{status:503}));
 await assert.rejects(fetchFeed(),/feed_http_503/);
 fetchMock.mock.mockImplementation(async()=>new Response('{bad',{status:200}));
 await assert.rejects(fetchFeed());
});
