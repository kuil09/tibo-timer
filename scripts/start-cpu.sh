#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache/evaluation
export LD_LIBRARY_PATH="$(dirname "$LLAMA_SERVER"):${LD_LIBRARY_PATH:-}"
template_args=()
if [[ "${MODEL_ID:-}" == "qwen3" ]]; then
  template_args=(--chat-template-kwargs '{"enable_thinking":false}')
fi
"$LLAMA_SERVER" -m "$MODEL_PATH" -ngl 0 -t 4 -c 4096 --parallel 1 --host 127.0.0.1 --port 8080 --jinja "${template_args[@]}" > .cache/evaluation/server.log 2>&1 &
printf '%s\n' "$!" > .cache/cpu/server.pid
for attempt in $(seq 1 60); do
  if curl --silent --fail http://127.0.0.1:8080/health > /dev/null; then exit 0; fi
  if ! kill -0 "$(cat .cache/cpu/server.pid)" 2>/dev/null; then cat .cache/evaluation/server.log; exit 1; fi
  sleep 1
done
cat .cache/evaluation/server.log
exit 1
