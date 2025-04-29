from fastapi import APIRouter, Depends, HTTPException

# from sqlalchemy import text

from src.logger import RequestSpan

# from src.database import AsyncSession
from src.server.deps import span  # , async_db

router = APIRouter()


@router.get("/healthz")
async def health(
    span: RequestSpan = Depends(span),
    # db: AsyncSession = Depends(async_db),
):
    try:
        # await db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        span.error(f"unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="health check failed")


# TODO: real readyz
@router.get("/readyz")
async def ready(
    span: RequestSpan = Depends(span),
):
    return {"status": "ok"}
