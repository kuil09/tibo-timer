# Codex Reset Local Time

A Korean, source-linked view of Tibo's public reset announcements in the visitor's browser timezone. General usage resets and banked reset grants are separate. A grant is not a claim that an account's usage was reset.

**Site:** https://kuil09.github.io/tibo-timer/

## Reliability model

The feed is a discovery source, not an authoritative schedule. Original `tweets.text` and tweet timestamps are preserved. Event summaries and operator timestamps never become original posts or scheduled reset times. No scheduled event becomes completed just because its countdown elapsed.

CPU inference is disabled until a candidate passes the frozen holdout and runner performance gates. If neither candidate passes, the site publishes originals with unresolved timing. Source-only type labels are lexical navigation hints; announcement state stays unknown. This service cannot inspect your personal OpenAI quota.

## Development

Requires Node.js 22+.

```sh
npm ci
npm run check
npm test
npm run sync
npm run build
python3 -m http.server 4173 --directory dist
```

`npm run test:browser` expects the static server on port 4173. Install the test browser once with `npx playwright install chromium`. Test fixtures intercept only the public JSON request; production smoke checks use the real published dataset.

## CPU inference

`config/models.lock.json` pins official model revisions, SHA256 hashes, and the CPU runtime archive. Use the manual **CPU model evaluation** workflow to compare Qwen2.5 1.5B Q4_K_M and Qwen3 1.7B Q8_0. GPU offload is disabled; the loopback-only server exists only during the job. Qwen3 thinking is disabled. Model artifacts are cached, never committed or served to visitors.

The fixture contains 20 development cases and 20 frozen holdout cases. Approval requires holdout accuracy >=95%, zero false completion/time claims, a cold download+five-post batch <10 minutes, and a warm five-post batch <5 minutes. Unresolved answers on resolvable cases fail. Reports retain all failed cases, server peak memory, elapsed time, runtime identity and hardware. Do not tune against the holdout or relax it after observing results.

`config/selection.json` is the explicit publication gate. Only a reviewed passing CPU result may enable a model. Changing model, prompt or schema invalidates cached interpretations.

## Collection and publication

The **Collect and deploy Pages** workflow runs at minutes 7/22/37/52 and manually. It checks source changes before loading a model, preserves raw semantic snapshots and historical edits, commits collection state, and deploys Pages within the same workflow. Runs are serialized. The generated site uses relative asset paths for `/tibo-timer/` hosting.

A failed/stale/invalid feed keeps the last valid dataset. Individual inference failures remain unresolved; a later source or interpretation-version change retries them. Budget-deferred and startup-failed records remain pending. Public freshness is the last successful feed check, not the newest tweet. After 60 minutes without a successful check the browser displays a delay notice. GitHub schedules may be delayed or disabled after prolonged repository inactivity; use manual dispatch to restore and investigate.

## Data and limitations

`data/events.json` is the public versioned event document; `data/state.json` is durable processing state. `data/raw/` preserves upstream responses when semantic source content changes; `data/history/` preserves superseded source interpretations. Full raw records are kept in Git, not in Pages artifacts. The public event includes source text, source time, event type/state, normalized time and interpretation provenance.

Time shapes are `instant`, `window`, `date`, and `unresolved`; precision is separate. PT uses America/Los_Angeles. Explicit PST/PDT conflicting with the local seasonal offset is unresolved. Relative durations anchor to the original post. Date-only expressions retain their source calendar/timezone. Unsupported or ungrounded expressions do not gain an invented timestamp. Upstream may truncate without marking it: explicit flags/ellipsis are detected, but completeness cannot always be established. The UI links to the original for verification.

The feed currently mixes original text, heuristic/LLM classifications and operator observations. We do not automatically merge apparently related announcements. An explicit completion is labeled as a source's completion announcement, not independent account verification.

Public standard GitHub runners and Pages avoid additional infrastructure charges. This assumes a public repository and existing free quotas for ancillary GitHub storage; no paid runner, paid inference API, custom domain purchase, or persistent service is configured. Keep model caches and evaluation artifacts bounded. A custom domain is deferred until a hostname is supplied.

## Sources

- [Public feed](https://codex-reset.com/api/feed)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [Qwen2.5 official GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF)
- [Qwen3 official GGUF](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF)

Independent community utility; not affiliated with OpenAI or Tibo. Source material retains its original rights. Model licenses remain with their publishers.
