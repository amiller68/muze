from fastapi import Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel


# Response/Error Types
class ListError(BaseModel):
    detail: str
    code: str


# Handler
templates = Jinja2Templates(directory="templates")


async def handler(
    request: Request,
) -> HTMLResponse:
    """Get the list page

    Args:
        request: The incoming request

    Returns:
        HTMLResponse: The rendered list template

    Raises:
        HTTPException: If rendering fails
    """
    try:
        if request.headers.get("HX-Request"):
            return templates.TemplateResponse(
                "content/list.html", {"request": request}
            )
        return templates.TemplateResponse(
            "index.html", {"request": request, "initial_content": "content/list.html"}
        )
    except Exception as _e:
        raise HTTPException(
            status_code=500,
            detail={
                "detail": "Failed to render list page",
                "code": "LIST_RENDER_ERROR",
            },
        )
