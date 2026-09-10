import { initAsciiPortrait } from './tibo-ascii.mjs';
import { COPY } from './copy.mjs';
import { localTime, headline, countdown } from './view.mjs';
const $ = id => document.getElementById(id);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const sourceURL = url => typeof url === 'string' && /^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(url);
const names = COPY.status;
const analysisNames = COPY.analysis;
let snapshot, timer;
const timeSuffix = kind => kind === 'approximate' ? COPY.hero.approximate_suffix : kind === 'deadline' ? COPY.hero.deadline_suffix : '';
function renderHero() {
  const hero = headline(snapshot);
  $('hero-title').textContent = hero.title;
  $('hero-label').textContent = hero.post?.result?.event === 'banked_reset' ? COPY.hero.banked_reset_label : COPY.hero.reset_label;
  $('reset-time').textContent = '';
  $('countdown').textContent = '';
  const time = hero.post?.result?.time;
  if (time && ['scheduled', 'elapsed'].includes(hero.kind)) {
    $('reset-time').textContent = localTime(time.at, zone) + timeSuffix(time.kind);
    if (hero.kind === 'scheduled' && time.kind === 'exact') $('countdown').textContent = countdown(time.at) + COPY.hero.countdown_suffix;
  }
  $('hero-note').textContent = COPY.hero.notes[hero.kind] ?? COPY.hero.notes.default;
  $('hero-source').hidden = !sourceURL(hero.post?.url);
  if (!$('hero-source').hidden) $('hero-source').href = hero.post.url;
}
function render() {
  renderHero();
  $('timezone').textContent = COPY.page.timezone_prefix + zone + COPY.page.timezone_suffix;
  $('freshness').textContent = snapshot.last_success_at ? COPY.page.freshness_prefix + localTime(snapshot.last_success_at, zone) + COPY.page.freshness_suffix : COPY.page.no_successful_collection;
  $('analysis').textContent = COPY.page.analysis_prefix + (analysisNames[snapshot.analysis_status] ?? COPY.page.model_unavailable);
  $('posts').replaceChildren();
  if (!snapshot.posts.length) { const p = document.createElement('p'); p.textContent = COPY.page.no_recent_posts; $('posts').append(p); }
  for (const post of snapshot.posts) {
    const article = document.createElement('article'), meta = document.createElement('div'), date = document.createElement('a'), badge = document.createElement('span'), quote = document.createElement('blockquote');
    meta.className = 'meta'; date.textContent = localTime(post.posted_at, zone);
    if (sourceURL(post.url)) { date.href = post.url; date.target = '_blank'; date.rel = 'noopener noreferrer'; }
    badge.textContent = names[post.status] ?? COPY.page.needs_review; meta.append(date, badge); quote.textContent = post.text; article.append(meta, quote);
    if (post.result?.state === 'scheduled') {
      const p = document.createElement('p'), r = post.result;
      const eventLabel = r.event === 'banked_reset' ? COPY.page.banked_reset_granted : COPY.page.usage_reset;
      const scheduleLabel = r.conditional ? COPY.page.conditional_notice : r.time ? localTime(r.time.at, zone) + timeSuffix(r.time.kind) : COPY.page.time_unknown;
      p.textContent = eventLabel + COPY.page.separator + scheduleLabel;
      article.append(p);
    }
    if (post.votes?.length) {
      const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = COPY.page.model_details; details.append(summary);
      for (const vote of post.votes) {
        const p = document.createElement('p'); p.className = 'vote';
        p.textContent = vote.model + '\n' + (vote.claim ? vote.claim.event === 'none' ? COPY.page.not_reset_notice : (vote.claim.evidence || COPY.page.time_unknown) : COPY.page.no_model_response);
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
    $('hero-title').textContent = COPY.page.load_failure_title;
    $('reset-time').textContent = ''; $('countdown').textContent = ''; $('hero-source').hidden = true;
    $('hero-note').textContent = COPY.page.load_failure_note;
  }
}
initAsciiPortrait($('tibo-ascii-canvas'), $('tibo-ascii-fallback'));
refresh(); setInterval(refresh, 60000);
