---
name: steroid-web-design-review
description: Internal Steroid wrapper for web UI audit source inputs and accessibility review.
---

# Steroid Web Design Review

Use this internal skill when Steroid needs to review or audit a web interface.

## Sources

- `steroid-web-review`
- `steroid-interface-review`
- `steroid-ux-discipline`
- `src/services/audit/accesslint-audit.cjs`

## Responsibilities

- Apply web interface guideline rules from the local `command.md` snapshot.
- Surface UI findings in Steroid review format.
- Add accessibility findings from the Steroid-owned AccessLint service during verify.

## Important

- Never depend on a live fetch to GitHub for the guideline rules.
- Load the Steroid-owned local copy of `steroid-interface-review` rules.
