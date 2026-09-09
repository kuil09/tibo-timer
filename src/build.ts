import { emptyCouncil } from './publish-council.ts';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const doc=JSON.parse(await readFile('data/events.json','utf8'));
const state=JSON.parse(await readFile('data/state.json','utf8'));
const selection=JSON.parse(await readFile('config/selection.json','utf8'));
const source=JSON.parse(await readFile('config/source.json','utf8'));
doc.analysis={enabled:selection.enabled,model:selection.model,activation:selection.activation??null,acceptance_status:selection.acceptance_status??null,last_run_at:state.analysis?.last_run_at??null,last_success_at:state.analysis?.last_success_at??null,attempted:state.analysis?.attempted??0,succeeded:state.analysis?.succeeded??0,failed:state.analysis?.failed??0,deferred:state.analysis?.deferred??0};
doc.collection={mode:source.mode??'incremental',lookback_hours:source.lookback_hours??null,last_attempt_at:state.last_attempt_at,last_error:state.last_error,provider:state.collection?.provider??null,coverage:state.collection?.coverage??null,checked_at:state.collection?.checked_at??null,upstream_at:state.collection?.upstream_at??null};
if(doc.schema_version!==1||!Array.isArray(doc.events))throw new Error('Invalid publication schema');
await writeFile('dist/events.json',JSON.stringify(doc));
await writeFile('dist/.nojekyll','');
console.log(`Built ${doc.events.length} source records`);

let council;
try { council=JSON.parse(await readFile('data/council.json','utf8')); } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; council=emptyCouncil(); }
if(council.schema_version!==1||!Array.isArray(council.attempts))throw new Error('Invalid council publication schema');
await writeFile('dist/council.json',JSON.stringify(council));

await writeFile('dist/version.json',JSON.stringify({commit:process.env.GITHUB_SHA??'local',built_at:new Date().toISOString()}));
