from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


# ── Connection ──────────────────────────────────────────────────────────────
class ConnectionCreate(BaseModel):
    name: str
    server: str
    username: str
    password: str
    is_default: bool = False


class ConnectionUpdate(BaseModel):
    server: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_default: Optional[bool] = None


class ConnectionOut(BaseModel):
    id: int
    name: str
    server: str
    username: str
    is_default: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConnectionTest(BaseModel):
    server: str
    username: str
    password: str


# ── Query request ────────────────────────────────────────────────────────────
class FlowQueryRequest(BaseModel):
    date_from: str  # YYYYMMDD
    connection_id: Optional[int] = None


class CheckPoGrpoRequest(BaseModel):
    db: str  # "TTVH" | "KBMD"
    po_numbers: list[str]
    connection_id: Optional[int] = None


class CheckSoArRequest(BaseModel):
    db: str
    so_numbers: list[str]
    connection_id: Optional[int] = None


class OriginQueryRequest(BaseModel):
    db: str
    doc_type: str  # "PR" | "GRPO" | "AP" | "SO" | "AR"
    doc_numbers: list[str]
    connection_id: Optional[int] = None


class GrpoOverPoRequest(BaseModel):
    db: str  # "TTVH" | "KBMD"
    date_from: str
    connection_id: Optional[int] = None


class FlowChainRequest(BaseModel):
    po_number: str
    connection_id: Optional[int] = None


class DetailDocRequest(BaseModel):
    db: str
    doc_type: str  # "PO"|"PR"|"GRPO"|"AP"|"SO"|"DO"|"AR"|"ARCM"|"APCM"|"OP"|"IP"|"JE"
    doc_number: str
    connection_id: Optional[int] = None


# ── Response ─────────────────────────────────────────────────────────────────
class QueryResult(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    duration_ms: int


class ErrorResponse(BaseModel):
    detail: str
