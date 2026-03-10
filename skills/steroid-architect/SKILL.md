---
name: steroid-architect
description: This skill should be used after steroid-vibe-capture has written .memory/user_vibe.md. It converts the vibe specification into a rigorous, atomic execution checklist with a defined tech stack, written to .memory/project_state.md.
---

# Steroid Architect

This skill reads the user's vibe specification from `.memory/user_vibe.md` and produces a granular, test-ready implementation plan.

## When To Use

Activate immediately after `@steroid-vibe-capture` completes. Do not wait for user invocation.

## Instructions

### 1. No User Interaction

Do not ask the user any questions. Read `.memory/user_vibe.md` and make all architectural decisions silently. Select the optimal, stable, modern tech stack to achieve the vibe (e.g., Vite+React+Tailwind, Next.js+Supabase, or vanilla HTML/CSS/JS depending on complexity).

### 2. Anti-Summarization Directive

NEVER write vague tasks like "Setup Auth", "Build Backend", or "Implement Frontend". Every task must be a 5-minute atomic step that a TDD engine can execute.

NEVER summarize existing code. If instructed to reproduce or fork a file, reproduce it line-by-line. Writing "...rest of the code here..." is a critical failure.

NEVER use "..." or truncate the checklist. Write every single task explicitly.

### 3. Schema Obedience

Write the output to `.memory/project_state.md` using this exact format:

```markdown
## Tech Stack
- Frontend: [specific framework and version]
- Backend: [specific framework and version, or "None - static site"]
- Database: [specific provider, or "None - local storage"]
- Styling: [specific CSS framework or approach]

## Execution Checklist
- [ ] Initialize [framework] project in current directory
- [ ] Install and configure [styling solution]
- [ ] Create [Component A] with layout and placeholder content
- [ ] Write test for [Component A] core behavior
- [ ] Implement [Component A] to pass test
- [ ] Create [Component B] with [specific functionality]
- [ ] Write test for [Component B] core behavior
- [ ] Implement [Component B] to pass test
- [ ] Connect [Component A] and [Component B] via [routing/state]
- [ ] Write integration test for the full user flow
- [ ] Apply final styling polish and micro-animations
```

Each checklist item must be specific enough that an AI sub-agent with fresh context can execute it without ambiguity.

### 4. Automatic System Handoff

Once `.memory/project_state.md` is written, do NOT ask the user for permission. Output exactly one sentence:

"The technical blueprint is finalized. Let's start building."

Then immediately invoke `@steroid-engine`.

## Example

<good>
Input (.memory/user_vibe.md): Minimal habit tracker, Apple Health inspired

Output (.memory/project_state.md):
```markdown
## Tech Stack
- Frontend: React 18 via Vite 5
- Backend: None - local storage
- Database: Browser localStorage
- Styling: Tailwind CSS 3

## Execution Checklist
- [ ] Initialize Vite + React project with TypeScript template
- [ ] Install and configure Tailwind CSS 3 with default config
- [ ] Create HabitCard component with name, icon, and completion toggle
- [ ] Write test: HabitCard toggles completion state on click
- [ ] Implement HabitCard to pass test
- [ ] Create HabitList component rendering array of HabitCards
- [ ] Write test: HabitList renders 3 habits from mock data
- [ ] Implement HabitList to pass test
- [ ] Create AddHabitModal with name and icon input fields
- [ ] Write test: AddHabitModal calls onAdd callback with form data
- [ ] Implement AddHabitModal to pass test
- [ ] Create StreakCounter component showing consecutive completion days
- [ ] Write test: StreakCounter calculates streak from completion history
- [ ] Implement StreakCounter to pass test
- [ ] Create WeeklyOverview component with bar chart for 7-day history
- [ ] Write test: WeeklyOverview renders correct bar heights from data
- [ ] Implement WeeklyOverview to pass test
- [ ] Connect all components in App.tsx with localStorage persistence
- [ ] Write integration test: full flow from add habit to mark complete to see streak
- [ ] Apply Apple Health-inspired styling: rounded cards, SF Pro font, green accents
- [ ] Add micro-animations: checkmark bounce on completion, card slide-in on load
```
</good>

<bad>
Output: "Setup frontend. Build habit tracking. Add styling."
(Too vague. Not atomic. Not testable.)
</bad>
