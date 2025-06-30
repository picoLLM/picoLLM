from typing import (
    Optional,
    Dict, 
    Any, 
    Union, 
    List, 
    Type, 
    TypeVar
)
import logging
import asyncio
import json
from pydantic import BaseModel
import openai
from routes.tools.registry import ToolRegistry, global_tool_registry
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)

class ToolCall:
    def __init__(self, tool_registry: Optional[ToolRegistry] = None):
        self.tool_registry = tool_registry or global_tool_registry
        self.pydantic_models: Dict[str, Type[BaseModel]] = {}

    def register_pydantic_model(self, model: Type[BaseModel]) -> None:
        """Register a Pydantic model as a tool"""
        model_name = model.__name__.lower()
        self.pydantic_models[model_name] = model

    async def execute_function(self, name: str, arguments: str) -> Any:
        """Execute a registered tool or Pydantic model with proper async handling"""
        if name.lower() in self.pydantic_models:
            try:
                args = json.loads(arguments)
                model = self.pydantic_models[name.lower()]
                instance = model.model_validate(args)
                return instance.model_dump()
            except Exception as e:
                logger.error(f"Error executing Pydantic model {name}: {str(e)}")
                return {
                    "name": name,
                    "arguments": arguments,
                    "status": "error",
                    "error": str(e)
                }

        func = self.tool_registry.get_implementation(name)
        if not func:
            logger.error(f"Function {name} not found in registry")
            logger.error(f"Available implementations: {list(self.tool_registry._implementations.keys())}")
            raise ValueError(f"Function {name} not registered")
            
        try:
            args = json.loads(arguments)
            
            if asyncio.iscoroutinefunction(func):
                result = await func(**args)
                if isinstance(result, list) and all(asyncio.iscoroutine(item) for item in result):
                    result = await asyncio.gather(*result)
            else:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: func(**args))
            
            return {
                "name": name,
                "arguments": args,
                "status": "success",
                "result": result
            }
        except Exception as e:
            logger.error(f"Error executing function {name}: {str(e)}")
            return {
                "name": name,
                "arguments": args,
                "status": "error",
                "error": str(e)
            }

    def get_available_tools(self, requested_tools: List[Union[str, Type[BaseModel]]]) -> List[Dict[str, Any]]:
        """Get available tool schemas including Pydantic models"""
        tools = []
        
        logger.info(f"Getting available tools for: {requested_tools}")
        
        for tool in requested_tools:
            if isinstance(tool, type) and issubclass(tool, BaseModel):
                self.register_pydantic_model(tool)
                function_tool = openai.pydantic_function_tool(tool)
                if "parameters" in function_tool["function"]:
                    schema = function_tool["function"]["parameters"]
                    schema["additionalProperties"] = False
                    if "properties" in schema:
                        schema["required"] = list(schema["properties"].keys())
                tools.append(function_tool)
            elif isinstance(tool, str):
                schema = self.tool_registry.get_schema(tool)
                if schema:
                    tools.append(schema)
                    logger.info(f"Found tool schema for '{tool}'")
                else:
                    logger.warning(f"Tool '{tool}' not found in registry")
                    logger.warning(f"Available tools: {list(self.tool_registry._tools.keys())}")
                
        logger.info(f"Returning {len(tools)} tool schemas")
        return tools
    
    async def process_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
        """Process multiple tool calls and return results"""
        tool_executions = [
            self.execute_function(
                tool_call.function.name,
                tool_call.function.arguments
            )
            for tool_call in tool_calls
        ]
        
        tool_execution_results = await asyncio.gather(*tool_executions)
        
        return [
            {
                "id": tool_call.id,
                "type": tool_call.type,
                "function": {
                    "name": tool_call.function.name,
                    "arguments": tool_call.function.arguments,
                    "result": result
                }
            }
            for tool_call, result in zip(tool_calls, tool_execution_results)
        ]
