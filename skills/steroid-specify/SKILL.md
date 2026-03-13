---
name: steroid-specify
description: This skill should be used after steroid-vibe-capture has written .memory/changes/<feature>/vibe.md. It converts the vibe into a formal specification with prioritized user stories and acceptance criteria, written to .memory/changes/<feature>/spec.md.
---

# Steroid Specify (Specification Generator)

This skill reads the user's vibe from `.memory/changes/<feature>/vibe.md` and produces a formal specification with testable acceptance criteria.

Forked from: `src/forks/spec-kit/templates/spec-template.md` (GitHub Spec Kit, MIT License)

## When To Use

Activate immediately after `@steroid-vibe-capture` completes. Do not wait for user invocation. The vibe.md file must already exist in `.memory/changes/<feature>/`.

## Instructions

### 1. Phase Gate (Physical Enforcement)

Before doing anything, run the gate check:
```
node steroid-run.cjs gate specify <feature>
```
If this command fails, STOP. The vibe capture phase is not complete.

### 2. No User Interaction

Do not ask the user any questions. Read `.memory/changes/<feature>/vibe.md` and translate the vibe into a formal spec. Make all decisions silently.

### 3. Anti-Summarization Directive

NEVER write vague acceptance criteria like "it should work" or "the app looks good". Every criterion must be a binary pass/fail test that a TDD engine can validate.

NEVER summarize existing code. Writing "...rest of the code here..." is a critical failure.

### 4. Circuit Breaker Mandate

If at any point you need to run a terminal command, you MUST use:
`node steroid-run.cjs '<command>'`
Direct terminal execution is strictly forbidden.

### 5. Schema Obedience

Write the output to `.memory/changes/<feature>/spec.md` using this exact format:

```markdown
# Specification: <Feature Name>

**Created**: <date>
**Source**: .memory/changes/<feature>/vibe.md
**Status**: Ready for Research

## Scope Boundary

### In Scope (v1)
- [explicit feature 1]
- [explicit feature 2]

### Out of Scope (not v1)
- [explicitly excluded thing 1]
- [explicitly excluded thing 2]

## User Stories

### Story 1: [Brief Title] (Priority: P1)

[Describe this user journey in plain, non-technical language]

**Acceptance Criteria:**

1. **Given** [initial state], **When** [user action], **Then** [expected outcome]
2. **Given** [initial state], **When** [user action], **Then** [expected outcome]

---

### Story 2: [Brief Title] (Priority: P2)

[Describe this user journey in plain, non-technical language]

**Acceptance Criteria:**

1. **Given** [initial state], **When** [user action], **Then** [expected outcome]

---

### Story 3: [Brief Title] (Priority: P3)

[Continue for all stories derived from the vibe]

---

## Edge Cases

- What happens when [boundary condition]?
- How does the system handle [error scenario]?

## Success Criteria

- **SC-001**: [Measurable outcome, e.g., "User can complete primary flow in under 30 seconds"]
- **SC-002**: [Measurable outcome]
- **SC-003**: [Measurable outcome]

## Hard Constraints (from vibe.md)
- [Copy ALL hard constraints from vibe.md verbatim]
- [These are non-negotiable requirements that override all other decisions]
```

Each user story MUST be independently testable — if you implement just ONE of them, the user should have a working piece of value.

### 6. Story Derivation Rules

From the vibe's "Key Features" list:
- Each feature becomes at least one user story
- P1 = the core flow (what the user does every time they open the app)
- P2 = supporting features that make the core flow better
- P3 = nice-to-haves, polish, delight features

From the vibe's "Core User Flow":
- Each step in the flow becomes at least one acceptance criterion
- The full flow becomes an integration-level success criterion

### 6b. Constraint Pass-Through (v5.5.0)

Read the `Hard Constraints & Directives` field from vibe.md. Copy every single constraint into the spec's `## Hard Constraints` section **verbatim**. Do NOT:
- Summarize them
- Reinterpret them
- Silently drop any of them
- Override them with your own preferences

These constraints are the user's exact words and must survive to the Research and Architect phases unchanged.

### 7. Automatic System Handoff

