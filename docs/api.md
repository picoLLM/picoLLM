# API Usage

The fastapi interface is available at `http://0.0.0.0:8081/docs`

### Example Ollama Request

```json
{
  "api_key": "ollama",
  "base_url": "http://nginx/v1",
  "max_tokens": 100,
  "messages": [
    {
      "content": "You are a helpful assistant.",
      "role": "system"
    },
    {
      "content": "Search for recent news about AI.",
      "role": "user"
    }
  ],
  "model": "llama3.1",
  "stream": true,
  "temperature": 0.7,
  "tools": ["web_search"]
}
```

### Example vLLM request

```json
{
  "api_key": "vllm",
  "base_url": "http://nginx/vllm/v1",
  "max_tokens": 100,
  "messages": [
    {
      "content": "You are a helpful assistant.",
      "role": "system"
    },
    {
      "content": "Search for recent news about AI.",
      "role": "user"
    }
  ],
  "model": "RedHatAI/Meta-Llama-3.1-8B-Instruct-FP8",
  "stream": true,
  "temperature": 0.7,
  "tools": ["hybrid_search"]
}
```


### Example Anthropic Request

```json
{
  "provider": "anthropic",
  "max_tokens": 100,
  "system": "You are a helpful AI assistant",
  "messages": [
    {
      "content": "Search for recent news about AI.",
      "role": "user"
    }
  ],
  "model": "claude-3-7-sonnet-20250219",
  "stream": true,
  "temperature": 0.7,
  "tools": ["web_search"]
}
```
### Example Ollama Request

```json
{
  "api_key": "openai",
  "max_tokens": 100,
  "messages": [
    {
      "content": "You are a helpful assistant.",
      "role": "system"
    },
    {
      "content": "Search for recent news about AI.",
      "role": "user"
    }
  ],
  "model": "gpt-4.1-mini",
  "stream": true,
  "temperature": 0.7,
  "tools": ["web_search"]
}
```