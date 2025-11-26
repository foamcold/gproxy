from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

from app.api.api import api_router
from app.api.endpoints import generic_proxy

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(generic_proxy.router, tags=["generic_proxy"])

@app.get("/")
async def root():
    return {"message": "Welcome to Gproxy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
