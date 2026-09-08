import { TYPE_LABELS, nextEvent, sourceUrl, stateLabel, temporalLabel, formatInstant, countdown, isStale } from './view.js';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
let dataset = null;
let items = [];
const counters = [];
document.querySelector('#timezone').textContent = zone;

function source(item) {
  const box = el('div', 'source');
  box.append(el('blockquote', '', item.source.text || '원문이 제공되지 않았습니다.'));
  const meta = el('div', 'source-meta');
  meta.append(el('span', '', `게시 ${formatInstant(item.source.posted_at, zone)}`));
  const url = sourceUrl(item.source.url);
  if (url) {
    const link = el('a', '', '원문 보기 ↗');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    meta.append(link);
  } else meta.append(el('span', '', '원문 링크 미확인'));
  box.append(meta);
  if (item.interpretation?.method === 'source-only') box.append(el('p', 'quiet interpretation', '원문만 표시 · 공지의 의미와 시각은 아직 검증되지 않았습니다.'));
  return box;
}

function render() {
  counters.length = 0;
  const cards = document.querySelector('#schedules');
  cards.replaceChildren();
  for (const [index, type] of ['reset', 'banked_reset'].entries()) {
    const card = el('article', `schedule ${type === 'reset' ? 'primary' : ''}`);
    const title = el('div', 'card-head');
    title.append(el('span', 'card-number', `0${index + 1}`), el('h2', '', TYPE_LABELS[type]));
    card.append(title, el('p', 'card-description', type === 'reset' ? '일반 사용량 한도의 초기화 공지' : '필요할 때 사용할 수 있는 Reset의 지급 공지'));
    const next = nextEvent(items, type);
    if (next) {
      card.append(el('p', 'schedule-time', temporalLabel(next.temporal, zone)));
      const ticker = el('p', 'countdown', countdown(next));
      card.append(ticker);
      counters.push({ node: ticker, item: next });
      card.append(source(next));
    } else {
      card.append(el('p', 'schedule-time unknown-time', type === 'reset' ? '다음 Reset 시각 미정' : '다음 지급 시각 미정'));
      card.append(el('p', 'quiet', '확인 가능한 미래 시각이 아직 없습니다.'));
    }
    const latest = items.find(item => item.event.type === type);
    if (latest) {
      const latestBox = el('div', 'latest');
      latestBox.append(el('span', 'mini-label', '최근 공지'), el('p', 'latest-state', stateLabel(latest)));
      if (!next || next.id !== latest.id) {
        latestBox.append(el('p', 'quiet', temporalLabel(latest.temporal, zone)), source(latest));
      }
      card.append(latestBox);
    }
    cards.append(card);
  }
  const list = document.querySelector('#events');
  list.replaceChildren();
  document.querySelector('#event-count').textContent = `${items.length}개 기록`;
  if (!items.length) list.append(el('p', 'empty', '아직 수집된 공지가 없습니다. 다음 수집이 끝나면 여기에 표시됩니다.'));
  for (const item of items) {
    const article = el('article', 'event');
    const top = el('div', 'event-meta');
    top.append(el('span', 'type-label', TYPE_LABELS[item.event.type] || TYPE_LABELS.unknown), el('span', 'state-label', stateLabel(item)));
    article.append(top, el('h3', '', temporalLabel(item.temporal, zone)));
    if (item.temporal.original) article.append(el('p', 'expression', `시간 표현: ${item.temporal.original}`));
    if (item.temporal.kind === 'unresolved') article.append(el('p', 'quiet', '근거가 충분한 시각으로 변환되지 않았습니다. 원문을 확인해 주세요.'));
    if (item.event.audience?.length) article.append(el('p', 'quiet', `대상: ${item.event.audience.join(', ')}`));
    if (item.observation) {
      const result = item.observation.result === 'reset_observed' ? 'Reset 관측 기록' : '별도 관측 기록';
      article.append(el('p', 'quiet observation', `운영자 관측 정보 · ${formatInstant(item.observation.at, zone)} · ${result}. 티보의 완료 공지나 개인 계정 확인을 뜻하지 않습니다.`));
    }
    article.append(source(item));
    list.append(article);
  }
}

function tick() {
  document.querySelector('#local-clock').textContent = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  counters.forEach(({ node, item }) => { node.textContent = countdown(item); });
  if (!dataset) return;
  const stale = isStale(dataset.last_success_at);
  const collectionFailed = dataset.collection?.last_error != null;
  const status = document.querySelector('#status');
  status.classList.toggle('warning', stale || collectionFailed);
  status.textContent = collectionFailed ? '자동 수집 지연 · 마지막 성공 기록을 표시합니다.' : stale ? '정보 지연 · 마지막으로 확보한 공지를 표시합니다. 최신 상태는 원문에서 확인하세요.' : '수집 상태 정상 · 표시된 시각은 공지 내용에 근거합니다.';
  document.querySelector('#updated').textContent = dataset.last_success_at ? `마지막 수집 성공 ${formatInstant(dataset.last_success_at, zone)}` : '아직 성공한 수집 기록이 없습니다.';
}

try {
  const response = await fetch('./events.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Feed unavailable');
  const data = await response.json();
  if (data.schema_version !== 1 || !Array.isArray(data.events)) throw new Error('Invalid event format');
  dataset = data;
  items = data.events.filter(item => item?.event && item?.temporal && item?.source)
    .sort((a, b) => (Date.parse(b.source.posted_at) || 0) - (Date.parse(a.source.posted_at) || 0));
  render();
} catch {
  render();
  const status = document.querySelector('#status');
  status.classList.add('warning');
  status.textContent = '공지 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
  document.querySelector('#updated').textContent = '수집 상태를 확인할 수 없습니다.';
}
tick();
setInterval(tick, 1000);
