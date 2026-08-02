# Rusty View consumer bundle evidence — task #6570

This record explains the narrow Roleplay initial-bundle budget revision needed
to consume the current Rusty View public packages. It does not waive the
existing component-style budget or suppress CommonJS diagnostics.

## Compared inputs

- Roleplay source: `b7657df0795a779cc459e8be816b0dc37eff9319`
- existing installed Rusty View release: `0.0.20`
- candidate Rusty View source: `9720a5e94f81057d3fbd39638e457317526a281b`
- candidate package identity: nine locally packed public packages at the
  isolated certification version `0.0.6555`
- method: separate `git archive` checkouts; the sibling working tree and its
  lockfile were not changed during measurement

## Production build comparison

| Input | Initial raw | Estimated transfer | Worker raw | Result under old budget |
|---|---:|---:|---:|---|
| Rusty View 0.0.20 | 1.19 MB | 239.46 kB | 246.10 kB | Pass; warning only |
| Rusty View at `9720a5e` | 1.30 MB | 264.89 kB | 318.08 kB | Fail; 102.68 kB over the 1.20 MB hard cap |

The current packages add about 25.43 kB to the estimated transferred initial
payload. The transcript worker remains a lazy chunk, so its raw growth does not
belong in the initial budget. Development compilation, `rp-layout` and
`rp-message-decorators` typechecks/tests, and the direct boundary browser smoke
all passed against the candidate packages.

## Decision

Roleplay raises only the initial warning/error thresholds from 1.10/1.20 MB to
1.32/1.40 MB. The new warning remains close to the measured 1.30 MB candidate,
and the hard cap leaves less than 100 kB of raw headroom. This is preferable to
pretending the reusable transcript/admin surface can be split safely during a
cross-consumer certification task. Any future increase again crosses a visible
warning before it reaches the hard cap.

The existing CommonJS optimization warnings remain visible and the 4/8 kB
component-style budget is unchanged. A later package-format or lazy-loading
improvement can lower these thresholds using the same comparison method.
