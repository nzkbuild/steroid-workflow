---
name: steroid-web-design-review
description: Internal Steroid wrapper for imported web UI audit rules and accessibility review.
---

# Steroid Web Design Review

Use this internal skill when Steroid needs to review or audit a web interface.

## Sources

- `imported/vercel-web-design-guidelines/SKILL.md`
- `imported/vercel-web-interface-guidelines/command.md`
- `imported/bencium-ux-designer/`
- `integrations/accesslint/`

## Responsibilities

- Apply imported web interface guideline rules from the local `command.md` snapshot.
- Surface UI findings in Steroid review format.
- Add accessibility findings from the AccessLint integration during verify.

## Important

- Never depend on a live fetch to GitHub for the guideline rules.
- Load `imported/vercel-web-interface-guidelines/command.md` locally.
