# Codex Reset Local Time

A Korean, source-linked view of Tibo's public reset announcements in the visitor's browser timezone. General usage resets and banked reset grants are separate. A grant is not a claim that an account's usage was reset.

**Site:** https://kuil09.github.io/tibo-timer/

## Reliability model

The feed is a discovery source, not an authoritative schedule. Original source text (`raw_text.text` for FxEmbed) and post timestamps are preserved. Event summaries and operator timestamps never become original posts or scheduled reset times. No scheduled event becomes completed just because its countdown elapsed.

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

## Local prompt experiments

On macOS arm64, run `python3 scripts/local-cpu.py` once. It verifies the identical GGUF model and b10856 runtime, downloads only missing artifacts, and prints the CPU-only server command. Run that command in a terminal and keep it running across experiments. `python3 scripts/local-cpu.py --check` verifies the cache without network access.

- `npm run lab`: six development probes with and without JSON Schema; saves raw requests, responses, scores and elapsed times under `.cache/local-lab/`.
- `npm run lab -- --schema-only --prompt=/absolute/path/prompt.txt --output=.cache/local-lab/variant.json`: test a draft instruction without changing production code.
- `npm run evaluate -- --model lfm25 --split dev`: full development regression through the production path.

Optional lab flags `--single-message` and `--compact-input` isolate message placement and input representation. The lab only connects to loopback and never collects upstream, commits, pushes, or dispatches Actions. Iterate locally, preserve failed variants, and update production instructions once evidence supports improvement. Local macOS timing/output is not Linux runner acceptance evidence; an unseen acceptance set remains required before enabling automatic interpretation.

## Collection and publication

Free automatic collection uses FxEmbed's public v2 `thsottiaux` timeline with replies, with no API key, X cookie, visitor browser or always-on machine. Two independent standard GitHub runner probes succeeded in [run 34310903217](https://github.com/kuil09/tibo-timer/actions/runs/34310903217). `config/source.json` selects the provider; the old codex-reset adapter remains available explicitly, not as an automatic fallback.

**Publish Pages (optional collection)** collects at UTC minutes 7, 27 and 47. Manual dispatch with `collect=true` also collects. Normal main pushes only publish repository data; an explicitly requested deployment commit containing `[collect]` performs one refresh in that same deployment. Scheduled and manual collection persist data and deploy within the same workflow; no separate bot-push deployment is assumed.

Each run makes at most three public timeline requests. The initial scan covers up to 14 days, continuing from a durable cursor across runs when necessary; this is not a full-account archive. Later runs re-read the head for edits and scan to the previous completed watermark. Fresh head posts collected during backlog recovery do not advance that backlog's watermark, so newer gaps can be scanned next. Partial scans retain the previous success timestamp and display a warning. Provider ordering, deletions and older edits outside the scanned window limit completeness.

The collector pins both `thsottiaux` and numeric author ID `1953337039510003712`. Other authors' conversation parents and quoted text are not Tibo's own speech. Original `raw_text.text` is preserved, never inline translation; missing original text, visible truncation, or suspiciously short note text stays source-only. Normalized source fingerprints exclude likes, fetch timestamps and cursor metadata. Operator observations and past interpretations are retained separately.

HTTP/JSON/schema/identity errors fail closed, with no immediate retry, paid fallback, cookie use, challenge solving or domain rotation. An unexpected 204 is rejected because this collector intentionally does not send `since`. `checked_at` is our successful request time; `upstream_at` remains null where the provider does not supply a collection timestamp. A successful request does not establish complete X coverage or verify a user's quota.

For a local refresh, run `git pull --ff-only`, then `bash scripts/collect-local.sh`. Review the data changes and commit/push `data/` to publish them. The command validates the selected source, preserves historical data, and does not commit or push automatically. While model approval is disabled it publishes original text with unresolved timing. An approved model requires the configured local CPU service when using this entry point. Local collection is manual: there is no unattended Mac scheduler. The generated site uses relative asset paths for `/tibo-timer/` hosting.

A failed/stale/invalid feed keeps the last valid dataset. Individual inference failures remain unresolved; a later source or interpretation-version change retries them. Budget-deferred and startup-failed records remain pending. Public freshness is the last successful feed check, not the newest tweet. After 60 minutes without a successful check the browser displays a delay notice. GitHub schedules may be delayed or disabled after prolonged repository inactivity; use manual dispatch to restore and investigate.

