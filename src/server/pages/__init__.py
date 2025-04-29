from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from . import index, new, list

router = APIRouter()

# Home routes
router.add_api_route(
    "/",
    index.handler,
    methods=["GET"],
    response_class=HTMLResponse,
    responses={
        200: {"description": "Successfully rendered home page"},
        500: {"model": index.IndexError, "description": "Internal server error"},
    },
)

# About routes
router.add_api_route(
    "/new",
    new.handler,
    methods=["GET"],
    response_class=HTMLResponse,
    responses={
        200: {"description": "Successfully rendered new page"},
        500: {"model": new.NewError, "description": "Internal server error"},
    },
)

router.add_api_route(
    "/list",
    list.handler,
    methods=["GET"],
    response_class=HTMLResponse,
    responses={
        200: {"description": "Successfully rendered list page"},
        500: {"model": list.ListError, "description": "Internal server error"},
    },
)
