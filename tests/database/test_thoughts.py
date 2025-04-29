import os
import uuid
import pytest
from src.database.database import AsyncDatabase
from src.database.models.thought import Thought, DatabaseException

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def db():
    # Get database connection info from environment
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/muze")
    
    # Convert to async URL if needed
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    # Create database connection
    db = AsyncDatabase(db_url)
    await db.initialize()
    yield db
    
    # Cleanup
    await db.engine.dispose()


@pytest.fixture
async def session(db):
    # Use a simple session with rollback for cleanup
    async with db.session() as session:
        yield session
        # Rollback any changes
        await session.rollback()

async def test_create_thought(session):
    # Test creating a user with valid email - use unique email
    content = f"clouds are like god's farts"
    user = await Thought.create(content=content, session=session)

    assert user.id is not None
    assert user.content == content
    assert user.created_at is not None
    assert user.updated_at is not None