"""Convert SQL result rows to JSON-serializable dicts."""
from decimal import Decimal
from datetime import datetime, date


def serialize_row(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if v is None:
            out[k] = None
        elif isinstance(v, bool):
            out[k] = v
        elif isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, date):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def serialize_rows(rows: list[dict]) -> list[dict]:
    return [serialize_row(r) for r in rows]
