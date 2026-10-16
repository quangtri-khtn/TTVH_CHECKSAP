from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db, DbConnection
from ...core.security import encrypt, decrypt
from ...core.sap import connect_from_record
from ...models.schemas import ConnectionCreate, ConnectionUpdate, ConnectionOut, ConnectionTest
import pyodbc

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/connections", response_model=list[ConnectionOut])
def list_connections(db: Session = Depends(get_db)):
    return db.query(DbConnection).order_by(DbConnection.id).all()


@router.post("/connections", response_model=ConnectionOut)
def create_connection(body: ConnectionCreate, db: Session = Depends(get_db)):
    if body.is_default:
        db.query(DbConnection).update({"is_default": False})
    rec = DbConnection(
        name=body.name,
        server=body.server,
        username=body.username,
        password_enc=encrypt(body.password),
        is_default=body.is_default,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.put("/connections/{conn_id}", response_model=ConnectionOut)
def update_connection(conn_id: int, body: ConnectionUpdate, db: Session = Depends(get_db)):
    rec = db.query(DbConnection).filter(DbConnection.id == conn_id).first()
    if not rec:
        raise HTTPException(404, "Không tìm thấy kết nối")
    if body.server is not None:
        rec.server = body.server
    if body.username is not None:
        rec.username = body.username
    if body.password is not None:
        rec.password_enc = encrypt(body.password)
    if body.is_default is not None:
        if body.is_default:
            db.query(DbConnection).update({"is_default": False})
        rec.is_default = body.is_default
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/connections/{conn_id}")
def delete_connection(conn_id: int, db: Session = Depends(get_db)):
    rec = db.query(DbConnection).filter(DbConnection.id == conn_id).first()
    if not rec:
        raise HTTPException(404, "Không tìm thấy kết nối")
    db.delete(rec)
    db.commit()
    return {"ok": True}


@router.post("/connections/test")
def test_connection(body: ConnectionTest):
    from ...core.sap import _get_driver
    driver = _get_driver()
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={body.server};"
        f"UID={body.username};"
        f"PWD={body.password};"
        "TrustServerCertificate=yes"
    )
    try:
        conn = pyodbc.connect(conn_str, timeout=10)
        cur = conn.cursor()
        cur.execute("SELECT @@VERSION")
        version = cur.fetchone()[0]
        conn.close()
        return {"ok": True, "version": version[:80]}
    except Exception as e:
        raise HTTPException(400, f"Kết nối thất bại: {str(e)}")
