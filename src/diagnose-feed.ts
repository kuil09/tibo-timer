import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateFeed } from './source.ts';
import { writeJson } from './storage.ts';
const exec = promisify(execFile);
const url = 'https://codex-reset.com/api/feed';
const originalHeaders = { Accept: 'application/json', 'User-Agent': 'tibo-timer/1.0 (+https://github.com/kuil09/tibo-timer)' };
const browserHeaders = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
interface ResponseData {status:number;content_type:string|null;cf_mitigated:string|null;body:string;}
export function assessResponse(response:ResponseData) {
  let valid=false, schema_error:string|null=null, posts:number|null=null;
  try {
    if(response.status!==200)throw new Error(`http_${response.status}`);
    if(!/^application\/json(?:\s*;|$)/i.test(response.content_type??''))throw new Error('not_json_content_type');
    if(response.body.length>2_000_000)throw new Error('response_too_large');
    const feed=validateFeed(JSON.parse(response.body));valid=true;posts=feed.tweets.length;
  }catch(error){schema_error=error instanceof Error?error.message:String(error);}
  return {status:response.status,content_type:response.content_type,cf_mitigated:response.cf_mitigated,body_excerpt:response.body.slice(0,700),valid_feed:valid,schema_error,posts};
}
async function nodeRequest(headers:Record<string,string>):Promise<ResponseData>{
  const res=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(20_000)});
  return {status:res.status,content_type:res.headers.get('content-type'),cf_mitigated:res.headers.get('cf-mitigated'),body:await res.text()};
}
async function curlRequest(headers:Record<string,string>, index:number):Promise<ResponseData>{
  const prefix=`.cache/feed-diagnosis/response-${index}`;
  const args=['--silent','--show-error','--compressed','--max-time','20','--dump-header',prefix+'.headers','--output',prefix+'.body','--write-out','%{http_code}'];
  for(const [key,value] of Object.entries(headers))args.push('--header',`${key}: ${value}`);
  args.push(url);
  const out=await exec('curl',args,{timeout:22_000});
  const raw=await readFile(prefix+'.headers','utf8');
  const get=(key:string)=>[...raw.matchAll(new RegExp(`^${key}:\\s*(.+)$`,'gmi'))].at(-1)?.[1].trim()??null;
  return {status:Number(out.stdout.trim()),content_type:get('content-type'),cf_mitigated:get('cf-mitigated'),body:await readFile(prefix+'.body','utf8')};
}
export async function main(){
  await mkdir('.cache/feed-diagnosis',{recursive:true});
  const variants=[{name:'node_current',client:'node',headers:originalHeaders},{name:'curl_same_application_headers',client:'curl',headers:originalHeaders},{name:'node_browser_user_agent',client:'node',headers:browserHeaders}];
  const results:Record<string,any>[]=[];
  async function run(v:typeof variants[number], recheck=false){
    const started=new Date().toISOString();
    try {
      const response=await (v.client==='curl'?curlRequest(v.headers,results.length):nodeRequest(v.headers));
      const result={name:v.name,recheck,started_at:started,request_headers:v.headers,...assessResponse(response)};
      results.push(result);console.log(JSON.stringify(result));
    }catch(error){const result={name:v.name,recheck,started_at:started,request_headers:v.headers,valid_feed:false,error:error instanceof Error?error.message:String(error)};results.push(result);console.log(JSON.stringify(result));}
  }
  // Exactly three controlled probes. Never retry failed/challenged requests.
  for(const v of variants)await run(v);
  const successful=variants.find(v=>results.find(r=>r.name===v.name)?.valid_feed);
  if(successful)await run(successful,true); // One confirmation only, on this same runner.
  const confirmation=results.find(r=>r.recheck);
  await writeJson('.cache/feed-diagnosis/report.json',{version:1,url,run_url:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,runner:process.env.RUNNER_NAME,node_version:process.version,request_count:results.length,
    note:'Identical application-specified headers for variants 1 and 2; implicit transport headers and TLS/HTTP fingerprints remain client-dependent. No cookies, redirects, retries, IP rotation or challenge solving.',
    verified_combination:confirmation?.valid_feed?confirmation.name:null,results});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
