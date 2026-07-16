#!/usr/bin/env bash
set -euo pipefail

deployment_root="${RUSTY_ROLEPLAY_DEPLOYMENT_ROOT:-/home/system/rusty-roleplay-test}"
compose=(docker compose --file "${deployment_root}/compose.yaml" --project-directory "${deployment_root}")

"${compose[@]}" up --detach --wait
"${compose[@]}" exec -T rusty-roleplay \
  node /opt/rusty-roleplay/deployment-scripts/seed-test-data.mjs
"${compose[@]}" exec -T rusty-roleplay \
  node /opt/rusty-roleplay/deployment-scripts/smoke-test.mjs
"${compose[@]}" exec -T rusty-roleplay \
  node /opt/rusty-roleplay/deployment-scripts/live-turn-smoke.mjs

port="$(sed -n 's/^RUSTY_ROLEPLAY_PORT=//p' "${deployment_root}/.env" | tail -1)"
lan_host="${RUSTY_ROLEPLAY_LAN_HOST:-$(ip -4 route get 1.1.1.1 | awk '{for (index = 1; index <= NF; index++) if ($index == "src") { print $(index + 1); exit }}')}"
echo "Rusty Roleplay test deployment is available at http://${lan_host:-127.0.0.1}:${port:-9350}/"
