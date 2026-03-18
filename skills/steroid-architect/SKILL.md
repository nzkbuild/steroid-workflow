---
name: steroid-architect
description: This skill should be used after steroid-research has written .memory/changes/<feature>/research.md. It converts the spec + research into a rigorous, atomic execution checklist with a defined tech stack, written to .memory/changes/<feature>/plan.md.
---

# Steroid Architect

This skill reads the spec and research from `.memory/changes/<feature>/` and produces a granular, test-ready implementation plan.

## Governed Baseline

The live governed authority for the planning surface is:

- `governed/spec-system/MODULE.yaml`
- `governed/spec-system/LIVE-MAPPING.md`
- `governed/spec-system/PROVENANCE.md`
- `governed/spec-system/PARITY.md`

In the live repo, this skill implements the `plan_md` part of the governed `steroid-spec-system` after the specification artifact has been locked.

## When To Use

Activate immediately after `@steroid-research` completes. Do not wait for user invocation.

## Instructions

### 1. Phase Gate (Physical Enforcement)

Before doing anything, run the gate check:

```
node steroid-run.cjs gate architect <feature>
```

If this command fails, STOP. The research phase is not complete.

### 2. No User Interaction

Do not ask the user any questions. Read the following files and make all architectural decisions silently:

1. `.memory/changes/<feature>/vibe.md` — The aesthetic vision
2. `.memory/changes/<feature>/spec.md` — The acceptance criteria
3. `.memory/changes/<feature>/research.md` — The investigated tech stack and patterns
4. `.memory/changes/<feature>/prompt.json` — The normalized prompt interpretation, if present
5. `.memory/changes/<feature>/design-routing.json` — The internal frontend routing receipt, if present
6. `.memory/changes/<feature>/design-system.md` — The generated design system artifact, if present

Use the researched stack from `research.md`. Do NOT guess or pick your own tech stack — the Research skill already investigated and verified the best tools.
For UI-intensive work, `design-system.md` is the binding frontend artifact. The physical gate now blocks architect if UI work is missing `design-routing.json` or `design-system.md`.

### 2. Anti-Summarization Directive

NEVER write vague tasks like "Setup Auth", "Build Backend", or "Implement Frontend". Every task must be a 5-minute atomic step that a TDD engine can execute.

NEVER summarize existing code. If instructed to reproduce or fork a file, reproduce it line-by-line. Writing "...rest of the code here..." is a critical failure.

NEVER use "..." or truncate the checklist. Write every single task explicitly.

### 3. Schema Obedience

Write the output to `.memory/changes/<feature>/plan.md` using this exact format:

```markdown
# Implementation Plan: <Feature Name>

**Source**: .memory/changes/<feature>/spec.md + research.md
**Created**: <date>

## Tech Stack

- Frontend: [from research.md Standard Stack]
- Backend: [from research.md Standard Stack, or "None"]
- Database: [from research.md, or "None - localStorage"]
- Styling: [from research.md Standard Stack]

## Execution Checklist

- [ ] Initialize [framework] project via temp-directory scaffold (see engine scaffold safety)
- [ ] Install and configure [from research.md installation command]
- [ ] Create [Component A] with layout and placeholder content
- [ ] Write test for [Component A] core behavior (Story 1, AC 1)
- [ ] Implement [Component A] to pass test
- [ ] Create [Component B] with [specific functionality]
- [ ] Write test for [Component B] core behavior (Story 2, AC 1)
- [ ] Implement [Component B] to pass test
- [ ] Connect [Component A] and [Component B] via [routing/state]
- [ ] Write integration test for the full user flow (SC-001)
- [ ] Apply final styling polish and micro-animations
```

**Brownfield Override (v5.5.0):** If vibe.md has `Project Type: Brownfield`, do NOT include:

- `Initialize [framework] project` tasks — the project already exists
- `npm init` or framework scaffolding commands
- Tasks that would overwrite existing config files (`tsconfig.json`, `next.config.*`, etc.)

Instead, generate an _integration_ checklist that adds to the existing structure without destroying it.

Each checklist item must:

