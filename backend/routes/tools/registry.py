import inspect
import logging
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Optional,
    Type,
    get_type_hints,
)
import json
import ast
from routes.tools.web_search import web_search
from routes.tools.hybrid_search import hybrid_search

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AsyncCallable = Callable[..., Awaitable[Any]]

class ToolRegistry:
    """Registry for managing available tools and their schemas"""
    
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._implementations: Dict[str, Callable] = {}
        self._dynamic_implementations: Dict[str, Callable] = {}
        
    def register_tool(self, func: Callable, description: Optional[str] = None) -> None:
        """Register a tool and generate its schema"""
        schema = self.generate_schema(func, description)
        name = func.__name__
        self._tools[name] = {
            "type": "function",
            "function": schema
        }
        self._implementations[name] = func
    
    def load_from_database(self, db_connection):
        """Load dynamic tools from database - call this on startup"""
        try:
            # Simple raw SQL query - adapt to your DB
            cursor = db_connection.cursor()
            cursor.execute("""
                SELECT name, description, code, parameters, required_params, 
                       allow_network, timeout 
                FROM dynamic_tools 
                WHERE is_active = TRUE
            """)
            
            for row in cursor.fetchall():
                try:
                    name, description, code, parameters, required_params, allow_network, timeout = row
                    
                    # Parse JSON fields if stored as strings
                    if isinstance(parameters, str):
                        parameters = json.loads(parameters)
                    if isinstance(required_params, str):
                        required_params = json.loads(required_params)
                    
                    # Create the function from code
                    func = self._create_function_from_code(code, allow_network)
                    
                    # Register it just like a normal tool
                    schema = {
                        "name": name,
                        "description": description,
                        "parameters": {
                            "type": "object",
                            "properties": parameters,
                            "required": required_params or []
                        }
                    }
                    
                    self._tools[name] = {
                        "type": "function",
                        "function": schema
                    }
                    self._dynamic_implementations[name] = func
                    
                    logger.info(f"Loaded dynamic tool '{name}' from database")
                    
                except Exception as e:
                    logger.error(f"Failed to load tool '{name}': {e}")
                    
        except Exception as e:
            logger.error(f"Failed to load tools from database: {e}")
    
    def _create_function_from_code(self, code: str, allow_network: bool = False) -> Callable:
        """Create a function from code string"""
        # Basic safety check
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in ['os', 'subprocess', 'sys'] and not allow_network:
                        raise ValueError(f"Unsafe import: {alias.name}")
        
        # Create restricted globals
        safe_globals = {
            '__builtins__': {
                'len': len, 'range': range, 'str': str, 'int': int,
                'float': float, 'bool': bool, 'list': list, 'dict': dict,
                'sum': sum, 'min': min, 'max': max, 'sorted': sorted,
                'enumerate': enumerate, 'zip': zip, 'print': print,
                'Exception': Exception, 'ValueError': ValueError,
            }
        }
        
        # Add imports if allowed
        if allow_network:
            import requests
            safe_globals['requests'] = requests
        
        safe_globals['json'] = json
        
        # Execute code to get function
        local_vars = {}
        exec(code, safe_globals, local_vars)
        
        # Find the function
        for name, obj in local_vars.items():
            if callable(obj) and not name.startswith('_'):
                return obj
                
        raise ValueError("No function found in code")
        
    def get_schema(self, name: str, format: str = "openai") -> Optional[Dict[str, Any]]:
        """Get the schema for a registered tool in the specified format"""
        tool_schema = self._tools.get(name)
        if not tool_schema:
            return None
            
        if format == "openai":
            return tool_schema
        elif format == "anthropic":
            return self._convert_to_anthropic_format(tool_schema)
        else:
            logger.warning(f"Unknown schema format: {format}, using 'openai' format")
            return tool_schema
        
    def get_implementation(self, name: str) -> Optional[Callable]:
        """Get the implementation for a registered tool"""
        # Check static implementations first
        if name in self._implementations:
            return self._implementations[name]
        # Then check dynamic implementations
        if name in self._dynamic_implementations:
            return self._dynamic_implementations[name]
        return None
    
    def get_all_tools(self, format: str = "openai") -> List[Dict[str, Any]]:
        """Get all registered tool schemas in the specified format"""
        if format == "openai":
            return list(self._tools.values())
        elif format == "anthropic":
            return [self._convert_to_anthropic_format(tool) for tool in self._tools.values()]
        else:
            logger.warning(f"Unknown schema format: {format}, using 'openai' format")
            return list(self._tools.values())

    # Keep all your existing methods unchanged...
    @staticmethod
    def generate_schema(func: Callable, description: Optional[str] = None) -> Dict[str, Any]:
        """Generate OpenAI function schema from a Python function"""
        sig = inspect.signature(func)
        type_hints = get_type_hints(func)
        
        properties = {}
        required = []
        
        for param_name, param in sig.parameters.items():
            if param_name == 'self':
                continue
                
            param_type = type_hints.get(param_name, Any)
            param_schema = ToolRegistry._type_to_schema(param_type)
            
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
            
            param_desc = ToolRegistry._get_param_description(func, param_name)
            if param_desc:
                param_schema["description"] = param_desc
                
            properties[param_name] = param_schema
        
        if description is None:
            description = inspect.getdoc(func) or f"Call the {func.__name__} function"
        
        return {
            "name": func.__name__,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }

    @staticmethod
    def _type_to_schema(type_hint: Type) -> Dict[str, Any]:
        """Convert Python type hints to JSON Schema types"""
        type_map = {
            str: {"type": "string"},
            int: {"type": "integer"},
            float: {"type": "number"},
            bool: {"type": "boolean"},
            List[str]: {"type": "array", "items": {"type": "string"}},
            Dict[str, Any]: {"type": "object"}
        }
        return type_map.get(type_hint, {"type": "string"})

    @staticmethod
    def _get_param_description(func: Callable, param_name: str) -> Optional[str]:
        """Extract parameter description from function docstring"""
        if docstring := inspect.getdoc(func):
            param_marker = f":param {param_name}:"
            if param_marker in docstring:
                param_section = docstring.split(param_marker)[1].split("\n")[0]
                return param_section.strip()
        return None
        
    def _convert_to_anthropic_format(self, tool: Dict[str, Any]) -> Dict[str, Any]:
        """Convert OpenAI tool format to Anthropic format"""
        if "function" not in tool:
            logger.warning(f"Tool has no function field: {tool}")
            return tool
            
        function = tool["function"]
        
        anthropic_tool = {
            "name": function.get("name", ""),
            "description": function.get("description", ""),
            "input_schema": function.get("parameters", {})
        }
        
        return anthropic_tool

    def load_from_postgres_async(self, database):
        """Load dynamic tools from PostgreSQL database using databases library"""
        async def _load():
            try:
                query = """
                    SELECT name, description, code, parameters, required_params, allow_network
                    FROM dynamic_tools 
                    WHERE is_active = true
                """
                
                rows = await database.fetch_all(query)
                
                for row in rows:
                    try:
                        name = row['name']
                        description = row['description']
                        code = row['code']
                        parameters = row['parameters']
                        required_params = row['required_params'] or []
                        allow_network = row['allow_network']
                        
                        # Create function from code
                        func = self._create_function_from_code(code, allow_network)
                        
                        # Register as dynamic tool
                        schema = {
                            "name": name,
                            "description": description,
                            "parameters": {
                                "type": "object",
                                "properties": parameters,
                                "required": required_params
                            }
                        }
                        
                        self._tools[name] = {
                            "type": "function",
                            "function": schema
                        }
                        
                        # IMPORTANT: Store in _implementations not _dynamic_implementations
                        self._implementations[name] = func
                        
                        logger.info(f"Loaded dynamic tool '{name}' from database")
                        
                    except Exception as e:
                        logger.error(f"Failed to load tool '{name}': {e}")
                        
            except Exception as e:
                logger.error(f"Failed to load tools from database: {e}")
        
        return _load()
    
global_tool_registry = ToolRegistry()

def register_core_tools():
    global_tool_registry.register_tool(web_search)
    global_tool_registry.register_tool(
        hybrid_search,
        description="Retrieve relevant context from vector store to enhance responses."
    )
    
register_core_tools()
