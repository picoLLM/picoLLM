## Self-Host Options

## Ollama (default)

This is the default engine for picoLLM. We provide 2 options for deployment 

+ Option 1 (default)

Deploy with the provided config that uses nginx to communicate with localhost on the docker provided host.docker.internal address. This option will use your local ollama install and not containerize it. 

+ Option 2 

Deploy picoLLM with the ollama container attached to the same network. This will not use your local ollama cache or existing library. 

To do this use the [docker-compose.ollama.yml](../configs/docker-compose.ollama.yml)

```bash
docker compose -f configs/docker-compose.ollama.yml up --build
```

### vLLM

Supported on localhost. 

If you launch the vllm server locally, you can keep the nginx address for the url. You can also use a number of cloud providers by changing your base url.

You can attach a vLLM container by using the docker-compose.vllm.yml However, this will use a significant amount more of your system resources. 

### Nvidia NIM

    _If you do this use VLLM in the UI_
    
If you have a GPU that is compatible with vLLM and an Nvidia Enterprise API key, you can host llama 3.1 8b (or 70b) yourself: 

```bash
docker login nvcr.io
```
The login will look like this, paste your NGC _Enterprise_ token for the login.

```bash
Username: $oauthtoken
Password: <PASTE_API_KEY_HERE>
```
The container will not be a part of the docker network because I have no way of validating if you have an enterprise key.

The configured server will dynamically quantize the model to fp8. Prefix caching can be enabled by adding the flag `--prefix-caching-enabled` to the end of your preferred deployment file. Not recommended if your have less than 24GB as speed is less of a priority than context window in this case. 

```bash
chmod +x build/nim/deploy_llama_3.1.sh
./build/nim/deploy_llama_3.1.sh # This will utilize your existing login or prompt you if no login is stored
```
If you dont have an enterprise NGC key you can use vllm


## Cloud Providers

## OpenAI

Just add your OpenAI API key to the .env

```bash
OPENAI_API_KEY=your-api-key
```

## Anthropic 

Just add your Anthropic API key to the .env

```bash
ANTHROPIC_API_KEY=your-api-key
```