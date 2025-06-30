interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_DEFAULT_MODEL?: string;
  readonly VITE_MODEL_BASE_URL?: string;
  readonly VITE_QDRANT_URI?: string;
  readonly VITE_OLLAMA_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}