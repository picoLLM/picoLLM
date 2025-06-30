from typing import (
    Optional,
    Dict,
    Any,
    AsyncGenerator,
    Union,
    List,
)
from openai import AsyncOpenAI
import logging
import asyncio
import json
import os

from routes.tools.registry import global_tool_registry
from models.http import ModelObject, ModelList
from routes.tools.tool_call import ToolCall
from utils.ollama_images import handle_ollama_with_images

logger = logging.getLogger(__name__)


def get_openai_client(api_key: Optional[str] = None, base_url: Optional[str] = None) -> AsyncOpenAI:
    """Get a configured OpenAI client instance."""
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OpenAI API key not detected...")

    return AsyncOpenAI(api_key=api_key, base_url=base_url)


class OpenAIChat:
    def __init__(
        self,
        api_key=None,
        base_url=None,
        provider: Optional[str] = None,
        **kwargs
    ):
        self.client = get_openai_client(api_key=api_key, base_url=base_url)
        self.tool_handler = ToolCall(global_tool_registry)
        self.provider = provider
        self.base_url = base_url

    def _has_images(self, messages: List[Dict[str, Any]]) -> bool:
        """Check if messages contain images."""
        for msg in messages:
            content = msg.get('content')
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get('type') == 'image_url':
                        return True
        return False

    def is_o_model(self, model: str) -> bool:
        """Check if the model is an O model using regex pattern."""
        if not model:
            return False
        import re
        return bool(re.match(r'^o\d+(-.*)?$', model, re.IGNORECASE))

    def is_o_mini_model(self, model: str) -> bool:
        """Check if the model is an O-mini model using regex pattern."""
        if not model:
            return False
        import re
        return bool(re.match(r'^o\d+(-mini)$', model.lower(), re.IGNORECASE))

    async def chat(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.7,
        max_completion_tokens: Optional[int] = None,
        stream: bool = False,
        tools: Optional[List[str]] = None,
        tool_choice: Optional[str] = "auto",
        reasoning_effort: Optional[str] = None,  # Add this parameter
        **kwargs
    ) -> Union[Dict[str, Any], AsyncGenerator[Dict[str, Any], None]]:

        if self.is_o_model(model):
            return await self.oModelChat(
                messages=messages,
                model=model,
                max_completion_tokens=max_completion_tokens,
                stream=stream,
                tools=tools,
                tool_choice=tool_choice,
                reasoning_effort=reasoning_effort,
                **kwargs
            )

        if self.provider == 'ollama' and self._has_images(messages):
            return await handle_ollama_with_images(
                messages=messages,
                model=model,
                base_url=self.base_url,
                stream=stream,
                **kwargs
            )

        request_kwargs = {
            "model": model,
            "messages": messages.copy(),
            "temperature": temperature,
            "max_completion_tokens": max_completion_tokens,
            "stream": stream,
            **kwargs
        }
        if tools:
            available_tools = self.tool_handler.get_available_tools(tools)
            if available_tools:
                request_kwargs["tools"] = available_tools
                request_kwargs["tool_choice"] = tool_choice

        if stream:
            return await self._handle_streaming_chat(request_kwargs, messages)
        else:
            return await self._handle_regular_chat(request_kwargs, messages)

    async def oModelChat(
        self,
        messages: list[dict],
        model: str,
        max_completion_tokens: Optional[int] = None,
        stream: bool = False,
        tools: Optional[List[str]] = None,
        tool_choice: Optional[str] = "auto",
        reasoning_effort: Optional[str] = None,  # Add this parameter
        **kwargs
    ) -> Union[Dict[str, Any], AsyncGenerator[Dict[str, Any], None]]:
        """
        Specialized method for O models that excludes unsupported parameters
        like temperature, top_p, frequency_penalty, etc.
        """
        # Create a clean request with only supported parameters
        request_kwargs = {
            "model": model,
            "messages": self._format_o_model_messages(messages),
            "max_completion_tokens": max_completion_tokens,
            "stream": stream,
        }

        # Add reasoning_effort if provided
        if reasoning_effort is not None:
            request_kwargs["reasoning_effort"] = reasoning_effort

        # Handle tools if provided
        if tools:
            available_tools = self.tool_handler.get_available_tools(tools)
            if available_tools:
                request_kwargs["tools"] = available_tools
                request_kwargs["tool_choice"] = tool_choice

        # Process any additional kwargs, excluding unsupported parameters
        unsupported_params = [
            "temperature", "top_p", "frequency_penalty",
            "presence_penalty", "n", "logprobs"
        ]

        for key, value in kwargs.items():
            if key not in unsupported_params:
                request_kwargs[key] = value

        logger.info(f"O model request parameters: {request_kwargs}")

        # Use the same handlers but with the filtered parameters
        if stream:
            return await self._handle_streaming_chat(request_kwargs, messages)
        else:
            return await self._handle_regular_chat(request_kwargs, messages)

    def _format_o_model_messages(self, messages: list[dict]) -> list[dict]:
        """Format messages for O models, converting 'system' to 'developer' role if needed."""
        formatted_messages = []

        for message in messages:
            # Make a copy to avoid modifying the original
            msg_copy = dict(message)

            # Convert system role to developer role for O models
            if msg_copy.get("role") == "system":
                msg_copy["role"] = "developer"

            formatted_messages.append(msg_copy)

        return formatted_messages

    async def _handle_regular_chat(self, request_kwargs, messages):
        """
        Non-streaming path: usage is included directly in the final response.
        Remove or modify usage here if you do not want usage anywhere.
        """
        initial_response = await self.client.chat.completions.create(**request_kwargs)
        message = initial_response.choices[0].message

        if not getattr(message, "tool_calls", None):
            return {
                "answer": message.content,
                "metadata": {
                    "usage": initial_response.usage.model_dump() if initial_response.usage else None
                }
            }

        # Tools found => second call
        tool_results = await self.tool_handler.process_tool_calls(message.tool_calls)
        messages.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": tool_results
        })
        for result in tool_results:
            messages.append({
                "role": "tool",
                "content": json.dumps(result["function"]["result"]),
                "tool_call_id": result["id"]
            })

        final_response = await self.client.chat.completions.create(
            **{**request_kwargs, "messages": messages}
        )

        return {
            "answer": final_response.choices[0].message.content,
            "tool_calls": tool_results,
            "metadata": {
                "usage": initial_response.usage.model_dump() if initial_response.usage else None
            }
        }

    async def _handle_streaming_chat(
        self,
        request_kwargs: Dict[str, Any],
        messages: List[Dict[str, Any]]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streaming path: 
        - Start streaming immediately for minimal TTFB.
        - If tool calls appear, accumulate them properly.
        - No usage data is returned in the streaming scenario.
        """
        async def stream_generator():
            streamed_content = []
            tool_calls_accumulator = {}  # Accumulate tool calls by index
            has_tool_calls = False

            # First pass streaming
            first_pass = await self.client.chat.completions.create(**request_kwargs)
            async for chunk in first_pass:
                if not hasattr(chunk.choices[0], "delta"):
                    continue
                delta = chunk.choices[0].delta

                if getattr(delta, "content", None):
                    streamed_content.append(delta.content)
                    yield {"delta": delta.content}

                # Handle tool call chunks properly
                if getattr(delta, "tool_calls", None):
                    has_tool_calls = True
                    calls = delta.tool_calls if isinstance(
                        delta.tool_calls, list) else [delta.tool_calls]

                    for tool_call in calls:
                        if not tool_call:
                            continue

                        # Get the index of this tool call
                        index = getattr(tool_call, "index",
                                        len(tool_calls_accumulator))

                        # Initialize the tool call if it's new
                        if index not in tool_calls_accumulator:
                            tool_calls_accumulator[index] = {
                                "id": getattr(tool_call, "id", None),
                                "type": getattr(tool_call, "type", None),
                                "function": {
                                    "name": getattr(tool_call.function, "name", None) if hasattr(tool_call, "function") else None,
                                    "arguments": ""
                                }
                            }

                        # Update tool call with any non-null values from the current chunk
                        if getattr(tool_call, "id", None) is not None:
                            tool_calls_accumulator[index]["id"] = tool_call.id
                        if getattr(tool_call, "type", None) is not None:
                            tool_calls_accumulator[index]["type"] = tool_call.type

                        # Update function data if present
                        if hasattr(tool_call, "function"):
                            if getattr(tool_call.function, "name", None) is not None:
                                tool_calls_accumulator[index]["function"]["name"] = tool_call.function.name
                            if getattr(tool_call.function, "arguments", None) is not None:
                                tool_calls_accumulator[index]["function"]["arguments"] += tool_call.function.arguments

            # If no tool calls => done with main pass
            if not has_tool_calls:
                # Stop here; we don't return usage in the streaming scenario
                return

            # Convert the accumulated tool calls to a list
            tool_calls_data = list(tool_calls_accumulator.values())

            # Filter out any incomplete tool calls
            tool_calls_data = [
                call for call in tool_calls_data
                if call["id"] is not None and call["function"]["name"] is not None
            ]

            # If all tool calls were filtered out, stop here
            if not tool_calls_data:
                return

            # If tool calls => finalize with second pass
            async for final_chunk in self._finalize_stream_with_tools(
                request_kwargs, messages, tool_calls_data, streamed_content
            ):
                yield final_chunk

        return stream_generator()

    async def _finalize_stream_with_tools(
        self,
        request_kwargs: Dict[str, Any],
        messages: List[Dict[str, Any]],
        tool_calls_data: List[Dict[str, Any]],
        streamed_content: List[str]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Handle tools, do a second streaming pass for final text.
        """
        # First execute all the tool calls
        tool_results = []
        for call in tool_calls_data:
            try:
                result = await self.tool_handler.execute_function(
                    call["function"]["name"],
                    call["function"]["arguments"]
                )
                tool_result = {
                    "id": call["id"],
                    "type": call["type"],
                    "function": {
                        "name": call["function"]["name"],
                        "arguments": call["function"]["arguments"],
                        "result": result
                    }
                }
                tool_results.append(tool_result)
            except Exception as e:
                logger.error(f"Tool execution error: {str(e)}")
                # Add failed result
                tool_results.append({
                    "id": call["id"],
                    "type": call["type"],
                    "function": {
                        "name": call["function"]["name"],
                        "arguments": call["function"]["arguments"],
                        "result": {"error": str(e)}
                    }
                })

        # Yield the tool calls results to the client
        yield {"tool_calls": tool_results}

        # Create updated messages for the second pass
        updated_messages = messages.copy()
        updated_messages.append({
            "role": "assistant",
            "content": "".join(streamed_content) if streamed_content else None,
            "tool_calls": tool_calls_data  # Use the original tool_calls_data here
        })

        # Add tool results
        for result in tool_results:
            updated_messages.append({
                "role": "tool",
                "content": json.dumps(result["function"]["result"]),
                "tool_call_id": result["id"]
            })

        # Create a new request for the second pass
        second_pass_kwargs = {
            "model": request_kwargs["model"],
            "messages": updated_messages,
            "stream": True
        }

        # Copy any other relevant parameters
        for key in ["temperature", "max_completion_tokens"]:
            if key in request_kwargs:
                second_pass_kwargs[key] = request_kwargs[key]

        # Stream the second pass response
        final_response = await self.client.chat.completions.create(**second_pass_kwargs)

        async for chunk in final_response:
            if hasattr(chunk.choices[0], "delta") and getattr(chunk.choices[0].delta, "content", None):
                yield {"delta": chunk.choices[0].delta.content}

    async def get_models(self) -> List[ModelObject]:
        """Fetch OpenAI models"""
        try:
            response = await self.client.models.list()
            return [
                ModelObject(
                    id=model.id,
                    object="model",
                    created=int(model.created),
                    owned_by=model.owned_by
                )
                for model in response.data
            ]
        except Exception as e:
            logger.error(f"Error fetching OpenAI models: {e}")
            return []

    async def list_models(self) -> ModelList:
        """List all available models from all configured providers"""
        all_models = []

        # Gather models from all providers concurrently
        model_futures = [provider.get_models()
                         for provider in self.model_providers]
        model_results = await asyncio.gather(*model_futures, return_exceptions=True)

        for result in model_results:
            if isinstance(result, list):
                all_models.extend(result)
            else:
                logger.error(f"Error fetching models from provider: {result}")

        return ModelList(data=all_models)
