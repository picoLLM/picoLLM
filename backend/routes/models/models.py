from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
import logging
import asyncio
import httpx
import json
import os
import ollama

import models.http as rest
from utils.handlers import get_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/models", tags=["models"])

# Get OLLAMA_HOST from environment
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

async def stream_pull(request: rest.PullRequest):
    """Stream the pull response with error handling for version mismatches"""
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_HOST}/api/pull",
                json={
                    "name": request.name,
                    "insecure": request.insecure,
                    "stream": True
                },
                timeout=None  # No timeout for long downloads
            ) as response:
                # Check for version mismatch before streaming
                if response.status_code == 412:
                    # Yield a specific error for version issues
                    yield json.dumps({
                        "status": "error", 
                        "message": "Ollama version update required. Please download the latest version at https://ollama.com/download"
                    }).encode() + b"\n"
                    return
                
                # Handle other HTTP errors
                if response.status_code != 200:
                    error_text = await response.aread()
                    error_message = error_text.decode() if error_text else f"HTTP error: {response.status_code}"
                    yield json.dumps({
                        "status": "error",
                        "message": error_message
                    }).encode() + b"\n"
                    return
                
                # Stream the successful response
                async for line in response.aiter_lines():
                    if line.strip():
                        yield (line + "\n").encode()
    except httpx.HTTPError as e:
        # Handle connection errors
        yield json.dumps({
            "status": "error",
            "message": f"Connection error: {str(e)}"
        }).encode() + b"\n"
    except Exception as e:
        # Handle any other exceptions
        yield json.dumps({
            "status": "error",
            "message": f"Error streaming model data: {str(e)}"
        }).encode() + b"\n"

@router.get("/{provider}", summary="List Provider Models")
async def get_models_for_provider(provider: str):
    """List available models from a specific provider. (ollama, vllm, anthropic, openai)"""
    try:
        if provider == "openai":
            provider_instance = get_provider("openai")
            models = await provider_instance.get_models()
            models_data = [model.model_dump() for model in models]
            return rest.ModelList(data=models_data)
            
        elif provider == "anthropic":
            provider_instance = get_provider("anthropic")
            return await provider_instance.get_models()
            
        elif provider == "vllm":
            vllm_url = os.getenv("VLLM_HOST", "http://nginx/vllm/v1")
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{vllm_url}/models")
                response.raise_for_status()
                return response.json()
                
        elif provider == "ollama":
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{OLLAMA_HOST}/api/tags")
                response.raise_for_status()
                return response.json()
                
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Provider '{provider}' not found"
            )
            
    except ValueError as ve:
        logger.warning(f"Configuration error for {provider}: {str(ve)}")
        raise HTTPException(
            status_code=401,
            detail=f"{provider.capitalize()} API not configured: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"Error listing {provider} models: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch {provider} models: {str(e)}"
        )

@router.post("/pull", summary="Pull Ollama Model", 
          response_description="Stream of status updates for model pull progress")
async def pull_model(
    request: rest.PullRequest,
    response: Response
):
    """
    Pull a model from Ollama. Returns a stream of status updates.
    
    Response format examples:
    ```
    {"status": "pulling manifest"}
    {"status": "downloading", "digest": "sha256:...", "total": 1000000, "completed": 100000}
    {"status": "verifying sha256 digest"}
    {"status": "writing manifest"}
    {"status": "removing any unused layers"}
    {"status": "success"}
    ```
    """
    try:
        # Set content type for streaming response
        response.headers["Content-Type"] = "application/x-ndjson"
        
        if not request.stream:
            # Handle non-streaming request
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{OLLAMA_HOST}/api/pull",
                    json={
                        "name": request.name,
                        "insecure": request.insecure,
                        "stream": False
                    }
                )
                resp.raise_for_status()
                return resp.json()
        
        return StreamingResponse(
            stream_pull(request),
            media_type="application/x-ndjson"
        )
    except Exception as e:
        logger.error(f"Error pulling model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/ollama/{model_name}", 
           summary="Delete Ollama Model", 
           response_description="Response indicating model deletion status")
async def delete_model(model_name: str):
    """
    Delete a model from Ollama.
    """
    try:
        if not model_name:
            raise HTTPException(status_code=400, detail="Model name is required")
            
        # Use ollama client to delete the model
        # We need to run this in a thread pool since ollama client is synchronous
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: ollama.delete(model_name))
        
        # Return success response
        return {
            "status": "success", 
            "message": f"Model {model_name} deleted successfully"
        }
            
    except Exception as e:
        logger.error(f"Error deleting model: {e}")
        # Handle case where model doesn't exist
        if "model not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
        raise HTTPException(status_code=500, detail=str(e))