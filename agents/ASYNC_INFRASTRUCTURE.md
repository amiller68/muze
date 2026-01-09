# Async Infrastructure

This document covers three key infrastructure patterns for building async/background capabilities:

1. **LLM Agent Framework** - How to define agents and tools for the chat interface
2. **Cron Scheduling** - Declarative periodic tasks with distributed locking
3. **Background Task Tools** - How agent tools can dispatch async operations

---

## LLM Agent Framework

**Location:** `py_core/ai_ml/`

The agent framework uses [Pydantic AI](https://ai.pydantic.dev/) to define LLM agents with typed tools. Tools receive dependencies through a shared `AgentDeps` context.

### Core Components

| File | Purpose |
|------|---------|
| `_agent.py` | Agent factory (`create_agent()`) |
| `_deps.py` | Dependency container (`AgentDeps`) |
| `_config.py` | API key configuration |
| `tools/` | Tool implementations |

### AgentDeps

All tools receive dependencies via `RunContext[AgentDeps]`:

```python
# py_core/ai_ml/_deps.py
@dataclass
class AgentDeps:
    db: AsyncSession       # Database access
    logger: Logger         # Structured logging
    user_id: str           # Current user (for authorization)
    thread_id: str         # Current chat thread (for async ops)
    completion_id: str     # Current completion (for async tool executions)
```

### Defining a Tool

Tools are async functions that receive `RunContext[AgentDeps]` as the first parameter:

```python
# py_core/ai_ml/tools/my_tool.py
from pydantic_ai import RunContext
from py_core.ai_ml._deps import AgentDeps

async def my_tool(
    ctx: RunContext[AgentDeps],
    query: str,
    limit: int = 10,
) -> str:
    """
    One-line description shown to the LLM.

    Longer docstring for documentation.

    Args:
        ctx: Pydantic AI run context with dependencies
        query: Search query
        limit: Maximum results

    Returns:
        JSON string with results
    """
    # Access dependencies
    result = await ctx.deps.db.execute(...)
    ctx.deps.logger.info(f"Tool executed: {query}")

    # Return JSON string
    return json.dumps({"results": [...]})
```

**Key patterns:**
- Access dependencies via `ctx.deps.db`, `ctx.deps.logger`, etc.
- Return JSON strings (LLMs work with text)
- Use docstrings - they become the tool description
- Check `ctx.deps.user_id` for authorization

### Registering Tools

Tools are registered in `AgentSpec` which is passed to the chat engine:

```python
# py_core/ai_ml/chat/tasks/complete_thread.py

def _get_chat_agent_spec() -> AgentSpec:
    """Build agent spec lazily to avoid circular imports."""
    from py_core.ai_ml.tools import my_tool, other_tool

    return AgentSpec(
        model="claude-sonnet-4-5",
        thinking_enabled=False,
        system_prompt_builder=_system_prompt,
        tools=[my_tool, other_tool],  # Tools available to the agent
    )
```

### Adding a New Tool

1. **Create tool file** in `py_core/ai_ml/tools/`:
   ```python
   # py_core/ai_ml/tools/my_new_tool.py
   async def my_new_tool(ctx: RunContext[AgentDeps], param: str) -> str:
       ...
   ```

2. **Export from `__init__.py`**:
   ```python
   # py_core/ai_ml/tools/__init__.py
   from .my_new_tool import my_new_tool
   __all__ = [..., "my_new_tool"]
   ```

3. **Register in agent spec**:
   ```python
   # In _get_chat_agent_spec()
   return AgentSpec(
       tools=[..., my_new_tool],
   )
   ```

4. **Document in system prompt** (optional but recommended):
   ```python
   async def _system_prompt(ctx: RunContext[AgentDeps]) -> str:
       return """...

       ### my_new_tool
       Description of what it does...
       """
   ```

---

## Cron Scheduling

**Location:** `py_core/tasks/cron.py`

The `@cron` decorator provides declarative periodic tasks with:
- Automatic Redis distributed locking (prevents overlapping runs)
- Run tracking in `cron_job_runs` table (for observability)
- Integration with TaskIQ's scheduler

### Basic Usage

```python
from py_core.tasks import broker
from py_core.tasks.cron import cron
from py_core.tasks.deps import get_db_session, get_logger

@cron("*/5 * * * *", lock_ttl=300)  # Every 5 minutes, 5 min lock
@broker.task
async def my_periodic_task(
    db: AsyncSession = TaskiqDepends(get_db_session),
    logger: Logger = TaskiqDepends(get_logger),
) -> dict:
    """
    Periodic cleanup task.

    Returns dict for logging/observability.
    """
    logger.info("Running periodic task")
    # ... do work ...
    return {"cleaned_count": 42}
```

**Decorator order matters:** `@cron` must come before `@broker.task`.

### Cron Expression Format

Standard 5-field cron expressions:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, 0=Sunday)
│ │ │ │ │
* * * * *
```

| Expression | Meaning |
|------------|---------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 2 * * 0` | Weekly on Sunday at 2am |