## Data and limitations

`data/events.json` is the public versioned event document; `data/state.json` is durable processing state. `data/raw/` preserves upstream responses when semantic source content changes; `data/history/` preserves superseded source interpretations. Full raw records are kept in Git, not in Pages artifacts. The public event includes source text, source time, event type/state, normalized time and interpretation provenance.

Time shapes are `instant`, `window`, `date`, and `unresolved`; precision is separate. PT uses America/Los_Angeles. Explicit PST/PDT conflicting with the local seasonal offset is unresolved. Relative durations anchor to the original post. Date-only expressions retain their source calendar/timezone. Unsupported or ungrounded expressions do not gain an invented timestamp. Upstream may truncate without marking it: explicit flags/ellipsis are detected, but completeness cannot always be established. The UI links to the original for verification.

The legacy feed mixes original text, heuristic/LLM classifications and operator observations. We do not automatically merge apparently related announcements. An explicit completion is labeled as a source's completion announcement, not independent account verification.

Public standard GitHub runners and Pages avoid additional infrastructure charges. This assumes a public repository and existing free quotas for ancillary GitHub storage; no paid runner, paid inference API, custom domain purchase, or persistent service is configured. Keep model caches and evaluation artifacts bounded. A custom domain is deferred until a hostname is supplied.

## Sources

- [Primary timeline API](https://docs.fxembed.com/api/twitter/operations/2profilehandlestatuses/)
- [Legacy public feed](https://codex-reset.com/api/feed)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [LFM2.5 official GGUF](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF)
- [Phi-4-mini-instruct](https://huggingface.co/microsoft/Phi-4-mini-instruct)
- [Phi GGUF community conversion](https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF)
- [Qwen2.5 official GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF)
- [Qwen3 official GGUF](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF)

Independent community utility; not affiliated with OpenAI or Tibo. Source material retains its original rights. Model licenses remain with their publishers.

### Two-stage claim experiment

`npm run evaluate:claims -- --pairs` evaluates controlled minimal pairs; `npm run evaluate:claims` evaluates the reviewed development mapping. Both use the already running local CPU server (default port8081). The experimental path classifies `scheduled/completed/retrospective/not_announcement/uncertain`, then selects a whole-post delivery-time candidate only for a scheduled claim with available candidates. It never publishes results. Gold mappings in `eval/claims-dev.json` retain previous labels and review reasons; original cases are unchanged. Reports explicitly count false scheduled claims even when normalized time stays unresolved.

### Latest local candidate and completion verifier

Qwen3.5-9B Q4_K_M is pinned in `config/local-models.json` for local CPU experiments. It is not the production-selected model. Run its server with four CPU threads, GPU layers zero, context 4096 and explicit non-thinking mode. The saved model/runtime hashes, rendered chat template and launch settings are in `docs/evaluation/local-lab/qwen359b/`.

`CLAIM_VERSION=v3 LOCAL_MODEL=qwen359b LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:claims` selects the refined classifier; add `-- --pairs` or `-- --fresh` for the other controlled sets. `src/verify-completion.ts` provides a live classification-plus-verification wrapper: every non-truncated claim receives an independent source-only verification of type, state and delivery-time selection. Failed verification reruns inference and verification, with at most three total attempts; agreement stops immediately, while exhaustion remains unresolved. `scripts/evaluate-completion.ts` replays locked first-stage results and calls the verifier live.

Across 52 controlled cases, completion verification reduced false completions from four to zero while retaining nine true completion announcements. Exact accuracy stays 47/52 because rejected completions become unresolved rather than recovered schedules. These are local experiments, not release acceptance. Automatic interpretation is still disabled; collection approval and model approval are independent. Normal Pages publication without collection does not refresh the source or approve these models.

### Bounded verification loop

`src/verify-claim.ts` implements all-claim verification. `runVerifiedClaimAll` (also exported as `runVerifiedClaim` by the previous entry point) performs at most three complete inference/verification attempts, including the first attempt. No previous answer or verifier feedback is passed to the next model call. Truncated sources bypass every model call. The result records each attempt, the attempt count, and exhaustion. A failed initial inference cannot be promoted by a verifier alone.

`npm run evaluate:verification` reuses locked v3 initial outputs and verifies every non-truncated case live. `npm run evaluate:verification-loop` reuses that locked first attempt and performs live retries only for rejected cases. These evaluations remain local and do not enable production inference.
