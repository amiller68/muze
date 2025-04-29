from fastapi import Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from src.state import AppState
from src.server.deps import state


# Response/Error Types
class IndexError(BaseModel):
    detail: str
    code: str


# Handler
templates = Jinja2Templates(directory="templates")


async def handler(
    request: Request,
    _state: AppState = Depends(state),
) -> HTMLResponse:
    """Get the home page

    Args:
        request: The incoming request
        _state: Application state

    Returns:
        HTMLResponse: The rendered home template

    Raises:
        HTTPException: If rendering fails
    """
    try:
        if request.headers.get("HX-Request"):
            return templates.TemplateResponse(
                "content/index.html", {"request": request}
            )
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as _e:
        raise HTTPException(
            status_code=500,
            detail={
                "detail": "Failed to render home page",
                "code": "HOME_RENDER_ERROR",
            },
        )
