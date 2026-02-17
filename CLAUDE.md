# Project Guide

Multi-track audio recorder built with Tauri 2.0 (Rust) and SolidJS.

## Quick Reference

```bash
pnpm install              # Install dependencies
make dev                  # Start development server (pnpm tauri dev)
make check                # Run all checks (lint + fmt-check + test)
make test                 # Run all tests (frontend + backend)
make lint                 # Run linters (Biome + Clippy)
make fmt                  # Format code (Biome + cargo fmt)
make build                # Build for production
```

## Project Structure

```
src/                      # Frontend (SolidJS + TypeScript)
├── components/           # UI components (editor/, sidebar/)
├── stores/               # Reactive state (mixStore, vaultStore)
├── types/                # TypeScript interfaces
├── services/             # Service layer
├── utils/                # Utility functions
└── constants/            # Theme colors, config values

src-tauri/src/            # Backend (Rust)
├── audio/                # Audio engine, recorder, splice
├── commands/             # Tauri IPC command handlers
├── project/              # Mix/Track/Collection models
└── vault/                # Multi-vault storage
```

For detailed structure, see `docs/PROJECT_LAYOUT.md`.

## Documentation

- `docs/index.md` — Documentation hub and agent instructions
- `docs/PATTERNS.md` — Coding conventions
- `docs/SUCCESS_CRITERIA.md` — CI checks
- `docs/CONTRIBUTING.md` — Contribution guide
- `docs/PROJECT_LAYOUT.md` — Codebase structure

## Issues

Track work items in `issues/`. See `issues/README.md` for the convention.

## Constraints

- TypeScript strict mode enabled
- Biome for linting/formatting (100 char line width, 2-space indent, double quotes)
- All Tauri commands return `Result<T, String>`
- Frontend tests use Vitest with jsdom environment
- Backend tests use standard cargo test

## Do Not

- Do not use `any` type in TypeScript
- Do not skip CI checks with `--no-verify`
- Do not push directly to main
- Do not add dependencies without discussion
- Do not modify audio files directly — use the audio engine commands
