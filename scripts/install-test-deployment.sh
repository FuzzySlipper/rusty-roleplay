#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deployment_root="${RUSTY_ROLEPLAY_DEPLOYMENT_ROOT:-/home/system/rusty-roleplay-test}"
frontend_dist="${repo_root}/roleplay-frontend/dist/apps/roleplay-web/browser"

if [[ ! -f "${frontend_dist}/index.html" ]]; then
  echo "Frontend build missing; run the roleplay-web production build first." >&2
  exit 1
fi

install -d \
  "${deployment_root}/config/profiles" \
  "${deployment_root}/config/skills" \
  "${deployment_root}/data/engine" \
  "${deployment_root}/run" \
  "${deployment_root}/logs" \
  "${deployment_root}/artifacts" \
  "${deployment_root}/backups" \
  "${deployment_root}/workspace" \
  "${deployment_root}/site" \
  "${deployment_root}/scripts"

install -m 0644 "${repo_root}/docker/compose.yaml" "${deployment_root}/compose.yaml"
install -m 0644 "${repo_root}/docker/deployment.env" "${deployment_root}/.env"
install -m 0644 "${repo_root}/docker/seed-test-data.mjs" "${deployment_root}/scripts/seed-test-data.mjs"
install -m 0644 "${repo_root}/docker/smoke-test.mjs" "${deployment_root}/scripts/smoke-test.mjs"
install -m 0644 "${repo_root}/docker/live-turn-smoke.mjs" "${deployment_root}/scripts/live-turn-smoke.mjs"

if [[ ! -f "${deployment_root}/config/service.env" ]]; then
  install -m 0600 "${repo_root}/docker/service.env" "${deployment_root}/config/service.env"
fi
if [[ ! -f "${deployment_root}/config/service.json" ]]; then
  install -m 0644 "${repo_root}/docker/service.json" "${deployment_root}/config/service.json"
fi

find "${deployment_root}/site" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
cp -a "${frontend_dist}/." "${deployment_root}/site/"
install -m 0644 "${repo_root}/docker/runtime-config.js" "${deployment_root}/site/runtime-config.js"

echo "Installed the test deployment at ${deployment_root}."
echo "The Dockerfile and source build assets remain in ${repo_root}; only runtime artifacts were installed."
