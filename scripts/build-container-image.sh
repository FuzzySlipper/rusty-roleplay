#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
crew_repo="${RUSTY_CREW_REPO:-/home/dev/rusty-crew}"
image="${RUSTY_ROLEPLAY_IMAGE:-rusty-roleplay:test}"

if [[ ! -d "${crew_repo}/.git" ]]; then
  echo "Rusty Crew checkout not found at ${crew_repo}" >&2
  exit 1
fi
if ! git -C "${crew_repo}" diff --quiet --ignore-submodules -- || \
   ! git -C "${crew_repo}" diff --cached --quiet --ignore-submodules --; then
  echo "Rusty Crew checkout is dirty; commit or stash it before creating a reproducible image." >&2
  exit 1
fi

crew_context="$(mktemp -d)"
trap 'rm -rf "${crew_context}"' EXIT
git -C "${crew_repo}" archive --format=tar HEAD | tar -xf - -C "${crew_context}"

crew_revision="$(git -C "${crew_repo}" rev-parse HEAD)"
roleplay_revision="$(git -C "${repo_root}" rev-parse HEAD)"

docker buildx build \
  --load \
  --network host \
  --build-context "rusty_crew=${crew_context}" \
  --build-arg "CREW_REVISION=${crew_revision}" \
  --build-arg "ROLEPLAY_REVISION=${roleplay_revision}" \
  --tag "${image}" \
  --file "${repo_root}/docker/Dockerfile" \
  "${repo_root}"

echo "Built ${image} from rusty-roleplay ${roleplay_revision} and rusty-crew ${crew_revision}."
