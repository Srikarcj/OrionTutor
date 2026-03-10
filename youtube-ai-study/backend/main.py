from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.routes.video_routes import router as video_router
from backend.routes.qa_routes import router as qa_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="YouTube AI Study Backend",
        version="1.0.0",
        description="Backend service for turning YouTube videos into structured learning material with RAG QA.",
    )

    # CORS – allow frontend (Vercel) and local dev by default
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(video_router, prefix="/api/video", tags=["video"])
    app.include_router(qa_router, prefix="/api/qa", tags=["qa"])

    # Static file serving for generated PDFs
    app.mount(
        "/static",
        StaticFiles(directory=settings.pdf_output_dir),
        name="static",
    )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()

