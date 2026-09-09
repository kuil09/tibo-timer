import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fetchFeed, postsFromFeed } from './sources/codex-reset.ts';
import { collectTimeline, type Checkpoint } from './sources/fxembed.ts';
export { fetchFeed, postsFromFeed, validateFeed, type Feed } from './sources/codex-reset.ts';
export interface SourcePost { id:string; url:string; text:string; posted_at:string; truncated:boolean; kind:string; observation?:{at:string;result:string}; }
export interface SourceBatch {
  provider:'fxembed'|'codex-reset'; posts:SourcePost[]; checked_at:string;
  upstream_at:string|null; coverage:'complete'|'partial'; raw:unknown;
  checkpoint?:Checkpoint;
}
export const hash = (value:unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function fetchSource(checkpoint?:Checkpoint):Promise<SourceBatch> {
  const config=JSON.parse(await readFile('config/source.json','utf8'));
  if(config.provider==='fxembed') return collectTimeline(checkpoint);
  if(config.provider==='codex-reset') {
    const feed=await fetchFeed();
    return {provider:'codex-reset',posts:postsFromFeed(feed),checked_at:new Date().toISOString(),upstream_at:feed.fetched_at,coverage:'complete',raw:feed};
  }
  throw new Error('unknown_source_provider');
}
