# Success Criteria

Checks that must pass before code can be merged. This is the CI gate.

## Quick Check

Run all checks with a single command:

```bash
make check
```

This runs: lint → format check → tests

## Individual Checks

### Build

```bash
# Frontend (Vite)
pnpm run build

# Backend (Rust)
cd src-tauri && cargo build --release

# Full build
make build
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

# Watch mode (frontend)
pnpm run test:watch
```

### Linting

```bash
# All linters
make lint

# Frontend (Biome)
pnpm lint
# or: pnpm biome check src

# Backend (Clippy)
cd src-tauri && cargo clippy -- -D warnings
```

### Formatting

```bash
# Check formatting (no changes)
make fmt-check

# Fix formatting
make fmt

# Frontend only
pnpm fmt
# or: pnpm biome check --write src

# Backend only
cd src-tauri && cargo fmt
cd src-tauri && cargo fmt -- --check  # check only
```

### Type Checking

TypeScript type checking is handled by:
- Vite build process
- Biome linting
- IDE (strict mode enabled in tsconfig.json)

Rust type checking is handled by the compiler.

## Fixing Common Issues

### Formatting Failures

Run the formatter and commit:

```bash
make fmt
git add -A && git commit -m "Fix formatting"
```

### Lint Warnings

**Biome** (frontend):
- Unused imports/variables: Remove them or use `_` prefix
- Most issues auto-fix: `pnpm fmt`

**Clippy** (backend):
- Follow the suggested fix in the error message
- `-D warnings` means all warnings are errors

### Test Failures

**Frontend tests**:
- Check `src/test/setup.ts` for Tauri mocks
- Component tests need jsdom environment
- Run single test: `pnpm vitest run src/utils/time.test.ts`

**Backend tests**:
- Run with verbose output: `cd src-tauri && cargo test -- --nocapture`
- Check audio device availability for audio-related tests

## Pre-commit

No pre-commit hooks are configured. Run `make check` manually before pushing.
