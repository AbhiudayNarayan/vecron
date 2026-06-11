import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .routes.PublicRoute import route as PublicRoute
from .routes.AuthRoute import route as AuthRoute
from .routes.ModelRoute import route as ModelRoute
from .routes.ReportRoute import route as ReportRoute
from .config.db import engine, Base
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Explicit origins only — "*" together with allow_credentials=True is an
# invalid combination browsers reject. Comma-separated env var so production
# just adds its domain; defaults to the Vite dev server.
origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve .onnx files (and other model assets) for download.
# Directory is relative to where the app runs from (backend/).
app.mount("/static", StaticFiles(directory="src/statics"), name="static")

app.include_router(PublicRoute)
app.include_router(AuthRoute)
app.include_router(ModelRoute)
app.include_router(ReportRoute)
