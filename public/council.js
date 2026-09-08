const labels={scheduled:'예정 공지',completed:'완료 발언',retrospective:'과거 회고',unknown:'판단 미정'};
const types={reset:'일반 Reset',banked_reset:'Banked 지급',unknown:'유형 미정'};
const statuses={valid:'해석 제출',invalid:'검증 실패',timeout:'응답 시간 초과',not_run:'호출 전 중단',error:'응답 실패'};
const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
export async function mountCouncil(events){
  let doc;
  try {const r=await fetch('./council.json',{cache:'no-store'});if(!r.ok)throw Error();doc=await r.json();if(doc.schema_version!==1||!Array.isArray(doc.attempts))throw Error();}catch{empty('회의 기록을 불러오지 못했습니다.');return;}
  const event=events.find(e=>e.id===doc.source_id);
  if(!event||!doc.attempts.length){empty('아직 완료된 회의 기록이 없습니다.');return;}
  // A result belongs to the exact source version, never a subsequently edited post.
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(event.source.text));
  const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==doc.source_hash){empty('원문이 수정되어 다시 검토해야 합니다.');return;}
  document.querySelector('#agenda-text').textContent=event.source.text;
  document.querySelector('#agenda-meta').textContent=new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.source.posted_at));
  const link=document.querySelector('#run-link');
  if(/^https:\/\/github\.com\/kuil09\/tibo-timer\/actions\/runs\/\d+$/.test(doc.run_url||'')){link.href=doc.run_url;link.hidden=false;}
  document.querySelector('#council-status').textContent=doc.status==='completed'?'검토 기록 도착':'검토 중단 · 결론 미해결';
  document.querySelector('#council-time').textContent=doc.run_at?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(doc.run_at)):'실행 시각 미확인';
  const select=document.querySelector('#attempt-select');select.replaceChildren();select.disabled=false;
  doc.attempts.forEach((a,i)=>{const o=node('option','',`${a.attempt}차 검토${i===doc.attempts.length-1?' · 마지막 시도':''}`);o.value=String(i);select.append(o);});
  let activeSeat=0;
  function draw(){
    const attempt=doc.attempts[Number(select.value)];
    document.querySelectorAll('.speech').forEach((button,i)=>{
      const m=attempt.models[i];button.classList.toggle('active',i===activeSeat);button.setAttribute('aria-pressed',String(i===activeSeat));
      button.querySelector('.speaker').textContent=shortName(m?.id);
      const c=m?.claim;
      button.querySelector('.speech-copy').textContent=m?.status==='timeout'?'응답 시간\n초과…':m?.status==='not_run'?'아직\n차례가…':c?`${c.state==='retrospective'?'과거 이야기':labels[c.state]||'판단 미정'}${m.status==='invalid'?'\n검증 실패':''}`:'해석을\n확인 못했어';
      button.setAttribute('aria-label',`${shortName(m?.id)} · ${statuses[m?.status]||'기록 없음'} · 상세 해석 보기`);
    });
    const final=Number(select.value)===doc.attempts.length-1;
    document.querySelector('#council-verdict').textContent=final&&doc.result==='corroborated'?`${labels[attempt.models[0]?.claim?.state]||'판단 미정'}로 의견 일치.\n${attempt.models[0]?.claim?.time_expression ? attempt.models[0].claim.time_expression.slice(0,28)+(attempt.models[0].claim.time_expression.length>28?'…':'') : '다음 Reset 시각 미정.'}`:final?(doc.status==='completed'?'의견이 엇갈립니다.\n시각 확정은 보류합니다.':'삼자 검증, 미완료.\n다음 Reset 시각 미정.'):'이 회의는 중단됐습니다.\n다음 모델로 다시 검토.';
    const detail=document.querySelector('#model-detail');detail.replaceChildren();
    const m=attempt.models[activeSeat];if(!m)return;
    const head=node('div','detail-heading','');head.append(node('span','detail-index',`0${activeSeat+1}`),node('h3','',shortName(m.id)),node('span','detail-status',statuses[m.status]||'기록 없음'));detail.append(head);
    detail.append(node('p','model-id',m.id));
    if(m.claim){
      const c=m.claim;detail.append(node('p','claim-summary',`${types[c.event_type]||'유형 미정'} · ${labels[c.state]||'판단 미정'}${c.conditional?' · 조건부':''}`));
      detail.append(node('blockquote','evidence',c.evidence||'선택한 원문 근거 없음'));
      detail.append(node('p','detail-note',c.time_expression?`시간 표현: ${c.time_expression}`:'초기화 시각으로 해석할 수 있는 시간 표현을 제출하지 않았습니다.'));
      if(m.status!=='valid')detail.append(node('p','invalid-notice','검증을 통과하지 못한 모델의 발언입니다. 확정된 해석으로 사용하지 않습니다.'));
    }else detail.append(node('p','detail-note',m.status==='not_run'?'앞선 모델의 오류로 이 차수에서는 호출되지 않았습니다.':m.status==='timeout'?'제한 시간 안에 응답하지 못했습니다. 이 모델의 해석은 없습니다.':'사용할 수 있는 해석을 받지 못했습니다.'));
  }
  select.value=String(doc.attempts.length-1);select.addEventListener('change',()=>{activeSeat=0;draw();});
  document.querySelectorAll('.speech').forEach((b,i)=>b.addEventListener('click',()=>{activeSeat=i;draw();}));draw();
}
function shortName(id){if(!id)return '대기 중';const known={'nvidia/nemotron-3-ultra-550b-a55b:free':'Nemotron Ultra','nvidia/nemotron-3.5-lightning:free':'Nemotron Lightning','nvidia/nemotron-3-super-120b-a12b:free':'Nemotron Super','google/gemma-4-31b-it:free':'Gemma 4','cohere/north-mini-code:free':'North Mini Code'};return known[id]||id.split('/').pop().replace(/:free$/,'');}
function empty(message){document.querySelector('#council-status').textContent=message;document.querySelector('#agenda-text').textContent='확인 가능한 모델 회의 기록이 없습니다.';document.querySelector('#council-verdict').textContent='아직 결론을\n내리지 못했습니다.';document.querySelectorAll('.speech').forEach(b=>b.disabled=true);}
