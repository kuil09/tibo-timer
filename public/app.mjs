import { initAsciiPortrait } from './tibo-ascii.mjs';
import { COPY } from './copy.mjs';
import { localTime, historyState, headline, countdown } from './view.mjs';
const $ = id => document.getElementById(id);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const sourceURL = url => typeof url === 'string' && /^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(url);
let snapshot, timer, historyTimer;
const timeSuffix = kind => kind === 'approximate' ? COPY.hero.approximate_suffix : kind === 'deadline' ? COPY.hero.deadline_suffix : '';
function heroTitle(hero) {
  if (hero.kind === 'scheduled') return hero.post?.result?.event === 'banked_reset' ? COPY.hero.titles.scheduled_banked : COPY.hero.titles.scheduled_reset;
  if (hero.kind === 'unknown' && hero.post?.result?.conditional) return COPY.hero.titles.conditional;
  return COPY.hero.titles[hero.kind] ?? COPY.hero.titles.unknown;
}
function renderHero() {
  const hero = headline(snapshot);
  $('hero-title').textContent = heroTitle(hero);
  $('reset-time').textContent = '';
  $('countdown').textContent = '';
  const time = hero.post?.result?.time;
  if (time && ['scheduled', 'elapsed'].includes(hero.kind)) {
    $('reset-time').textContent = localTime(time.at, zone) + timeSuffix(time.kind);
    if (hero.kind === 'scheduled' && time.kind === 'exact') $('countdown').textContent = countdown(time.at) + COPY.hero.countdown_suffix;
  }
  $('hero-source').hidden = !sourceURL(hero.post?.url);
  if (!$('hero-source').hidden) $('hero-source').href = hero.post.url;
}
function historyTitle(state) {
  if (!['scheduled', 'elapsed', 'completed', 'cancelled'].includes(state.kind)) return COPY.history[state.kind] ?? COPY.history.unknown;
  const event = state.event === 'banked_reset' ? 'banked' : 'reset';
  return COPY.history[`${state.kind}_${event}`] ?? COPY.history.unknown;
}
function renderHistory() {
  $('posts').replaceChildren();
  if (!snapshot.posts.length) {
    const p = document.createElement('p');
    p.textContent = COPY.page.no_recent_posts;
    $('posts').append(p);
    return;
  }
  for (const post of snapshot.posts) {
    const article = document.createElement('article');
    const meta = document.createElement('div');
    const date = document.createElement('a');
    const result = historyState(post);
    const resultLine = document.createElement('p');
    const quote = document.createElement('blockquote');
    meta.className = 'meta';
    date.textContent = localTime(post.posted_at, zone);
    if (sourceURL(post.url)) {
      date.href = post.url;
      date.target = '_blank';
      date.rel = 'noopener noreferrer';
    }
    meta.append(date);
    resultLine.className = 'post-result';
    resultLine.textContent = historyTitle(result);
    if (result.time && ['scheduled', 'elapsed'].includes(result.kind)) {
      const time = document.createElement('time');
      time.dateTime = result.time.at;
      time.textContent = localTime(result.time.at, zone) + timeSuffix(result.time.kind);
      resultLine.append(document.createTextNode(COPY.history.separator), time);
    }
    quote.textContent = post.text;
    article.append(meta, resultLine, quote);
    $('posts').append(article);
  }
}
function render() {
  renderHero();
  renderHistory();
  clearInterval(timer);
  clearInterval(historyTimer);
  timer = setInterval(renderHero, 1000);
  historyTimer = setInterval(renderHistory, 60000);
}
async function refresh() {
  try {
    const response = await fetch('status.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('status_unavailable');
    const value = await response.json();
    if (value.schema_version !== 2 || !Array.isArray(value.posts)) throw new Error('status_invalid');
    snapshot = value;
    render();
  } catch {
    clearInterval(timer);
    clearInterval(historyTimer);
    $('hero-title').textContent = COPY.page.load_failure_title;
    $('reset-time').textContent = '';
    $('countdown').textContent = '';
    $('hero-source').hidden = true;
    $('posts').replaceChildren();
  }
}
initAsciiPortrait($('tibo-ascii-canvas'), $('tibo-ascii-fallback'));
refresh();
setInterval(refresh, 60000);