### Lock TTL

The `lock_ttl` parameter (in seconds) determines how long the Redis lock is held:

- **Should be longer** than the maximum expected task duration
- **Defaults to 300 seconds** (5 minutes)
- If a task takes longer than `lock_ttl`, the lock expires and another instance could start

```python
@cron("0 * * * *", lock_ttl=3600)  # Hourly, 1 hour lock for long task
```

### Run Tracking

All cron runs are recorded in `cron_job_runs` table:

| Column | Purpose |
|--------|---------|
| `job_name` | Task function name |
| `status` | RUNNING, COMPLETED, FAILED, SKIPPED |
| `started_at` | When the run started |
| `completed_at` | When it finished |
| `duration_ms` | Execution time |
| `result` | JSON result from task |
| `error` | Error message if failed |

**Skipped runs** are recorded when a task attempts to run but the lock is held by another instance.

### Running the Scheduler

The scheduler is a separate process that dispatches scheduled tasks:

```bash
# In development
taskiq scheduler py_core.tasks.scheduler:scheduler

# In production (via procfile or container)
# Only run ONE instance to avoid duplicate dispatches
```

### Real Example

```python
# py_core/ai_ml/chat/tasks/recover_stuck.py

@cron("* * * * *", lock_ttl=120)  # Every minute, 2 min lock
@broker.task
async def recover_stuck_completions_task(
    timeout_minutes: int = 5,
    db: AsyncSession = TaskiqDepends(get_db_session),
    logger: Logger = TaskiqDepends(get_logger),
    events: EventPublisher = TaskiqDepends(get_event_publisher),
) -> dict:
    """
    Find and recover completions stuck in PROCESSING state.
    """
    # Find stuck completions
    cutoff = utcnow() - timedelta(minutes=timeout_minutes)
    result = await db.execute(
        select(Completion)
        .where(Completion.status == CompletionStatus.PROCESSING)
        .where(Completion.started_at < cutoff)
    )

    stuck = list(result.scalars().all())
    # ... recover them ...

    return {"recovered_count": len(stuck)}
```

---

## Background Task Tools

**Pattern:** Agent tools can dispatch async background operations

This pattern is used when an agent tool needs to trigger long-running work that shouldn't block the chat response. The `design_procedure` tool is the canonical example.

### Architecture

```
1. User asks LLM to design a procedure
   ↓
2. LLM calls design_procedure tool
   ↓
3. Tool creates database records:
   - Search record (captures search parameters)
   - AsyncToolExecution (links search to chat thread)
   ↓
4. Tool dispatches background task with label:
   - run_search_task.kicker().with_labels(async_tool_execution_id=...).kiq(search_id=...)
   ↓
5. Tool returns immediately:
   - pending(...) result
   ↓
6. Background task runs A* search
   ↓
7. @with_async_tool_lifecycle decorator handles:
   - Completing/failing the AsyncToolExecution
   - Publishing events
   ↓
8. Frontend receives event via WebSocket
   ↓
9. UI updates with search results
```

### Core Components

