from typing import List, Dict, Any, Optional, Union, Literal
from pydantic import BaseModel, Field, model_validator
from pathlib import Path
from datetime import datetime
from enum import Enum
import base64

### Message Models ###

class ImageSource(BaseModel):
    """Anthropic-style image source"""
    type: str = "base64"
    media_type: str
    data: str

class AnthropicImageContent(BaseModel):
    """Anthropic-style image content"""
    type: Literal["image"] = "image"
    source: ImageSource

class OpenAIImageContent(BaseModel):
    """OpenAI-style image content"""
    type: Literal["image_url"] = "image_url"
    image_url: Dict[str, str]

class TextContent(BaseModel):
    """Universal text content"""
    type: Literal["text"] = "text"
    text: str

class FileAttachment(BaseModel):
    """OpenAI file attachment"""
    file_id: str
    tools: Optional[List[str]] = None

class Message(BaseModel):
    """Unified message model supporting both OpenAI and Anthropic formats"""
    role: str = Field(..., description="The role of the message sender (system, user, or assistant)")
    content: Union[str, List[Union[AnthropicImageContent, OpenAIImageContent, TextContent]]] = Field(
        ..., 
        description="The content of the message. Can be string or structured content"
    )
    attachments: Optional[List[FileAttachment]] = None
    name: Optional[str] = None  # OpenAI optional field

    @model_validator(mode='after')
    def validate_content_structure(self) -> 'Message':
        """Validate content structure based on type"""
        if isinstance(self.content, list):
            # Ensure we don't mix OpenAI and Anthropic image formats in the same message
            content_types = {type(item) for item in self.content}
            if AnthropicImageContent in content_types and OpenAIImageContent in content_types:
                raise ValueError("Cannot mix OpenAI and Anthropic image formats in the same message")
        return self

    def model_dump(self, provider: str = "openai", *args, **kwargs) -> Dict[str, Any]:
        """
        Provider-aware serialization with OpenAI format as default.
        Special handling for Anthropic, all other providers use OpenAI-compatible format.
        """
        base_dict = {
            "role": self.role
        }
        
        # Add optional name for OpenAI-compatible providers
        if self.name and provider != "anthropic":
            base_dict["name"] = self.name

        # Handle content serialization
        if isinstance(self.content, str):
            base_dict["content"] = self.content
        elif isinstance(self.content, list):
            if provider == "anthropic":
                # Anthropic-specific format
                content = [
                    c.model_dump() for c in self.content 
                    if isinstance(c, (AnthropicImageContent, TextContent))
                ]
            else:
                # OpenAI-compatible format for all other providers
                content = [
                    c.model_dump() for c in self.content 
                    if isinstance(c, (OpenAIImageContent, TextContent))
                ]
            base_dict["content"] = content

        # Add attachments for OpenAI-compatible providers
        if self.attachments and provider != "anthropic":
            base_dict["attachments"] = [a.model_dump() for a in self.attachments]

        return base_dict

    @classmethod
    def from_text(cls, role: str, text: str, name: Optional[str] = None) -> 'Message':
        """Create a text-only message"""
        return cls(role=role, content=text, name=name)

    @classmethod
    def from_image_and_text(
        cls,
        role: str,
        image_data: Union[str, Path],
        text: str,
        provider: str = "openai",
        media_type: str = "image/jpeg",
        name: Optional[str] = None
    ) -> 'Message':
        """Create an image+text message for specified provider"""
        # Handle image data
        if isinstance(image_data, Path):
            with open(image_data, "rb") as img_file:
                image_data = base64.b64encode(img_file.read()).decode()

        text_content = TextContent(text=text)
        
        if provider == "anthropic":
            image_content = AnthropicImageContent(
                source=ImageSource(
                    type="base64",
                    media_type=media_type,
                    data=image_data
                )
            )
        else:  # openai
            image_content = OpenAIImageContent(
                image_url={
                    "url": f"data:{media_type};base64,{image_data}"
                }
            )

        return cls(
            role=role,
            content=[image_content, text_content],
            name=name
        )

#### Request Models #### 

