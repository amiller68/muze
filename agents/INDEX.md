# Agent Documentation Index

This directory contains documentation for AI agents and human developers working on Muse.

## Quick Start

1. Run `make check` to verify the project builds and passes tests
2. Read [CONCEPTS.md](./CONCEPTS.md) to understand the domain model
3. Follow [CONTRIBUTING.md](./CONTRIBUTING.md) for code standards
4. Ensure [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) are met before creating a PR

---

## Document Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [CONCEPTS.md](./CONCEPTS.md) | Domain model and high-level architecture | Understanding the system |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical implementation details | Writing code |
| [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) | Directory structure and file organization | Finding files |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Code standards and PR process | First time contributing |
| [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) | Definition of "done" | Before creating a PR |
| [IOS_DEPLOYMENT.md](./IOS_DEPLOYMENT.md) | Building for iOS via AltStore | iOS-specific work |
| [ISSUES.md](./ISSUES.md) | Issue tracking conventions | Planning work |

---

## Document Summaries

### [CONCEPTS.md](./CONCEPTS.md)
High-level domain concepts:
- Mix/Track/Clip hierarchy
- Audio engine architecture
- State management patterns
- Platform considerations (iOS vs Desktop)

### [ARCHITECTURE.md](./ARCHITECTURE.md)
Technical implementation:
- Frontend structure (SolidJS, stores, components)
- Backend structure (Rust, Tauri commands, audio engine)
- Type mapping between TypeScript and Rust
- Key patterns (auto-save, playhead polling, atomic state)

### [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md)
Exhaustive directory tree:
- `src/` - SolidJS frontend
- `src-tauri/` - Rust backend
- Configuration files

### [CONTRIBUTING.md](./CONTRIBUTING.md)
How to contribute:
- Code quality standards
- Naming conventions
- Component patterns
- Testing requirements

### [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md)
What "done" means:
- `make check` must pass
- Type safety requirements
- Testing expectations

### [ISSUES.md](./ISSUES.md)
Issue organization:
- Epic vs ticket format
- Status tracking
- Dependency management

---

## Key Constraints

1. **`make check` must pass** - All lint, format, and test checks
2. **No `any` types** - Use proper types or generics
3. **Types must match** - TypeScript and Rust types stay in sync
4. **Auto-save is debounced** - 300ms debounce, don't break this pattern

---

## Tech Stack Quick Reference

| Layer | Technology | Config |
|-------|------------|--------|
| Frontend | SolidJS + TypeScript | `tsconfig.json` |
| Styling | Tailwind CSS | `tailwind.config.js` |
| Linting | Biome | `biome.json` |
| Bundler | Vite | `vite.config.ts` |
| Backend | Rust + Tauri 2.0 | `Cargo.toml`, `tauri.conf.json` |
| Audio I/O | CPAL | - |
| WAV Encoding | Hound | - |
| Frontend Tests | Vitest | `vitest.config.ts` |
| Backend Tests | cargo test | - |

---

## Common Commands

```bash
make check    # Run all checks (lint, format, test)
make fmt      # Auto-format all code
make dev      # Start dev server
make build    # Production build
```

---

## See Also

- [README.md](./README.md) - Quick start overview
- `.claude/commands/` - Claude Code slash commands
