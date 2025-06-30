# utils/ollama_handler.py
import ollama
import base64
import os
import asyncio
from typing import List, Dict, Any, Union, AsyncGenerator
import logging

logger = logging.getLogger(__name__)


async def handle_ollama_with_images(
    messages: List[Dict[str, Any]], 
    model: str,
    base_url: str,
    stream: bool = False,
    **kwargs
) -> Union[Dict[str, Any], AsyncGenerator[Dict[str, Any], None]]:
    """
    Simple handler for Ollama requests with images.
    Converts OpenAI format to Ollama format and processes the request.
    """
    # Convert messages to Ollama format
    ollama_messages = []
    for msg in messages:
        ollama_msg = {'role': msg['role']}
        content = msg.get('content')
        images = []
        text_parts = []
        
        if isinstance(content, str):
            ollama_msg['content'] = content
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    if item.get('type') == 'text':
                        text_parts.append(item.get('text', ''))
                    elif item.get('type') == 'image_url':
                        image_url = item.get('image_url', {}).get('url', '')
                        # Convert to base64 if needed
                        if image_url.startswith('data:image'):
                            images.append(image_url.split(',')[1])
                        elif os.path.exists(image_url):
                            with open(image_url, 'rb') as f:
                                images.append(base64.b64encode(f.read()).decode('utf-8'))
            
            ollama_msg['content'] = ' '.join(text_parts) if text_parts else ''
        
        if images:
            ollama_msg['images'] = images
        
        ollama_messages.append(ollama_msg)

    client = ollama.Client(host=base_url)
    
    if stream:
        async def stream_generator():
            try:
                stream = await asyncio.to_thread(
                    client.chat,
                    model=model,
                    messages=ollama_messages,
                    stream=True
                )
                for chunk in stream:
                    if chunk.get('message', {}).get('content'):
                        # Match OpenAI streaming format
                        yield {"delta": chunk['message']['content'], "finish_reason": None}
                    
                    # Check if this is the final chunk
                    if chunk.get('done'):
                        yield {"delta": "", "finish_reason": "stop"}
                        
            except Exception as e:
                logger.error(f"Ollama streaming error: {e}")
                yield {"error": str(e)}
        
        return stream_generator()
    
    try:
        response = await asyncio.to_thread(
            client.chat,
            model=model,
            messages=ollama_messages
        )
        return {
            "answer": response['message']['content'],
            "metadata": {"model": model, "provider": "ollama"}
        }
    except Exception as e:
        logger.error(f"Ollama chat error: {e}")
        raise