| File | Purpose |
|------|---------|
| `py_core/ai_ml/tools/lifecycle.py` | `@with_async_tool_lifecycle` decorator |
| `py_core/ai_ml/tools/_types/payload.py` | `AsyncToolPayload` base class |
| `py_core/database/models/async_tool_execution.py` | `AsyncToolExecution` model |
| `apps/py-platform/src/tasks/procedure/run_search.py` | Real-world example |

### AsyncToolExecution Model

Links async operations to chat threads for UI display.

```python
# py_core/database/models/async_tool_execution.py
class AsyncToolExecution(Base):
    id: str                      # UUID7
    thread_id: str               # Which chat thread
    completion_id: str | None    # Which completion launched this execution
    name: str                    # Tool name (e.g., "design_procedure")
    timeout_seconds: int | None  # Per-execution timeout (used by recovery task)
    ref_type: str | None         # AsyncToolRefType (SEARCH, etc.)
    ref_id: str | None           # UUID of the domain object
    status: str                  # PENDING, COMPLETED, or FAILED
    result: dict | None          # JSONB for result data
    error_type: str | None       # TIMEOUT, INTERNAL_ERROR, etc.
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None
```

### AsyncToolPayload Base Class

Tasks return a payload that declares both data AND formatting for the LLM:

```python
# py_core/ai_ml/tools/_types/payload.py
class AsyncToolPayload(BaseModel, ABC):
    # Pending state (class methods - no data yet)
    @classmethod
    @abstractmethod
    def format_pending_message(cls) -> str:
        """Short UI message when task starts."""
        ...

    @classmethod
    @abstractmethod
    def format_pending_content_parts(cls) -> list[ContentPart]:
        """Content parts for LLM when task starts."""
        ...

    # Completed state (instance methods - has data)
    @abstractmethod
    def format_message(self) -> str:
        """Short UI message when complete."""
        ...

    @abstractmethod
    def format_content_parts(self) -> list[ContentPart]:
        """Content parts for LLM when complete."""
        ...
```

### Two-Mode Execution

The same task can work in two modes based on TaskIQ labels:

```python
# Chat mode (LLM called the tool) - label triggers AsyncToolExecution lifecycle
await run_search_task.kicker().with_labels(
    async_tool_execution_id=execution.id,
).kiq(search_id)

# Standalone mode (procedure editor, etc.) - runs normally without lifecycle
await run_search_task.kiq(search_id)
```

### Implementing a Background Task with Lifecycle

```python
# apps/py-platform/src/tasks/procedure/run_search.py
from taskiq import Context as TaskiqContext, TaskiqDepends
from py_core.ai_ml.tools import (
    AsyncToolPayload,
    AsyncToolRefType,
    with_async_tool_lifecycle,
)
from py_core.ai_ml.types.llm import ContentPart, TextPart
from src.tasks import broker
from src.tasks.deps import (
    get_db_session, get_logger, get_event_publisher, get_taskiq_context
)

class SearchResultPayload(AsyncToolPayload):
    """Payload for search task results."""
    search_id: str
    found_solution: bool
    operations_count: int
    states_explored: int

    # --- Pending state (class methods) ---
    @classmethod
    def format_pending_message(cls) -> str:
        return "Cloning search started"

    @classmethod
    def format_pending_content_parts(cls) -> list[ContentPart]:
        return [TextPart(content="Search in progress. Results will appear when complete.")]

    # --- Completed state (instance methods) ---
    def format_message(self) -> str:
        if self.found_solution:
            return f"Search found a solution with {self.operations_count} operations"
        return f"Search completed - no solution found ({self.states_explored} states explored)"

    def format_content_parts(self) -> list[ContentPart]:
        if self.found_solution:
            content = f"Search completed successfully.\n- Operations: {self.operations_count}"
        else:
            content = f"Search completed.\n- Found solution: No"
        return [TextPart(content=content)]


@broker.task
@with_async_tool_lifecycle(
    payload_cls=SearchResultPayload,
    ref_id_param="search_id",
    ref_type=AsyncToolRefType.SEARCH,
)
async def run_search_task(
    search_id: str,
    procedure_id: str | None = None,
    # Injected dependencies
    db: AsyncSession = TaskiqDepends(get_db_session),
    logger: Logger = TaskiqDepends(get_logger),
    events: EventPublisher = TaskiqDepends(get_event_publisher),
    _taskiq_ctx: TaskiqContext = TaskiqDepends(get_taskiq_context),  # Required!
) -> SearchResultPayload:
    """
    Background task for running cloning search.

    When called with async_tool_execution_id label, the decorator handles:
    - Loading the AsyncToolExecution record
    - Completing/failing it based on task result
    - Publishing AsyncToolExecutionCompleted/Failed events

    When called without labels, runs in standalone mode.
    """
    # Do the actual work
    result = await run_search(...)

    # Return payload - decorator handles lifecycle if labels present
    return SearchResultPayload(
        search_id=search_id,
        found_solution=result.found_solution,
        states_explored=result.states_explored,
        operations_count=len(result.operations),
    )
```

