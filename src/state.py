from fastapi import (
    Request,
)
from dataclasses import dataclass
from enum import Enum as PyEnum

from src.vectorizer import Vectorizer
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
    vectorizer: Vectorizer

    @classmethod
    def from_config(cls, config: Config):
        state = cls(
            config=config,
            database=AsyncDatabase(config.database_async_url),
            logger=Logger(config.log_path, config.debug),
            secrets=config.secrets,
            vectorizer=Vectorizer(config.database_url),
        )
        return state

    async def startup(self):
        """run any startup logic here"""
        try:
            await self.database.initialize()
            await self.vectorizer.install()
            await self.vectorizer.create_vectorizer(self.database)
            await self.vectorizer.run_worker()
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
