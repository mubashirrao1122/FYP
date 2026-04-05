"""
Async SQLAlchemy engine and session factory for SolRush.
Reads DATABASE_URL from environment (falls back to localhost defaults).
"""

import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# Default: postgres running locally with solrush user/db
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://solrush:solrush@localhost:5432/solrush"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,           # set True to see SQL queries in logs
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,   # reconnect on stale connections
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a DB session and closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
