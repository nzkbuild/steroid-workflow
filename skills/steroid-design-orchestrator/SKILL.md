---
name: steroid-design-orchestrator
description: Internal Steroid wrapper that routes UI-intensive work to Steroid source-library inputs and writes design-system.md for later phases.
---

# Steroid Design Orchestrator

This internal Steroid skill is the routing layer for Steroid's frontend source library.
Users should never need to install or invoke internal packs directly.

## Source Inputs

- `steroid-design-system`
- `steroid-web-direction`
- `steroid-ux-discipline`
- `steroid-web-review`
- `steroid-interface-review`
- `steroid-react-rules`
- `steroid-composition-rules`
- `steroid-native-rules`

## Responsibilities

1. Detect whether the task is:
   - web UI review
   - web UI generation/refactor
   - React/Next implementation
   - React Native / Expo implementation
   - accessibility-focused audit
2. Load only the minimum relevant source inputs for the task.
3. Write `.memory/changes/<feature>/design-system.md` for UI-intensive work.
4. Hand off stack-specific constraints to architect and engine.

## Routing Rules

- **General design-system generation**: start from `steroid-design-system`
- **Premium web aesthetic direction**: add `steroid-web-direction`
- **Anti-generic UX discipline**: add `steroid-ux-discipline`
- **React/Next implementation**: add `steroid-react-rules` and `steroid-composition-rules`
- **React Native / Expo**: add `steroid-native-rules`
- **Web UI audit**: add `steroid-web-review` and `steroid-interface-review`

## Guardrails

- Do not expose internal rule bodies as the public product surface.
- Prefer Steroid-owned adapters and summaries over direct internal path references.
- Keep source inputs internal; expose Steroid behavior, not internal workflows.