- Be specific enough that an AI sub-agent with fresh context can execute it without ambiguity
- Reference which user story / acceptance criterion it satisfies (from spec.md)
- Map to researched libraries (from research.md) — not arbitrary choices

If `prompt.json` exists, adapt the checklist shape to the approved route without breaking the structure:

- `lite-change` → keep the checklist tight and focused on the smallest viable set of files/tasks
- `resume-mode` → prefer incremental integration tasks over fresh setup tasks
- `split-work` → group tasks by sub-problem or story so execution does not blend multiple intents together
- `research-heavy` → include explicit validation or compatibility tasks before implementation

Do NOT invent new route names. Use `prompt.json` only as planning context inside the existing structure.

**UI-intensive override:** If `research.md` contains `## Design Intelligence`, the checklist MUST translate it into implementation tasks. Do not leave design direction trapped in research. Create explicit tasks for tokens, layout hierarchy, component states, responsive behavior, accessibility constraints, imported rule application, and final anti-pattern review.
If `design-system.md` exists, the checklist MUST reference it explicitly in frontend tasks instead of inventing a separate design direction.

### 4. Task Ordering Rules

Follow this order for each component:

1. **Create** the component file with layout/structure
2. **Write test** for the component (referencing spec.md acceptance criteria)
3. **Implement** the component to pass the test
4. **Repeat** for next component

After all components: 5. **Wire up** the components together 6. **Integration test** the full user flow 7. **Polish** styling and animations (referencing vibe.md aesthetic)

### 5. Circuit Breaker Mandate

If at any point you need to run a terminal command, you MUST use:
`node steroid-run.cjs '<command>'`
Direct terminal execution is strictly forbidden.

### 6. Mandatory Quality Tasks (v5.1.0)

Append these tasks to EVERY execution checklist, regardless of what the user asked for. These are industry-standard non-negotiables:

```markdown
## Quality Baseline (auto-added)

- [ ] Semantic HTML: use proper heading hierarchy (h1→h2→h3), landmark elements (header, main, footer, nav)
- [ ] Accessibility: add aria-labels to all interactive elements, alt text on all images
- [ ] SEO: add meta title, meta description, and OG tags (og:title, og:description, og:image) to layout/head
- [ ] Responsive: verify layout at 320px, 768px, 1024px, 1440px viewports
- [ ] Performance: lazy-load images, minimize JS bundle in initial load
```

### 6a. Frontend Design Quality (auto-added for UI-intensive work)

If `research.md` contains a `## Design Intelligence` section, append these checklist items:

```markdown
## Frontend Design Quality (auto-added for UI-intensive work)

- [ ] Establish semantic design tokens for color, typography, spacing, radius, shadow, and motion before final polish
- [ ] Implement layout hierarchy and core page composition according to the researched pattern before decorative effects
- [ ] Add all required interactive states: hover, focus, active, disabled, loading, empty, and error
- [ ] Validate responsive behavior and readability at the researched breakpoints
- [ ] Run a final anti-pattern pass against research.md so the UI does not regress into generic AI-generated styling
```

### 6b. Documentation Baseline (v5.2.0 — auto-added)

```markdown
## Documentation (auto-added)

- [ ] Create README.md: project name, one-line description, how to install, how to run, tech stack
- [ ] Create CHANGELOG.md with initial v0.1.0 entry
- [ ] Set package.json version to 0.1.0 (semver)
```

These are non-negotiable. Every project ships with a README and a version.

### 6c. Error Handling Baseline (v5.3.0 — auto-added)

```markdown
## Error Handling (auto-added)

- [ ] Add global error boundary (React) or top-level try/catch (Node.js) for unhandled errors
- [ ] Add loading states/skeletons for async data fetching
- [ ] Handle unknown routes with a 404 page or redirect
- [ ] Validate all user input before processing (forms, API params)
```

### 6d. Environment & Deployment (v5.3.0 — auto-added)

```markdown
## Ship Readiness (auto-added)

- [ ] Create .env.example documenting all required environment variables (API keys, URLs, flags) — never commit real secrets
- [ ] Add .env and .env.local to .gitignore
- [ ] Add deployment section to README.md: build command, output directory, recommended platform (Vercel/Netlify/Railway)
- [ ] Create .github/workflows/ci.yml: install → lint → build → test on push/PR (only if GitHub remote exists)
```