class ChatCompletionRequest(BaseModel):
    # Essential Parameters
    model: str = Field(..., description="The model to use for completion")
    messages: List[Message] = Field(..., description="The messages to generate completions for")
    
    # API Configuration
    provider: Optional[str] = Field(None, description="Optional provider override (e.g., 'anthropic')")
    api_key: Optional[str] = Field(None, description="API key for the provider")
    base_url: Optional[str] = Field(None, description="Base URL for the provider")
    debug: Optional[bool] = Field(False, description="Enable debug logging")

    # Common Parameters
    temperature: Optional[float] = Field(0.7, description="Sampling temperature between 0 and 1", gt=0, lt=1)
    top_p: Optional[float] = Field(None, description="Nucleus sampling parameter", gt=0, lt=1)
    max_tokens: Optional[int] = Field(None, description="Maximum number of tokens to generate", gt=1)
    stream: Optional[bool] = Field(False, description="Whether to stream responses")

    presence_penalty: Optional[float] = Field(0.0, description="Presence penalty for token selection (OpenAI)")
    frequency_penalty: Optional[float] = Field(0.0, description="Frequency penalty for token selection (OpenAI)")
    n: Optional[int] = Field(1, description="Number of completions to generate (OpenAI)")
    reasoning_effort: Optional[Literal["low", "medium", "high"]] = None  # For OpenAI o-models
    tools: Optional[List[Any]] = Field(None, description="Tool definitions or names of tools to use")
    tool_choice: Optional[Any] = Field(None, description="Tool choice configuration")

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "vllm",
                "base_url": "http://nginx/v1/vllm",
                "model": "",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Search for recent news about AI."}
                ],
                "temperature": 0.7,
                "stream": True,
                "max_tokens": 100,
                "tools": ["web_search"]
            }
        }


class AnthropicChatCompletionRequest(BaseModel):
    """Anthropic-specific request model that reuses the existing Message model"""
    model: str = Field(..., description="The model to use (e.g. claude-3-opus-20240229)")
    messages: List[Message] = Field(..., description="The messages to generate completions for")
    system: Optional[str] = Field(None, description="System prompt")

    # Anthropic-specific parameters
    max_tokens: Optional[int] = Field(None, description="Maximum number of tokens to generate")
    temperature: Optional[float] = Field(0.7, description="Sampling temperature")
    top_p: Optional[float] = Field(None, description="Nucleus sampling parameter")
    top_k: Optional[int] = Field(None, description="Only sample from top K options for each token")
    stop_sequences: Optional[List[str]] = Field(None, description="Sequences that will cause the model to stop")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    thinking: Optional[Dict[str, Any]] = None
    stream: Optional[bool] = Field(False, description="Whether to stream responses")
    debug: Optional[bool] = Field(False, description="Enable debug logging")
    
    # Tool Configuration
    tools: Optional[List[Any]] = Field(None, description="Tool definitions to use")
    tool_choice: Optional[Any] = Field(None, description="Tool choice configuration")


## dynamic tool management ##
 
class DynamicToolRequest(BaseModel):
    name: str = Field(..., description="Unique tool name")
    description: str = Field(..., description="Tool description")
    code: str = Field(..., description="Python function code")
    parameters: Dict[str, Dict[str, Any]] = Field(..., description="Parameter schemas")
    required_params: List[str] = Field(default_factory=list)
    allow_network: bool = Field(default=False)

class ToolStatusResponse(BaseModel):
    """Base response for tool operations with status and message"""
    status: str
    message: str


class ToolsResponse(BaseModel):
    """Response with tools dictionary"""
    tools: Dict[str, str]


class ToolSchema(BaseModel):
    """Schema details for a tool"""
    name: str
    description: str
    parameters: Dict[str, Any]


class ToolCreateRequest(BaseModel):
    """Request to create a new tool"""
    name: str
    description: str
    code: str
    tool_schema: Optional[Dict[str, Any]] = Field(None, alias="schema")
    
    class Config:
        populate_by_name = True


