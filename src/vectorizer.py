from pgai import Worker, install
from sqlalchemy import text
import asyncio

from src.database import AsyncDatabase

# TODO: getopt() for cmd line arguments
class Vectorizer:
    database_url: str

    def __init__(self, database_url: str):
        self.database_url = database_url

    async def install(self):
        install(self.database_url)

    async def create_vectorizer(self, db: AsyncDatabase):
        sql = text("""
            SELECT ai.create_vectorizer(
                'thoughts'::regclass,
                if_not_exists => true,
                loading => ai.loading_column(column_name=>'content'),
                embedding => ai.embedding_openai(model=>'text-embedding-ada-002', dimensions=>'1536'),
                destination => ai.destination_table(view_name=>'thought_embedding')
            )
        """)
        async with db.session() as session:
            await session.execute(sql)
            await session.commit()

    async def run_worker(self):
        """
        Run the pgai worker to process vectorization tasks in a non-blocking way.
        """
        # def _run_worker():
        #     worker = pgai.Worker(self.database_url)
        #     worker.run()
            
        # await asyncio.to_thread(_run_worker)

        worker = Worker(self.database_url)
        worker.run()