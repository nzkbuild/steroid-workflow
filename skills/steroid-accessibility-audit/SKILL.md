---
name: steroid-accessibility-audit
description: Internal Steroid wrapper for accessibility verification using the AccessLint integration.
---

# Steroid Accessibility Audit

This internal skill exists so Steroid can expose accessibility verification as a
native workflow instead of expecting users to wire external tools themselves.

## Source

- `src/services/audit/accesslint-audit.cjs`

## Responsibilities

- Run accessibility audits during Steroid verify for UI work.
- Record findings in Steroid receipts (`verify.md`, `verify.json`, optional accessibility artifacts).
- Keep AccessLint behind Steroid's normal review and verification flow.
