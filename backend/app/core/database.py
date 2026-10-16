from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
from .config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DbConnection(Base):
    __tablename__ = "db_connections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    server = Column(String(255), nullable=False)
    username = Column(String(100), nullable=False)
    password_enc = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, index=True)
    query_type = Column(String(50))
    date_from = Column(String(20))
    row_count = Column(Integer)
    duration_ms = Column(Integer)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
