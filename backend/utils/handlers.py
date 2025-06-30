from typing import (
    Optional,
    Any,
)

from dotenv import load_dotenv
import os

load_dotenv(override=True)


def get_provider(
    provider_name: str,
    base_url: Optional[str] = None,
    **kwargs
) -> Any:
    """
    Get a fresh LLM provider instance with the specified configuration.
    API keys are managed entirely on the backend for all providers.
    """
    from providers.openai import OpenAIChat
    
    if provider_name == "anthropic":
        from providers.anthropic import AnthropicChat
        kwargs.pop('api_key', None)
        server_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not server_api_key:
            raise ValueError("Anthropic API key not configured on server")
        return AnthropicChat(
            api_key=server_api_key,
            base_url=base_url,
            **kwargs
        )
        
    if provider_name == "openai":
        kwargs.pop('api_key', None)
        server_api_key = os.getenv("OPENAI_API_KEY")
        if not server_api_key:
            raise ValueError("OpenAI API key not configured on server")
        return OpenAIChat(
            api_key=server_api_key,
            base_url=base_url,
            **kwargs
        )
        
    if provider_name == "ollama":
        kwargs.pop('api_key', None)
        return OpenAIChat(
            api_key="ollama", 
            base_url=base_url or os.getenv("OLLAMA_HOST", "http://nginx/v1"),
            **kwargs
        )
        
    if provider_name == "vllm":
        kwargs.pop('api_key', None)
        return OpenAIChat(
            api_key="vllm",
            base_url=base_url or os.getenv("VLLM_HOST", "http://nginx/v1/vllm"),
            **kwargs
        )
        
    custom_provider_key = os.getenv(f"{provider_name.upper()}_API_KEY")
    if custom_provider_key:
        kwargs.pop('api_key', None) 
        return OpenAIChat(
            api_key=custom_provider_key,
            base_url=base_url,
            **kwargs
        )
        
    raise ValueError(f"Unsupported provider: {provider_name}")
