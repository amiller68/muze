from fastapi import Request, HTTPException, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.models import Thought
from src.logger import RequestSpan
from src.server.deps import async_db, span


# Response/Error Types
class ListError(BaseModel):
    detail: str
    code: str


# Handler
templates = Jinja2Templates(directory="templates")


async def handler(
    request: Request,
    db: AsyncSession = Depends(async_db),
    span: RequestSpan = Depends(span),
) -> HTMLResponse:
    """Get the list page

    Args:
        request: The incoming request
        db: Database session
        span: Request span for logging

    Returns:
        HTMLResponse: The rendered list template

    Raises:
        HTTPException: If rendering fails
    """
    try:
        # Fetch thoughts from database
        thoughts = await Thought.get_all(db, span=span)
        
        if request.headers.get("HX-Request"):
            return templates.TemplateResponse(
                "content/list.html", {"request": request, "thoughts": thoughts}
            )
        return templates.TemplateResponse(
            "index.html", 
            {
                "request": request, 
                "initial_content": "content/list.html",
                "thoughts": thoughts
            }
        )
    except Exception as _e:
        raise HTTPException(
            status_code=500,
            detail={
                "detail": "Failed to render list page",
                "code": "LIST_RENDER_ERROR",
            },
        )
