from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .core.database import create_tables
from .api.routes import config, flow, origin, grpo

settings = get_settings()

app = FastAPI(
    title="Check Pilot Web API",
    description="API theo dõi luồng chứng từ SAP B1 (TTVH ↔ KBMD)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config.router, prefix="/api")
app.include_router(flow.router, prefix="/api")
app.include_router(origin.router, prefix="/api")
app.include_router(grpo.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
