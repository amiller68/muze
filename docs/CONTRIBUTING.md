# Contributing

Guide for both human contributors and AI agents working on this project.

## For All Contributors

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the development server:
   ```bash
   make dev
   # or: pnpm tauri dev
   ```
4. Run tests to verify setup:
   ```bash
   make check
   ```

### System Requirements

- **Node.js** 18+ with pnpm
- **Rust** (latest stable) with cargo
- **Tauri CLI**: installed via pnpm (`pnpm tauri`)
- **Platform tools**: Xcode (macOS/iOS), Android SDK (Android)

### Making Changes

1. Create a feature branch from `main`
2. Make your changes following the patterns in `docs/PATTERNS.md`
3. Run checks: `make check`
4. Commit with a clear message describing the change
5. Open a pull request

### Commit Message Format

Use imperative mood, present tense:

```
Add feature description
Fix bug in component
Update dependency version
Refactor module for clarity
```

Examples from this repo:
- `Fix track playback ignoring position_ms`
- `Fix recording waveform sync and audio quality issues`
- `Add Claude Code configuration and update agent docs`

Reference issues when applicable:
- `Fix playback bug (#123)`

## For AI Agents

### Context to Gather First

Before making changes, read:
- `CLAUDE.md` — Project overview and quick commands
- `docs/PATTERNS.md` — Coding conventions
- `docs/SUCCESS_CRITERIA.md` — CI checks that must pass
- Related code files to understand existing patterns

### Workflow

1. **Understand** — Read the task and relevant code
2. **Plan** — Break down into small steps
3. **Implement** — Follow existing patterns
4. **Verify** — Run tests and checks
5. **Commit** — Clear, atomic commits

### Key Patterns to Follow

- **SolidJS**: Use `createSignal`, not React's `useState`
- **State**: Use existing stores (`useMixStore`, `useVaultStore`)
- **Backend**: Return `Result<T, String>` from commands
- **Types**: Add interfaces to `src/types/`, re-export from `index.ts`
- **Tests**: Add tests alongside source files (`*.test.ts`)

### Constraints

- Don't modify CI/CD configuration without approval
- Don't add new dependencies without discussion
- Don't refactor unrelated code
- Don't skip tests or use `--no-verify`
- Don't manipulate audio files directly — use engine commands

## Code Review

- All PRs require review
- CI must pass before merge
- Squash commits on merge (for feature branches)