### 6e. Compliance Baseline (v5.5.0 — auto-added if applicable)

If `research.md` contains a `## Compliance Requirements` section, add the corresponding checklist items:

```markdown
## Compliance (auto-added from research.md)

- [ ] [Specific compliance task, e.g., "Add cookie consent banner for GDPR"]
- [ ] [Specific compliance task, e.g., "Implement rate limiting on auth endpoints (OWASP)"]
- [ ] [Specific compliance task, e.g., "Add aria-labels to all interactive elements (WCAG 2.1 AA)"]
```

If research.md says "No regulatory requirements detected", skip this section entirely.

### 7. Automatic System Handoff

Once `.memory/changes/<feature>/plan.md` is written, do NOT ask the user for permission. Output exactly one sentence:

"The technical blueprint is finalized. Let's start building."

Then immediately read the file at `.agents/skills/steroid-engine/SKILL.md` and follow its instructions.

## Example

<good>
Input (from spec.md + research.md): Habit tracker with React 18/Vite 5/Tailwind CSS/Chart.js, user stories for daily completion, streak tracking, weekly overview

Output (.memory/changes/habit-tracker/plan.md):

```markdown
# Implementation Plan: Habit Tracker

**Source**: .memory/changes/habit-tracker/spec.md + research.md
**Created**: 2026-03-11

## Tech Stack

- Frontend: React 18.3 via Vite 5.4 with TypeScript
- Backend: None - local storage
- Database: Browser localStorage
- Styling: Tailwind CSS 3.4

## Execution Checklist

- [ ] Scaffold Vite + React project into .steroid-scaffold-tmp and merge into root
- [ ] Install tailwindcss chart.js react-chartjs-2 date-fns and configure Tailwind
- [ ] Create HabitCard component with name, icon, and completion toggle (Story 1)
- [ ] Write test: HabitCard toggles completion state on click (Story 1, AC 2)
- [ ] Implement HabitCard to pass test
- [ ] Create useHabits hook for localStorage CRUD operations (Architecture Pattern from research)
- [ ] Write test: useHabits persists habit state across renders (Story 1, AC 4)
- [ ] Implement useHabits to pass test
- [ ] Create HabitList component rendering array of HabitCards (Story 1)
- [ ] Write test: HabitList renders habits from useHabits hook (Story 1, AC 1)
- [ ] Implement HabitList to pass test
- [ ] Create StreakCounter component using date-fns differenceInCalendarDays (Story 2)
- [ ] Write test: StreakCounter calculates streak from completion history (Story 2, AC 1-2)
- [ ] Implement StreakCounter to pass test (use date-fns startOfDay to avoid Pitfall 1)
- [ ] Create WeeklyChart component using Chart.js Bar via react-chartjs-2 (Story 3)
- [ ] Write test: WeeklyChart renders correct bar data for 7-day history (Story 3, AC 1-2)
- [ ] Implement WeeklyChart to pass test (import only Bar - avoid Pitfall 3)
- [ ] Create AddHabitModal with name and icon input fields (Story 4)
- [ ] Write test: AddHabitModal calls onAdd callback with form data (Story 4, AC 1-2)
- [ ] Implement AddHabitModal to pass test
- [ ] Connect all components in App.tsx with localStorage persistence
- [ ] Write integration test: full flow from add habit → mark complete → see streak → see chart (SC-001)
- [ ] Apply Apple Health-inspired styling: rounded-xl, shadow-sm, bg-emerald-500 (from vibe.md)
- [ ] Add micro-animations: checkmark bounce on completion, card slide-in on load
```

</good>

<bad>
Output: "Setup frontend. Build habit tracking. Add styling."
(Too vague. Not atomic. Not testable. No spec/research references.)
</bad>

## Referenced Forks

To understand the full, unmodified logic behind the upstream methodology, read:

- `src/forks/spec-kit/templates/plan-template.md` - Spec Kit's plan template
- `src/forks/spec-kit/templates/tasks-template.md` - Spec Kit's task breakdown template
