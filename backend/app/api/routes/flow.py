"""API cho các màn hình luồng bán / luồng trả."""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io, time
from concurrent.futures import ThreadPoolExecutor

from ...core.database import get_db, DbConnection, QueryLog
from ...core.sap import get_default_connection, run_query, run_query_timed
from ...models.schemas import (
    FlowQueryRequest, CheckPoGrpoRequest, CheckSoArRequest,
    FlowChainRequest, QueryResult,
)
from ...services.query_builder import (
    build_flow_query, build_po_grpo_query, build_so_ar_query,
    build_flow_chain_queries,
)
from ...services.serializer import serialize_rows

router = APIRouter(prefix="/flow", tags=["flow"])

QUERIES_DIR = Path(__file__).resolve().parents[4] / "queries"

QUERY_FILES = {
    "sales": "Query_Purchase_Sale_Combined_NoItem.txt",
    "sales_item": "Query_Purchase_Sale_Combined.txt",
    "returns": "Query_Return_Combined_NoItem.txt",
    "returns_item": "Query_Return_Combined.txt",
}


def _get_conn(connection_id, db: Session):
    if connection_id:
        rec = db.query(DbConnection).filter(DbConnection.id == connection_id).first()
        if not rec:
            raise HTTPException(404, "Không tìm thấy kết nối")
        from ...core.sap import connect_from_record
        return connect_from_record(rec)
    return get_default_connection(db)


def _run_flow(query_type: str, req: FlowQueryRequest, db: Session) -> QueryResult:
    fname = QUERY_FILES[query_type]
    fpath = QUERIES_DIR / fname
    if not fpath.exists():
        raise HTTPException(404, f"Không tìm thấy file query: {fname}. Hãy copy file vào thư mục queries/.")

    query_text = fpath.read_text(encoding="utf-8")
    sql = build_flow_query(query_text, req.date_from)

    conn = _get_conn(req.connection_id, db)
    try:
        cols, rows, ms = run_query_timed(conn, sql)
    finally:
        conn.close()

    log = QueryLog(query_type=query_type, date_from=req.date_from, row_count=len(rows), duration_ms=ms)
    db.add(log)
    db.commit()

    return QueryResult(columns=cols, rows=serialize_rows(rows), row_count=len(rows), duration_ms=ms)


@router.post("/sales", response_model=QueryResult)
def get_sales_flow(req: FlowQueryRequest, db: Session = Depends(get_db)):
    return _run_flow("sales", req, db)


@router.post("/sales-item", response_model=QueryResult)
def get_sales_flow_item(req: FlowQueryRequest, db: Session = Depends(get_db)):
    return _run_flow("sales_item", req, db)


@router.post("/returns", response_model=QueryResult)
def get_returns_flow(req: FlowQueryRequest, db: Session = Depends(get_db)):
    return _run_flow("returns", req, db)


@router.post("/returns-item", response_model=QueryResult)
def get_returns_flow_item(req: FlowQueryRequest, db: Session = Depends(get_db)):
    return _run_flow("returns_item", req, db)


@router.post("/check-po-grpo", response_model=QueryResult)
def check_po_grpo(req: CheckPoGrpoRequest, db: Session = Depends(get_db)):
    if not req.po_numbers:
        raise HTTPException(400, "Vui lòng nhập ít nhất 1 số PO")
    sql = build_po_grpo_query(req.db, req.po_numbers)
    conn = _get_conn(req.connection_id, db)
    try:
        cols, rows, ms = run_query_timed(conn, sql)
    finally:
        conn.close()
    return QueryResult(columns=cols, rows=serialize_rows(rows), row_count=len(rows), duration_ms=ms)


@router.post("/check-so-ar", response_model=QueryResult)
def check_so_ar(req: CheckSoArRequest, db: Session = Depends(get_db)):
    if not req.so_numbers:
        raise HTTPException(400, "Vui lòng nhập ít nhất 1 số SO")
    sql = build_so_ar_query(req.db, req.so_numbers)
    conn = _get_conn(req.connection_id, db)
    try:
        cols, rows, ms = run_query_timed(conn, sql)
    finally:
        conn.close()
    return QueryResult(columns=cols, rows=serialize_rows(rows), row_count=len(rows), duration_ms=ms)


@router.post("/chain/{po_number}", response_model=QueryResult)
def get_flow_chain(po_number: str, req: FlowChainRequest, db: Session = Depends(get_db)):
    if not po_number.isdigit():
        raise HTTPException(400, "Số PO không hợp lệ")
    queries = build_flow_chain_queries(po_number)
    conn = _get_conn(req.connection_id, db)
    try:
        t0 = time.monotonic()
        with ThreadPoolExecutor(max_workers=6) as ex:
            results = list(ex.map(lambda q: run_query(conn, q)[1], queries))
        ms = int((time.monotonic() - t0) * 1000)
    finally:
        conn.close()

    rows = [r for res in results for r in res]
    rows.sort(key=lambda r: (r.get("Ord", 0), r.get("DocNum", 0)))
    if rows:
        cols = list(rows[0].keys())
    else:
        cols = ["Stage", "Ord", "DocNum", "DocDate", "CreateDate", "DocStatus",
                "Canceled", "DocTotal", "JE", "Info", "RefNo", "EinvStatus",
                "InvSeri", "InvDate", "ShipDate"]

    return QueryResult(columns=cols, rows=serialize_rows(rows), row_count=len(rows), duration_ms=ms)
