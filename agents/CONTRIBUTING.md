# Contributing Guide

This guide covers how to contribute to the Geney Platform, whether you're an AI agent or a human developer.

## For AI Agents

### Getting Started

1. **Run `make install`** - Always first, to ensure dependencies are available
2. **Read the relevant docs** - Start with [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) and [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md)
3. **Understand the task** - Use planning mode to analyze requirements before coding
4. **Follow existing patterns** - Match the style and structure of existing code

### Key Constraints

- **Work only in your workspace** - Don't access files outside your Conductor workspace
- **No dev servers** - Shared machine; trust tests and builds instead
- **All database/storage through py-core** - Never access DB or storage directly from apps
- **`make check` must pass** - Before creating any PR

### Code Quality Expectations

- Follow [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md) for Python code
- Use `Params` and `Context` dataclasses for operations
- Keep functions pure where possible
- Write tests for new functionality
- Update documentation when patterns change

### File Naming Conventions

**TypeScript/React:**
- Use `kebab-case` for all file names, including React components
- Example: `chat-header.tsx`, `message-list.tsx`, `use-server-event.ts`
- Export components with `PascalCase` names: `export { ChatHeader } from './chat-header'`

**Python:**
- Use `snake_case` for all file names (standard Python convention)
- Example: `async_tool_execution.py`, `run_search.py`

### Naming Philosophy

**Prefer pedantic, descriptive names over short ones.** Clarity is more important than brevity.

- Function/file names should fully describe what they do
- Don't abbreviate unless the abbreviation is universally understood
- If a name feels too long, that's usually fine - it helps future readers understand the code

**Examples:**
```python
# Good - pedantic and descriptive
recover_stuck_async_tool_executions_task
create_async_tool_execution
get_thread_with_messages_and_operations

# Bad - too short or ambiguous
recover_ops_task
create_execution
get_thread
```

This applies to files, functions, classes, and variables. When in doubt, be more explicit.

### Refactoring Principles

**No backward compatibility shims.** When refactoring:

- Update all imports in a single pass - don't create re-export shims
- Delete the old code completely after migrating
- If consolidating code to a shared package, update all consumers directly
- The user would rather have a clean refactor (with LLM assistance to update imports) than a codebase littered with deprecated re-exports

This applies to:
- Moving types/classes between packages
- Consolidating duplicated code
- Renaming exports
- Changing import paths

**Example - WRONG approach:**
```typescript
// OLD: lib/requests/library.ts - Don't do this!
/** @deprecated Import from '@geney/ts-geney/requests' instead */
export { ListLibraryRequest } from '@geney/ts-geney/requests'
```

**Example - RIGHT approach:**
```typescript
// Just update the imports directly in all files:
import { ListLibraryRequest } from '@geney/ts-geney/requests'
```

### Before Submitting

1. Run `make check` - All checks must pass
2. Run `make test` - All tests must pass
3. Update docs if needed - See [SUCCESS_CRITERIA.md](./SUCCESS_CRITERIA.md#documentation-requirements)
4. Write descriptive commit messages
5. Create PR with clear summary

---

## For Human Developers

### Development Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:geney-ai/geney.git
   cd geney
   ```

2. **Install dependencies**
   ```bash
   make install
   ```

3. **Start local services** (if not using Conductor)
   ```bash
   # Services are managed via Docker
   # See docs/development/LOCAL.md for full setup
   ```

4. **Run the dev server**
   ```bash
   make dev
   ```

### Working with Conductor

If you're using [Conductor](https://www.conductor.build/) for parallel agent development:

1. Workspaces are created in `.conductor/<workspace-name>/`
2. Each workspace is an isolated git worktree
3. Services (PostgreSQL, MinIO, Redis) are shared across workspaces
4. See [PR_WORKFLOW.md](./PR_WORKFLOW.md) for details

### Multi-Dev-Server Support

You can run multiple dev servers concurrently on the same machine. Each worktree/branch gets its own:

- **Port**: First available in range 8000-8009
- **Database**: Named `geney_{branch_name}` (e.g., `geney_feature_my_feature`)

**Usage:**

```bash
# Check your assigned port and database
make ports

# Start dev server (auto-assigns port, creates database, runs migrations)
make dev

# View current dev server config
cat .dev-server
```

**How it works:**

1. `bin/worktree-ports` derives a database name from your git branch
2. On `make dev`, the system:
   - Finds the first available port (8000-8009)
   - Creates the branch-specific database if needed
   - Runs migrations on that database
   - Starts the server with the assigned port
3. A `.dev-server` file is created with your current config (gitignored)

**Testing:**

Tests also use the branch-specific database:

```bash
# Run tests against your branch's database
cd app/packages/py-core
make test-integration
```

**OAuth Setup:**

For Google OAuth to work on all ports, register callback URLs for ports 8000-8009 in Google Cloud Console:
- `http://localhost:8000/auth/google/callback`
- `http://localhost:8001/auth/google/callback`
- ... through 8009

### Code Review Guidelines

When reviewing PRs (from agents or humans):

**Do check:**
- Does the code solve the stated problem?
- Are there appropriate tests?
- Does it follow existing patterns?
- Is the code readable and maintainable?
- Are there security concerns?

**Don't worry about:**
- Formatting - CI enforces this
- Linting - CI catches this
- Type safety - Type checker verifies this

### Architecture Decisions

Before making significant changes:

1. **Discuss first** - Open an issue or discuss in PR
2. **Document the decision** - Update relevant docs
3. **Follow established patterns** - Or document why you're deviating

Key architectural principles:
- Database and storage operations go through py-core only
- Python operations are functional with explicit dependency injection
- Use `Params` dataclasses for extensible function signatures
- Prefer composition over inheritance

---

## Commit Conventions

Use conventional commit prefixes:

| Prefix | Use For |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `refactor:` | Code refactoring (no behavior change) |
| `chore:` | Maintenance tasks, dependency updates |
| `docs:` | Documentation changes |
| `test:` | Test additions or modifications |
| `perf:` | Performance improvements |

Example:
```
feat: add plasmid export functionality

- Implement export endpoint in py-platform
- Add GenBank serialization in py-bio
- Write tests for export flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## TODO Comments

Use structured TODO comments to track work that needs to be done:

| Format | Meaning |
|--------|---------|
| `TODO (name):` | Future work - do this eventually |
| `TODO (draft):` | Must be resolved before merging |
| `TODO (name, tag):` | Create an issue for this with the specified tag |

**Examples:**

```python
# TODO (amiller68): Optimize this query for large datasets

# TODO (draft): Add error handling for edge cases

# TODO (amiller68, enhancement): Support batch imports
```

**Guidelines:**
- `TODO (draft):` comments **must** be resolved before the PR is merged
- `TODO (name):` comments are acceptable to merge - they track future work
- `TODO (name, tag):` should result in a GitHub issue being created with the appropriate label

---

## Pull Request Process

1. **Create a branch** - Use descriptive names (e.g., `feature/plasmid-export`)
2. **Make changes** - Follow patterns, write tests
3. **Run checks** - `make check && make test`
4. **Push and create PR** - Use the PR template
5. **Wait for CI** - All checks must pass
6. **Address feedback** - Respond to review comments
7. **Merge** - Squash merge to main

See [PR_WORKFLOW.md](./PR_WORKFLOW.md) for detailed instructions.

---

## Getting Help

- **Documentation issues** - Update the relevant doc and submit a PR
- **Bug reports** - Open a GitHub issue with reproduction steps
- **Feature requests** - Open a GitHub issue with use case description
- **Questions** - Check existing docs first, then open a discussion

---

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Assume good intent
- Help others learn
