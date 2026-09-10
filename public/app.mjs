import { initAsciiPortrait } from './tibo-ascii.mjs';
import { COPY } from './copy.mjs';
import { localTime, headline, countdown } from './view.mjs';
const $ = id => document.getElementById(id);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const sourceURL = url => typeof url === 'string' && /^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(url);
let snapshot, timer;
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
function render() {
  renderHero();
  $('posts').replaceChildren();
  if (!snapshot.posts.length) {
    const p = document.createElement('p');
    p.textContent = COPY.page.no_recent_posts;
    $('posts').append(p);
  }
  for (const post of snapshot.posts) {
    const article = document.createElement('article');
    const meta = document.createElement('div');
    const date = document.createElement('a');
    const quote = document.createElement('blockquote');
    meta.className = 'meta';
    date.textContent = localTime(post.posted_at, zone);
    if (sourceURL(post.url)) {
      date.href = post.url;
      date.target = '_blank';
      date.rel = 'noopener noreferrer';
    }
    meta.append(date);
    quote.textContent = post.text;
    article.append(meta, quote);
    $('posts').append(article);
  }
  clearInterval(timer);
  timer = setInterval(renderHero, 1000);
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
