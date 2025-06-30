from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import logging
import sqlalchemy
import traceback
import databases
from dependencies import QdrantDBManager
from routes.sessions import chat_sessions, export
from routes.collections import qdrant
from routes.tools import tools
from routes.providers import anthropic, openai
from routes.models import models
from ollama import AsyncClient
import dependencies

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(override=True)

# SQLAlchemy setup
metadata = sqlalchemy.MetaData()
engine = sqlalchemy.create_engine(dependencies.DATABASE_URL)
metadata.reflect(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and configure resources with lazy model loading"""
    try:
        # pg connection
        database = databases.Database(dependencies.DATABASE_URL)
        if not database.is_connected:
            try:
                await database.connect()
                logger.info("Successfully connected to the database")
            except Exception as e:
                logger.error(f"Failed to connect to the database: {str(e)}")
                raise
        # load tools from database
        try:
            logger.info("Loading dynamic tools from database...")
            from routes.tools.registry import global_tool_registry, register_core_tools
            
            await global_tool_registry.load_from_postgres_async(database)
            register_core_tools()
            
            logger.info(f"Tools loaded successfully. Total tools: {len(global_tool_registry._tools)}")
            logger.info(f"Available tools: {list(global_tool_registry._tools.keys())}")
            
        except Exception as e:
            logger.error(f"Failed to load tools: {e}")
        
        # configure embedding models
        logger.info("Configuring embedding models... They will load/unload as needed.")
        model_manager = dependencies.get_model_manager()
        model_manager.configure_models(
            query_model_name=dependencies.SPARSE_MODEL_QUERY,
            doc_model_name=dependencies.SPARSE_MODEL_DOCS,
            dense_model_name=dependencies.DENSE_MODEL,
            rerank_model_name=dependencies.RERANK_MODEL
        )
        
        qdrant_manager = QdrantDBManager(
            model_manager=model_manager,
            build_with_quantized=False,
            use_matryoshka=False
        )
        
        # Initialize Ollama client
        ollama_client = AsyncClient(host=dependencies.OLLAMA_HOST)
        
        # Initialize all dependencies
        dependencies.initialize_dependencies(
            db=database,
            qdrant=qdrant_manager,
            models=model_manager,
            ollama=ollama_client,
            tools=global_tool_registry
        )
        
        # Set manager for routes that need it
        qdrant.set_qdrant_manager(qdrant_manager)
        
        logger.info("Application startup complete - models will be loaded on first use")
        yield
    
    except Exception as e:
        logger.error(f"Initialization error: {str(e)}")
        traceback.print_exc()
        raise
    
    finally:
        try:
            if dependencies.model_manager:
                logger.info("Cleaning up model resources...")
                dependencies.model_manager.cleanup()
            
            if dependencies.database and dependencies.database.is_connected:
                await dependencies.database.disconnect()
                logger.info("Disconnected from the database")
        
        except Exception as e:
            logger.error(f"Cleanup error: {str(e)}")
            traceback.print_exc()

origins = ["*"]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*']
    )
]

app = FastAPI(
    title="PicoLLM API",
    description="API endpoint compatible with OpenAI chat completion interface",
    lifespan=lifespan,
    middleware=middleware
)

app.include_router(openai.router)
app.include_router(anthropic.router)
app.include_router(tools.router)
app.include_router(qdrant.router)
app.include_router(models.router)
app.include_router(chat_sessions.router)
app.include_router(export.router)    

@app.get("/health", tags=["health"])
async def health_check(db: databases.Database = Depends(dependencies.get_database)):
    try:
        # Perform a simple query to check database connection
        await db.fetch_one("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8080
    )