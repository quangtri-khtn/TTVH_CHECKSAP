"""SAP connection manager - wraps pyodbc the same way the desktop app does."""
import pyodbc
import time
from typing import Any
from sqlalchemy.orm import Session
from .database import DbConnection
from .security import decrypt


SCHEMA_MAP = {
    "TTVH": "maycha_live",
    "KBMD": "kbmd_live",
}

_DEFAULT_ACCOUNT: dict | None = None


def _get_driver() -> str:
    installed = pyodbc.drivers()
    for d in ("ODBC Driver 17 for SQL Server", "ODBC Driver 18 for SQL Server"):
        if d in installed:
            return d
    return "ODBC Driver 17 for SQL Server"


def connect_from_record(rec: DbConnection) -> pyodbc.Connection:
    password = decrypt(rec.password_enc)
    conn_str = (
        f"DRIVER={{{_get_driver()}}};"
        f"SERVER={rec.server};"
        f"UID={rec.username};"
        f"PWD={password};"
        "TrustServerCertificate=yes"
    )
    return pyodbc.connect(conn_str, timeout=30)


def get_default_connection(db: Session) -> pyodbc.Connection:
    rec = db.query(DbConnection).filter(DbConnection.is_default == True).first()
    if rec is None:
        rec = db.query(DbConnection).order_by(DbConnection.id).first()
    if rec is None:
        raise RuntimeError("Chưa cấu hình kết nối SQL Server. Vào Settings để cấu hình.")
    return connect_from_record(rec)


def run_query(conn: pyodbc.Connection, sql: str) -> tuple[list[str], list[dict]]:
    cur = conn.cursor()
    cur.execute(sql)
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    return cols, rows


def run_query_timed(conn: pyodbc.Connection, sql: str) -> tuple[list[str], list[dict], int]:
    t0 = time.monotonic()
    cols, rows = run_query(conn, sql)
    ms = int((time.monotonic() - t0) * 1000)
    return cols, rows, ms


def wrap_openquery(inner: str) -> str:
    return "select * from openquery(hana_mc, '" + inner.replace("'", "''") + "')"
