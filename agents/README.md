# Muse Agent Documentation

Documentation for AI agents and contributors working on Muse, a multi-track audio recording app built with SolidJS and Tauri.

**Start here:** [INDEX.md](./INDEX.md) is the central navigation hub for all documentation.

---

## For AI Agents

### Getting Started

1. **Run `make check`** - Verify the project builds and all tests pass
2. **Read [CONCEPTS.md](./CONCEPTS.md)** - Understand the domain model
3. **Read [ARCHITECTURE.md](./ARCHITECTURE.md)** - Understand the technical implementation
4. **Follow [CONTRIBUTING.md](./CONTRIBUTING.md)** - Match existing code patterns

### Key Constraints

1. **`make check` must pass** before any PR
2. **No `any` types** without explicit justification
3. **Types must match** between TypeScript and Rust
4. **Auto-save is debounced** (300ms) - don't break this pattern

### Slash Commands

Use these Claude Code commands for common workflows:
- `/check` - Run all success criteria checks
- `/draft` - Create a draft PR
- `/review` - Review branch against conventions

---

## For Human Developers

### Quick Start

```bash
make check    # Lint, format check, and test
make fmt      # Auto-format code
make dev      # Start dev server
```

### Documentation Index

| Document | Purpose |
|----------|---------|
| [INDEX.md](./INDEX.md) | Central navigation hub |
| [CONCEPTS.md](./CONCEPTS.md) | Domain model overview |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App structure, data flow, type system |
| [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) | Directory structure and file organization |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Code standards, patterns, PR process |
| [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) | Definition of "done" |
| [IOS_DEPLOYMENT.md](./IOS_DEPLOYMENT.md) | Building and deploying via AltStore |
| [ISSUES.md](./ISSUES.md) | Issue tracking, epics, and ticket workflow |

---

## Tech Stack

- **Frontend**: SolidJS, Tailwind CSS, TypeScript
- **Backend**: Rust, Tauri 2.0
- **Audio**: CPAL (I/O), Hound (WAV encoding)
- **Testing**: Vitest (frontend), cargo test (backend)
- **Linting**: Biome (TS), Clippy (Rust)

---

## See Also

- [INDEX.md](./INDEX.md) - Full document index with summaries
- [CONCEPTS.md](./CONCEPTS.md) - High-level domain concepts
