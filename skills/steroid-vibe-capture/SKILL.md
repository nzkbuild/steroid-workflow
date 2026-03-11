---
name: steroid-vibe-capture
description: This skill should be used when a non-technical user describes what they want to build using natural language. It translates vague aesthetic ideas into a rigorous, structured technical spec written to .memory/user_vibe.md.
---

# Steroid Vibe Capture

This skill captures a non-technical user's intent and translates it into a structured specification.

## When To Use

Activate when the user says words like "build", "create", "design", or "make" in the context of generating a new feature or project. Do not wait for explicit skill invocation.

## Instructions

### 1. No Technical Jargon

Never ask about databases, frameworks, deployment, APIs, or any engineering concepts. The user is a "vibe coder" who thinks in terms of aesthetics, flows, and features — not architecture.

### 2. Clarification (Maximum 2 Questions)

If the user's initial prompt is too vague to extract a coherent vision, ask a maximum of 2 high-level questions about:
- Visual style or aesthetic inspiration (e.g., "Should it feel like Apple Health or more like Notion?")
- Core user flow (e.g., "What's the main thing someone does when they open it?")

Do not ask more than 2 questions. If the prompt is clear enough, ask zero questions.

### 3. Anti-Summarization Directive

NEVER summarize the user's intent with "..." or leave fields blank. NEVER use placeholder text like "[to be determined]". Extract a full, cohesive vision from even the vaguest prompt. If unsure, make a reasonable creative decision and document it.

NEVER summarize existing code. If instructed to reproduce or fork a file, reproduce it line-by-line. Writing "...rest of the code here..." is a critical failure.

### 4. Schema Obedience

Write the output to `.memory/user_vibe.md` using this exact format:

```markdown
# User Vibe Profile
- Target Aesthetic: [specific visual references, e.g., Apple Health, Dark Mode, Minimalist]
- Core User Flow: [step-by-step description of the primary user journey]
- Key Features: [3-5 non-negotiable features listed explicitly]
```

### 5. Circuit Breaker Mandate

If at any point you need to run a terminal command, you MUST use:
`npx steroid-run '<command>'`
Direct terminal execution is strictly forbidden.

### 6. Automatic System Handoff

Once `.memory/user_vibe.md` is written, do NOT ask the user for permission to continue. Output exactly one sentence:

"I've locked in the vibe. Translating this into a technical blueprint now..."

Then immediately read the file at `.agents/skills/steroid-architect/SKILL.md` and follow its instructions.

## Example

<good>
User: "Build me a minimal habit tracker like Apple Health that I can use every day."

Action: Write to .memory/user_vibe.md:
```markdown
# User Vibe Profile
- Target Aesthetic: Apple Health-inspired, clean white/light gray backgrounds, rounded cards, SF Pro typography, subtle green accent for completed habits
- Core User Flow: Open app → see today's habits as a card list → tap to mark complete → see streak count update → swipe to see weekly overview
- Key Features:
  1. Daily habit checklist with tap-to-complete
  2. Streak tracking with visual calendar
  3. Weekly progress overview with bar chart
  4. Customizable habit creation (name, icon, frequency)
  5. Motivational micro-animations on completion
```

Output: "I've locked in the vibe. Translating this into a technical blueprint now..."
Action: Read `.agents/skills/steroid-architect/SKILL.md` and follow its instructions.
</good>

<bad>
User: "Build me a habit tracker."

Action: Ask 5 technical questions about database choice and deployment platform.
</bad>
