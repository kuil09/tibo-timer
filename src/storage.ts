import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
export async function readJson<T>(file:string):Promise<T> { return JSON.parse(await readFile(file,'utf8')); }
export async function writeJson(file:string,value:unknown) {
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');
  await rename(file+'.tmp',file);
}
