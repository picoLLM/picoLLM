from fastapi import APIRouter, HTTPException, Query, Depends
import logging
import models.http as rest
from providers.anthropic import AnthropicChat
from providers.openai import OpenAIChat
from utils.handlers import get_provider
import dependencies
from dependencies import databases
import json
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tools", tags=["tools"])



@router.get("", response_model=rest.ToolsResponse)
async def list_tools(provider_name: str = Query("openai")):
    """
    Get all registered tools for a specific provider.
    Returns a dictionary of tool names to descriptions.
    """
    try:
        # Get the provider
        provider = get_provider(provider_name)
        
        if isinstance(provider, OpenAIChat):
            tools_dict = {}
            
            # Import the global registry
            from routes.tools.registry import global_tool_registry
            
            # Get ALL tools from the registry (this includes dynamic tools)
            for name, tool_info in global_tool_registry._tools.items():
                if "function" in tool_info:
                    description = tool_info["function"].get("description", "No description available")
                    tools_dict[name] = description
            
            # Also get registered Pydantic models if tool handler exists
            tool_handler = provider.tool_handler
            if tool_handler:
                for model_name, model in tool_handler.pydantic_models.items():
                    function_tool = tool_handler.get_available_tools([model])[0]
                    description = function_tool["function"].get("description", "No description available")
                    tools_dict[model_name] = description
                    
            return rest.ToolsResponse(tools=tools_dict)
            
        elif isinstance(provider, AnthropicChat):
            # Anthropic currently doesn't support tools in this implementation
            return rest.ToolsResponse(tools={})
            
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider type: {type(provider).__name__}"
            )
            
    except ValueError as e:
        logger.error(f"Value error in list_tools: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in list_tools: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{tool_name}", response_model=rest.ToolSchema)
async def get_tool(tool_name: str, provider_name: str = Query("openai")):
    """
    Get detailed information about a specific tool.
    
    Args:
        tool_name: Name of the tool to retrieve
        provider_name: Provider to check for the tool (default: openai)
        
    Returns:
        Detailed tool schema including parameters
    """
    try:
        provider = get_provider(provider_name)
        
        if isinstance(provider, OpenAIChat):
            # Import the global registry
            from routes.tools.registry import global_tool_registry
            
            # Check in _tools dict which includes both static and dynamic tools
            if tool_name in global_tool_registry._tools:
                tool_info = global_tool_registry._tools[tool_name]
                if "function" in tool_info:
                    function_data = tool_info["function"]
                    return rest.ToolSchema(
                        name=tool_name,
                        description=function_data.get("description", ""),
                        parameters=function_data.get("parameters", {})
                    )
                
            # Check Pydantic models
            if (hasattr(provider, 'tool_handler') and 
                provider.tool_handler and
                tool_name in provider.tool_handler.pydantic_models):
                model = provider.tool_handler.pydantic_models[tool_name]
                function_tool = provider.tool_handler.get_available_tools([model])[0]
                function_data = function_tool["function"]
                
                return rest.ToolSchema(
                    name=tool_name,
                    description=function_data.get("description", ""),
                    parameters=function_data.get("parameters", {})
                )
                
            raise HTTPException(
                status_code=404,
                detail=f"Tool '{tool_name}' not found"
            )
            
        elif isinstance(provider, AnthropicChat):
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{provider_name}' does not support tools"
            )
            
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider type: {type(provider).__name__}"
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        logger.error(f"Value error in get_tool: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in get_tool: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/register")
async def register_dynamic_tool(
    request: rest.DynamicToolRequest,
    db: databases.Database = Depends(lambda: dependencies.database)
):
    """Register a new dynamic tool to the database"""
    try:
        import hashlib
        from routes.tools.registry import global_tool_registry
        
        # Validate and create the function
        func = global_tool_registry._create_function_from_code(request.code, request.allow_network)
        
        # Generate ID
        tool_id = hashlib.sha256(f"{request.name}:{request.code}".encode()).hexdigest()[:16]
        
        # Insert or update in database
        query = """
            INSERT INTO dynamic_tools (id, name, description, code, parameters, required_params, allow_network)
            VALUES (:id, :name, :description, :code, :parameters, :required_params, :allow_network)
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                code = EXCLUDED.code,
                parameters = EXCLUDED.parameters,
                required_params = EXCLUDED.required_params,
                allow_network = EXCLUDED.allow_network,
                updated_at = CURRENT_TIMESTAMP
        """
        
        await db.execute(query, {
            "id": tool_id,
            "name": request.name,
            "description": request.description,
            "code": request.code,
            "parameters": json.dumps(request.parameters),
            "required_params": json.dumps(request.required_params),
            "allow_network": request.allow_network
        })
        
        # Create the schema
        schema = {
            "name": request.name,
            "description": request.description,
            "parameters": {
                "type": "object",
                "properties": request.parameters,
                "required": request.required_params
            }
        }
        
        # Register in BOTH _tools and _implementations
        global_tool_registry._tools[request.name] = {
            "type": "function",
            "function": schema
        }
        global_tool_registry._implementations[request.name] = func  # This was missing!
        
        logger.info(f"Registered tool '{request.name}' in both _tools and _implementations")
        
        return {"success": True, "message": f"Tool '{request.name}' registered successfully"}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to register tool: {e}")
        raise HTTPException(status_code=500, detail="Failed to register tool")

@router.get("/test/{tool_name}")
async def test_tool_execution(
    tool_name: str,
    a: float = Query(..., description="First number"),
    b: float = Query(..., description="Second number"), 
    operation: str = Query(..., description="Operation")
):
    """Test if a tool can be executed"""
    from routes.tools.registry import global_tool_registry
    
    # Check if tool exists
    impl = global_tool_registry.get_implementation(tool_name)
    if not impl:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found in implementations")
    
    try:
        # Execute the tool
        result = impl(a=a, b=b, operation=operation)
        return {
            "tool": tool_name,
            "input": {"a": a, "b": b, "operation": operation},
            "result": result,
            "status": "success"
        }
    except Exception as e:
        return {
            "tool": tool_name,
            "input": {"a": a, "b": b, "operation": operation},
            "error": str(e),
            "status": "error"
        }
    
@router.delete("/{tool_name}")
async def delete_dynamic_tool(
    tool_name: str,
    db: databases.Database = Depends(lambda: dependencies.database)
):
    """Soft delete a dynamic tool"""
    try:
        query = """
            UPDATE dynamic_tools 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE name = :name
        """
        
        result = await db.execute(query, {"name": tool_name})
        
        if result == 0:
            raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
        
        # Remove from current session
        from routes.tools.registry import global_tool_registry
        if tool_name in global_tool_registry._tools:
            del global_tool_registry._tools[tool_name]
        if tool_name in global_tool_registry._implementations:
            del global_tool_registry._implementations[tool_name]
            
        return {"message": f"Tool '{tool_name}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete tool: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete tool")