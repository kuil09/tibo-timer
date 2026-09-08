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

`config/models.lock.json` pins model revisions, SHA256 hashes, and the CPU runtime archive. The active candidate is LFM2.5-1.2B-Instruct Q4_K_M from LiquidAI’s official GGUF distribution. Use the manual **CPU model evaluation** workflow to evaluate it; prior Phi and Qwen locks and reports remain for provenance. GPU offload is disabled; the loopback-only server exists only during the job. Qwen3 thinking is disabled. Model artifacts are cached, never committed or served to visitors.

Evaluation restores verified weights and the runtime archive by default. Use `cold_download=true` only for a fresh-download performance proof; cached measurements cannot replace that proof. `cache_check=true` measures cache restoration, one model load, and five-post batches without rerunning quality cases. Artifacts are cached immediately after preparation, before inference. Runtime extraction is isolated by SHA256; process IDs and prepared paths are not cached. Each job loads one CPU server and processes its batch sequentially; GitHub-hosted jobs do not retain a live model between runs.

Collection detects changed records before restoring model artifacts. Unchanged posts and batches containing only truncated sources skip model loading. Processing fingerprints include only the active model and runtime, so inactive candidate changes do not invalidate interpretations.

The fixture contains 20 development cases and 20 frozen holdout cases. Approval requires holdout accuracy >=95%, zero false completion/time claims, a cold download+five-post batch <10 minutes, and a warm five-post batch <5 minutes. Unresolved answers on resolvable cases fail. Reports retain all failed cases, server peak memory, elapsed time, runtime identity and hardware. Do not tune against the holdout or relax it after observing results.

The v2 extractor supplies exact source sentence/time spans and accepts four selection fields: type, state, sentence ID, and time ID. Code reconstructs evidence and qualifiers; the model cannot write times, timezones, or audience text. A time ID must belong to the selected sentence and may only accompany a scheduled event. Unsupported expressions remain unresolved. Cross-sentence timezone borrowing is intentionally unsupported. Audience is currently empty rather than inferred; original text remains available.

Evaluation retains raw model output before validation, and distinguishes format errors, semantic classification, temporal results, and legacy exact-string scores. It exercises the production interpretation path, including skipping truncated sources. Existing viewed cases are regression evidence; they cannot authorize publication after prompt development without a new unseen acceptance evaluation.

`config/selection.json` is the explicit publication gate. Only a reviewed passing CPU result may enable a model. Changing model, prompt or schema invalidates cached interpretations.

## Collection and publication

Remote scheduled collection is suspended after Cloudflare challenges. **Publish Pages (optional collection)** deploys repository data on main pushes and manual dispatch without contacting upstream. The `collect` input defaults to false; enable it only for an explicitly authorized remote collection. No separate push workflow is assumed for bot commits.

For a local refresh, run `git pull --ff-only`, then `bash scripts/collect-local.sh`. Review the data changes and commit/push `data/` to publish them. The command validates the feed, preserves historical data, and does not commit or push automatically. While model approval is disabled it publishes original text with unresolved timing. An approved model requires the configured local CPU service when using this entry point. Local collection is manual: there is no unattended Mac scheduler. The generated site uses relative asset paths for `/tibo-timer/` hosting.

A failed/stale/invalid feed keeps the last valid dataset. Individual inference failures remain unresolved; a later source or interpretation-version change retries them. Budget-deferred and startup-failed records remain pending. Public freshness is the last successful feed check, not the newest tweet. After 60 minutes without a successful check the browser displays a delay notice. GitHub schedules may be delayed or disabled after prolonged repository inactivity; use manual dispatch to restore and investigate.

## Data and limitations

`data/events.json` is the public versioned event document; `data/state.json` is durable processing state. `data/raw/` preserves upstream responses when semantic source content changes; `data/history/` preserves superseded source interpretations. Full raw records are kept in Git, not in Pages artifacts. The public event includes source text, source time, event type/state, normalized time and interpretation provenance.

Time shapes are `instant`, `window`, `date`, and `unresolved`; precision is separate. PT uses America/Los_Angeles. Explicit PST/PDT conflicting with the local seasonal offset is unresolved. Relative durations anchor to the original post. Date-only expressions retain their source calendar/timezone. Unsupported or ungrounded expressions do not gain an invented timestamp. Upstream may truncate without marking it: explicit flags/ellipsis are detected, but completeness cannot always be established. The UI links to the original for verification.

The feed currently mixes original text, heuristic/LLM classifications and operator observations. We do not automatically merge apparently related announcements. An explicit completion is labeled as a source's completion announcement, not independent account verification.

Public standard GitHub runners and Pages avoid additional infrastructure charges. This assumes a public repository and existing free quotas for ancillary GitHub storage; no paid runner, paid inference API, custom domain purchase, or persistent service is configured. Keep model caches and evaluation artifacts bounded. A custom domain is deferred until a hostname is supplied.

## Sources

- [Public feed](https://codex-reset.com/api/feed)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [LFM2.5 official GGUF](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF)
- [Phi-4-mini-instruct](https://huggingface.co/microsoft/Phi-4-mini-instruct)
- [Phi GGUF community conversion](https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF)
- [Qwen2.5 official GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF)
- [Qwen3 official GGUF](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF)

Independent community utility; not affiliated with OpenAI or Tibo. Source material retains its original rights. Model licenses remain with their publishers.
