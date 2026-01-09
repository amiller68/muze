# PR Workflow & Parallel Development Guide

This document describes the pull request workflow for the Geney Platform, including parallel development approaches with Claude Code agents.

## Overview

We enable parallel development streams, allowing multiple well-scoped tasks to be worked on simultaneously in complete isolation. This approach is effective when working with Claude Code agents on discrete, non-overlapping work items.

**Two approaches are supported:**

1. **Conductor** (recommended) - A Mac app that orchestrates multiple Claude Code agents in isolated workspaces
2. **Git Worktrees** (manual) - Traditional worktree-based isolation for manual setup

---

## Conductor Workflow (Recommended)

[Conductor](https://www.conductor.build/) is a Mac app that automates parallel agent development. It handles workspace isolation, agent orchestration, and provides a unified interface for managing multiple tasks.

### How It Works

1. **Conductor creates isolated workspaces** - Each task runs in its own `.conductor/<workspace-name>` directory
2. **Agents work independently** - Multiple Claude Code agents can run in parallel without conflicts
3. **Shared services** - PostgreSQL, MinIO, and other services are shared across workspaces
4. **Unified management** - Monitor all agents, view progress, and manage tasks from one interface

### Working in a Conductor Workspace

When you're in a Conductor workspace (e.g., `/path/to/geney/.conductor/my-task/`):

```bash
# You're already in an isolated workspace
# The working directory is set up for you

# Install dependencies (do this first!)
make install

# Run checks
make check

# Run tests
make test
```

### Conductor-Specific Constraints

- **Work only in your workspace** - Don't read or write files outside `.conductor/<your-workspace>/`
- **Don't run dev servers** - Shared machine with other agents; trust tests and builds
- **Shared services are available** - PostgreSQL, MinIO accessible to all workspaces

### Creating PRs from Conductor

Conductor workspaces are git worktrees under the hood. Create PRs normally:

```bash
git add .
git commit -m "feat: your changes"
git push -u origin <branch-name>
gh pr create --title "feat: description" --body "..."
```

---

## Git Worktree Workflow (Manual)

For environments without Conductor, or when manual control is needed, use git worktrees directly.

For the complete rationale and methodology, see: [Parallel Development with Claude Code](https://krondor.org/blog/parallel-development-with-claude-code-539534)

### Prerequisites

1. **Git worktree management script** - Available at `bin/worktree` in this repository
2. **Claude Code** - Installed and configured with appropriate permissions
3. **Development environment** - All dependencies installed (`make install`)

### Create a New Worktree

```bash
# Option A: Using the worktree script
bin/worktree --repo . create feature/add-user-search

# Option B: Using the Makefile wrapper
make worktree-create BRANCH=feature/add-user-search
```

**Where do worktrees live?**

By default, worktrees are created in a `worktrees/` directory. This can be:
- **External to repo** (e.g., `~/projects/geney-workspace/worktrees/`) - Cleaner separation
- **Inside the repo** (e.g., `~/projects/geney/worktrees/`) - More convenient, git-ignored

### Managing Worktrees

```bash
# List active worktrees
make worktree-list

# Remove completed worktree
make worktree-remove BRANCH=feature/completed-task

# Remove all worktrees
make worktree-cleanup
```

---

## Branch Naming Conventions

Follow these conventions for branch names:

- **Features**: `feature/short-description` (e.g., `feature/user-dashboard`)
- **Bug fixes**: `fix/issue-description` (e.g., `fix/login-redirect`)
- **Chores**: `chore/task-description` (e.g., `chore/update-deps`)
- **Refactoring**: `refactor/component-name` (e.g., `refactor/auth-service`)

---

## Development Process

### Initial Setup

```bash
# Navigate to your workspace (Conductor) or worktree (manual)
cd /path/to/workspace

# Install dependencies - ALWAYS do this first!
make install

# Verify environment
make check
```

### Working with Claude Code

1. **Plan Mode** - Start by understanding the task and proposing a strategy
2. **Iterate on Strategy** - Refine the approach before execution
3. **Execute** - Work autonomously within defined parameters
4. **Verify** - Ensure success criteria are met

### Success Criteria

**You are not allowed to finish in a state where CI is failing.**

Before considering work complete, ensure these commands pass:

```bash
make check          # Runs all checks (build, format, types, lint)
make test           # Run all tests
```

---

## Creating a Pull Request

### Pre-PR Checklist

- [ ] All success criteria commands pass (`make check`)
- [ ] Tests are written and passing
- [ ] Changes are committed with descriptive messages
- [ ] Branch is pushed to remote

### Create PR with gh CLI

```bash
# Ensure changes are committed
git add .
git commit -m "feat: add user search functionality

- Implement search API endpoint
- Add frontend search component
- Update database queries for performance

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push -u origin feature/add-user-search

# Create PR
gh pr create --title "Add user search functionality" --body "$(cat <<'EOF'
## Summary
- Implemented search API endpoint with filtering and pagination
- Added frontend search component with debouncing
- Optimized database queries for search performance

## Test Plan
- [x] Search returns correct results for various queries
- [x] Pagination works correctly
- [x] Frontend updates in real-time
- [x] All existing tests still pass
- [x] `make check` passes

## Changes
- `app/apps/py-platform/src/api/search.py` - Search endpoint
- `app/apps/ts-web/src/components/Search.tsx` - Search component
- `app/packages/py-core/src/library/search.py` - Search operations

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### PR Title Conventions

Use conventional commit prefixes:

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring without functionality changes
- `chore:` - Maintenance tasks, dependency updates
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `perf:` - Performance improvements

---

## CI/CD Pipeline

### GitHub Actions Workflow

Our CI pipeline (`.github/workflows/ci.yml`) runs automatically on every push and PR:

**Checks that run:**
1. **Format checking** - Black (Python), Biome (TypeScript)
2. **Linting** - Ruff (Python), Biome (TypeScript)
3. **Type checking** - mypy (Python), tsc (TypeScript)
4. **Tests** - pytest (Python), Vitest (TypeScript)
5. **Build verification** - Ensures production build succeeds
6. **Docker build** - Verifies Dockerfile builds successfully
7. **E2E tests** - docker-compose integration tests

**All checks must pass before merging.**

### Continuous Deployment

The CD pipeline (`.github/workflows/cd.yml`) automatically deploys to production when:
- Changes are merged to `main`
- Changes affect specific paths (`app/`, `branding/`, configs)

---

## Code Review Guidelines

### What Reviewers Should Check

1. **Functionality** - Does the code solve the stated problem?
2. **Tests** - Are there appropriate tests? Do they pass?
3. **Code Quality** - Is the code readable and maintainable?
4. **Architecture** - Does it fit the existing patterns?
5. **Security** - Any potential vulnerabilities?
6. **Performance** - Any obvious performance issues?

### What Reviewers Should NOT Worry About

- **Formatting** - CI enforces this automatically
- **Linting** - CI catches this
- **Type safety** - Type checker verifies this
- **Build success** - CI verifies this

### Review Process

1. **Automated checks** - Wait for CI to pass (or investigate failures)
2. **Code review** - Review the changes in GitHub
3. **Test locally** (optional) - Pull the branch and test if needed
4. **Request changes** or **Approve**
5. **Merge** - Squash merge to `main` (preserves clean history)

---

## Troubleshooting

### CI Failing After PR Creation

**Format issues:**
```bash
make fmt          # Auto-fix formatting
git add .
git commit -m "chore: fix formatting"
git push
```

**Type errors:**
```bash
make types        # See type errors
# Fix errors, then:
git add .
git commit -m "fix: resolve type errors"
git push
```

**Test failures:**
```bash
make test         # See failing tests
# Fix tests, then commit and push
```

### Dev Server Issues

**Do not run dev servers in workspaces** - you're on a shared machine with other agents.

For testing:
- Run tests: `make test`
- Check builds: `make build`
- Trust that manual testing will happen after merge

---

## Quick Reference

**Success criteria:**
```bash
make check  # Must pass before PR
```

**Create PR:**
```bash
gh pr create --title "feat: description" --body "..."
```

**View PR status:**
```bash
gh pr status
gh pr checks
```

**Merge after approval:**
```bash
gh pr merge --squash
```
