import logging
from typing import Dict, Any, Union
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class RetrieveContextRequest(BaseModel):
    """Pydantic model for RAG tool request parameters."""
    query: str = Field(..., description="The query to search for relevant context")
    top_k: int = Field(5, description="Number of results to retrieve", ge=1, le=10)
    
    model_config = {
        "json_schema_extra": {
            "description": "Retrieve relevant context from the knowledge base"
        }
    }

async def hybrid_search(
    request: Union[RetrieveContextRequest, str]
) -> Dict[str, Any]:
    """
    Perform hybrid search and return results with truncated content.
    Handles both string input (interpreted as 'query') and a RetrieveContextRequest model.
    """
    try:
        from dependencies import qdrant_manager
        if not qdrant_manager:
            raise ValueError("QdrantManager not initialized")

        # 1) Handle if 'request' is just a string
        if isinstance(request, str):
            query = request
            top_k_value = 5  # default
        else:
            # 2) Otherwise it's RetrieveContextRequest
            query = request.query
            top_k_value = max(1, min(request.top_k, 10))

        # Execute advanced search
        search_results = await qdrant_manager.advanced_search(
            collection_name="test",
            query=query,
            top_k=top_k_value
        )

        # Process nodes with truncation
        nodes = []
        for doc in search_results:
            try:
                truncated_text = doc.text[:2500] if doc.text else ""
                truncated_metadata = {
                    k: (v[:2500] if isinstance(v, str) else v)
                    for k, v in doc.metadata.items()
                }
                nodes.append({
                    'metadata': truncated_metadata
                })
            except Exception as e:
                logger.error(f"Error processing document: {str(e)}")
                continue

        return {
            'results': nodes,
            'total_results': len(nodes),
            'query': query
        }

    except Exception as e:
        logger.error(f"Error in hybrid_search: {str(e)}", exc_info=True)
        # Return a consistent structure, even on error
        return {
            'results': [],
            'total_results': 0,
            'query': request if isinstance(request, str) else request.query,
            'error': str(e)
        }