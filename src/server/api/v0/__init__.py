from fastapi import APIRouter
from . import thoughts

# Create main HTML router
router = APIRouter()

# Include sub-routers with prefixes
router.include_router(thoughts.router, prefix="/thoughts")