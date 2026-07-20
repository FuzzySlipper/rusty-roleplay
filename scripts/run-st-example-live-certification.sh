#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_root="${repo_root}/roleplay-frontend"
deployment_root="/home/system/rusty-roleplay-test"
compose=(docker compose --file "${deployment_root}/compose.yaml" --project-directory "${deployment_root}")

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact_root="${deployment_root}/artifacts/task-5999/${timestamp}"
port="$(sed -n 's/^RUSTY_ROLEPLAY_PORT=//p' "${deployment_root}/.env" | tail -1)"
port="${port:-9350}"
lan_host="${RUSTY_ROLEPLAY_LAN_HOST:-$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')}"
backend_url="http://127.0.0.1:${port}"
lan_url="http://${lan_host}:${port}"

"${compose[@]}" up --detach --wait rusty-roleplay >/dev/null
install -d "${artifact_root}"
(
  cd "${frontend_root}"
  BASE_URL="${lan_url}" \
  PLAYWRIGHT_HTML_OPEN=never \
  PLAYWRIGHT_BROKER_ARTIFACT_ROOT="${artifact_root}" \
  RUSTY_ROLEPLAY_DEPLOYED_RUN=1 \
  RUSTY_ROLEPLAY_LIVE_RUN=1 \
  RUSTY_ROLEPLAY_ST_EXAMPLE_LIVE_RUN=1 \
  RUSTY_ROLEPLAY_LIVE_BACKEND_URL="${backend_url}" \
  pnpm exec playwright test \
    --config=apps/roleplay-web-e2e/playwright.config.mts \
    --project=chromium \
    --grep='@live-st-example'
)

echo "ST example live-certification artifacts: ${artifact_root}"
