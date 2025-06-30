from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import logging
import json

import models.http as rest
from utils.handlers import get_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["chat"])

@router.post("/chat/completions")
async def chat_completions(request: rest.ChatCompletionRequest):
    """
    Handle chat completions from all OpenAI-compatible providers.
    API keys are managed on the backend for standard providers.
    """
    try:
        provider = get_provider(
            provider_name=request.provider,
            base_url=request.base_url
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating provider: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize provider")

    messages = [msg.model_dump(provider="openai") for msg in request.messages]
    
    hyperparams = {
        "messages": messages,
        "model": request.model,
        "temperature": request.temperature,
        "max_completion_tokens": request.max_tokens,
        "stream": request.stream,
        "top_p": request.top_p,
        "n": request.n,
        "presence_penalty": request.presence_penalty,
        "frequency_penalty": request.frequency_penalty,
        "tools": request.tools,
        "reasoning_effort": request.reasoning_effort
    }
    
    # Filter out None values
    hyperparams = {k: v for k, v in hyperparams.items() if v is not None}
    
    # 1) If streaming, return an SSE response
    if request.stream:
        async def generate():
            try:
                async for chunk in await provider.chat(**hyperparams):
                    # `chunk` can be {"delta": "..."} or {"tool_calls": [...]}, {"usage": {...}}, etc.
                    yield f"data: {json.dumps(chunk)}\n\n"
                # End of stream signal
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Error in streaming: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
                
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    
    try:
        response = await provider.chat(**hyperparams)
        return response
    except Exception as e:
        logger.error(f"Error in chat completion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))