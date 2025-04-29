from fastapi import APIRouter
from . import create_thought

router = APIRouter()

# Get entries
router.add_api_route(
    "",
    create_thought.handler,
    methods=["POST"],
)