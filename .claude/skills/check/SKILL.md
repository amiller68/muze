---
description: Run project checks (build, test, lint, format). Use when validating code quality, preparing for merge, or verifying changes pass CI.
allowed-tools:
  - Bash(make:*)
  - Bash(pnpm:*)
  - Bash(cargo:*)
  - Bash(cat:*)
  - Bash(ls:*)
  - Read
  - Glob
  - Grep
---

Run the full success criteria checks to validate code quality.

## Quick Check

This project uses a Makefile. Run all checks with:

```bash
make check
```

This runs: lint → format check → tests

## Individual Commands

### Linting

```bash
# All linters
make lint

# Frontend only (Biome)
pnpm lint

# Backend only (Clippy)
cd src-tauri && cargo clippy -- -D warnings
```

### Format Check

```bash
# Check without modifying
make fmt-check

# Auto-fix formatting
make fmt
```

### Tests

```bash
# All tests
make test

# Frontend only (Vitest)
make test-fe
# or: pnpm run test

# Backend only (Cargo)
make test-be
# or: cd src-tauri && cargo test
```

### Build

```bash
# Full build
make build

# Frontend only
pnpm run build

# Backend only
cd src-tauri && cargo build --release
```

## Steps

1. Run `make check` to execute all checks in sequence
2. If formatting fails, run `make fmt` to auto-fix
3. If linting fails, address the specific issues reported
4. If tests fail, investigate and fix the failing tests
5. Report a summary of pass/fail status for each check

## Fixing Common Issues

### Biome (Frontend)

- Most issues auto-fix with `pnpm fmt`
- Unused imports/variables: remove them or prefix with `_`

### Clippy (Backend)

- Follow the suggested fix in the error message
- `-D warnings` treats all warnings as errors

### Test Failures

- Frontend: Check `src/test/setup.ts` for Tauri mocks
- Backend: Run with `cargo test -- --nocapture` for verbose output

This is the gate for all PRs — all checks must pass before merge.
