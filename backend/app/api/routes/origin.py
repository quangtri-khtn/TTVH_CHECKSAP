from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db, DbConnection
from ...core.sap import get_default_connection, run_query_timed
from ...models.schemas import OriginQueryRequest, QueryResult
from ...services.query_builder import build_origin_query
from ...services.serializer import serialize_rows

router = APIRouter(prefix="/origin", tags=["origin"])


def _get_conn(connection_id, db):
    if connection_id:
        rec = db.query(DbConnection).filter(DbConnection.id == connection_id).first()
        if not rec:
            raise HTTPException(404, "Không tìm thấy kết nối")
        from ...core.sap import connect_from_record
        return connect_from_record(rec)
    return get_default_connection(db)


@router.post("/query", response_model=QueryResult)
def query_origin(req: OriginQueryRequest, db: Session = Depends(get_db)):
    if not req.doc_numbers:
        raise HTTPException(400, "Vui lòng nhập ít nhất 1 số chứng từ")
    numbers = [n for n in req.doc_numbers if n.strip().isdigit()]
    if not numbers:
        raise HTTPException(400, "Số chứng từ không hợp lệ")
    sql = build_origin_query(req.db, req.doc_type, numbers)
    conn = _get_conn(req.connection_id, db)
    try:
        cols, rows, ms = run_query_timed(conn, sql)
    finally:
        conn.close()
    return QueryResult(columns=cols, rows=serialize_rows(rows), row_count=len(rows), duration_ms=ms)
