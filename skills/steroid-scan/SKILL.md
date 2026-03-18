---
name: steroid-scan
description: The codebase awareness skill for Steroid-Workflow. This skill scans the existing project before any build work begins, producing a context.md snapshot that all downstream phases reference. It detects tech stack, project structure, existing patterns, test infrastructure, and related code.
---

# Steroid Scan (Codebase Awareness)

This skill runs **before** vibe capture. It builds a `context.md` snapshot of the existing codebase so all downstream phases know what already exists. Without this, the AI works blind — proposing architectures that conflict with existing code, missing available libraries, and duplicating logic.

## Governed Baseline

The live governed authority for this phase is:

- `governed/scan-system/MODULE.yaml`
- `governed/scan-system/LIVE-MAPPING.md`

In the live repo, this skill is the execution surface for the governed `steroid-scan-system`.

The governed live scan artifacts are:

- `.memory/changes/<feature>/request.json`
- `.memory/changes/<feature>/context.md`

This skill is adapted from the GSD Codebase Mapper (see `src/forks/gsd/agents/gsd-codebase-mapper.md`) and the Ralph AGENTS.md system (see `src/forks/ralph/AGENTS.md`).

## The Circuit Breaker Mandate

All terminal commands executed by this skill MUST be wrapped in the physical Node.js circuit breaker:

```
node steroid-run.cjs '<command>'
```

For file inspection on hardened or Windows environments, prefer shell-free subcommands like `node steroid-run.cjs fs-cat ...`, `node steroid-run.cjs fs-find ...`, `node steroid-run.cjs fs-grep ...`, and `node steroid-run.cjs fs-ls ...`. Do not fall back to `Get-Content`, `cat`, `type`, `find`, `grep`, pipes, or redirection just to inspect code.

Direct terminal commands are strictly forbidden. See `skills/steroid-engine/SKILL.md` for the full mandate.

## When To Run

This skill triggers automatically when the user expresses intent to build, fix, refactor, migrate, or document something. It runs ONCE per feature, BEFORE the vibe capture phase.

If `.memory/changes/<feature>/context.md` already exists and is less than 24 hours old, skip the scan and report: "✅ Context already captured for this feature."

## The Scan Process

### Step 0: Capture Request Receipt

Before writing `context.md`, create `.memory/changes/<feature>/request.json`.

This is the governed live `feature_request` artifact for the scan slice. It should minimally record:

- `feature`
- `source: scan`
- `requested_at`
- `summary`

The summary may be brief if the raw user request is sparse. The point of this receipt is durable intake identity for the scan phase, not full prompt interpretation.

### Step 1: Detect Tech Stack

Read the project's package manifest to identify language, framework, and key dependencies.

```bash
# Node.js projects
node steroid-run.cjs fs-cat package.json --head=80 --optional

# Python projects  
node steroid-run.cjs fs-cat requirements.txt pyproject.toml --head=50 --optional

# Go projects
node steroid-run.cjs fs-cat go.mod --head=30 --optional

# Rust projects
node steroid-run.cjs fs-cat Cargo.toml --head=30 --optional

# Java/Kotlin projects (v5.4.0)
node steroid-run.cjs fs-cat pom.xml build.gradle --head=40 --optional

# Ruby projects (v5.4.0)
node steroid-run.cjs fs-cat Gemfile --head=30 --optional

# PHP projects (v5.4.0)
node steroid-run.cjs fs-cat composer.json --head=40 --optional

# .NET/C# projects (v5.4.0)
node steroid-run.cjs fs-find . --name=*.csproj --name=*.fsproj --type=file --max-depth=2 --limit=5

# Flutter/Dart projects (v5.4.0)
node steroid-run.cjs fs-cat pubspec.yaml --head=30 --optional
```

Check ALL of the above — a project may use multiple languages (e.g., Node.js frontend + Python backend).

Extract:
- Primary language and version (may be multiple for monorepos)
- Framework (React, Next.js, Express, Django, Spring, Rails, Laravel, etc.)
- Key dependencies (database clients, auth libraries, UI frameworks)
- Build tool (Vite, Webpack, esbuild, Maven, Gradle, Cargo, etc.)

### Step 2: Map Project Structure

Build a condensed file tree (max 2 levels deep, exclude noise directories).

```bash
node steroid-run.cjs fs-ls .
```

Identify:
- Entry points (`src/index.*`, `src/main.*`, `app/page.*`, `src/App.*`)
- API routes (if web project)
- Component directories (if frontend)
- Service/model layers (if backend)

