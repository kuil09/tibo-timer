import type { SourceBatch, SourcePost } from '../source.ts';

// Confirmed independently in both runner probes in Actions run 34310903217.
export const AUTHOR = {handle:'thsottiaux', id:'1953337039510003712'} as const;
export const ENDPOINT = `https://api.fxtwitter.com/2/profile/${AUTHOR.handle}/statuses`;
const MAX_BYTES=2_000_000, MAX_PAGES=3, INITIAL_DAYS=14;
interface Pending {cursor:string; boundary:string; target:string;}
export interface Checkpoint {watermark:string|null; pending:Pending|null;}
interface Page {posts:SourcePost[]; cursor:string|null; raw:unknown[]; empty:boolean;}
type ObjectValue=Record<string,unknown>;
function object(value:unknown):value is ObjectValue {return !!value && typeof value==='object' && !Array.isArray(value);}
function numeric(value:unknown):value is string {return typeof value==='string' && /^\d+$/.test(value);}
function instant(value:unknown):value is string {return typeof value==='string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value);}
function validCursor(value:unknown):value is string {return typeof value==='string' && value.length>0 && value.length<=4096;}

export function parseTimeline(value:unknown):Page {
  if(!object(value) || value.code!==200 || !Array.isArray(value.results) || !object(value.cursor)) throw new Error('fx_invalid_timeline');
  const bottom=value.cursor.bottom;
  if(bottom!==null && bottom!==undefined && !validCursor(bottom)) throw new Error('fx_invalid_cursor');
  const unique=new Map<string,SourcePost>(), raw:unknown[]=[];
  for(const entry of value.results) {
    if(!object(entry)) throw new Error('fx_invalid_entry');
    if(entry.type==='tombstone') continue;
    if(entry.type!=='status' || !object(entry.author)) throw new Error('fx_invalid_status');
    const author=entry.author;
    if(!numeric(author.id) || typeof author.screen_name!=='string') throw new Error('fx_invalid_author');
    const matchingHandle=author.screen_name.toLowerCase()===AUTHOR.handle;
    const matchingId=author.id===AUTHOR.id;
    if(matchingHandle!==matchingId) throw new Error('fx_author_identity_changed');
    // with_replies also returns OTHER authors' conversation parents. Never recurse into quote.
    if(!matchingId) continue;
    // Media-only display text may be empty while raw_text retains the original URL.
    if(!numeric(entry.id) || typeof entry.text!=='string' || typeof entry.url!=='string') throw new Error('fx_invalid_post');
    if(entry.url!==`https://x.com/${AUTHOR.handle}/status/${entry.id}`) throw new Error('fx_mismatched_url');
    if(typeof entry.created_timestamp!=='number' || !Number.isSafeInteger(entry.created_timestamp) || entry.created_timestamp<=0 || entry.created_timestamp*1000>Date.now()+300_000) throw new Error('fx_invalid_timestamp');
    if(typeof entry.created_at!=='string' || Math.abs(Date.parse(entry.created_at)-entry.created_timestamp*1000)>1000 || !Number.isFinite(Date.parse(entry.created_at))) throw new Error('fx_timestamp_mismatch');
    const original=object(entry.raw_text) && typeof entry.raw_text.text==='string' ? entry.raw_text.text : null;
    const text=original??entry.text;
    if(!text.trim() || text.length>100_000) throw new Error('fx_invalid_text');
    // raw_text retains original mentions/links; never use translated text or quote.text.
    // Absence of truncation metadata is not proof of completeness.
    const truncated=entry.truncated===true || original===null ||
      /(?:…|\.\.\.)\s*(?:https:\/\/t\.co\/\S+\s*)*$/.test(text) ||
      (entry.is_note_tweet===true && text.length<=280);
    const post:SourcePost={id:entry.id,url:entry.url,text,posted_at:new Date(entry.created_timestamp*1000).toISOString(),truncated,kind:object(entry.replying_to)?'reply':'post'};
    const prior=unique.get(post.id);
    if(prior && JSON.stringify(prior)!==JSON.stringify(post)) throw new Error('fx_conflicting_duplicate');
    if(!prior) {
      unique.set(post.id,post);
      raw.push({id:post.id,author_id:author.id,screen_name:author.screen_name,text:post.text,url:post.url,created_at:entry.created_at,created_timestamp:entry.created_timestamp,is_note_tweet:entry.is_note_tweet??null,truncated:post.truncated,
        reply_to:object(entry.replying_to)&&numeric(entry.replying_to.status)?entry.replying_to.status:null,
        quote_id:object(entry.quote)&&numeric(entry.quote.id)?entry.quote.id:null});
    }
  }
  return {posts:[...unique.values()],cursor:bottom==null?null:bottom as string,raw,empty:value.results.length===0};
}

async function readPage(cursor:string|null, request:typeof fetch):Promise<Page> {
  const url=new URL(ENDPOINT);url.searchParams.set('count','50');url.searchParams.set('with_replies','1');
  if(cursor) url.searchParams.set('cursor',cursor);
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(20_000),headers:{Accept:'application/json','User-Agent':'tibo-timer/1.0 (+https://github.com/kuil09/tibo-timer)'}});
  // We intentionally do not use since: refetching the head detects edits as well as new posts.
  // Therefore an unsolicited 204 is not proof that the original data is current.
  if(response.status!==200) throw new Error(`fx_http_${response.status}`);
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')) throw new Error('fx_not_json');
  const age=Number(response.headers.get('age')??0);
  if(!Number.isFinite(age) || age>3600) throw new Error('fx_cached_response_expired');
  if(Number(response.headers.get('content-length')??0)>MAX_BYTES) throw new Error('fx_response_too_large');
  const reader=response.body?.getReader();if(!reader) throw new Error('fx_empty_body');
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done) break;
      size+=value.byteLength;
      if(size>MAX_BYTES) {await reader.cancel();throw new Error('fx_response_too_large');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  return parseTimeline(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}

// A pinned/old item near the beginning is not an overlap. Only a target-authored
// trailing item can end this incremental scan. Provider coverage is still best-effort.
function crossed(page:Page,boundary:string):boolean {
  const last=page.posts.at(-1);return !!last && Date.parse(last.posted_at)<=Date.parse(boundary);
}
export async function collectTimeline(checkpoint?:Checkpoint, request:typeof fetch=fetch):Promise<SourceBatch> {
  if(checkpoint) {
    if((checkpoint.watermark!==null && !instant(checkpoint.watermark)) ||
      (checkpoint.pending!==null && (!object(checkpoint.pending) || !validCursor(checkpoint.pending.cursor) || !instant(checkpoint.pending.boundary) || !instant(checkpoint.pending.target)))) throw new Error('fx_invalid_checkpoint');
  }
  const checked_at=new Date().toISOString();
  const first=await readPage(null,request);
  if(first.posts.length===0) throw new Error('fx_empty_target_timeline');
  const pages=[first];
  const newest=first.posts.reduce((a,p)=>p.posted_at>a?p.posted_at:a,'');
  const pending=checkpoint?.pending;
  const boundary=pending?.boundary??checkpoint?.watermark??new Date(Date.now()-INITIAL_DAYS*86_400_000).toISOString();
  // During backlog recovery, fresh head records are stored, but MUST NOT advance
  // the old scan's target. The next scan closes the newer gap separately.
  const target=pending?.target??newest;
  let cursor=pending?.cursor??first.cursor;
  if(!pending && crossed(first,boundary)) cursor=null;
  const visited=new Set<string>();
  while(cursor && pages.length<MAX_PAGES) {
    if(visited.has(cursor)) throw new Error('fx_cursor_loop');
    visited.add(cursor);
    const page=await readPage(cursor,request);pages.push(page);
    // FxEmbed can return an empty terminal page with the unchanged cursor.
    // Count original entries, not author-filtered posts: foreign-only pages are not empty.
    if(page.empty) {cursor=null;break;}
    if(page.cursor===cursor) throw new Error('fx_cursor_loop');
    cursor=crossed(page,boundary)?null:page.cursor;
  }
  const posts=new Map<string,SourcePost>();
  // The freshly fetched head wins over overlapping older cursor results.
  for(const page of pages) for(const post of page.posts) if(!posts.has(post.id)) posts.set(post.id,post);
  const watermark=checkpoint?.watermark??null;
  return {provider:'fxembed',posts:[...posts.values()],checked_at,upstream_at:null,coverage:cursor?'partial':'complete',
    checkpoint:{watermark:cursor?watermark:[watermark??'',target].sort().at(-1)!,pending:cursor?{cursor,boundary,target}:null},
    raw:{provider:'fxembed',checked_at,upstream_at:null,pages:pages.map(p=>({posts:p.raw,next_cursor:p.cursor,empty:p.empty}))}};
}
