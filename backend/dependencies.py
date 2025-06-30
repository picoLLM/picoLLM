# app/dependencies.py
import databases
import os
from typing import AsyncGenerator, Optional
from functools import lru_cache
from ollama import AsyncClient
from routes.collections.manager import QdrantDBManager, ModelManager
from routes.tools.registry import ToolRegistry

DATABASE_URL = os.getenv("DATABASE_URL")
OLLAMA_HOST = os.getenv("OLLAMA_HOST")
DENSE_MODEL = os.getenv("DENSE_MODEL", "mixedbread-ai/mxbai-embed-large-v1")
SPARSE_MODEL_DOCS = os.getenv(
    "SPARSE_MODEL_DOCS", "naver/efficient-splade-VI-BT-large-doc")
SPARSE_MODEL_QUERY = os.getenv(
    "SPARSE_MODEL_QUERY", "naver/efficient-splade-VI-BT-large-query")
RERANK_MODEL = os.getenv("RERANK_MODEL", None)

# Global instances
database: Optional[databases.Database] = None
qdrant_manager: Optional[QdrantDBManager] = None
model_manager: Optional[ModelManager] = None
ollama_client: Optional[AsyncClient] = None
tool_registry: Optional[ToolRegistry] = None


async def get_database() -> AsyncGenerator[databases.Database, None]:
    """Dependency to get database connection"""
    if not database:
        raise RuntimeError("Database not initialized")
    if not database.is_connected:
        await database.connect()
    try:
        yield database
    finally:
        pass


def get_qdrant_manager() -> QdrantDBManager:
    """Get the Qdrant manager instance"""
    if qdrant_manager is None:
        raise RuntimeError("Qdrant manager not initialized")
    return qdrant_manager


@lru_cache(maxsize=None)
def get_model_manager() -> ModelManager:
    """Get the Model manager instance"""
    if model_manager is None:
        return ModelManager.get_instance()
    return model_manager


def get_ollama_client() -> AsyncClient:
    """Get the Ollama client instance"""
    global ollama_client
    if ollama_client is None:
        ollama_client = AsyncClient(host=os.getenv("OLLAMA_HOST"))
    return ollama_client


def get_tool_registry() -> ToolRegistry:
    """Get the tool registry instance"""
    if tool_registry is None:
        from routes.tools.registry import global_tool_registry
        return global_tool_registry
    return tool_registry


def initialize_dependencies(
    db: databases.Database,
    qdrant: QdrantDBManager,
    models: ModelManager,
    ollama: AsyncClient,
    tools: Optional[ToolRegistry] = None
):
    """Initialize all global dependencies"""
    global database, qdrant_manager, model_manager, ollama_client, tool_registry
    database = db
    qdrant_manager = qdrant
    model_manager = models
    ollama_client = ollama
    if tools:
        tool_registry = tools
