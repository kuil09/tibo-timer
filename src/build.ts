import { emptyCouncil } from './publish-council.ts';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const doc=JSON.parse(await readFile('data/events.json','utf8'));
const state=JSON.parse(await readFile('data/state.json','utf8'));
doc.collection={last_attempt_at:state.last_attempt_at,last_error:state.last_error};
if(doc.schema_version!==1||!Array.isArray(doc.events))throw new Error('Invalid publication schema');
await writeFile('dist/events.json',JSON.stringify(doc));
await writeFile('dist/.nojekyll','');
console.log(`Built ${doc.events.length} source records`);

let council;
try { council=JSON.parse(await readFile('data/council.json','utf8')); } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; council=emptyCouncil(); }
if(council.schema_version!==1||!Array.isArray(council.attempts))throw new Error('Invalid council publication schema');
await writeFile('dist/council.json',JSON.stringify(council));
