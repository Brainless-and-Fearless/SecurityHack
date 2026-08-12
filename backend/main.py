import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("securityhack")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SecurityHack API started")
    yield
    logger.info("SecurityHack API stopped")


app = FastAPI(
    title="SecurityHack API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "SecurityHack FastAPI server is running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    client = "unknown"
    if websocket.client:
        client = f"{websocket.client.host}:{websocket.client.port}"

    logger.info("WebSocket connected: %s", client)

    try:
        while True:
            message = await websocket.receive_text()

            await websocket.send_json(
                {
                    "type": "message",
                    "message": message,
                }
            )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", client)

    except Exception:
        logger.exception("WebSocket error: %s", client)

        try:
            await websocket.close(code=1011)
        except Exception:
            pass:
            pass
