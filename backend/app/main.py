import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import connect, disconnect
from app.routes import chat, documents, system

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect()
    yield
    await disconnect()


app = FastAPI(title="Policy QA", version="1.0.0", lifespan=lifespan)

origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(documents.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {"service": "Policy QA API", "health": "/api/health", "docs": "/docs"}
