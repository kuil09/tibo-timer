import {readJson,writeJson} from '../src/storage.ts';
import {interpret} from '../src/sync.ts';
const selection=await readJson<{model:string}>('config/selection.json');
const cases=[
 {text:'Look! A fish!',type:'unknown',state:'unknown'},
 {text:'See you at the party. Excited to meet some of you.',type:'unknown',state:'unknown'},
 {text:'Will usage reset today?',state:'unknown'},
 {text:'Usage will reset for everyone in 2 hours.',type:'reset',state:'scheduled'},
 {text:'Usage has now been reset for everyone.',type:'reset',state:'completed'},
 {text:'We will not reset usage today.',state:'unknown'},
 {text:'Last year we reset usage during a launch.',state:'retrospective'}
];
const report=[];
for(const [i,c] of cases.entries()) {
 const post={id:String(i),url:`https://x.com/thsottiaux/status/${i}`,text:c.text,posted_at:new Date().toISOString(),truncated:false,kind:'post'};
 const result=await interpret(post,selection.model);
 const passed=result.interpretation.method==='cpu-model'&&result.event.state===c.state&&(!c.type||result.event.type===c.type);
 report.push({text:c.text,expected:c,actual:result.event,method:result.interpretation.method,reason:result.temporal.reason,passed});
 console.log(JSON.stringify(report.at(-1)));
}
await writeJson('.cache/automatic-ai-smoke.json',{at:new Date().toISOString(),model:selection.model,cases:report,passed:report.every(r=>r.passed),note:'Focused operational smoke cases, not unseen model acceptance.'});
if(report.some(r=>!r.passed)) throw new Error('automatic_ai_semantic_smoke_failed');