**Key requirements for `@with_async_tool_lifecycle`:**
- Must stack AFTER `@broker.task` (decorator order matters)
- Task MUST include `_taskiq_ctx: TaskiqContext = TaskiqDepends(get_taskiq_context)` parameter
- Task MUST have `db`, `logger`, and `events` parameters
- Task MUST return an instance of the `payload_cls`

### Implementing the Tool (Chat Side)

```python
# apps/py-platform/src/agents/tools/design_procedure.py
from py_core.ai_ml.chat.async_tool_execution.create import (
    Context as CreateExecContext,
    Params as CreateExecParams,
    create_async_tool_execution,
)
from py_core.ai_ml.tools import AsyncToolRefType, pending, validation_error

async def design_procedure(
    ctx: RunContext[AgentDeps],
    input_plasmid_ids: list[str],
    target_feature_ids: list[str],
) -> ToolResultBase:
    """Tool that dispatches async search work."""
    db = ctx.deps.db

    # 1. Validate inputs
    if not input_plasmid_ids:
        return validation_error("At least one input plasmid required")

    # 2. Create domain record (captures parameters)
    search = Search(user_id=ctx.deps.user_id, ...)
    db.add(search)
    await db.flush()

    # 3. Create AsyncToolExecution (links to chat thread and completion)
    exec_result = await create_async_tool_execution(
        params=CreateExecParams(
            thread_id=ctx.deps.thread_id,
            completion_id=ctx.deps.completion_id,
            name="design_procedure",
            timeout_seconds=600,  # 10 minutes for cloning search
            ref_type=AsyncToolRefType.SEARCH,
            ref_id=search.id,
        ),
        ctx=CreateExecContext(db=db, logger=ctx.deps.logger),
    )
    await db.commit()

    # 4. Dispatch task WITH label (triggers lifecycle handling)
    from src.tasks.procedure import run_search_task
    await run_search_task.kicker().with_labels(
        async_tool_execution_id=exec_result.execution_id,
    ).kiq(search_id=search.id)

    # 5. Return pending result
    return pending(
        ref_type=AsyncToolRefType.SEARCH,
        ref_id=search.id,
        message="Search started",
        content_parts=[TextPart(content="Searching for cloning path...")],
    )
```

### Frontend Integration

**Event types** (in `@geney/ts-geney/events`):

```typescript
export const ASYNC_TOOL_EXECUTION_COMPLETED = 'async_tool_execution.completed' as const
export const ASYNC_TOOL_EXECUTION_FAILED = 'async_tool_execution.failed' as const

export interface AsyncToolExecutionCompletedPayload {
  execution_id: string
  execution_type: string
  ref_id: string | null
  thread_id: string
}
```

**Listen for events** in chat component:

```typescript
useServerEvent<AsyncToolExecutionCompletedPayload>(
  ASYNC_TOOL_EXECUTION_COMPLETED,
  (payload) => {
    if (payload.thread_id === threadId) {
      reloadThread()  // Refresh to get updated results
    }
  }
)
```

---

## Admin Dashboard

**Location:** `apps/py-platform/src/server/html/admin/`

The admin dashboard provides observability into the async infrastructure components. It's built with Jinja2 templates and HTMX for a simple server-rendered UI.

### Structure

