import asyncio

from src.config.db import AsyncSessionLocal
from src.routes.ModelRoute import list_models
from src.schemas.model_schema import ModelOut


async def main():
    async with AsyncSessionLocal() as session:
        all_models = await list_models(runtime="ONNX", db=session)
        transportation = await list_models(domain="transportation", db=session)

    catalog = [ModelOut.model_validate(model).model_dump() for model in all_models]
    assert len(catalog) == 5
    assert all(model["runtime"] == "ONNX" for model in catalog)
    assert all(model["model_size_mb"] is not None for model in catalog)
    assert [model.name for model in transportation] == ["GeoTrax Traffic Detection"]
    print(catalog)


asyncio.run(main())
