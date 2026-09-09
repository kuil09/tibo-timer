import { readFile } from 'node:fs/promises';
import { collectTimeline, AUTHOR } from './sources/fxembed.ts';
import { writeJson } from './storage.ts';

// No model, credentials, data commit or deployment. Keep only minimal source evidence.
const batch=await collectTimeline();
await writeJson('.cache/timeline-probe.json',{
  run_url:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  at:batch.checked_at,provider:batch.provider,author:AUTHOR,posts:batch.posts.length,
  replies:batch.posts.filter(p=>p.kind==='reply').length,long_posts:batch.posts.filter(p=>p.text.length>280).length,
  truncated:batch.posts.filter(p=>p.truncated).length,coverage:batch.coverage,
  checkpoint:batch.checkpoint,
  samples:batch.posts.slice(0,3).map(({id,url,posted_at,truncated})=>({id,url,posted_at,truncated})),
});
console.log(await readFile('.cache/timeline-probe.json','utf8'));
