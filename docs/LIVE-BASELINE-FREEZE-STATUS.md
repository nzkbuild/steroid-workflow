# Live Baseline Freeze Status

Date: 2026-03-18
Status: Draft `v1` live governed baseline frozen

## Governed Baseline

The live governed baseline is now frozen under `governed/` for these transplanted subsystems:

- `governed/scan-system/`
- `governed/spec-system/`
- `governed/research-system/`
- `governed/execution-engine/`
- `governed/review-and-verify/`
- `governed/progress-memory/`
- `governed/core-runtime/`

## Authority

For the governed live baseline, authority order is:

1. `governed/<slice>/MODULE.yaml`
2. `governed/<slice>/LIVE-MAPPING.md`
3. `governed/<slice>/PROVENANCE.md`
4. `governed/<slice>/PARITY.md`
5. runtime skill and CLI files

## Freeze Meaning

This freeze means:

- the governed migration map for the live core is complete
- the governed baseline slices are structurally aligned
- the governed baseline slices are parity-aligned
- the governed baseline slices are migration-closed
- future work should implement or extend from this baseline rather than reopen architecture design

## Governed Live Artifacts

The current live governed baseline depends on these durable runtime surfaces:

- `.memory/changes/<feature>/request.json`
- `.memory/changes/<feature>/spec.md`
- `.memory/changes/<feature>/research.md`
- `.memory/changes/<feature>/plan.md`
- `.memory/changes/<feature>/tasks.md`
- `.memory/changes/<feature>/execution.json`
- `.memory/changes/<feature>/review.md`
- `.memory/changes/<feature>/review.json`
- `.memory/changes/<feature>/verify.md`
- `.memory/changes/<feature>/verify.json`
- `.memory/changes/<feature>/completion.json`
- `.memory/progress.md`

## Next Phase

The next phase is not additional core slice design. The next phase is:

1. keep the live governed baseline stable
2. commit the governed-baseline milestone
3. choose a second-wave transplant set or enforcement-hardening pass