Once `.memory/changes/<feature>/spec.md` is written, do NOT ask the user for permission. Output exactly one sentence:

"Spec locked. Researching the best tech to build this..."

Then immediately read the file at `.agents/skills/steroid-research/SKILL.md` and follow its instructions.

## Example

<good>
Input (.memory/changes/habit-tracker/vibe.md):
```
# User Vibe Profile
- Target Aesthetic: Apple Health-inspired, clean white backgrounds, rounded cards, green accents
- Core User Flow: Open app → see today's habits → tap to mark complete → see streak update
- Key Features:
  1. Daily habit checklist with tap-to-complete
  2. Streak tracking with visual calendar
  3. Weekly progress overview with bar chart
```

Output (.memory/changes/habit-tracker/spec.md):
```
# Specification: Habit Tracker

**Created**: 2026-03-11
**Source**: .memory/changes/habit-tracker/vibe.md
**Status**: Ready for Research

## Scope Boundary

### In Scope (v1)
- Daily habit list with completion toggle
- Streak counter per habit
- Weekly bar chart overview
- Local storage persistence
- Apple Health-inspired visual design

### Out of Scope (not v1)
- User accounts / cloud sync
- Habit reminders / notifications
- Social features / sharing
- Data export

## User Stories

### Story 1: Complete a Daily Habit (Priority: P1)

The user opens the app and sees their habits for today as a card list. They tap a habit card to mark it complete. The card visually confirms completion with an animation.

**Acceptance Criteria:**

1. **Given** the app is loaded, **When** I see the main screen, **Then** I see a list of my habits as cards
2. **Given** a habit is incomplete, **When** I tap the habit card, **Then** it toggles to "complete" with a checkmark animation
3. **Given** a habit is complete, **When** I tap it again, **Then** it toggles back to "incomplete"
4. **Given** I complete a habit and close the app, **When** I reopen it, **Then** the habit is still marked complete

---

### Story 2: Track My Streak (Priority: P2)

The user can see how many consecutive days they've completed each habit. The streak count is prominently displayed on each habit card.

**Acceptance Criteria:**

1. **Given** I completed a habit today and yesterday, **When** I see the habit card, **Then** it shows "2 day streak"
2. **Given** I missed yesterday, **When** I see the habit card, **Then** the streak shows "0 days" or "1 day" if completed today

---

### Story 3: View Weekly Progress (Priority: P2)

The user can swipe or navigate to a weekly overview that shows a bar chart of completions across the last 7 days.

**Acceptance Criteria:**

1. **Given** I have completion data for the past 7 days, **When** I view the weekly overview, **Then** I see a bar chart with one bar per day
2. **Given** today is Wednesday, **When** I view the chart, **Then** bars for Mon-Wed show actual data and Thu-Sun show empty

---

### Story 4: Add a New Habit (Priority: P3)

The user can create a new habit with a name and icon.

**Acceptance Criteria:**

1. **Given** I'm on the main screen, **When** I tap "Add Habit", **Then** a form appears with name and icon fields
2. **Given** I fill in the form and submit, **When** I return to the main screen, **Then** the new habit appears in the list

---

## Edge Cases

- What happens when the user has zero habits? (Show empty state with prompt to add first habit)
- What happens at midnight? (Reset daily completion status, preserve streak data)
- What happens if localStorage is full? (Show graceful error, don't crash)

## Success Criteria

- **SC-001**: User can add a habit and complete it within 10 seconds
- **SC-002**: Streak counter accurately reflects consecutive completion days
- **SC-003**: App loads all habits from localStorage in under 1 second
- **SC-004**: All P1 stories work independently as a standalone MVP
```
</good>

<bad>
Output: "The app should track habits with a nice UI."
(Too vague. No acceptance criteria. Not testable.)
</bad>

## Referenced Forks

To understand the full, unmodified logic behind the spec format, read:

- `src/forks/spec-kit/templates/spec-template.md` - The original Spec Kit spec template (116 lines)
- `src/forks/openspec/openspec/changes/IMPLEMENTATION_ORDER.md` - The OpenSpec per-change folder pattern example
