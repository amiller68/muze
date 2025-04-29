from fastapi import (
    Request,
)
from dataclasses import dataclass
from enum import Enum as PyEnum


from src.database import (
    AsyncDatabase,
)
from src.config import Config, Secrets
from src.logger import Logger


class AppStateExceptionType(PyEnum):
    startup_failed = "startup_failed"  # raised when startup fails


class AppStateException(Exception):
    def __init__(self, type: AppStateExceptionType, message: str):
        self.message = message
        self.type = type


@dataclass
class AppState:
    config: Config
    database: AsyncDatabase
    logger: Logger
    secrets: Secrets

    @classmethod
    def from_config(cls, config: Config):
        state = cls(
            config=config,
            database=AsyncDatabase(config.database_async_url),
            logger=Logger(config.log_path, config.debug),
            secrets=config.secrets,
        )
        return state

    async def startup(self):
        """run any startup logic here"""
        try:
            await self.database.initialize()
        except Exception as e:
            raise AppStateException(AppStateExceptionType.startup_failed, str(e)) from e

    async def shutdown(self):
        """run any shutdown logic here"""
        pass

    def set_on_request(self, request: Request):
        """set any request-specific state here"""
        request.state.app_state = self

    def get_on_request(self, request: Request):
        """get any request-specific state here"""
        return request.state.app_state
