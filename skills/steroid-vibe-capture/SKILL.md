---
name: steroid-vibe-capture
description: This skill should be used when a non-technical user describes what they want to build using natural language. It translates vague aesthetic ideas into a rigorous, structured vibe profile written to .memory/changes/<feature>/vibe.md.
---

# Steroid Vibe Capture

This skill captures a non-technical user's intent and translates it into a structured vibe profile.

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

### 2b. Prompt Quality Check (v5.1.0)

After capturing the initial vibe, assess completeness. If ANY of these are unclear from the user's prompt, fill in sensible defaults and document them in vibe.md:

| Question | Why It Matters | Default If Missing |
|----------|---------------|--------------------|
| Who is this for? | Determines UI complexity, accessibility needs | "General audience" |
| What's the ONE thing it must do well? | Focuses the spec, prevents scope creep | First feature mentioned |
| Any tech preferences? | Prevents wrong framework choice | "No preference — AI decides" |
| Any existing services to integrate? | Surfaces auth, API, DB needs early | "None — standalone app" |
| What's the scale? MVP or full product? | Sets scope boundaries | "MVP — launch fast" |

Add a `## Assumptions` section to vibe.md listing any defaults used:
```markdown
## Assumptions (filled by AI — user did not specify)
- Target audience: General public
- Scale: MVP
- Tech preference: None
```

This guides non-technical users without requiring them to understand development.

### 2c. Remote Repo Check (v5.3.0)

If the user's prompt doesn't mention GitHub, version control, or saving to the cloud, add to the Assumptions section:

```markdown
- Remote repository: None specified — code saved locally only
```

If the user mentions GitHub or provides a repo URL, note it:
```markdown
- Remote repository: https://github.com/user/repo
```

This determines whether CI/CD and deployment steps are generated later in the pipeline.

### 3. Anti-Summarization Directive

NEVER summarize the user's intent with "..." or leave fields blank. NEVER use placeholder text like "[to be determined]". Extract a full, cohesive vision from even the vaguest prompt. If unsure, make a reasonable creative decision and document it.

NEVER summarize existing code. If instructed to reproduce or fork a file, reproduce it line-by-line. Writing "...rest of the code here..." is a critical failure.

### 4. Feature Slug Extraction

Extract a short, URL-safe slug from the user's prompt for the feature folder name.

Examples:
- "Build me a habit tracker" → `habit-tracker`
- "Create a minimal to-do app like Notion" → `todo-app`
- "Design a dashboard for my crypto portfolio" → `crypto-dashboard`

### 5. Physical Folder Creation

Once the slug is determined, physically create the feature folder using the steroid-run enforcer:

```
node steroid-run.cjs init-feature <slug>
```

This is NOT optional. The command validates the slug format and creates `.memory/changes/<slug>/` with the correct structure. If the name is invalid, the command will block you with an error.

### 6. Schema Obedience

Write the output to `.memory/changes/<slug>/vibe.md` using this exact format:

```markdown
# User Vibe Profile
- Feature: <slug>
- Target Aesthetic: [specific visual references, e.g., Apple Health, Dark Mode, Minimalist]
- Core User Flow: [step-by-step description of the primary user journey]
- Key Features:
  1. [non-negotiable feature]
  2. [non-negotiable feature]
  3. [non-negotiable feature]
  4. [additional feature]
  5. [additional feature]
```

### 6. Circuit Breaker Mandate

If at any point you need to run a terminal command, you MUST use:
`node steroid-run.cjs '<command>'`
Direct terminal execution is strictly forbidden.

### 7. Automatic System Handoff

Once `.memory/changes/<slug>/vibe.md` is written, do NOT ask the user for permission to continue. Output exactly one sentence:

"I've locked in the vibe. Turning this into a formal spec now..."

Then immediately read the file at `.agents/skills/steroid-specify/SKILL.md` and follow its instructions.

## Example

<good>
User: "Build me a minimal habit tracker like Apple Health that I can use every day."

Action: Extract slug "habit-tracker", create `.memory/changes/habit-tracker/`, write to `.memory/changes/habit-tracker/vibe.md`:
```markdown
# User Vibe Profile
- Feature: habit-tracker
- Target Aesthetic: Apple Health-inspired, clean white/light gray backgrounds, rounded cards, SF Pro typography, subtle green accent for completed habits
- Core User Flow: Open app → see today's habits as a card list → tap to mark complete → see streak count update → swipe to see weekly overview
- Key Features:
  1. Daily habit checklist with tap-to-complete
  2. Streak tracking with visual calendar
  3. Weekly progress overview with bar chart
  4. Customizable habit creation (name, icon, frequency)
  5. Motivational micro-animations on completion
```

Output: "I've locked in the vibe. Turning this into a formal spec now..."
Action: Read `.agents/skills/steroid-specify/SKILL.md` and follow its instructions.
</good>

<bad>
User: "Build me a habit tracker."

Action: Ask 5 technical questions about database choice and deployment platform.
</bad>
