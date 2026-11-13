"""
CHIMERA Backend — Main application entrypoint.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.connection import Base, engine
from app.api.investigations import router as investigations_router

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Evidence-First Cyber Investigation Engine",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom validation exception handler to match API contract
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "code": "VALIDATION_ERROR"},
    )


# Include API v1 routers
app.include_router(investigations_router, prefix="/api/v1")


@app.get("/")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}
