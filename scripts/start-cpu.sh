#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache/evaluation
export LD_LIBRARY_PATH="$(dirname "$LLAMA_SERVER"):${LD_LIBRARY_PATH:-}"
template_args=()
if [[ "${MODEL_ID:-}" == "qwen3" || "${MODEL_ID:-}" == "qwen359b" ]]; then
  template_args=(--chat-template-kwargs '{"enable_thinking":false}')
fi
"$LLAMA_SERVER" -m "$MODEL_PATH" -ngl 0 -t 4 -c 4096 --parallel 1 --host 127.0.0.1 --port 8080 --jinja "${template_args[@]}" > .cache/evaluation/server.log 2>&1 &
server_pid=$!
printf '%s\n' "$server_pid" > .cache/cpu/server.pid
ready=false
cleanup() {
  if [[ "$ready" != true ]]; then
    kill "$server_pid" 2>/dev/null || true
    kill -KILL "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
deadline=$((SECONDS+60))
while (( SECONDS < deadline )); do
  if ! kill -0 "$server_pid" 2>/dev/null; then cat .cache/evaluation/server.log; exit 1; fi
  if curl --silent --fail --connect-timeout 1 --max-time 2 http://127.0.0.1:8080/health > /dev/null; then
    ready=true
    exit 0
  fi
  sleep 1
done
cat .cache/evaluation/server.log
exit 1
