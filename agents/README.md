# Agent Documentation

This directory contains documentation designed for AI agents (and human developers) working on the Geney Platform.

## Quick Start

1. Read [TASK_TEMPLATE.md](./TASK_TEMPLATE.md) to understand how to start a task
2. Run `make install` to ensure dependencies are available
3. Follow the patterns in [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md)
4. Ensure [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) are met before creating a PR

---

## Document Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute (agents & humans) | First time contributing |
| [TASK_TEMPLATE.md](./TASK_TEMPLATE.md) | Task template for starting work | Beginning of every task |
| [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) | Monorepo structure and packages | Understanding the codebase |
| [DATABASE.md](./DATABASE.md) | Database operations, migrations, local setup | Working with the database |
| [PACKAGE_SETUP.md](./PACKAGE_SETUP.md) | Package scripts and tooling | Creating or modifying packages |
| [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md) | Python architecture patterns | Writing Python code |
| [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md) | CI requirements and checks | Before creating a PR |
| [PR_WORKFLOW.md](./PR_WORKFLOW.md) | Git, branching, and PR conventions | Creating PRs |

---

## Document Summaries

### [CONTRIBUTING.md](./CONTRIBUTING.md)
How to contribute to the project:
- **For AI agents**: Constraints, code quality expectations, submission checklist
- **For humans**: Dev setup, code review guidelines, architecture decisions
- Commit conventions and PR process

### [TASK_TEMPLATE.md](./TASK_TEMPLATE.md)
Template for starting a new task. Copy this into your Claude Code conversation and fill in the mission section. Includes references to other docs and constraints.

### [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md)
Describes the monorepo structure:
- **Primary apps**: `py-platform` (FastAPI), `ts-web` (React)
- **Shared packages**: `py-core`, `py-bio`, `ts-seqviz`
- **Build tools**: pnpm, Turborepo, uv, Make
- **Services**: PostgreSQL, MinIO, Redis

### [DATABASE.md](./DATABASE.md)
Database operations and local development:
- Local setup with make commands (`make setup`, `make db-migrate`)
- Creating and running Alembic migrations
- Model patterns and best practices
- Storage (MinIO) setup and usage

### [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md)
Architecture patterns for Python code:
- **Models vs Operations**: Database models are data-only; operations are functional
- **Dependency Injection**: Use `Context` dataclasses, never globals
- **Params for Extensibility**: Design params with defaults for backward compatibility
- **Module Organization**: Standard structure with `_context.py`, `create.py`, `read.py`

### [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md)
What "done" means:
- `make check` must pass (build, format, types, lint)
- Tests must pass
- No dev servers (shared machine)
- Common fixes for CI failures

### [PACKAGE_SETUP.md](./PACKAGE_SETUP.md)
Package development standards:
- TypeScript package scripts and structure
- Python package scripts, pyproject.toml, Makefile
- Turbo configuration and task orchestration
- Tool standards (Biome, Black, Ruff, mypy)

### [PR_WORKFLOW.md](./PR_WORKFLOW.md)
Git and PR conventions:
- **Conductor** (recommended): Automated workspace management
- **Git Worktrees** (manual): Traditional isolation
- Branch naming, commit conventions, PR templates
- CI/CD pipeline details

---

## Key Constraints

1. **Run `make install` first** - Always at the start of work
2. **No dev servers** - Shared machine with other agents
3. **`make check` must pass** - Before creating any PR
4. **Follow existing patterns** - Match codebase style

---

## External Resources

- [Local Development](../development/LOCAL.md) - Full development environment
- [Kamal Deployment](../deployment/KAMAL.md) - Deployment guide
