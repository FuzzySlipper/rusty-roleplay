# rusty-roleplay frontend — implementation notes

## What this is

The Angular/Nx frontend workspace for rusty-roleplay (task #3211). It consumes
`@rusty-view/*` packages as versioned dependencies and adds RP-specific UI in
`libs/rp-*`. This proves Milestone 4 (Package Boundary Proof) and scaffolds the
Milestone 5 RP UX layer.

## Consuming `@rusty-view/*` (local verdaccio)

rusty-view packages are consumed from a **local verdaccio registry**, not a
filesystem link, so the dependency model matches real publishing.

1. Run verdaccio (any storage dir):
   ```
   verdaccio --config <config.yaml>   # listening on http://localhost:4873
   ```
2. Build rusty-view's libs in **partial** compilation mode and publish them.
   The libs are normally built with `@nx/angular:ng-packagr-lite` (full
   compilation, in-workspace use). For cross-repo consumption they must be
   **partial**-compiled — set `angularCompilerOptions.compilationMode: "partial"`
   in each lib's `tsconfig.lib.prod.json`, rebuild, then `npm publish` each
   `dist/libs/*` to the registry (rewriting `workspace:*` specifiers to a
   concrete version and stripping `private`).
3. `.npmrc` scopes `@rusty-view` to the local registry:
   ```
   @rusty-view:registry=http://localhost:4873/
   ```

`pnpm-workspace.yaml` disables the supply-chain release-age gate
(`minimumReleaseAge: 0`) because packages are (re)published moments before
install in local dev.

### Angular version alignment

The consuming app's Angular must be **>= the version the libs were compiled
with** so the Angular linker processes the partial declarations. rusty-view's
libs compile with `@angular/core` 21.2.17, so the app's `@angular/*` use the
`~21.2.0` range and resolve `core`/`compiler-cli` to 21.2.17.

## Backend URLs (runtime-configurable, no hardcoded host)

`apps/roleplay-web/src/app/backend-config.ts` resolves backend service URLs at
**runtime** so one build works locally or from a remote workstation over
LAN/Tailscale (the normal case — browser on your machine, services on a headless
box). Inject `BACKEND_CONFIG` from transport / lorekeep clients; never bake a
host into the build. Resolution order per URL (first match wins):

1. `?api=<url>` (rusty-crew) / `?lore=<url>` (lorekeep) query params.
2. `window.__RUSTY_ROLEPLAY_CONFIG__` injected at deploy time (may also carry a
   `bearerToken`).
3. Derived from the serving host on the default port — view at `http://host:4200`
   → chat `http://host:9347`, lorekeep `http://host:8790`.

This is the foundation only. The app currently renders mock data
(`DEMO_MESSAGES`, `MockLoreSource`) and does not yet wire the rusty-crew chat
transport / SSE stream or a lorekeep HTTP client — when those land they inject
`BACKEND_CONFIG`. Pure-logic resolution is unit-tested (`backend-config.spec.ts`).

## Transcript rendering (resolved)

Consumes `@rusty-view/*` >= 0.0.6 (partial-compiled; published packages link
fine — the linker runs, no unlinked `ngDeclare` markers in the consumer bundle).
The base `TranscriptViewportComponent` renders message rows here, including a
**preloaded** session (messages present at init). Two upstream fixes got it there:

1. **rusty-view #3241:** the template used a plain `@for` inside the CDK
   virtual-scroll viewport, which never registers rows with the scroll strategy;
   now `*cdkVirtualFor`.
2. **rusty-view #3248:** with messages present at init, CDK registered a data
   length of 0 while the viewport was still measured at 0 (layout behind the
   profile `@if`), so nothing rendered until the next data change. The viewport
   now drives `*cdkVirtualFor` from an internal signal and emits the data only
   once it has a real size.

The boundary-proof e2e asserts rendered rows + the narrator decorator prefix.

## Commands

```
pnpm install
pnpm exec nx run-many -t lint typecheck vite:test build --all
pnpm exec nx run roleplay-web:serve            # dev server
pnpm exec nx run roleplay-web-e2e:e2e -- --project=chromium
```