```
src/server/html/admin/
├── __init__.py           # Router combining all admin routes
├── deps.py               # require_admin_user dependency
├── dashboard.py          # Dashboard and health checks
├── users.py              # User management
├── cron_jobs.py          # Cron job run history
├── async_executions.py   # Async tool execution tracking
└── completions.py        # LLM completion audit trail

templates/
├── components/           # Reusable components
│   ├── status_badge.html
│   ├── json_viewer.html
│   └── pagination.html
├── layouts/
│   └── admin.html        # Admin layout with sidebar
└── pages/admin/
    ├── dashboard/
    ├── users/
    ├── cron_jobs/
    ├── async_executions/
    └── completions/
```

### Views

| Route | Description |
|-------|-------------|
| `/_admin/` | Dashboard with system stats and health checks |
| `/_admin/users` | User list with role badges |
| `/_admin/cron-jobs` | Cron job run history with status filtering |
| `/_admin/async-executions` | Async tool executions linked to threads/completions |
| `/_admin/completions` | Full completion audit trail with message history viewer |

### Key Features

**Cron Jobs View:**
- Lists all `CronJobRun` records with status badges
- Filter by job name and status
- Detail view shows full error messages and result JSON

**Async Executions View:**
- Lists `AsyncToolExecution` records
- Links to related thread and completion
- Filter by name, status, thread_id
- Shows timeout configuration and error details

**Completions View:**
- Lists `Completion` records with token usage and latency
- Filter by status, thread_id, user_id
- Detail view shows:
  - Full prompt text
  - Message history with role-based coloring (system/user/assistant/tool)
  - Response text
  - Error details with type, message, and JSON details

### Adding New Admin Views

1. **Create handler** in `src/server/html/admin/`:
   ```python
   from fastapi import APIRouter, Depends
   from .deps import require_admin_user

   router = APIRouter()

   @router.get("", response_class=HTMLResponse)
   async def list_items(
       request: Request,
       user: User = Depends(require_admin_user),
       db: AsyncSession = Depends(async_db),
   ) -> HTMLResponse:
       ...
   ```

2. **Register in `__init__.py`**:
   ```python
   from .my_feature import router as my_feature_router
   router.include_router(my_feature_router, prefix="/my-feature")
   ```

3. **Create templates** following the pattern:
   - `templates/pages/admin/my_feature/index.html` - List view
   - `templates/pages/admin/my_feature/detail.html` - Detail view
   - `templates/pages/admin/my_feature/components/table.html` - Table partial

4. **Add navigation** in `templates/layouts/admin.html`

---

## Quick Reference

### Adding a Simple Tool

1. Create `py_core/ai_ml/tools/my_tool.py`
2. Export from `py_core/ai_ml/tools/__init__.py`
3. Add to tools list in `_get_chat_agent_spec()`

### Adding a Cron Task

1. Create task with `@cron` + `@broker.task` decorators
2. Import in `py_core/tasks/__init__.py` (for registration)
3. Run scheduler process in production

### Adding an Async Tool

1. Add new value to `AsyncToolRefType` enum (requires migration if adding enum value)
2. Create domain record model + migration
3. Create `AsyncToolPayload` subclass with formatting methods
4. Create background task with `@with_async_tool_lifecycle` decorator
5. Create tool that dispatches task with `async_tool_execution_id` label
6. Update frontend to listen for events

### Checklist for New Async Tools

- [ ] Add value to `AsyncToolRefType` enum in async_tool_execution.py (if needed)
- [ ] Migration to add enum value: `ALTER TYPE async_tool_ref_type ADD VALUE 'my_type'`
- [ ] Domain record model with necessary fields
- [ ] `AsyncToolPayload` subclass with all 4 format methods
- [ ] Background task with `@broker.task` + `@with_async_tool_lifecycle`
- [ ] Task includes `_taskiq_ctx` parameter with `TaskiqDepends(get_taskiq_context)`
- [ ] AsyncToolExecution created with `completion_id` and `timeout_seconds`
- [ ] Task dispatched with `.kicker().with_labels(async_tool_execution_id=...)`
- [ ] Frontend listens for `ASYNC_TOOL_EXECUTION_COMPLETED` events
