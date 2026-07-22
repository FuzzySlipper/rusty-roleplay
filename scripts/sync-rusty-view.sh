#!/usr/bin/env bash
# Advance every @rusty-view package to the newest published 0.0.x release.
# The lockfile remains committed so builds and deployments stay reproducible.
set -euo pipefail

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend_root="$(cd "${script_root}/../roleplay-frontend" && pwd)"
packages=(
  @rusty-view/chat-components
  @rusty-view/chat-domain
  @rusty-view/chat-shell
  @rusty-view/chat-store
  @rusty-view/chat-theme
  @rusty-view/design-tokens
  @rusty-view/protocol
  @rusty-view/transcript-renderer
  @rusty-view/transport
)

if (($# > 0)); then
  echo "Usage: $0" >&2
  exit 2
fi

echo "Reading the coordinated Rusty View release from the configured registry..."
versions=()
for package in "${packages[@]}"; do
  versions+=("$(cd "${frontend_root}" && npm view "${package}" version)")
done

release="${versions[0]}"
for version in "${versions[@]}"; do
  if [[ "${version}" != "${release}" ]]; then
    echo "Rusty View packages are not published at one coherent release:" >&2
    for index in "${!packages[@]}"; do
      printf '  %s %s\n' "${packages[index]}" "${versions[index]}" >&2
    done
    exit 1
  fi
done
if [[ ! "${release}" =~ ^0\.0\.[0-9]+$ ]]; then
  echo "Refusing unexpected Rusty View release ${release}; expected 0.0.x." >&2
  exit 1
fi

echo "Refreshing Rusty View packages to ${release}..."
manifest_snapshot="$(mktemp)"
cleanup() {
  cp "${manifest_snapshot}" "${frontend_root}/package.json"
  rm -f -- "${manifest_snapshot}"
}
trap cleanup EXIT
cp "${frontend_root}/package.json" "${manifest_snapshot}"
package_specs=()
for package in "${packages[@]}"; do
  package_specs+=("${package}@${release}")
done
(
  cd "${frontend_root}"
  # Adding the coordinated exact release targets only these lock entries. The
  # broad development ranges are restored before the importer is normalized.
  pnpm add --workspace-root --prod --lockfile-only "${package_specs[@]}"
  cp "${manifest_snapshot}" package.json
  pnpm install --lockfile-only
  pnpm install --frozen-lockfile
)

node --input-type=module - "${frontend_root}" <<'EOF'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const frontendRoot = process.argv[2];
const manifest = JSON.parse(
  readFileSync(join(frontendRoot, 'package.json'), 'utf8'),
);
const packageNames = Object.keys(manifest.dependencies).filter((name) =>
  name.startsWith('@rusty-view/'),
);
const packages = packageNames.map((name) => {
  const packageJson = JSON.parse(
    readFileSync(join(frontendRoot, 'node_modules', name, 'package.json'), 'utf8'),
  );
  return { name, version: packageJson.version };
});
const versions = new Set(packages.map(({ version }) => version));

if (packages.length === 0 || versions.size !== 1) {
  console.error('Rusty View packages did not resolve to one coherent release:');
  for (const pkg of packages) console.error(`  ${pkg.name} ${pkg.version}`);
  process.exit(1);
}

const [version] = versions;
if (!/^0\.0\.\d+$/.test(version)) {
  console.error(`Refusing unexpected Rusty View release ${version}; expected 0.0.x.`);
  process.exit(1);
}

console.log(`Rusty View packages are synchronized at ${version}.`);
EOF

echo "Commit roleplay-frontend/package.json and pnpm-lock.yaml when they change."
