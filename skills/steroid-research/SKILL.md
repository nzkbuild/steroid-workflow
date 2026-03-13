---
name: steroid-research
description: This skill should be used after steroid-specify has written .memory/changes/<feature>/spec.md. It investigates the best tech stack, libraries, and patterns to implement the spec, writing findings to .memory/changes/<feature>/research.md.
---

# Steroid Research (Tech Investigation Agent)

This skill reads the spec from `.memory/changes/<feature>/spec.md` and investigates the best technical approach before the Architect commits to a plan.

Forked from: `src/forks/gsd/agents/gsd-phase-researcher.md` (Get-Shit-Done, MIT License) — simplified from 556 to ~150 lines for the Steroid non-technical context.

## When To Use

Activate immediately after `@steroid-specify` completes. Do not wait for user invocation. The spec.md file must already exist in `.memory/changes/<feature>/`.

## Instructions

### 1. Phase Gate (Physical Enforcement)

Before doing anything, run the gate check:
```
node steroid-run.cjs gate research <feature>
```
If this command fails, STOP. The specification phase is not complete.

### 2. No User Interaction

Do not ask the user any questions. Read `.memory/changes/<feature>/spec.md`, investigate what's needed, and make all recommendations silently.

### 2. Research Philosophy

> Forked from GSD: "Research is investigation, not confirmation."

- Treat your training data as **hypothesis, not fact**. Libraries change, APIs break, best practices evolve.
- **Verify before asserting** — don't state library capabilities without checking official docs or package registries.
- **Be honest about gaps** — "I couldn't verify this" is more valuable than a confident lie.
- **Be prescriptive, not exploratory** — "Use X" not "Consider X or Y". The Architect needs decisions, not options.

### 3. Circuit Breaker Mandate

If at any point you need to run a terminal command, you MUST use:
`node steroid-run.cjs '<command>'`
Direct terminal execution is strictly forbidden.

### 3b. Constraint Obedience (v5.5.0)

Read the `## Hard Constraints` section from spec.md. If the user explicitly requested a specific technology, version, or approach (e.g., "must use Framer Motion", "do NOT use a database"), the research MUST:
- Center around that constraint, not recommend alternatives
- Explain how to best use the constrained technology, not argue against it
- Only flag constraints that are technically impossible (e.g., "use React for an iOS native app")

### 3c. Brownfield Context Check (v5.5.0)

Read vibe.md for the `Project Type` field. If it says **Brownfield**:

1. Run `node steroid-run.cjs scan` to detect the existing tech stack
2. Your research MUST respect the existing stack — do NOT recommend replacing it
3. Focus on libraries that integrate with what's already there
4. Note version compatibility with existing dependencies

### 4. What To Investigate

For each user story in the spec, identify:

**Standard Stack** — What libraries/frameworks are the proven choice for this type of feature?
- Include specific version numbers
- Prefer stable, well-maintained packages over trendy new ones
- For a non-technical user's project, prefer zero-config or minimal-config tools

**Architecture Patterns** — What's the recommended project structure and design approach?
- File organization that scales
- State management approach
- Data flow patterns

**Don't Hand-Roll** — What problems look simple but have battle-tested solutions?
- Date/time handling → use a library
- Form validation → use a library
- Charting → use a library
- Never build what npm already solved

**Common Pitfalls** — What do beginners get wrong with this tech?
- Gotchas that cause hours of debugging
- Configuration traps
- Dependency conflicts

### 5. Confidence Levels

Every recommendation MUST include a confidence level:

| Level | Meaning | Based On |
|-------|---------|----------|
| **HIGH** | Verified against official docs or package registry | Official documentation, npm/PyPI page |
| **MEDIUM** | Multiple credible sources agree | Blog posts, Stack Overflow, community consensus |
| **LOW** | Based on training data only, unverified | Flag for validation |

Never present LOW confidence findings as authoritative.

### 6. Schema Obedience

Write the output to `.memory/changes/<feature>/research.md` using this exact format:

```markdown
# Research: <Feature Name>

**Researched**: <date>
**Spec Source**: .memory/changes/<feature>/spec.md
**Overall Confidence**: [HIGH/MEDIUM/LOW]

## Summary

[2-3 paragraph executive summary of what was investigated and the primary recommendation]

## Standard Stack

### Core
| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| [name] | [ver] | [what it does] | [HIGH/MEDIUM/LOW] |

### Installation
```bash
npm install [packages]
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── [folder]/        # [purpose]
├── [folder]/        # [purpose]
└── [folder]/        # [purpose]
```

### Key Patterns
- **[Pattern Name]**: [description and when to use it]

### Complex Architecture (v5.4.0 — investigate if applicable)

If context.md or the user's request involves any of these, research them specifically:

| Pattern | When to Investigate | What to Research |
|---------|-------------------|-----------------|
| Monorepo | Multiple packages/apps in one repo | Workspace tool (turborepo/nx/pnpm workspaces), shared deps |
| Docker | Deployment isolation or services | Dockerfile patterns, docker-compose for dev, multi-stage builds |
| Microservices | Multiple backends communicating | API gateway, service communication (REST/gRPC/message queue) |
| Multi-language | Python + JS, Go + React, etc. | Project structure, build orchestration, shared types |
| Database | Persistent data needed | ORM choice, migration strategy, seed data, connection pooling |
| Auth | User accounts or protected routes | Provider (Clerk/Auth.js/Supabase Auth/JWT), token storage |
| Real-time | Live updates or collaboration | WebSocket vs SSE vs polling, state sync |
| CI/CD | Auto-deploy needed | GitHub Actions, Vercel, Railway, Docker registry |

If none of these patterns apply, skip this section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| [problem] | [custom solution] | [library] | [edge cases it handles] |

## Common Pitfalls

### Pitfall 1: [Name]
**What goes wrong**: [description]
**How to avoid**: [prevention strategy]

## Security Considerations (v5.1.0 — mandatory)

Every research output MUST include this section, even for simple projects:

1. **Dependency audit** — Note if any recommended package has known CVEs. Run `node steroid-run.cjs 'npm audit --production'` after install.
2. **User input** — If the app accepts user input, document XSS/CSRF prevention approach.
3. **Authentication** — If the app needs auth, document token storage strategy (never localStorage for JWTs).
4. **Secrets** — Document `.env` strategy for API keys. Never hardcode secrets in source.
5. **HTTPS** — Note if deployment requires SSL configuration.

For static sites with no user input: "No server-side security concerns. Ensure no API keys or secrets in client bundle."

## Industry Standards & Compliance (v5.5.0 — mandatory)

Assess whether the feature being built triggers any regulatory or industry standards:

| Domain | Standard | When It Applies |
|--------|----------|----------------|
| User data / EU users | GDPR | Any app collecting personal data |
| Health data | HIPAA | Health tracking, medical records |
| Payments | PCI DSS | Processing credit cards |
| Accessibility | WCAG 2.1 AA | All web apps (non-negotiable baseline) |
| Security | OWASP Top 10 | Any app with user input or authentication |

If applicable, add a `## Compliance Requirements` section to research.md documenting which standards apply and what the Architect must include in the plan. If none apply, write: "No regulatory requirements detected for this feature."

## Deployment Strategy (v5.3.0 — mandatory)

Every research output MUST include deployment guidance:

- **Platform**: [Vercel/Netlify/Railway/Docker — recommend based on project type]
- **Build command**: [exact command, e.g., `npm run build`]
- **Output directory**: [dist/out/.next/build]
- **Environment variables**: [list from .env.example, or "None"]

For simple static sites: "Deploy `dist/` to Vercel or Netlify. Zero config needed."

## Open Questions