class ToolSchemaResponse(ToolStatusResponse):
    """Response with tool schema details"""
    name: str
    description: str
    tool_schema: Dict[str, Any] = Field(..., alias="schema")
    
    class Config:
        populate_by_name = True
        
### Model List Models ###

class ModelObject(BaseModel):
    id: str
    object: str = "model"
    created: int = int(datetime.now().timestamp())
    owned_by: str
    permissions: Optional[List[Dict[str, Any]]] = None
    root: Optional[str] = None
    parent: Optional[str] = None

class ModelList(BaseModel):
    object: str = "list"
    data: List[ModelObject]

class ModelProvider:
    async def get_models(self) -> List[ModelObject]:
        raise NotImplementedError
    
class PullRequest(BaseModel):
    name: str
    insecure: Optional[bool] = False
    stream: Optional[bool] = True

### Chat Session Models ###

class ChatSession(BaseModel):
    id: int
    name: str
    created_at: datetime
    messages: List[Message] = []

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ChatSessionCreate(BaseModel):
    first_message: Optional[str] = None
    name: Optional[str] = None
    is_temporary: bool = False
    system_message: str = "You are a helpful AI assistant."
    model: str = "meta/llama-3.1-8b-instruct"
    provider: str = "openai"
    max_tokens: int = 128
    temperature: float = 0.7

class MessageCreate(BaseModel):
    role: str
    content: str
    metadata: Optional[Dict[str, Any]] = None

class Message(BaseModel):
    id: int
    chat_session_id: int
    role: str
    content: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class ChatSessionRename(BaseModel):
    new_name: str

class ChatHistoryEntry(BaseModel):
    id: int
    timestamp: datetime
    question: str
    answer: str
    retrieved_context: List['RetrievedContextItem']

class RecentConversation(BaseModel):
    question: str
    answer: str
    context: Optional[Dict[str, Any]] = Field(default=None)
    timestamp: datetime

class ChatOverview(BaseModel):
    total_entries: int
    date_range: dict
    question_count: int
    answer_count: int
    recent_conversations: List[RecentConversation]

class CaseDetail(BaseModel):
    case_name: str
    case_link: str
    summary: str
    impact: Optional[str]
    verdict: Optional[str]
    key_points: Optional[List[str]]
    full_text: Optional[str]


class InferenceResponse(BaseModel):
    answer: str
    case_details: List[CaseDetail]

class RetrievedContextItem(BaseModel):
    doc_id: str
    text: str



#### Qdrant Models ####

class CollectionBuildRequest(BaseModel):
    collection_name: str = Field(..., description="Name of the collection to build")
    dataset_names: list[str] = Field(..., description="List of dataset names to process")
    load_from_disk: bool = Field(False, description="Whether to load from disk instead of HF Hub")
    split: str = Field("train", description="Dataset split to use")
    text_field: str = Field("text", description="Field containing the text to index")
    batch_size: int = Field(32, description="Processing batch size")
    use_quantization: bool = Field(False, description="Enable vector quantization")
    use_matryoshka: bool = Field(False, description="Enable matryoshka embeddings")

class SearchResult(BaseModel):
    content: str
    metadata: Dict[str, Any]
    score: float

class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, description="Number of top results to retrieve")
    alpha: float = Field(default=0.5, description="Alpha value for relative score fusion")
    rerank: Optional[bool] = Field(default=False, description="Whether to rerank the results")

class FilteredSearchRequest(BaseModel):
    query: str
    collection_name: str = Field(..., description="Name of the collection to search")
    filters: Optional[Dict[str, List[Dict[str, Any]]]] = Field(
        default=None,
        description="Filter criteria to refine search results. Can include 'must', 'should', and 'must_not' conditions."
    )
    top_k: int = Field(default=5, description="Number of top results to retrieve")
    alpha: float = Field(default=0.5, description="Alpha value for relative score fusion")
    rerank: bool = Field(default=False, description="Whether to rerank the results")

class SearchResponse(BaseModel):
    results: List[SearchResult]


class ConversationExportFormat(str, Enum):
    DEFAULT = "default"
    CHATML = "chatml"  

