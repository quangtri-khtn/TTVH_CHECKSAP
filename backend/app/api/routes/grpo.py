from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db, DbConnection
from ...core.sap import get_default_connection, run_query_timed
from ...models.schemas import GrpoOverPoRequest, QueryResult
from ...services.query_builder import OVER_PO_DEFAULT_DATE
from ...services.serializer import serialize_rows

router = APIRouter(prefix="/grpo", tags=["grpo"])

QUERIES_DIR = Path(__file__).resolve().parents[4] / "queries"

OVER_PO_FILES = {
    "TTVH": "Query_Monitor_GRPO_Vuot_PO_TTVH.txt",
    "KBMD": "Query_Monitor_GRPO_Vuot_PO_KBMD.txt",
}


def _get_conn(connection_id, db):
    if connection_id:
        rec = db.query(DbConnection).filter(DbConnection.id == connection_id).first()
        if not rec:
            raise HTTPException(404, "Không tìm thấy kết nối")
        from ...core.sap import connect_from_record
        return connect_from_record(rec)
    return get_default_connection(db)


@router.post("/over-po", response_model=QueryResult)
def get_grpo_over_po(req: GrpoOverPoRequest, db: Session = Depends(get_db)):
    fname = OVER_PO_FILES.get(req.db.upper())
    if not fname:
        raise HTTPException(400, f"DB không hợp lệ: {req.db}")
    fpath = QUERIES_DIR / fname
    if not fpath.exists():
        raise HTTPException(404, f"Không tìm thấy file query: {fname}")

    text = fpath.read_text(encoding="utf-8-sig")
    old = f"''{OVER_PO_DEFAULT_DATE}''"
    if old not in text:
        raise HTTPException(500, f'Không tìm thấy mốc ngày "{old}" trong file query.')
    sql = text.replace(old, f"''{req.date_from}''", 1)

    conn = _get_conn(req.connection_id, db)
    try:
        cols, rows, ms = run_query_timed(conn, sql)
    finally:
        conn.close()
    return QueryResult(columns=cols, rows=serialize_rows(rows), row_count=len(rows), duration_ms=ms)
