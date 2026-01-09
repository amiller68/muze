# Project Layout

This document describes the structure of the Geney Platform monorepo.

## Monorepo Structure

The project is a **monorepo using Turborepo + pnpm** for orchestration.

```
geney/
├── app/                    # All application code
│   ├── apps/               # Deployable applications
│   │   ├── py-platform/    # FastAPI Python backend
│   │   └── ts-web/         # Vite + React TypeScript frontend
│   │
│   ├── packages/           # Shared libraries
│   │   ├── py-core/        # Core domain operations, database persistence
│   │   ├── py-bio/         # Bioinformatics algorithms
│   │   ├── ts-geney/       # Shared TS types: domain, API contracts, events
│   │   └── ts-ui/          # UI component library + sequence visualization
│   │
│   ├── package.json        # pnpm workspace root
│   ├── pnpm-workspace.yaml # Workspace configuration
│   └── turbo.json          # Turborepo pipeline configuration
│
├── docs/                   # Documentation
│   ├── agents/             # Agent-facing documentation (this folder)
│   ├── deployment/         # Deployment guides
│   ├── development/        # Development setup
│   └── setup/              # Infrastructure setup
│
├── bin/                    # Scripts and tools
├── .github/                # GitHub Actions workflows
└── Makefile                # Top-level orchestration
```

## Primary Applications

### py-platform (FastAPI Backend)

**Location:** `app/apps/py-platform/`

The Python backend serving the REST API. Uses:
- FastAPI for HTTP routing
- SQLAlchemy for database access
- Pydantic for validation
- TaskIQ for background jobs

### ts-web (React Frontend)

**Location:** `app/apps/ts-web/`

The TypeScript frontend. Uses:
- Vite for bundling
- React for UI
- TanStack Query for data fetching
- Tailwind CSS for styling

## Shared Packages

### py-core

**Location:** `app/packages/py-core/`

Core library providing:
- Database models and migrations (Alembic)
- Domain operations (construct, feature, library, search, etc.)
- Infrastructure services (events, tasks, storage, observability)

**All database and storage operations must go through py-core.** This is the single source of truth for:
- Database schema and migrations
- Storage client configuration
- Domain business logic

See [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md) for architectural patterns.

### py-bio

**Location:** `app/packages/py-bio/`

Bioinformatics library providing:
- DNA sequence data structures
- Content-addressed constructs and features
- Cloning operations (digest, ligate)
- A* search engine for assembly planning

### ts-geney

**Location:** `app/packages/ts-geney/`

Shared TypeScript types package providing the canonical type definitions used across the frontend. This is the TypeScript equivalent of py-core's domain types - it ensures type consistency between frontend components and API contracts.

**Subpath exports:**
- `@geney/ts-geney/core` - Domain types (Enzyme, Feature, Topology, Strand, etc.)
- `@geney/ts-geney/api` - API request classes and response types
- `@geney/ts-geney/events` - WebSocket event payload types

**Core types (`/core`):**
```typescript
import type { Enzyme, Feature, Topology, Strand } from '@geney/ts-geney/core'
import { OPERATIONS, type OperationType } from '@geney/ts-geney/core'
```

- `Enzyme` - Restriction enzyme with recognition sequence and cut sites
- `Feature` - DNA annotation (CDS, promoter, terminator, etc.)
- `Topology` - Sequence topology (`'circular' | 'linear'`)
- `Strand` - DNA strand (`1 | -1`)
- `OperationType` - Cloning operation types (digest, ligate, etc.)
- `Construct`, `Plasmid`, `MethylationContext` - Additional domain types

**API request classes (`/api`):**
```typescript
import { GetPlasmidRequest, ListLibraryRequest } from '@geney/ts-geney/api'
import type { PlasmidDetail, PlasmidListItem } from '@geney/ts-geney/api'

// Usage - request classes encapsulate endpoint logic
const request = new GetPlasmidRequest()
const plasmid = await request.execute({ id: 'abc123' })
```

Request classes extend `ApiRequest<TInput, TOutput>` or `FormDataRequest<TInput, TOutput>` and handle:
- URL construction
- HTTP method
- Request body serialization
- Response typing

**Event types (`/events`):**
```typescript
import type { SearchCompletedPayload, EventEnvelope } from '@geney/ts-geney/events'
import { SEARCH_COMPLETED } from '@geney/ts-geney/events'
```

Type-safe WebSocket event payloads that mirror `py-core/src/py_core/procedure/events/`.

**Key principles:**
- Types mirror Python backend (py-platform API responses, py-core domain types)
- No runtime dependencies - pure type definitions
- Single source of truth for frontend type consistency
- API request classes provide typed, reusable fetch wrappers

### ts-ui

**Location:** `app/packages/ts-ui/`

Shared UI component library providing design system components and sequence visualization.

**Subpath exports:**
- `@geney/ts-ui` - Design system components (Button, Card, Typography, etc.)
- `@geney/ts-ui/sequence` - Sequence visualization (SeqViz)

**Design system components:**
```typescript
import { Button, Card, Typography, Input, Tabs } from '@geney/ts-ui'
import { cn } from '@geney/ts-ui' // Tailwind class merger utility
```

**Sequence visualization:**
```typescript
import { SeqViz } from '@geney/ts-ui/sequence'
import type { Enzyme, Feature } from '@geney/ts-geney/core'

<SeqViz
  seq={sequence}
  annotations={features}  // Feature[] from ts-geney
  enzymes={enzymes}       // Enzyme[] from ts-geney
  viewer="both"
/>
```

**Key principles:**
- Uses ts-geney types directly (no internal type duplication)
- Tailwind CSS for styling (requires ts-ui in tailwind content paths)
- Radix UI primitives for accessible components

## Build Tools

| Tool | Purpose | Config |
|------|---------|--------|
| **pnpm** | Package management | `pnpm-workspace.yaml` |
| **Turborepo** | Build orchestration | `turbo.json` |
| **uv** | Python package management | `pyproject.toml` |
| **Make** | Top-level commands | `Makefile` |

## Package Development Standards

See [PACKAGE_SETUP.md](./PACKAGE_SETUP.md) for detailed requirements.

**All packages must implement these standard scripts:**
- `build` - Build the package
- `fmt` / `fmt:check` - Format code / check formatting
- `lint` / `lint:fix` - Lint code / fix linting issues
- `types` - Type checking
- `check` - Run all checks (fmt:check, lint, types)
- `test` - Run tests (if applicable)
- `clean` - Clean build artifacts

## Resources

The project relies on services running in Docker:

| Service | Purpose | Port |
|---------|---------|------|
| PostgreSQL | Primary database | 5433 |
| MinIO | S3-compatible storage | 9000 |
| Redis | Pub/sub, background tasks | 6379 |

**Do not attempt to start or stop these services** - they are shared across workspaces.

## Database and Storage (py-core only)

**All database and storage operations must be implemented in py-core.** Applications (like py-platform) should import from py-core rather than accessing the database or storage directly.

For detailed database operations, migrations, and local setup, see [DATABASE.md](./DATABASE.md).

### Quick Reference

```bash
# From app/packages/py-core/

make setup              # Start all services and run migrations
make db-migrate         # Run pending migrations
make db-prepare MSG="add new table"  # Create new migration
```

### Creating New Database Models

1. Add the model to `app/packages/py-core/src/py_core/database/models/`
2. Generate a migration: `make db-prepare MSG="add_new_model"`
3. Apply the migration: `make db-migrate`
4. Create domain operations in py-core (not in py-platform)
5. Follow patterns in [PYTHON_LIBRARY_PATTERNS.md](./PYTHON_LIBRARY_PATTERNS.md)
