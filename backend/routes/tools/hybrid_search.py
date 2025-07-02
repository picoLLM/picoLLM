import logging
from typing import Dict, Any, Union, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class RetrieveContextRequest(BaseModel):
    """Pydantic model for RAG tool request parameters."""
    query: str = Field(..., description="The query to search for relevant context")
    collection_name: Optional[str] = Field(None, description="Name of the collection to search in")
    top_k: int = Field(5, description="Number of results to retrieve", ge=1, le=10)
    
    model_config = {
        "json_schema_extra": {
            "description": "Retrieve relevant context from the knowledge base"
        }
    }

async def hybrid_search(
    request: Union[RetrieveContextRequest, str],
    collection_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Perform hybrid search and return results with truncated content.
    
    Args:
        request: Either a string (interpreted as 'query') or a RetrieveContextRequest model
        collection_name: Collection name (can be overridden by request.collection_name if present)
    
    Returns:
        Dict containing search results, total count, query, and collection info
    """
    try:
        from dependencies import qdrant_manager
        if not qdrant_manager:
            raise ValueError("QdrantManager not initialized")
        
        # Parse request parameters
        if isinstance(request, str):
            query = request
            top_k_value = 5
            search_collection = collection_name or "picollm"
        else:
            query = request.query
            top_k_value = max(1, min(request.top_k, 10))
            search_collection = request.collection_name or collection_name or "picollm"
        
        search_results = await qdrant_manager.advanced_search(
            collection_name=search_collection,
            query=query,
            top_k=top_k_value
        )
        
        nodes = []
        for doc in search_results:
            try:
                truncated_text = doc.text[:2500] if doc.text else ""
                truncated_metadata = {
                    k: (v[:2500] if isinstance(v, str) else v)
                    for k, v in doc.metadata.items()
                }
                
                nodes.append({
                    'text': truncated_text,
                    'metadata': truncated_metadata
                })
            except Exception as e:
                logger.error(f"Error processing document: {str(e)}")
                continue
        
        return {
            'results': nodes,
            'total_results': len(nodes),
            'query': query,
            'collection_name': search_collection
        }
        
    except Exception as e:
        logger.error(f"Error in hybrid_search: {str(e)}", exc_info=True)
        # Return a consistent structure, even on error
        return {
            'results': [],
            'total_results': 0,
            'query': request if isinstance(request, str) else request.query,
            'collection_name': collection_name or "default_collection",
            'error': str(e)
        }