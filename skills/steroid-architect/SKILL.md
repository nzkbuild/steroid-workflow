---
name: steroid-architect
description: This skill should be used after steroid-research has written .memory/changes/<feature>/research.md. It converts the spec + research into a rigorous, atomic execution checklist with a defined tech stack, written to .memory/changes/<feature>/plan.md.
---

# Steroid Architect

This skill reads the spec and research from `.memory/changes/<feature>/` and produces a granular, test-ready implementation plan.

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

Use the researched stack from `research.md`. Do NOT guess or pick your own tech stack — the Research skill already investigated and verified the best tools.

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
- [ ] Initialize [framework] project in current directory
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

Each checklist item must:
- Be specific enough that an AI sub-agent with fresh context can execute it without ambiguity
- Reference which user story / acceptance criterion it satisfies (from spec.md)
- Map to researched libraries (from research.md) — not arbitrary choices

### 4. Task Ordering Rules

Follow this order for each component:
1. **Create** the component file with layout/structure
2. **Write test** for the component (referencing spec.md acceptance criteria)
3. **Implement** the component to pass the test
4. **Repeat** for next component

After all components:
5. **Wire up** the components together
6. **Integration test** the full user flow
7. **Polish** styling and animations (referencing vibe.md aesthetic)

### 5. Circuit Breaker Mandate

If at any point you need to run a terminal command, you MUST use:
`node steroid-run.cjs '<command>'`
Direct terminal execution is strictly forbidden.

### 6. Automatic System Handoff

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
- [ ] Initialize Vite + React project with TypeScript template
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
