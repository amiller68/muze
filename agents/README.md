# Muse Agent Documentation

Documentation for AI agents and contributors working on Muse, a multi-track audio recording app built with SolidJS and Tauri.

## Quick Start

```bash
make check    # Lint, format check, and test
make fmt      # Auto-format code
make dev      # Start dev server
```

## Documentation Index

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App structure, data flow, type system |
| [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) | Directory structure and file organization |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Code standards, patterns, PR process |
| [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) | Definition of "done" |
| [IOS_DEPLOYMENT.md](./IOS_DEPLOYMENT.md) | Building and deploying via AltStore |
| [ISSUES.md](./ISSUES.md) | Issue tracking, epics, and ticket workflow |

## Key Constraints

1. **`make check` must pass** before any PR
2. **No `any` types** without explicit justification
3. **Types must match** between TypeScript and Rust
4. **Auto-save is debounced** (300ms) - don't break this pattern

## Tech Stack

- **Frontend**: SolidJS, Tailwind CSS, TypeScript
- **Backend**: Rust, Tauri 2.0
- **Audio**: CPAL (I/O), Hound (WAV encoding)
- **Testing**: Vitest (frontend), cargo test (backend)
- **Linting**: Biome (TS), Clippy (Rust)
