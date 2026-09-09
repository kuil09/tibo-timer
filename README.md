# Codex Reset Local Time

A Korean, source-linked view of Tibo's public reset announcements in the visitor's browser timezone. General usage resets and banked reset grants are separate. This service cannot inspect personal account quotas.

**Site:** https://kuil09.github.io/tibo-timer/

## Current operation

As of the explicit operator request on 2026-09-09, monitoring is **latest-only** and automatic CPU interpretation is **enabled**.

- `config/source.json`: FxEmbed, first timeline page only (50 provider entries, replies included), with a 24-hour lookback. No historical pagination or backfill. Existing archives are retained.
- `config/selection.json`: the locked `qwen359b` model, Qwen3.5-9B Q4_K_M, running on the standard GitHub-hosted CPU in non-thinking mode. No paid API or visitor browser is required for this interpretation path.
- Scheduled collection runs every 20 minutes (`7,27,47 * * * *`). New or edited recent originals receive at most five model calls per run. Unchanged processed originals do not start the model. Deferred work and failed inference retry on a later poll while still in the monitored recent window.
- Invalid or truncated sources remain source-only. A valid AI classification of unrelated text is still a completed interpretation; it does not become a reset announcement.

This is best-effort monitoring of the newest returned page, not a complete 24-hour archive. A quiet recent window is a successful source check if the underlying author timeline is valid. Collection freshness and automatic interpretation status are recorded separately in the public JSON and UI.

## Reliability

The source adapter checks both the handle and the pinned numeric author ID. Other authors' conversation parents and quote text never become Tibo's own words. Original text, URL and posting timestamp are preserved. Original edits invalidate earlier interpretations, retaining history.

AI selects evidence from original source spans; code validates those selections and normalizes supported time expressions. It does not invent times, borrow unrelated deadlines, or mark a reset complete when a countdown expires. A completion label describes the source's announcement, not independent account verification.

Automatic interpretation was enabled by the operator, **not by passing the previous experimental acceptance gates**. The configuration retains `activation: operator-enabled`, `acceptance_status: not-approved` and the previous evaluation note. Invalid evidence or runtime failures remain unresolved. Experimental quality reports have not been rewritten to imply success.

The separate three-model OpenRouter council and its UI remain independent of the automatic CPU interpretation path. A CPU result does not claim approval by three models.

## Development

Requires Node.js 22+.

```sh
npm ci
npm run check
npm test
npm run build
python3 -m http.server 4173 --directory dist
```

For browser regression checks, install Chromium with `npx playwright install chromium`, start the static server above, then run `npm run test:browser`.

## Collection and deployment

The Pages workflow collects on a schedule, on manual dispatch with `collect=true`, or on an explicit main push whose commit message contains `[collect]`. Ordinary pushes publish stored data only. Model preparation is skipped unless recent changed, non-truncated originals need inference. Model/runtime revisions and SHA256 hashes are pinned in `config/models.lock.json`.

For a local collection, `git pull --ff-only` and run `bash scripts/collect-local.sh` with the configured local CPU service available when interpretation is enabled. Review and commit data changes separately; the command does not push automatically.

Failures preserve the last valid public data. AI failures stay pending rather than being recorded as completed. Every deployment verifies its public HTML and JSON against the build. Artifact names include the attempt number so reruns do not collide. GitHub schedules can be delayed or disabled after prolonged repository inactivity; they are not a precise-time delivery guarantee.

## Data

`data/events.json` stores original records and interpretations. `data/state.json` stores processing fingerprints, source status and AI status. `data/raw/` stores changed original snapshots; `data/history/` stores superseded interpretations. Full raw snapshots are not served in Pages. Existing archived records are preserved but are not a backlog for latest-only automatic interpretation.

The codex-reset adapter remains available through explicit source configuration. There is no automatic paid fallback, proxy rotation or personal X-cookie dependency.

## Evaluation and provenance

Previous model experiments, local CPU launch settings, frozen evaluation guidance and commands are preserved in [historical operations](docs/evaluation/historical-operations.md) and `docs/evaluation/`. These are historical records, not the current enablement policy. Existing lab scripts remain unchanged; the previously pinned local Qwen model is also included in the production lock.

## Sources

- [FxEmbed timeline API](https://docs.fxembed.com/api/twitter/operations/2profilehandlestatuses/)
- [Secondary codex-reset feed](https://codex-reset.com/api/feed)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [Qwen3.5-9B community GGUF](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF)

Independent community utility; not affiliated with OpenAI or Tibo. Original source and model rights remain with their owners. Public standard runners and Pages avoid additional infrastructure charges, subject to existing storage limits. Third-party availability and complete source coverage are not guaranteed.
