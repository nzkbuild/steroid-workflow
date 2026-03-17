---
name: steroid-design-orchestrator
description: Internal Steroid wrapper that routes UI-intensive work to the imported design systems and writes design-system.md for later phases.
---

# Steroid Design Orchestrator

This internal Steroid skill is the routing layer for imported design systems.
Users should never need to install or invoke the imported packs directly.

## Imported Sources

- `imported/ui-ux-pro-max/`
- `imported/anthropic-frontend-design/`
- `imported/bencium-ux-designer/`
- `imported/vercel-web-design-guidelines/`
- `imported/vercel-web-interface-guidelines/`
- `imported/vercel-react-best-practices/`
- `imported/vercel-composition-patterns/`
- `imported/vercel-react-native-skills/`

## Responsibilities

1. Detect whether the task is:
   - web UI review
   - web UI generation/refactor
   - React/Next implementation
   - React Native / Expo implementation
   - accessibility-focused audit
2. Load only the minimum relevant imported packs for the task.
3. Write `.memory/changes/<feature>/design-system.md` for UI-intensive work.
4. Hand off stack-specific constraints to architect and engine.

## Routing Rules

- **General design-system generation**: start from `imported/ui-ux-pro-max/`
- **Premium web aesthetic direction**: add `imported/anthropic-frontend-design/`
- **Anti-generic UX discipline**: add `imported/bencium-ux-designer/`
- **React/Next implementation**: add `imported/vercel-react-best-practices/` and `imported/vercel-composition-patterns/`
- **React Native / Expo**: add `imported/vercel-react-native-skills/`
- **Web UI audit**: add `imported/vercel-web-design-guidelines/` and local rules from `imported/vercel-web-interface-guidelines/command.md`

## Guardrails

- Do not rewrite imported rule bodies into Steroid prose.
- Prefer wrapper-level path resolution over editing imported logic.
- Keep imported packs internal; expose Steroid behavior, not raw upstream workflows.