- [Anything unresolved that the Architect should be aware of]
```

### 7. Anti-Summarization Directive

NEVER write vague research like "use a modern framework" or "follow best practices". Every recommendation must be specific with a version number and a reason.

NEVER summarize existing code. Writing "...rest of the code here..." is a critical failure.

### 8. Automatic System Handoff

Once `.memory/changes/<feature>/research.md` is written, do NOT ask the user for permission. Output exactly one sentence:

"Research complete. Building the technical blueprint now..."

Then immediately read the file at `.agents/skills/steroid-architect/SKILL.md` and follow its instructions.

## Example

<good>
Input (from spec.md): Habit tracker with daily checklist, streak tracking, weekly bar chart, Apple Health aesthetic

Output (.memory/changes/habit-tracker/research.md):
```
# Research: Habit Tracker

**Researched**: 2026-03-11
**Spec Source**: .memory/changes/habit-tracker/spec.md
**Overall Confidence**: HIGH

## Summary

A habit tracker with daily completion, streak tracking, and weekly charts is a well-understood problem space. React + Vite is the standard stack for this type of single-page app. Chart.js handles the bar chart requirement. No backend needed — localStorage with a simple JSON schema covers persistence.

The biggest risk is date/time handling for streak calculations. Using date-fns prevents timezone and midnight-rollover bugs that always bite custom implementations.

## Standard Stack

### Core
| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| React | 18.3 | UI framework | HIGH |
| Vite | 5.4 | Build tool, zero-config | HIGH |
| TypeScript | 5.6 | Type safety | HIGH |
| Tailwind CSS | 3.4 | Utility-first styling | HIGH |
| Chart.js | 4.4 | Bar chart for weekly overview | HIGH |
| react-chartjs-2 | 5.2 | React wrapper for Chart.js | HIGH |
| date-fns | 3.6 | Date manipulation (streak calc) | HIGH |

### Installation
```bash
npm create vite@latest . -- --template react-ts
npm install tailwindcss chart.js react-chartjs-2 date-fns
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/      # HabitCard, HabitList, StreakCounter, WeeklyChart, AddHabitModal
├── hooks/           # useHabits (localStorage CRUD), useStreak (streak calculation)
├── types/           # Habit, CompletionRecord, DayData
├── utils/           # date helpers, storage helpers
├── App.tsx          # Main layout and routing
└── main.tsx         # Entry point
```

### Key Patterns
- **Custom Hooks for State**: useHabits() encapsulates all localStorage read/write logic. Components never touch localStorage directly.
- **Immutable State Updates**: Always create new arrays/objects when updating habits. Never mutate state directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date math | Custom day-difference calc | date-fns differenceInCalendarDays | Timezone bugs, DST, leap years |
| Bar charts | Canvas/SVG from scratch | Chart.js + react-chartjs-2 | Responsive, accessible, animated |
| CSS utilities | Custom utility classes | Tailwind CSS | Apple Health aesthetic achievable with rounded-xl, shadow-sm, bg-emerald-500 |

## Common Pitfalls

### Pitfall 1: Midnight Rollover
**What goes wrong**: Streak breaks or doubles when user completes a habit near midnight
**How to avoid**: Use date-fns startOfDay() to normalize all timestamps. Compare calendar days, not timestamps.

### Pitfall 2: localStorage Quota
**What goes wrong**: Silent failures when storage is full (~5MB limit)
**How to avoid**: Wrap localStorage.setItem in try/catch. Show graceful error if full.

### Pitfall 3: Chart.js Tree Shaking
**What goes wrong**: Bundle bloat from importing all of Chart.js
**How to avoid**: Import only needed components: `import { Bar } from 'react-chartjs-2'` and register only used elements.

## Open Questions

- None. This is a well-understood problem space with stable tools.
```
</good>

<bad>
Output: "Use React and some charting library. Follow best practices for state management."
(Too vague. No versions. No confidence levels. Not actionable.)
</bad>

## Referenced Forks

To understand the full, unmodified logic behind this skill's research methodology, read:

- `src/forks/gsd/agents/gsd-phase-researcher.md` - The complete GSD research agent (556 lines)
- `src/forks/gsd/agents/gsd-research-synthesizer.md` - The GSD research synthesis agent
