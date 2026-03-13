# 🧬 Steroid-Workflow

**Turn one sentence into working software.**

An AI pipeline that takes your idea through 8 enforced phases — codebase scanning, vibe capture, specification, research, architecture, TDD implementation, and verification — so the AI can't cut corners, skip steps, or hallucinate solutions.

Supports **10 languages** (JavaScript, TypeScript, Python, Rust, Go, Java, Ruby, PHP, C#, Dart), **complex architectures** (monorepos, Docker, microservices), and produces **enterprise-grade output** with documentation, CI/CD, error handling, deployment guidance, and license auditing.

## Install

```bash
npx steroid-workflow init
```

Run this inside any project with `git init`. That's it — no config, no dependencies, no terminal knowledge required.

### Update

```bash
npx steroid-workflow@latest update
```

Your project state (`.memory/`) is preserved. Only skills, configs, and enforcement layers are refreshed.

## How To Use

Just tell your AI what you want:

> "Build me a minimal habit tracker like Apple Health"

> "Fix the login bug that crashes on empty password"

> "Refactor the API layer to use proper error handling"

The AI automatically detects your intent and routes to the right pipeline:

| You say | AI does |
|---------|---------|
| "Build a dashboard" | Full pipeline: scan → vibe → spec → research → architect → engine → verify |
| "Fix the login bug" | Debug pipeline: scan → diagnose → targeted fix → verify |
| "Refactor the API" | Refactor pipeline: scan → specify target state → architect → engine → verify |
| "Upgrade to React 19" | Migration pipeline: scan → research → architect → engine → verify |
| "Document the API" | Docs pipeline: scan → specify → engine → verify |

If the AI doesn't activate automatically, say: **"Use the steroid pipeline."**

## The 8 Phases

| Phase | What happens | Output |
|-------|-------------|--------|
| 📡 **Scan** | Detects tech stack (10 languages), project structure, test infra | `context.md` |
| 🎯 **Vibe Capture** | Translates your idea into a structured brief, asks clarifying questions | `vibe.md` |
| 📋 **Specify** | Converts the brief into user stories with acceptance criteria | `spec.md` |
| 🔬 **Research** | Investigates tech stack, security, deployment, complex architecture | `research.md` |
| 🏗️ **Architect** | Creates atomic execution plan with quality, docs, error handling, deploy tasks | `plan.md` |
| ⚡ **Engine** | Builds it using TDD, commits atomically, captures learnings | Working code |
| ✅ **Verify** | Proves spec compliance, code quality, tests, license audit, infra checks | `verify.md` |
| 🔍 **Diagnose** | Root cause analysis for bugs (fix intent only) | `diagnosis.md` |

Each phase hands off to the next. No manual intervention needed.

## What Makes It Different

Most AI coding tools rely on **suggestions** — hoping the AI follows instructions. Steroid-Workflow uses **physical enforcement**:

- 🔒 **Git hook** — Commits are blocked unless the AI went through the pipeline
- ⚡ **Circuit breaker** — 5-level graduated recovery with friendly error messages
- ✅ **Two-stage review** — Spec compliance check + code quality gating
- 📄 **Handoff reports** — AI-to-human reports with build health, test results, review status
- 📊 **Analytics dashboard** — Track feature progress, error rates, time to completion
- 🔍 **Intent routing** — Different pipelines for build, fix, refactor, migrate, and document
- 🚫 **Anti-summarization** — The AI can't write "...rest of code here..." and call it done
- 🔀 **Gate checks** — Each phase requires the previous phase's output to exist

## AI Guardrails (v5.5.0+)

Steroid actively protects non-technical users from common AI coding mistakes:

- 🧠 **Adaptive Discussion** — AI detects your technical level and asks appropriate questions
- 📌 **Prompt Preservation** — Your exact requirements ("must use Framer Motion", "do NOT use a database") survive the entire pipeline unchanged
- 🏗️ **Brownfield Detection** — Won't scaffold over your existing project
- 🛡️ **Anti-Deletion Guard** — AI can't silently remove your working code
- 🧪 **True TDD Guard** — Fake tests like `expect(true).toBe(true)` are blocked
- 🔄 **Anti-Loop Directive** — Stops AI from guessing the same broken fix repeatedly
- 🔍 **Code Smell Scan** — Uses `knip`, `madge`, and `gitleaks` to catch phantom imports, circular deps, and leaked secrets
- 📋 **Bug Reports** — Run `node steroid-run.cjs report` to generate a diagnostic snapshot

## Enterprise-Grade Output (v5.3.0+)

Every project built by steroid automatically includes:

- 📝 **README.md + CHANGELOG.md** — Generated with install, run, deploy instructions
- 🔐 **Security considerations** — Dependency audit, input validation, secrets management
- ⚠️ **Error handling** — Error boundaries, loading states, 404 pages, input validation
- 🚀 **Deployment guidance** — Platform recommendation, build command, env vars
- 🔄 **CI/CD starter** — GitHub Actions workflow (install → lint → build → test)
- 📜 **License audit** — Flags GPL/AGPL viral licenses and deprecated packages
- 💬 **Code comments** — Module headers, JSDoc, explain-why-not-what standard

## Multi-Language Support (v5.4.0+)

| Language | Scan | Build | Lint | Test |
|----------|------|-------|------|------|
| JavaScript/TypeScript | ✅ | `npm run build` | `eslint` | `npm test` |
| Python | ✅ | `py_compile` | `flake8`/`ruff` | `pytest` |
| Rust | ✅ | `cargo build` | `cargo clippy` | `cargo test` |
| Go | ✅ | `go build` | `golangci-lint` | `go test` |
| Java/Kotlin | ✅ | `mvn`/`gradle` | `checkstyle` | `mvn test` |
| Ruby | ✅ | — | `rubocop` | `rspec` |
| PHP | ✅ | — | `phpstan` | `phpunit` |
| C#/.NET | ✅ | `dotnet build` | — | `dotnet test` |
| Dart/Flutter | ✅ | `flutter build` | `dart analyze` | `flutter test` |

## Supported IDEs

Works with any AI-powered IDE or CLI:

| IDE | Config |
|-----|--------|
| Gemini CLI / Antigravity | `GEMINI.md` |
| Cursor | `.cursorrules` |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules` |
| Aider | `.agents/steroid-maestro.md` |

All configs are auto-generated during install.

## Verify Installation

```bash
node steroid-run.cjs audit
```

Checks all enforcement layers (git hook, 8 skills, 7 gates, circuit breaker, IDE configs) and detects stale version references.

## Technical Details

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- How the pipeline enforcer works
- Full command reference for `steroid-run.cjs` (22+ commands)
- Intent routing, gate map, and memory system
- Two-stage review system, handoff reports, and analytics dashboard
- Smart recovery levels and story prioritization
- Fork credits and sources

## License

MIT © [nzkbuild](https://github.com/nzkbuild)
