#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_root="${repo_root}/roleplay-frontend"
deployment_root="/home/system/rusty-roleplay-test"
compose=(docker compose --file "${deployment_root}/compose.yaml" --project-directory "${deployment_root}")

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact_root="${deployment_root}/artifacts/task-5962/${timestamp}"
port="$(sed -n 's/^RUSTY_ROLEPLAY_PORT=//p' "${deployment_root}/.env" | tail -1)"
port="${port:-9350}"
lan_host="${RUSTY_ROLEPLAY_LAN_HOST:-$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')}"
backend_url="http://127.0.0.1:${port}"
lan_url="http://${lan_host}:${port}"

ensure_healthy() {
  "${compose[@]}" up --detach --wait rusty-roleplay >/dev/null
}
trap ensure_healthy EXIT

ensure_healthy
"${compose[@]}" exec -T rusty-roleplay \
  node /opt/rusty-roleplay/deployment-scripts/seed-test-data.mjs >/dev/null

mechanic_session_id="$(
  curl -fsS "${backend_url}/v1/admin/roleplay/mechanic-sessions?mechanic_profile_id=roleplay-mechanic-test" |
    jq -r '.data.items[] | select(.association.roleplaySessionId == "roleplay-test-scene" and .session.status != "archived") | .association.mechanicSessionId' |
    head -1
)"
if [[ -z "${mechanic_session_id}" ]]; then
  echo "The seeded attached mechanic session was not found." >&2
  exit 1
fi

install -d "${artifact_root}"
(
  cd "${frontend_root}"
  BASE_URL="${lan_url}" \
  PLAYWRIGHT_HTML_OPEN=never \
  PLAYWRIGHT_BROKER_ARTIFACT_ROOT="${artifact_root}" \
  RUSTY_ROLEPLAY_DEPLOYED_RUN=1 \
  RUSTY_ROLEPLAY_LIVE_RUN=1 \
  RUSTY_ROLEPLAY_MECHANIC_LIVE_RUN=1 \
  RUSTY_ROLEPLAY_MECHANIC_ALLOW_RESTART=1 \
  RUSTY_ROLEPLAY_LIVE_BACKEND_URL="${backend_url}" \
  RUSTY_ROLEPLAY_LIVE_LAN_URL="${lan_url}" \
  RUSTY_ROLEPLAY_LIVE_MECHANIC_SESSION_ID="${mechanic_session_id}" \
  pnpm exec playwright test \
    --config=apps/roleplay-web-e2e/playwright.config.mts \
    --project=chromium \
    --grep='@live-mechanic'
)

echo "Mechanic live-certification artifacts: ${artifact_root}"
