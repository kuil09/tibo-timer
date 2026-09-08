# OpenRouter discovery and cross-review

This strategy replaces local model selection experiments with a daily inventory of free OpenRouter candidates and a separate three-model inference experiment. It produces review artifacts. It does not approve a model for production, update public event interpretations, fetch fresh upstream posts, or deploy Pages.

## Workflows

`Discover free OpenRouter models` runs daily at 00:17 UTC (09:17 Asia/Seoul) and supports manual dispatch. GitHub schedules can be delayed. It runs dependency installation, type checking, and tests, then:

```sh
node --import tsx src/openrouter.ts discover
```

The discovery output `.cache/openrouter/catalog.json` is uploaded as the `openrouter-catalog` artifact, retained for 14 days. A free listing is a snapshot, not a guarantee of inference availability, quota, quality, or future price.

`OpenRouter independent inference and cross-review` starts after successful discovery on `main` in this repository. It downloads that exact run's catalog. A manual invocation creates a fresh catalog instead. It runs:

```sh
OPENROUTER_MAX_POSTS=5 node --import tsx src/openrouter.ts council
```

Set the `OPENROUTER_API_KEY` repository Actions secret before running the council. Discovery does not require this secret. The council explicitly fails when it is missing; a green discovery run alone does not establish working inference. Do not put the key in configuration files, artifacts, or shell history.

The council reads existing source posts from `data/events.json`. The default batch limit is five posts; manual runs can choose one through five. A complete panel uses three independent drafts and six cross-reviews. Each run allows at most 45 requests total, including abandoned attempts and fallback panels, so failures may reduce the number of posts completed. Provider limits can still prevent completion. No paid fallback is allowed.

Each workflow has a 20-minute job timeout. Council executions use one concurrency group with cancellation disabled. This prevents simultaneous council jobs, but GitHub concurrency is not a durable queue of every pending run. Results and available partial failure evidence under `.cache/openrouter/` are uploaded as `openrouter-council`, retained for 14 days, including when the council step fails.

## Interpretation and fair review

The three models first analyze the same original post independently. Cross-review must hide model identity, apply the same rubric and review opportunities to every candidate, and exclude self-review. Reviewers must check source support, event type, statement state, conditions, and the relationship between time expressions and delivery. A signup deadline is not a reset time; banked credit delivery is not immediate usage restoration. Posts are quoted input data, never instructions to execute.

Agreement is evidence of consistency, not independent ground truth. Models can share training data, biases, and errors. Disagreement, failed requests, invalid JSON, and unsupported claims must remain visible in artifacts. A missing third model or failed review is not a successful three-model consensus. Model candidate rankings are selection heuristics until validated against this project's frozen evaluation cases.

## Operational boundaries

- Workflow permissions are read-only: discovery uses `contents: read`; council additionally uses `actions: read` to download the prior run's artifact.
- The catalog is data. The triggered workflow executes trusted `main` code, not code from the discovery artifact.
- These workflows make no repository commits and do not mutate `data/events.json` or `data/state.json`.
- Existing source freshness and unresolved interpretations are preserved. This strategy does not resolve the upstream Cloudflare collection failure.
- Publishing new interpretations requires a separately validated integration. No deployment or model reliability claim follows from workflow configuration alone.

For local discovery, run `npm ci`, `npm run check`, and `npm test`, then the discovery command above. For a local council run, supply `OPENROUTER_API_KEY` through the environment without committing it, and set `OPENROUTER_MAX_POSTS=1` for a bounded initial check. Review the artifact and provider usage before increasing the batch size.

## Selection and acceptance policy

Candidates must have a `:free` ID, zero catalog pricing, text input/output, reasoning and max-token support, and at least 16K context. Rank by the catalog Artificial Analysis intelligence index, exclude missing scores, and prefer one model per author, filling remaining slots by score when fewer than three authors qualify. The artifact reports the distinct-author count; three models are not necessarily three independent model families. The catalog API ordering is not trusted. Fewer than three eligible scored models fails discovery. Before inference, re-fetch pricing and availability. Replace unavailable models from the live free reserve list before starting a panel. Unscored new models are labeled unranked and may serve as last-resort fallback candidates after scored reserves; they are never described as benchmark-qualified.

All models receive the same prompt, temperature 0, 4,096 output-token ceiling and 90-second timeout. Tokenization and internal reasoning allocation still differ by provider. Each anonymous candidate is reviewed alone in a fresh context by both other models. There are no paired answer positions or self-reviews. Corroboration requires matching semantic fields across all three drafts and all six supporting reviews; different literal evidence spans alone do not count as semantic disagreement. Corroboration is not a correctness score or permission to publish.

Daily runs intentionally compare the latest five stored non-truncated posts against that day's panel; they do not represent an ingestion queue. Model-specific HTTP errors, timeouts, incomplete outputs and invalid answers trigger a different free reserve model. Authentication (401), account budget (402), and account-wide 429 errors stop the run. A provider-specific 429 can trigger replacement. The same failed model is not retried during the run. At most 45 inference requests are attempted per run. This is not an account-wide quota reservation: manual runs and other API use share the account quota. Pricing is constrained by free IDs, live metadata, provider max_price zero for prompt/completion/request, and the configured key budget.

Inkling and Inkling Small free endpoints are excluded because ordinary Actions requests are not eligible for their agentic-harness-only access. Evidence: first live run returned HTTP403 with `Gate Free Endpoints by Agentic Harness`; official restriction: https://openrouter.ai/thinkingmachines/inkling%3Afree . Do not impersonate an allowed harness. Revisit this exclusion only when access policy changes.

## Model fallback

A post permits at most three panel attempts (initial plus two replacements). When any draft or review fails, preserve the abandoned panel, replace the failed model with the next live free reserve, and restart all three drafts and six reviews for that post. Never combine votes from different panels. Semantic disagreement is a valid unresolved outcome and does not trigger replacement to seek agreement. A completed run may contain recovered failures; every accepted post must still have one complete panel.

Persist the exact model IDs for every result, the abandoned claims/reviews, replacement reasons, scored/unranked status and total requests. With fewer than nine requests remaining, do not start a replacement panel. Exhausted candidates, attempts or request budget fail the workflow and preserve unresolved evidence. Free IDs, zero price caps and the key budget apply to every reserve. No paid fallback.

## Live verification, 2026-09-08 UTC

- Discovery and automatic workflow handoff succeeded: https://github.com/kuil09/tibo-timer/actions/runs/34275836025 . The repository secret was installed without committing credentials.
- The original Inkling panel failed with HTTP403 (harness-only access), and the restriction is now excluded.
- A subsequent run observed Gemma HTTP429 from `upstream_provider_shared_pool`; this did not establish a key-budget failure.
- The fallback implementation ran on Actions: https://github.com/kuil09/tibo-timer/actions/runs/34276337271 . Exactly three requests were attempted. Nemotron Ultra returned an inconsistent claim (empty delivery expression with `unclear` basis), Nemotron Lightning timed out, and Cohere North Mini Code returned another inconsistent claim (empty expression with `posted_at` basis). Both model replacements were recorded. The third panel exhausted the attempt cap and the workflow correctly failed with an unresolved result.
- This proves live fallback and bounded termination, not a completed three-model review or interpretation accuracy. A full successful council remains unverified. The latest local suite has 73 passing tests, including mocked full recovery and review-stage restart. Public data remains unchanged.
