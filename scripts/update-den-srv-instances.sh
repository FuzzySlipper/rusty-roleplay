#!/usr/bin/env bash
# Update the managed den-srv Rusty View and Roleplay deployments from clean,
# committed local checkouts. With no arguments, all three instances update.
set -euo pipefail

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
roleplay_repo="$(cd "${script_root}/.." && pwd)"
view_repo="${RUSTY_VIEW_REPO:-/home/dev/rusty-view}"
crew_repo="${RUSTY_CREW_REPO:-/home/dev/rusty-crew}"
dry_run=false
selected_instance=""

usage() {
  echo "Usage: $0 [--dry-run] [--only rusty-eva|rusty-eva-roleplay|rusty-lore-roleplay]"
}

while (($# > 0)); do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --only)
      if (($# < 2)); then
        usage >&2
        exit 2
      fi
      selected_instance="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

case "${selected_instance}" in
  "" | rusty-eva | rusty-eva-roleplay | rusty-lore-roleplay) ;;
  *)
    echo "Unknown managed instance: ${selected_instance}" >&2
    exit 2
    ;;
esac

require_clean_repo() {
  local label="$1"
  local path="$2"
  local status_output
  if [[ ! -d "${path}/.git" ]]; then
    echo "${label} checkout not found at ${path}" >&2
    exit 1
  fi
  status_output="$(
    git -C "${path}" status \
      --porcelain=v1 \
      --untracked-files=all \
      --ignore-submodules=all
  )"
  if [[ -n "${status_output}" ]]; then
    echo "${label} checkout is dirty at ${path}; commit or stash it before updating." >&2
    exit 1
  fi
}

should_update() {
  local instance="$1"
  [[ -z "${selected_instance}" || "${selected_instance}" == "${instance}" ]]
}

describe_revision() {
  local label="$1"
  local path="$2"
  printf '%s %s\n' "${label}:" "$(git -C "${path}" rev-parse HEAD)"
}

run_update() {
  local instance="$1"
  shift
  if [[ "${dry_run}" == true ]]; then
    printf 'Would update %s with:' "${instance}"
    printf ' %q' "$@"
    printf '\n'
    return
  fi
  echo "Updating ${instance}..."
  "$@"
}

require_clean_repo "Rusty Crew" "${crew_repo}"
if should_update rusty-eva; then
  require_clean_repo "Rusty View" "${view_repo}"
fi
if should_update rusty-eva-roleplay || should_update rusty-lore-roleplay; then
  require_clean_repo "Rusty Roleplay" "${roleplay_repo}"
fi

describe_revision "Rusty Crew" "${crew_repo}"
if should_update rusty-eva; then
  describe_revision "Rusty View" "${view_repo}"
  run_update rusty-eva "${view_repo}/scripts/deploy-den-srv.sh"
fi
if should_update rusty-eva-roleplay; then
  describe_revision "Rusty Roleplay" "${roleplay_repo}"
  run_update rusty-eva-roleplay \
    "${roleplay_repo}/scripts/deploy-den-srv.sh" rusty-eva-roleplay
fi
if should_update rusty-lore-roleplay; then
  if ! should_update rusty-eva-roleplay; then
    describe_revision "Rusty Roleplay" "${roleplay_repo}"
  fi
  run_update rusty-lore-roleplay \
    "${roleplay_repo}/scripts/deploy-den-srv.sh" rusty-lore-roleplay
fi
