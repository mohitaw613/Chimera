"""
Database connection and session factory.
Supports both SQLite (local dev) and PostgreSQL (production on Render).
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# --- Engine ---
_db_url = settings.DATABASE_URL

# SQLite needs check_same_thread=False for FastAPI's thread model.
# PostgreSQL does not need (and rejects) that kwarg.
if _db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}
    # Render/Heroku Postgres URLs sometimes start with "postgres://" (not "postgresql://")
    # SQLAlchemy ≥ 2 requires "postgresql+psycopg2://" — fix it transparently.
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif _db_url.startswith("postgresql://"):
        _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    _db_url,
    connect_args=connect_args,
    echo=False,
)

# Enable SQLite foreign key enforcement (no-op for Postgres)
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
