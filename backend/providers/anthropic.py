from typing import (
    Optional,
    Dict, 
    Any, 
    AsyncGenerator, 
    Union, 
    List, 
)
import logging
import os
import json
from datetime import datetime

from anthropic import AsyncAnthropic, APIError
from routes.tools.registry import global_tool_registry


logger = logging.getLogger(__name__)


def get_anthropic_client(api_key: Optional[str] = None, base_url: Optional[str] = None) -> AsyncAnthropic:
    server_api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    
    if not server_api_key:
        logger.error("No Anthropic API key provided or found in environment")
        raise ValueError("Anthropic API key not available")
        
    return AsyncAnthropic(api_key=server_api_key)


class AnthropicChat:
    """Provider class for Anthropic's API with optimized streaming and thinking support."""
    
    def __init__(self, client: Optional[AsyncAnthropic] = None, **_extra):
        self.client = client if client else get_anthropic_client()

    def _format_response(self, response) -> Dict[str, Any]:
        """Format Anthropic response to a consistent structure."""
        result = {
            "id": getattr(response, 'id', None),
            "model": getattr(response, 'model', None),
            "object": "message",
            "created": int(datetime.now().timestamp()),
            "content": []
        }
        
        if hasattr(response, 'usage'):
            result["usage"] = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
        
        if hasattr(response, 'content') and response.content:
            for content_block in response.content:
                if content_block.type == 'text':
                    result["content"].append({
                        "type": "text",
                        "text": content_block.text
                    })
                elif content_block.type == 'tool_use':
                    result["content"].append({
                        "type": "tool_use",
                        "name": content_block.name,
                        "id": getattr(content_block, 'id', None),
                        "input": content_block.input
                    })
                elif content_block.type == 'thinking':
                    result["content"].append({
                        "type": "thinking",
                        "thinking": getattr(content_block, 'thinking', ''),
                        "signature": getattr(content_block, 'signature', None)
                    })
        
        result["answer"] = "\n".join([
            block["text"] for block in result["content"] 
            if isinstance(block, dict) and block.get("type") == "text"
        ])
        
        result["finish_reason"] = getattr(response, 'stop_reason', None)
        return result

    def _get_tools_from_registry(self, tool_names: List[str]) -> List[Dict[str, Any]]:
        """Get tool schemas from the registry in Anthropic format."""
        return [
            tool_schema 
            for name in tool_names
            if (tool_schema := global_tool_registry.get_schema(name, format="anthropic"))
        ]

    def _convert_openai_tools_to_anthropic(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert OpenAI-style tools to Anthropic format."""
        anthropic_tools = []
        
        for tool in tools:
            if "input_schema" in tool:
                anthropic_tools.append(tool)
            elif tool.get("type") == "function" and "function" in tool:
                if anthropic_tool := global_tool_registry._convert_to_anthropic_format(tool):
                    anthropic_tools.append(anthropic_tool)
        
        return anthropic_tools

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        system: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        stop_sequence: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        top_p: Optional[float] = None,
        tool_choice: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        thinking: Optional[Dict[str, Any]] = None,
        stream: bool = False,
    ) -> Union[Dict[str, Any], AsyncGenerator[Dict[str, Any], None]]:
        """Unified chat method for Anthropic with tool execution and thinking support."""
        try:
            request_kwargs = self._build_request_kwargs(
                messages, model, temperature, max_tokens, system, 
                metadata, stop_sequence, top_k, top_p, tools, tool_choice, thinking
            )

            if stream:
                return self.stream_chat(**request_kwargs)

            # Non-streaming path with continuous tool handling
            current_messages = messages.copy()
            all_tool_calls = []
            
            while True:
                request_kwargs["messages"] = current_messages
                response = await self.client.messages.create(**request_kwargs)
                result = self._format_response(response)
                
                # Check for tool calls
                tool_blocks = [b for b in result.get("content", []) 
                              if isinstance(b, dict) and b.get("type") == "tool_use"]
                
                if not tool_blocks:
                    # No tools called, return final result
                    if all_tool_calls:
                        result["tool_calls"] = all_tool_calls
                    return result
                
                # Process all tool calls in this response
                for tool_block in tool_blocks:
                    tool_result = await self._execute_tool(
                        tool_block["name"], 
                        tool_block["input"]
                    )
                    formatted_result = self._format_tool_result(tool_result)
                    
                    all_tool_calls.append({
                        "id": tool_block["id"],
                        "name": tool_block["name"],
                        "input": tool_block["input"],
                        "result": formatted_result
                    })
                
                # Update messages with assistant response and tool results
                current_messages.append({
                    "role": "assistant",
                    "content": result["content"]
                })
                
                # Add tool results
                tool_results = []
                for tool_block in tool_blocks:
                    matching_call = next(
                        tc for tc in all_tool_calls 
                        if tc["id"] == tool_block["id"]
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_block["id"],
                        "content": matching_call["result"]
                    })
                
                current_messages.append({
                    "role": "user",
                    "content": tool_results
                })

        except APIError as e:
            logger.error(f"Anthropic API error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error in chat completion: {str(e)}")
            raise

    async def stream_chat(self, **kwargs) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream implementation with continuous tool calling support."""
        try:
            current_messages = kwargs['messages'].copy()
            
            while True:
                # Update kwargs with current messages
                kwargs['messages'] = current_messages
                has_tool_call = False
                
                # Stream the response and handle any tool calls
                async for chunk in self._stream_single_response(kwargs, current_messages):
                    if chunk.get("_internal_tool_called"):
                        has_tool_call = True
                        # Messages were updated internally
                        current_messages = chunk["_internal_messages"]
                    else:
                        # Yield all other chunks to the client
                        yield chunk
                
                # If no tool was called, we're done
                if not has_tool_call:
                    break
        
        except Exception as e:
            logger.error(f"Stream error: {str(e)}")
            yield {"error": str(e)}

    async def _stream_single_response(self, kwargs, current_messages) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream a single response, handling tool calls inline."""
        request_kwargs = {k: v for k, v in kwargs.items() if k != 'stream'}
        request_kwargs['stream'] = True
        
        # Tracking variables
        current_tool_call = None
        tool_input_json = ""
        is_collecting_tool_input = False
        current_thinking = ""
        is_thinking_block = False
        collected_content = []  # Track all content blocks
        pending_tool_calls = []  # Tool calls to execute
        
        stream = await self.client.messages.create(**request_kwargs)
        
        async for chunk in stream:
            if hasattr(chunk, 'type'):
                # Handle start of content block
                if chunk.type == "content_block_start" and hasattr(chunk, 'content_block'):
                    if chunk.content_block.type == "tool_use":
                        current_tool_call = {
                            "name": chunk.content_block.name,
                            "input": {},
                            "id": getattr(chunk.content_block, 'id', None)
                        }
                        is_collecting_tool_input = True
                        tool_input_json = ""
                        
                        yield {"tool_start": {
                            "name": current_tool_call["name"],
                            "id": current_tool_call["id"]
                        }}
                    elif chunk.content_block.type == "thinking":
                        is_thinking_block = True
                        current_thinking = ""
                        yield {"thinking_start": True}
                    elif chunk.content_block.type == "text":
                        # Start collecting text content
                        collected_content.append({"type": "text", "text": ""})
                
                # Handle content block deltas
                elif chunk.type == "content_block_delta":
                    if hasattr(chunk.delta, 'type'):
                        if chunk.delta.type == "thinking_delta" and hasattr(chunk.delta, 'thinking'):
                            current_thinking += chunk.delta.thinking
                            yield {"thinking_delta": chunk.delta.thinking}
                        elif chunk.delta.type == "text_delta" and hasattr(chunk.delta, 'text') and chunk.delta.text:
                            if collected_content and collected_content[-1]["type"] == "text":
                                collected_content[-1]["text"] += chunk.delta.text
                            yield {"delta": chunk.delta.text, "finish_reason": None}
                    elif hasattr(chunk.delta, 'text') and chunk.delta.text and not is_collecting_tool_input:
                        if collected_content and collected_content[-1]["type"] == "text":
                            collected_content[-1]["text"] += chunk.delta.text
                        yield {"delta": chunk.delta.text, "finish_reason": None}
                    
                    # Handle tool input streaming
                    if is_collecting_tool_input and hasattr(chunk.delta, 'partial_json'):
                        tool_input_json += chunk.delta.partial_json
                        try:
                            tool_input_complete = json.loads(tool_input_json)
                            yield {"tool_input_update": tool_input_complete}
                        except json.JSONDecodeError:
                            pass
                
                # Handle end of content block
                elif chunk.type == "content_block_stop":
                    if is_thinking_block:
                        is_thinking_block = False
                        collected_content.append({
                            "type": "thinking",
                            "thinking": current_thinking
                        })
                    elif current_tool_call:
                        is_collecting_tool_input = False
                        
                        # Parse final tool input
                        if tool_input_json:
                            try:
                                current_tool_call["input"] = json.loads(tool_input_json)
                            except json.JSONDecodeError:
                                logger.error(f"Failed to parse tool input JSON: {tool_input_json}")
                                current_tool_call["input"] = {}
                        
                        # Add to collected content and pending calls
                        collected_content.append({
                            "type": "tool_use",
                            "id": current_tool_call["id"],
                            "name": current_tool_call["name"],
                            "input": current_tool_call["input"]
                        })
                        pending_tool_calls.append(current_tool_call)
                        
                        yield {"tool_call": current_tool_call, "finish_reason": "tool_calls"}
                        
                        # Execute tool immediately
                        try:
                            tool_result = await self._execute_tool(
                                current_tool_call["name"], 
                                current_tool_call["input"]
                            )
                            formatted_result = self._format_tool_result(tool_result)
                            yield {"tool_result": formatted_result}
                            
                            # Store result for later
                            current_tool_call["result"] = formatted_result
                            
                        except Exception as e:
                            logger.error(f"Tool execution error: {str(e)}")
                            yield {"error": str(e)}
                        
                        current_tool_call = None
                
                # Handle message completion
                elif chunk.type == "message_stop":
                    if pending_tool_calls:
                        # Update messages with the complete response and tool results
                        current_messages.append({
                            "role": "assistant",
                            "content": collected_content
                        })
                        
                        # Add tool results
                        tool_results = []
                        for tool_call in pending_tool_calls:
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_call["id"],
                                "content": tool_call.get("result", "Error: No result")
                            })
                        
                        current_messages.append({
                            "role": "user",
                            "content": tool_results
                        })
                        
                        # Signal that we need to continue
                        yield {"_internal_tool_called": True, "_internal_messages": current_messages}
                    else:
                        # No tools called, conversation complete
                        yield {"delta": "", "finish_reason": "stop"}
                
                # Handle usage information
                elif chunk.type == "message_delta" and hasattr(chunk, 'usage'):
                    yield {"usage": {
                        "completion_tokens": getattr(chunk.usage, 'output_tokens', 0)
                    }}

    def _build_request_kwargs(self, messages, model, temperature, max_tokens, 
                             system, metadata, stop_sequence, top_k, top_p, 
                             tools, tool_choice, thinking=None):
        """Build request kwargs with all parameters including thinking."""
        request_kwargs = {"model": model, "messages": messages}
        
        # Add optional parameters
        optional_params = {
            "temperature": temperature,
            "max_tokens": max_tokens,
            "system": system,
            "metadata": metadata,
            "stop_sequences": stop_sequence,
            "top_k": top_k,
            "top_p": top_p,
        }
        request_kwargs.update({k: v for k, v in optional_params.items() if v is not None})
        
        # Add thinking parameter if provided
        if thinking is not None:
            request_kwargs["thinking"] = thinking
        
        # Handle tools
        if tools:
            if isinstance(tools, list) and all(isinstance(t, str) for t in tools):
                anthropic_tools = self._get_tools_from_registry(tools)
            else:
                anthropic_tools = self._convert_openai_tools_to_anthropic(tools)
            
            if anthropic_tools:
                request_kwargs["tools"] = anthropic_tools
        
        # Handle tool_choice - validate for thinking compatibility
        if tool_choice:
            if thinking and tool_choice not in ["auto", {"type": "auto"}, "none", {"type": "none"}]:
                logger.warning("Tool choice 'any' or specific tool selection not supported with thinking. Using 'auto'.")
                tool_choice = "auto"
            
            if tool_choice == "required":
                system_addition = " You must use one of the provided tools to respond."
                request_kwargs["system"] = request_kwargs.get("system", "") + system_addition
        
        return request_kwargs

    async def _execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Any:
        """Execute a tool with proper async handling."""
        tool_impl = global_tool_registry.get_implementation(tool_name)
        if not tool_impl:
            raise ValueError(f"Tool implementation not found for: {tool_name}")
        
        try:
            import inspect
            import asyncio
            
            if inspect.iscoroutinefunction(tool_impl):
                return await tool_impl(**tool_input)
            else:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, lambda: tool_impl(**tool_input))
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {str(e)}", exc_info=True)
            raise

    def _format_tool_result(self, result: Any) -> str:
        """Format tool result as string."""
        if result is None:
            return "No result"
        
        if isinstance(result, str):
            return result
        
        if isinstance(result, (dict, list)):
            try:
                return json.dumps(result, ensure_ascii=False, indent=2)
            except:
                return str(result)
        
        return str(result)

    async def get_models(self) -> List[Dict[str, Any]]:
        """Return list of available Anthropic models."""
        try:
            models = await self.client.models.list(limit=10)
            return models
        except Exception as e:
            logger.error(f"Error getting Anthropic models: {str(e)}")
            return []