from fastapi import (
    Request,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.logger import RequestSpan

def async_db(request: Request) -> AsyncSession:
    return request.state.database


def span(request: Request) -> RequestSpan:
    return request.state.span


def state(request: Request):
    return request.state.app_state