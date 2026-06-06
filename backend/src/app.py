from fastapi import FastAPI
from .routes.PublicRoute import route as PublicRoute
from .routes.AuthRoute import route as AuthRoute
from .config.db import engine, Base
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


origins = [
    "http://localhost",
    "*",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(PublicRoute)
app.include_router(AuthRoute)
