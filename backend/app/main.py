from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.auth.seed import seed_manager_account
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.exception_handlers import register_exception_handlers
from app.dashboard.router import router as manager_router
from app.resumes.router import router as resumes_router
from app.tracking.router import applications_router, events_router
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db = SessionLocal()
    try:
        seed_manager_account(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Job Application Tracking System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_origin_regex=get_settings().cors_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(resumes_router)
app.include_router(events_router)
app.include_router(applications_router)
app.include_router(manager_router)


@app.get("/actuator/health")
def health() -> dict:
    return {"status": "UP"}
