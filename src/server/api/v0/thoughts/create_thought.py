from fastapi import Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.database.models import Thought
from src.logger import RequestSpan
from src.server.deps import async_db, span


# Response/Error Types
class CreateThoughtError(BaseModel):
    detail: str
    code: str


# Handler
templates = Jinja2Templates(directory="templates")

async def handler(
    request: Request,
    db: AsyncSession = Depends(async_db),
    span: RequestSpan = Depends(span),
):
    """Create a new thought

    Args:
        request: The incoming request
        db: Database session
        span: Request span for logging

    Returns:
        Union[HTMLResponse, RedirectResponse]: The updated entries list or a redirect to the new entry

    Raises:
        HTTPException: If creating entry fails
    """
    try:
        form = await request.form()
        content = str(form.get("content", ""))
        span.info("api::v0::thoughts::create_thought -- creating new thought")

        if not content:
            span.warn("api::v0::thoughts::create_thought -- empty content provided")
            raise HTTPException(
                status_code=400,
                detail={
                    "detail": "Content cannot be empty",
                    "code": "EMPTY_CONTENT_ERROR",
                },
            )

        thought = await Thought.create(content, db, span)
        await db.commit()

        return thought
    except Exception as e:
        span.error(f"Failed to create thought: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"detail": "Failed to create thought", "code": "THOUGHT_CREATE_ERROR"},
        )
