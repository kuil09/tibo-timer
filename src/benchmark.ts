import {readFile} from 'node:fs/promises';
import {extract} from './inference.ts';
import {writeJson} from './storage.ts';
const samples=JSON.parse(await readFile('eval/cases.json','utf8')).filter((c:{split:string})=>c.split==='dev').slice(0,5);
const rounds=[];
for(const label of ['cold_first_five','warm_five']) {
 const start=performance.now();let errors=0;
 for(const s of samples)try{await extract(s.text);}catch{errors++;}
 rounds.push({label,seconds:(performance.now()-start)/1000,errors});
}
const prepared=JSON.parse(await readFile('.cache/cpu/prepared.json','utf8'));
const startup=Number(process.env.STARTUP_SECONDS??0);
const pid=(await readFile('.cache/cpu/server.pid','utf8')).trim();
const status=await readFile(`/proc/${pid}/status`,'utf8');
const peak=Number(status.match(/VmHWM:\s+(\d+)/)?.[1]??0);
const cold=prepared.prepare_seconds+startup+rounds[0].seconds;
await writeJson(`.cache/evaluation/${process.env.MODEL_ID}-benchmark.json`,{model:process.env.MODEL_ID,measurement_mode:prepared.model_cache_hit?'cached_load':'fresh_download',cold_proof_eligible:!prepared.model_cache_hit,prepared,startup_seconds:startup,rounds,cold_total_seconds:cold,server_peak_rss_kib:peak,
 performance_passed:!prepared.model_cache_hit&&cold<600&&rounds[1].seconds<300&&rounds.every(r=>r.errors===0)&&peak>0});
console.log(JSON.stringify({model:process.env.MODEL_ID,cold,rounds,server_peak_rss_kib:peak}));
