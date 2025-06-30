# Client

picoLLM can also be used as a python client for things like structured output with pydantic models and unifying providers in other projects.

- Chat completions:

```python
from picollm import OpenAIChat, AnthropicChat

class RPGCharacter(BaseModel):
    """Create a role-playing game character"""
    name: str = Field(..., description="Character name")
    character_class: CharacterClass = Field(..., description="Character class/profession")
    level: int = Field(1, ge=1, le=100, description="Character level")
    stats: CharacterStats = Field(..., description="Character attributes")
    backstory: str = Field(..., min_length=10, description="Character's background story")
    equipment: List[str] = Field(default_factory=list, description="Items the character carries")

client = OpenAIChat()

response = await client.chat(
    messages=[
            {"role": "user", "content": "Create a mysterious elven mage character for my D&D campaign"}
        ],
    model="gpt-4o-mini",
    tools=[RPGCharacter], #pydantic models accepted as tools
    tool_choice="required"
    )

    print("RPG Character Response:")
    print(json.dumps(response, indent=2))

```

## Synthetic Data Generation

Example:

```python
from picollm import OpenAIChat, AnthropicChat
import asyncio
import json
from pydantic import BaseModel, Field
from typing import List, Optional

# define structured output format
class RPGCharacter(BaseModel):
    name: str = Field(description="Character name")
    race: str = Field(description="Character race (e.g., elf, dwarf, human)")
    class_type: str = Field(description="Character class (e.g., mage, warrior, rogue)")
    level: int = Field(description="Character level (1-20)")
    background: str = Field(description="Character backstory and personality")
    abilities: List[str] = Field(description="Special abilities and skills")


# or something more complex

class ResearchReport(BaseModel):
    topic: str = Field(description="Research topic")
    database_findings: List[Dict[str, str]] = Field(
        description="Results from specialized databases"
        )
    web_findings: List[Dict[str, str]] = Field(description="Current web information")
    key_insights: List[str] = Field(description="Main insights discovered")
    recommendations: List[str] = Field(description="Actionable recommendations")
    confidence: str = Field(description="High/Medium/Low")


async def generate_batch_completions(requests):

    async def generate_completion(request_config):
        provider = request_config.get('provider', 'openai')
        client = openai_client if provider == 'openai' else anthropic_client

        # Build request
        return await client.chat(
            messages=request_config.get('messages', [
                {"role": "user", "content": request_config['prompt']}
            ]),
            model=request_config.get('model', 'gpt-4o-mini'),
            tools=request_config.get('tools', []),
            tool_choice=request_config.get('tool_choice', 'auto')
        )

    # Execute all requests concurrently
    return await asyncio.gather(*[
        generate_completion(req) for req in requests
    ])

# load clients, also can be provider object from utils.handlers
# from picollm.utils.handlers import get_provider
# provider = get_provider("ollama")
openai_client = OpenAIChat()
anthropic_client = AnthropicChat()

data_generation_config = [
    {
        "prompt": "Create a mysterious elven mage character for my D&D campaign",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "tools": [RPGCharacter],
        "tool_choice": "required"
    },
    {
        "prompt": "search for court cases relevant to [xyz topic]",
        "provider": "anthropic",
        "model": "claude-opus-4-20250514",
        "tools": ["hybrid_search"],
        "tool_choice": "required"
    },
    {
        "prompt": "Research the effect of AI on the judicial system. Use hybrid search to access verified documents, web search to find relevant citations from trusted sources, and compile the results in the research report format",
        "provider": "openai",
        "model": "gpt-4.1",
        # openai is currently the only provider that supports pydantic models as tools
        # json configuration is also accepted
        "tools": [ResearchReport, "web_search", "hybrid_search"],
        "tool_choice": "required"
    },
    {
        "prompt": "Find current news in the stock market and compile a chart of potential investment opportunities",
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "tools": ["web_search"],
        "tool_choice": "auto"
    }
]

responses = await generate_batch_completions(data_generation_config)
for request, response in zip(data_generation_config, responses):
    print(f"\n{'='*60}")
    print(f"Provider: {request['provider']} | Model: {request['model']}")
    print(f"Tools: {[tool.__name__ for tool in request.get('tools', [])]}")
    print(f"Prompt: {request['prompt'][:80]}...")
    print(f"\nResponse:")
    print(json.dumps(response, indent=2))

```
