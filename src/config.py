from dotenv import load_dotenv
import os


def empty_to_none(field):
    value = os.getenv(field)
    if value is None or len(value) == 0:
        return None
    return value


class Secrets:
    anthropic_api_key: str | None
    openai_api_key: str | None

    def __init__(self):

        # Get Anthropic API key and validate it's set
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable must be set")
        self.anthropic_api_key = anthropic_key

        # Get OpenAI API key and validate it's set
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise ValueError("OPENAI_API_KEY environment variable must be set")
        self.openai_api_key = openai_key

        # Load the environment variables
        load_dotenv()


# TODO: getopt() for cmd line arguments
class Config:
    dev_mode: bool
    host_name: str
    listen_address: str
    listen_port: int
    database_url: str
    database_async_url: str
    debug: bool
    log_path: str | None

    secrets: Secrets

    def __init__(self):
        # Load the environment variables
        load_dotenv()

        self.dev_mode = os.getenv("DEV_MODE", "False") == "True"

        self.host_name = os.getenv("HOST_NAME", "http://localhost:8000")

        self.listen_address = os.getenv("LISTEN_ADDRESS", "0.0.0.0")

        self.listen_port = int(os.getenv("LISTEN_PORT", 8000))

        # Get database URLs from environment
        self.database_url = os.getenv(
            "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/muze"
        )

        # For async, either use DATABASE_ASYNC_URL or derive it from DATABASE_URL
        self.database_async_url = os.getenv(
            "DATABASE_ASYNC_URL",
            self.database_url.replace("postgresql://", "postgresql+asyncpg://"),
        )

        # Set the log path
        self.log_path = empty_to_none("LOG_PATH")

        # Determine if the DEBUG mode is set
        debug = os.getenv("DEBUG", "True")
        self.debug = debug == "True"

        self.secrets = Secrets()

    def show(self, deep: bool = False):
        if deep:
            print(self.__dict__)
            print(self.secrets.__dict__)
        else:
            print(self.__dict__)
