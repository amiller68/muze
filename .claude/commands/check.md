---
description: Run success criteria checks (lint, test, build)
allowed-tools:
  - Bash(make:*)
---

Run `make check` and report pass/fail for each:

## Steps

1. Run `make check` to execute all success criteria checks

2. Report a summary of pass/fail status for each:
   - Biome lint (TypeScript)
   - Clippy lint (Rust)
   - Rust format
   - Frontend tests (Vitest)
   - Backend tests (cargo test)

3. If any checks fail that cannot be auto-fixed:
   - For format issues, suggest running `make fmt`
   - For lint issues, explain what needs to change
   - For test failures, summarize failing tests

This is the gate for all PRs - all checks must pass before merge.
