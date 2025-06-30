from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import logging
import json

import models.http as rest
from utils.handlers import get_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["chat"])

@router.post("/messages")
async def anthropic_chat_completions(request: rest.AnthropicChatCompletionRequest):
    """
    Endpoint for Anthropic Message API format with thinking support
    """
    print(request)
    provider = get_provider("anthropic")
    
    if request.debug:
        logger.debug(f"Processing request for anthropic with model {request.model}")
    
    formatted_messages = [msg.model_dump(provider="anthropic") for msg in request.messages]
    
    hyperparams = {
        "model": request.model,
        "messages": formatted_messages,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": request.stream,
        "system": request.system,
        "metadata": request.metadata,
        "stop_sequences": request.stop_sequences,
        "top_p": request.top_p,
        "top_k": request.top_k,
        "tools": request.tools,
        "tool_choice": request.tool_choice,
        "thinking": request.thinking
    }
    
    hyperparams = {k: v for k, v in hyperparams.items() if v is not None}
    
    try:
        # Streaming response handling
        if request.stream:
            async def generate():
                try:
                    async for chunk in await provider.chat(**hyperparams):
                        yield f"data: {json.dumps(chunk)}\n\n"
                except Exception as e:
                    logger.error(f"Streaming error: {str(e)}", exc_info=True)
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                
                # End of stream marker
                yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }
            )
        
        # Non-streaming response
        response = await provider.chat(**hyperparams)
        return response
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(502, detail=str(e))