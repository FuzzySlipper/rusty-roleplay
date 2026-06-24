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

## Open item — transcript row rendering (upstream)

The RP shell mounts rusty-view's `TranscriptViewportComponent` and passes it the
message array (verified: the input receives the messages). However, the base
viewport does **not** paint message rows in this consumption setup.

Diagnosis: `TranscriptViewportComponent` renders messages with a plain `@for`
inside a `cdk-virtual-scroll-viewport` driven by a fixed-size virtual-scroll
strategy (`[itemSize]="50"`). A CDK virtual-scroll viewport only renders rows
provided through `*cdkVirtualFor` (or an autosize strategy from
`@angular/cdk-experimental`); a plain `@for` yields an empty rendered range.
rusty-view's own unit tests skip `detectChanges()` and assert only the input /
projection, so DOM row rendering is not validated upstream.

This is a rusty-view component concern, not a rusty-roleplay boundary/consumption
failure — confirmed with a single aligned Angular instance, no runtime errors,
and the message array reaching the viewport input. Recommended upstream fix:
rusty-view's `TranscriptViewportComponent` should use `*cdkVirtualFor` (or wire
the autosize experimental strategy). Once published, no change is needed here.

## Commands

```
pnpm install
pnpm exec nx run-many -t lint typecheck vite:test build --all
pnpm exec nx run roleplay-web:serve            # dev server
pnpm exec nx run roleplay-web-e2e:e2e -- --project=chromium
```
