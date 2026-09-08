import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const doc=JSON.parse(await readFile('data/events.json','utf8'));
if(doc.schema_version!==1||!Array.isArray(doc.events))throw new Error('Invalid publication schema');
await writeFile('dist/events.json',JSON.stringify(doc));
await writeFile('dist/.nojekyll','');
console.log(`Built ${doc.events.length} source records`);