### Step 3: Load Existing Patterns

Check for project-level AI instructions and learnings.

**Source: Ralph AGENTS.md system** (see `src/forks/ralph/AGENTS.md`)

```bash
# Check for existing AI instructions
node steroid-run.cjs fs-cat AGENTS.md CLAUDE.md GEMINI.md --head=100 --optional

# Check for existing progress/learnings
node steroid-run.cjs fs-cat .memory/progress.md --head=50 --optional
```

Extract:
- Coding conventions documented in AGENTS.md
- Codebase patterns from progress.md
- Project-specific rules and gotchas

### Step 4: Detect Test Infrastructure

**Source: GSD Validation Architecture** (see `src/forks/gsd/agents/gsd-phase-researcher.md` lines 410-433)

```bash
# Detect test framework config
node steroid-run.cjs detect-tests
node steroid-run.cjs fs-find . --name=jest.config.* --name=vitest.config.* --name=pytest.ini --name=.mocharc.* --name=karma.conf.* --type=file --max-depth=2 --limit=20

# Count existing tests
node steroid-run.cjs fs-find . --name=*.test.* --name=*.spec.* --name=test_* --type=file --count

# Detect test run command
node steroid-run.cjs fs-cat package.json --head=120 --optional
```

Determine:
- Test framework in use (Jest, Vitest, Pytest, Mocha, etc.)
- Config file location
- Run command (`npm test`, `npx vitest`, `pytest`, etc.)
- Existing test count (0 = greenfield, 10+ = established patterns)

### Step 5: Find Related Code

Based on the user's stated intent (from the feature slug or initial description), search for code files that are likely related.

```bash
# Search for files related to the feature area
node steroid-run.cjs fs-grep '<keyword>' src --include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.py --files-with-matches --limit=15
```

### Step 6: Write context.md

Write all findings to `.memory/changes/<feature>/context.md` in this exact format:

```markdown
# Project Context for <feature>

**Scanned:** <timestamp>

## Tech Stack

- **Language:** <language> <version>
- **Framework:** <framework> <version>
- **Key Dependencies:** <list>
- **Build Tool:** <tool>
- **Package Manager:** <manager>

## Project Structure

```
<condensed file tree, max 2 levels>
```

**Entry Points:** <list with paths>
**API Routes:** <path pattern or "none detected">
**Components:** <path pattern or "none detected">

## Existing Patterns

<from AGENTS.md, progress.md, or "No existing patterns documented">

## Test Infrastructure

- **Framework:** <framework or "none detected">
- **Config:** <config file path or "none">
- **Run Command:** `<command>` or "not configured"
- **Existing Tests:** <count>

## Related Code

<list of files likely relevant to this feature, or "Greenfield — no existing related code">
```

## Output Signal

After writing `context.md`, output ONE line:

"📡 Context captured: <language>/<framework>, <test count> tests, <file tree depth> dirs scanned."

Then the pipeline continues to `steroid-vibe-capture`.

## Knowledge Store Update (v4.0)

After completing the scan, persist findings to structured memory so future iterations can recall project patterns without re-scanning:

```bash
node steroid-run.cjs memory write patterns '{"conventions": ["<pattern1>", "<pattern2>"], "file-structure": "<description>"}'
node steroid-run.cjs memory write gotchas '{"known-issues": ["<issue1>"]}'
```

The CLI's scan command auto-writes `tech-stack.json` — you only need to write patterns and gotchas.

## Anti-Summarization Directive

Do NOT truncate file trees or dependency lists. Write what you find. The downstream phases need accurate data to make good decisions.

## Forbidden Files

**NEVER read or include contents from** (ported from GSD Codebase Mapper rules):
- `.env`, `.env.*` — environment secrets
- `*.pem`, `*.key` — certificates and private keys
- `serviceAccountKey.json` — cloud credentials
- Any file listed in `.gitignore` that appears to contain secrets

Note their **existence only**: "`.env` file present."

## Referenced Forks

- `src/forks/gsd/agents/gsd-codebase-mapper.md` — The complete 4-focus codebase analysis system (773 lines)
- `src/forks/gsd/agents/gsd-phase-researcher.md` — Project context and validation architecture detection
- `src/forks/ralph/AGENTS.md` — Per-directory learnings system
- `src/forks/ralph/prompt.md` — Codebase patterns consolidation
