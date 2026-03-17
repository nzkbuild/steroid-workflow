# Imported Design Systems

This directory contains source snapshots that Steroid internalizes as part of its
frontend and accessibility workflow.

Rules for this directory:

- Preserve imported content as close to upstream as possible.
- Make only tiny compatibility edits needed for Steroid integration.
- Track every imported source in `imported-manifest.json`.
- Prefer Steroid wrapper skills over editing imported rule bodies directly.

These imported packs are implementation assets for Steroid. End users should
not need to install or fetch them separately.
