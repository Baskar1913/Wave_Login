from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import Base, engine, SessionLocal
from app.db.bootstrap import ensure_schema_compatibility
from app.models import Role, User, UserRole
from app.services.users import seed_roles
from app.routers import auth, users, admins, roles, me

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility(engine)
    db = SessionLocal()
    try: seed_roles(db)
    finally: db.close()
    yield

app = FastAPI(title="Wave API", version="1.0.0", description="Role-based user management API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router); app.include_router(users.router); app.include_router(admins.router); app.include_router(roles.router); app.include_router(me.router)

@app.get("/health")
def health(): return {"status":"ok", "service":"wave-api"}
