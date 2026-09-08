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

The council reads existing source posts from `data/events.json`. The default batch limit is five posts; manual runs can choose one through five. Three independent drafts plus six cross-reviews allow at most nine model requests per post, or 45 per five-post batch. Provider limits can still prevent completion. No paid fallback is allowed.

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

Candidates must have a `:free` ID, zero catalog pricing, text input/output, reasoning and max-token support, and at least 16K context. Rank by the catalog Artificial Analysis intelligence index, exclude missing scores, and take one model per author. The catalog API ordering is not trusted. Fewer than three eligible scored authors fails discovery. Before inference, re-fetch pricing and availability; never substitute another model mid-batch. Unscored new models remain visible in the catalog but are not silently ranked as strong.

All models receive the same prompt, temperature 0, 4,096 output-token ceiling and 90-second timeout. Tokenization and internal reasoning allocation still differ by provider. Each anonymous candidate is reviewed alone in a fresh context by both other models. There are no paired answer positions or self-reviews. Corroboration requires matching semantic fields across all three drafts and all six supporting reviews; different literal evidence spans alone do not count as semantic disagreement. Corroboration is not a correctness score or permission to publish.

Daily runs intentionally compare the latest five stored non-truncated posts against that day's panel; they do not represent an ingestion queue. HTTP errors stop the run without retries; invalid model answers remain unresolved. At most 45 inference requests are attempted per run. This is not an account-wide quota reservation: manual runs and other API use share the account quota. Pricing is constrained by free IDs, live metadata, provider max_price zero for prompt/completion/request, and the configured key budget.
