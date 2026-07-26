#!/usr/bin/env bash
# Regression coverage for update-den-srv-instances.sh checkout preflight.
set -euo pipefail

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
updater_source="${script_root}/update-den-srv-instances.sh"
fixture_root="$(mktemp -d)"

cleanup() {
  rm -rf "${fixture_root}"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

initialize_repo() {
  local path="$1"
  git -C "${path}" init -q
  git -C "${path}" config user.email "updater-test@example.invalid"
  git -C "${path}" config user.name "Updater Test"
  git -C "${path}" add .
  git -C "${path}" commit -qm "fixture"
}

create_fixture() {
  local name="$1"
  local root="${fixture_root}/${name}"
  local roleplay_repo="${root}/rusty-roleplay"
  local view_repo="${root}/rusty-view"
  local crew_repo="${root}/rusty-crew"

  mkdir -p \
    "${roleplay_repo}/scripts" \
    "${roleplay_repo}/roleplay-frontend/apps/roleplay-web/src" \
    "${roleplay_repo}/roleplay-frontend/apps/roleplay-web/public" \
    "${view_repo}/scripts" \
    "${crew_repo}"

  cp "${updater_source}" "${roleplay_repo}/scripts/update-den-srv-instances.sh"
  cp "${updater_source}" "${roleplay_repo}/scripts/deploy-den-srv.sh"
  cp "${updater_source}" "${view_repo}/scripts/deploy-den-srv.sh"
  chmod +x \
    "${roleplay_repo}/scripts/update-den-srv-instances.sh" \
    "${roleplay_repo}/scripts/deploy-den-srv.sh" \
    "${view_repo}/scripts/deploy-den-srv.sh"

  printf 'tracked roleplay source\n' \
    >"${roleplay_repo}/roleplay-frontend/apps/roleplay-web/src/tracked.ts"
  printf 'tracked public asset\n' \
    >"${roleplay_repo}/roleplay-frontend/apps/roleplay-web/public/tracked.txt"
  printf 'dist/\n' >"${roleplay_repo}/.gitignore"
  printf 'tracked view source\n' >"${view_repo}/tracked.ts"
  printf 'tracked crew source\n' >"${crew_repo}/tracked.ts"

  initialize_repo "${roleplay_repo}"
  initialize_repo "${view_repo}"
  initialize_repo "${crew_repo}"

  printf '%s\n' "${root}"
}

run_updater() {
  local root="$1"
  shift
  RUSTY_VIEW_REPO="${root}/rusty-view" \
    RUSTY_CREW_REPO="${root}/rusty-crew" \
    "${root}/rusty-roleplay/scripts/update-den-srv-instances.sh" "$@"
}

assert_rejected_before_update() {
  local root="$1"
  local label="$2"
  local output
  shift 2

  if output="$(run_updater "${root}" "$@" 2>&1)"; then
    fail "${label} was accepted"
  fi
  if [[ "${output}" != *"checkout is dirty"* ]]; then
    fail "${label} did not report a dirty checkout: ${output}"
  fi
  if [[ "${output}" == *"Would update"* ]]; then
    fail "${label} reached an update after preflight rejection"
  fi
}

clean_root="$(create_fixture clean)"
clean_output="$(run_updater "${clean_root}" --dry-run)"
[[ "${clean_output}" == *"Would update rusty-eva with:"* ]] ||
  fail "clean default dry run omitted rusty-eva"
[[ "${clean_output}" == *"Would update rusty-eva-roleplay with:"* ]] ||
  fail "clean default dry run omitted rusty-eva-roleplay"
[[ "${clean_output}" == *"Would update rusty-lore-roleplay with:"* ]] ||
  fail "clean default dry run omitted rusty-lore-roleplay"

only_root="$(create_fixture only)"
only_output="$(
  run_updater "${only_root}" --dry-run --only rusty-lore-roleplay
)"
[[ "${only_output}" == *"Would update rusty-lore-roleplay with:"* ]] ||
  fail "clean --only dry run omitted rusty-lore-roleplay"
[[ "${only_output}" != *"Would update rusty-eva with:"* ]] ||
  fail "clean --only dry run included rusty-eva"

typescript_root="$(create_fixture untracked-typescript)"
printf 'export const untracked = true;\n' \
  >"${typescript_root}/rusty-roleplay/roleplay-frontend/apps/roleplay-web/src/untracked.ts"
assert_rejected_before_update \
  "${typescript_root}" \
  "untracked TypeScript input" \
  --dry-run \
  --only rusty-lore-roleplay

public_root="$(create_fixture untracked-public)"
printf 'untracked public input\n' \
  >"${public_root}/rusty-roleplay/roleplay-frontend/apps/roleplay-web/public/untracked.txt"
assert_rejected_before_update \
  "${public_root}" \
  "untracked public input" \
  --dry-run \
  --only rusty-lore-roleplay

staged_root="$(create_fixture staged)"
printf 'staged change\n' \
  >>"${staged_root}/rusty-roleplay/roleplay-frontend/apps/roleplay-web/src/tracked.ts"
git -C "${staged_root}/rusty-roleplay" add \
  roleplay-frontend/apps/roleplay-web/src/tracked.ts
assert_rejected_before_update \
  "${staged_root}" \
  "staged input" \
  --dry-run \
  --only rusty-lore-roleplay

modified_root="$(create_fixture modified)"
printf 'unstaged change\n' \
  >>"${modified_root}/rusty-roleplay/roleplay-frontend/apps/roleplay-web/src/tracked.ts"
assert_rejected_before_update \
  "${modified_root}" \
  "modified input" \
  --dry-run \
  --only rusty-lore-roleplay

ignored_root="$(create_fixture ignored)"
mkdir -p "${ignored_root}/rusty-roleplay/dist"
printf 'ignored build output\n' >"${ignored_root}/rusty-roleplay/dist/bundle.js"
ignored_output="$(
  run_updater "${ignored_root}" --dry-run --only rusty-lore-roleplay
)"
[[ "${ignored_output}" == *"Would update rusty-lore-roleplay with:"* ]] ||
  fail "ignored build output blocked a clean dry run"

echo "update-den-srv-instances preflight tests passed"
