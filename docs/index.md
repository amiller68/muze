# Documentation Index

Central hub for project documentation. AI agents should read this first.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
make dev
# or: pnpm tauri dev

# Run all checks
make check

# Run tests only
make test
```

## Documentation

| Document | Purpose |
|----------|---------|
| [PATTERNS.md](./PATTERNS.md) | Coding conventions and patterns |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute (agents + humans) |
| [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) | CI checks that must pass |
| [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) | Codebase structure overview |

## For AI Agents

You are an autonomous coding agent working on a focused task.

### Workflow

1. **Understand** — Read the task description and relevant docs
2. **Explore** — Search the codebase to understand context
3. **Plan** — Break down work into small steps
4. **Implement** — Follow existing patterns in `PATTERNS.md`
5. **Verify** — Run checks from `SUCCESS_CRITERIA.md`
6. **Commit** — Clear, atomic commits

### Guidelines

- Follow existing code patterns and conventions
- Make atomic commits (one logical change per commit)
- Add tests for new functionality
- Update documentation if behavior changes
- If blocked, commit what you have and note the blocker

### Project-Specific Notes

- **Frontend**: SolidJS with reactive signals, not React hooks
- **Backend**: Rust with Tauri 2.0 IPC commands
- **Audio**: Use engine commands, don't manipulate files directly
- **State**: Use `useMixStore()` and `useVaultStore()` for state management

### When Complete

Your work will be reviewed and merged by the parent session.
Ensure all checks pass before finishing.
