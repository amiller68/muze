from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, String, DateTime, Text
from datetime import datetime
import uuid
from sqlalchemy.future import select

from src.logger import RequestSpan
from ..database import Base, DatabaseException


class Thought(Base):
    __tablename__ = "thoughts"

    # Unique identifier
    id = Column(
        String, primary_key=True, default=lambda: str(uuid.uuid4()), nullable=False
    )

    # Content
    content = Column(Text, nullable=False)

    # timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @staticmethod
    async def create(
        content: str,
        session: AsyncSession,
        span: RequestSpan | None = None,
    ):
        try:
            entry = Thought(content=content)
            session.add(entry)
            await session.flush()
            return entry
        except Exception as e:
            if span:
                span.error(f"database::models::thought::create: {e}")
            db_e = DatabaseException.from_sqlalchemy_error(e)
            raise db_e

    @staticmethod
    async def get_all(
        session: AsyncSession,
        offset: int = 0,
        limit: int = 10,
        span: RequestSpan | None = None,
    ):
        try:
            result = await session.execute(
                select(Thought)
                .order_by(Thought.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            if span:
                span.error(f"database::models::thought::get_all: {e}")
            db_e = DatabaseException.from_sqlalchemy_error(e)
            raise db_e