---
description: Review branch changes against project conventions
allowed-tools:
  - Bash(git:*)
  - Read
  - Glob
  - Grep
---

Review the current branch changes against project conventions defined in `agents/`.

## Context Files

Read these files first to understand conventions:
- `agents/CONTRIBUTING.md` - Contribution guidelines (commit conventions, code standards)
- `agents/SUCCESS_CRITERIA.md` - Definition of done (`make check` must pass)
- `agents/ARCHITECTURE.md` - App structure and patterns

## Review Steps

### 1. Commit Message Audit

Check commits on this branch vs main:
```
git log main..HEAD --format="%s"
```

Verify each commit follows conventional commit format:
- `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:` / `perf:`
- Breaking changes use `!` or `BREAKING CHANGE:` in body
- Messages are clear and descriptive

Report any commits that need amending with suggested corrections.

### 2. Code Pattern Review

Review changed files against project patterns:

**TypeScript (src/):**
- No `any` types without justification
- Proper error handling in Tauri invoke calls
- Store pattern usage (useMixStore)
- SolidJS signals used correctly

**Rust (src-tauri/):**
- Error handling with `map_err()` and `?`
- No `unwrap()` in production code
- Types match TypeScript definitions

### 3. Documentation Audit

Check if documentation needs updates:

1. **PROJECT_LAYOUT.md**: Does the tree match actual files?
2. **ARCHITECTURE.md**: Do architectural changes need documentation?
3. **CONTRIBUTING.md**: Are there new patterns to document?

### 4. Issue Cross-Reference

Check `issues/` directory for related tickets:
- Should any issue status be updated?
- Should new issues be created for follow-up work?

## Output Format

Provide a structured review report:

```
## Commit Messages
- [PASS/FAIL] Conventional commit format
- Commits needing amendment: (list or "None")

## Code Patterns
- [PASS/WARN/FAIL] TypeScript patterns
- [PASS/WARN/FAIL] Rust patterns
- [PASS/WARN/FAIL] Type consistency
- Suggestions: (list or "None")

## Documentation
- [PASS/WARN] Docs up to date
- Action items: (list or "None")

## Related Issues
- Issues addressed: (list or "None")
- Issues needing update: (list or "None")

## Summary
[Overall assessment and recommended actions before merge]
```

Be specific about what needs to change and why. Reference line numbers and file paths where relevant.
