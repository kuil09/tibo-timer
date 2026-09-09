import { initAsciiPortrait } from './tibo-ascii.mjs';
import { localTime, headline, countdown } from './view.mjs';
const $ = id => document.getElementById(id);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const sourceURL = url => typeof url === 'string' && /^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(url);
const names = { pending: '해석 대기', complete: '3개 모델 일치', unresolved: '모델 해석 불일치', error: '해석 재확인 필요', source_only: '원문만 제공' };
const analysisNames = { pending: '새 발언 해석 대기', up_to_date: '최신 수집 발언 확인 완료', unresolved: '일치하지 않은 해석이 있습니다', error: '모델 응답 오류 · 예정 시각 확정 안 함', missing_key: '운영 설정 확인 필요', daily_limit: '무료 호출 한도 도달 · 다음 UTC 날짜에 재개', retry_pending: '모델 응답 재시도 대기', source_unavailable: '최신 원문 확인 실패', running: '세 모델이 발언을 해석 중' };
let snapshot, timer;
function renderHero() {
  const hero = headline(snapshot);
  $('hero-title').textContent = hero.title;
  $('hero-label').textContent = hero.post?.result?.event === 'banked_reset' ? '추가 리셋권' : '최근 리셋 공지';
  $('reset-time').textContent = '';
  $('countdown').textContent = '';
  const time = hero.post?.result?.time;
  if (time && ['scheduled', 'elapsed'].includes(hero.kind)) {
    $('reset-time').textContent = `${localTime(time.at, zone)}${time.kind === 'approximate' ? '경' : time.kind === 'deadline' ? ' 이전' : ''}`;
    if (hero.kind === 'scheduled' && time.kind === 'exact') $('countdown').textContent = `${countdown(time.at)} 남음`;
  }
  $('hero-note').textContent = hero.kind === 'elapsed' ? '예정 시각 경과는 실제 리셋 완료를 뜻하지 않습니다.' : hero.kind === 'completed' ? '발언에 따른 안내입니다. 개인 계정의 실제 리셋 여부는 확인하지 않습니다.' : hero.kind === 'stale' ? '이전 데이터는 아래에 남겨두되, 현재 예정 시각으로 안내하지 않습니다.' : hero.kind === 'pending' ? '새 발언의 해석이 확인되기 전에는 이전 예정 시각을 현재 일정으로 표시하지 않습니다.' : '예정 시각은 실제 계정의 리셋을 보장하지 않습니다.';
  $('hero-source').hidden = !sourceURL(hero.post?.url);
  if (!$('hero-source').hidden) $('hero-source').href = hero.post.url;
}
function render() {
  renderHero();
  $('timezone').textContent = `표시 시간대: ${zone} · 기기 설정 기준`;
  $('freshness').textContent = snapshot.last_success_at ? `마지막 수집 성공: ${localTime(snapshot.last_success_at, zone)} · 약 20분 간격으로 확인` : '아직 수집에 성공한 발언이 없습니다.';
  $('analysis').textContent = `AI: ${analysisNames[snapshot.analysis_status] ?? '모델 이용 불가 · 확인 필요'}`;
  $('posts').replaceChildren();
  if (!snapshot.posts.length) { const p = document.createElement('p'); p.textContent = '최근 24시간의 수집된 발언이 없습니다.'; $('posts').append(p); }
  for (const post of snapshot.posts) {
    const article = document.createElement('article'), meta = document.createElement('div'), date = document.createElement('a'), badge = document.createElement('span'), quote = document.createElement('blockquote');
    meta.className = 'meta'; date.textContent = localTime(post.posted_at, zone);
    if (sourceURL(post.url)) { date.href = post.url; date.target = '_blank'; date.rel = 'noopener noreferrer'; }
    badge.textContent = names[post.status] ?? '확인 필요'; meta.append(date, badge); quote.textContent = post.text; article.append(meta, quote);
    if (post.result?.state === 'scheduled') {
      const p = document.createElement('p'), r = post.result;
      p.textContent = `${r.event === 'banked_reset' ? '추가 리셋권 지급' : '사용량 리셋'} · ${r.conditional ? '조건부 공지' : r.time ? localTime(r.time.at, zone) + (r.time.kind === 'approximate' ? '경' : r.time.kind === 'deadline' ? ' 이전' : '') : '시각 미정'}`;
      article.append(p);
    }
    if (post.votes?.length) {
      const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = '모델별 확인 내용'; details.append(summary);
      for (const vote of post.votes) {
        const p = document.createElement('p'); p.className = 'vote';
        p.textContent = `${vote.model}\n${vote.claim ? vote.claim.event === 'none' ? '리셋 공지가 아님' : (vote.claim.evidence || '시각 미정') : '응답을 확인하지 못함'}`;
        details.append(p);
      }
      article.append(details);
    }
    $('posts').append(article);
  }
  clearInterval(timer); timer = setInterval(renderHero, 1000);
}
async function refresh() {
  try {
    const response = await fetch('status.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('status_unavailable');
    const value = await response.json();
    if (value.schema_version !== 2 || !Array.isArray(value.posts)) throw new Error('status_invalid');
    snapshot = value; render();
  } catch {
    clearInterval(timer);
    $('hero-title').textContent = '최신 정보를 불러오지 못했습니다';
    $('reset-time').textContent = ''; $('countdown').textContent = ''; $('hero-source').hidden = true;
    $('hero-note').textContent = '연결이 복구되면 다시 확인합니다. 이전 시각을 현재 일정으로 안내하지 않습니다.';
  }
}
initAsciiPortrait($('tibo-ascii-canvas'), $('tibo-ascii-fallback'));
refresh(); setInterval(refresh, 60000);
