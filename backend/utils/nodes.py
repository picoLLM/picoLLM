from typing import Dict, Any, List, Optional, Set
import uuid

class TextNode:
    """
    A minimal implementation of LlamaIndex's TextNode that can be used as a drop-in replacement.
    This focuses on just the attributes and methods used in QdrantDBManager.
    """
    def __init__(
        self,
        text: str,
        id_: Optional[str] = None,
        embedding: Optional[List[float]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        relationships: Optional[Dict[str, Any]] = None,
        excluded_embed_metadata_keys: Optional[Set[str]] = None,
        excluded_llm_metadata_keys: Optional[Set[str]] = None,
        hash: Optional[str] = None,
    ):
        """
        Initialize a TextNode object.
        
        Args:
            text (str): The text content of the node
            id_ (str, optional): The node ID. Will generate UUID if not provided.
            embedding (List[float], optional): Vector embeddings for the document
            metadata (Dict[str, Any], optional): Additional metadata for the document
            relationships (Dict[str, Any], optional): Node relationships
            excluded_embed_metadata_keys (Set[str], optional): Metadata keys to exclude from embedding
            excluded_llm_metadata_keys (Set[str], optional): Metadata keys to exclude from LLM
            hash (str, optional): Hash of the node
        """
        self._text = text
        self.id_ = id_ if id_ is not None else str(uuid.uuid4())
        self.embedding = embedding if embedding is not None else None
        self.metadata = metadata if metadata is not None else {}
        self.excluded_embed_metadata_keys = excluded_embed_metadata_keys or set()
        self.excluded_llm_metadata_keys = excluded_llm_metadata_keys or set()
        self.relationships = relationships or {}
        self._hash = hash
    
    @property
    def text(self) -> str:
        """Get the text of the node."""
        return self._text
    
    @property
    def node_id(self) -> str:
        """Get the ID of the node."""
        return self.id_
    
    def get_content(self, metadata_mode: str = "all") -> str:
        """Get the content of the node."""
        return self._text
    
    def get_text(self) -> str:
        """Get the text of the node."""
        return self._text
    
    def __str__(self) -> str:
        """String representation of the node."""
        return f"TextNode(id={self.id_}, text={self._text[:50]}{'...' if len(self._text) > 50 else ''})"
    
    def __repr__(self) -> str:
        """Detailed representation of the node."""
        return (
            f"TextNode(id={self.id_}, "
            f"text_length={len(self._text)}, "
            f"embedding_size={len(self.embedding) if self.embedding else 0}, "
            f"metadata_keys={list(self.metadata.keys()) if self.metadata else []})"
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the node to a dictionary representation."""
        return {
            "id_": self.id_,
            "text": self._text,
            "embedding": self.embedding,
            "metadata": self.metadata,
            "relationships": self.relationships,
            "excluded_embed_metadata_keys": list(self.excluded_embed_metadata_keys),
            "excluded_llm_metadata_keys": list(self.excluded_llm_metadata_keys),
            "hash": self._hash,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TextNode':
        """Create a TextNode from a dictionary."""
        # Convert lists back to sets for the excluded keys
        excluded_embed_keys = set(data.get("excluded_embed_metadata_keys", []))
        excluded_llm_keys = set(data.get("excluded_llm_metadata_keys", []))
        
        return cls(
            text=data.get("text", ""),
            id_=data.get("id_"),
            embedding=data.get("embedding"),
            metadata=data.get("metadata", {}),
            relationships=data.get("relationships", {}),
            excluded_embed_metadata_keys=excluded_embed_keys,
            excluded_llm_metadata_keys=excluded_llm_keys,
            hash=data.get("hash"),
        )

