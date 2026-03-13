# Contributing to Steroid Workflow

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** ≥ 18.17.0
- **Git** with GPG signing configured

## Project Structure

```
steroid-workflow/
├── bin/
│   ├── cli.js              # Installer (npx steroid-workflow init)
│   └── steroid-run.cjs     # Pipeline enforcer (THE main file)
├── src/
│   └── utils/              # Extracted utilities (for testing only)
├── test/
│   ├── smoke.test.cjs      # End-to-end CLI tests
│   └── unit/               # Unit tests for extracted modules
├── skills/                 # AI skill definitions (.md files)
└── scripts/                # Build/sync utilities
```

> **Important**: `steroid-run.cjs` is a single self-contained file that gets copied to user projects. It must NOT `require()` external modules. Utility functions in `src/utils/` are identical copies for unit testing — the canonical source is `steroid-run.cjs`.

## Development Workflow

1. **Fork & clone** the repository
2. **Edit** `bin/steroid-run.cjs` directly (it's the source of truth)
3. **Mirror** utility function changes to `src/utils/` if applicable
4. **Run tests**: `npm test`
5. **Lint** (optional): `npm run lint`
6. **Submit a PR** against `main`

## Running Tests

```bash
# Full test suite (smoke + unit)
npm test

# Smoke tests only
node test/smoke.test.cjs

# Unit tests only
node test/unit/run-all.cjs
```

## Code Style

- **No external runtime dependencies** — the project is zero-dependency by design
- **CommonJS** (`.cjs`) — required for broad Node.js compatibility
- **JSDoc** annotations on all public functions
- **Section headers** — use `═══` dividers to group related commands
- **Console output** — use emoji prefixes for visual clarity (✅ ❌ 💡 🔴)

## Adding a New Command

1. Find the appropriate section in `steroid-run.cjs` (see the section map at the top of the file)
2. Add your command handler with a JSDoc comment:
   ```javascript
   /** CMD: your-command — Brief description */
   if (args[0] === 'your-command') {
       // implementation
       process.exit(0);
   }
   ```
3. Update the `--help` text
4. Add a smoke test in `test/smoke.test.cjs`
5. Update `CHANGELOG.md`

## Commit Messages

Use the format: `feat(steroid): <description>`

Examples:
- `feat(steroid): add 'deploy' command for cloud deploys`
- `fix(steroid): gate command handles missing plan.md`
- `docs(steroid): update README with new command reference`

## Versioning

We follow [Semantic Versioning](https://semver.org/):
- **PATCH** (5.x.Y): Bug fixes, documentation
- **MINOR** (5.Y.0): New features, non-breaking changes  
- **MAJOR** (Y.0.0): Breaking changes

## Questions?

Open an issue on [GitHub](https://github.com/nzkbuild/steroid-workflow/issues).
