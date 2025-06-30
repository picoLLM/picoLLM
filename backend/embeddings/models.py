import os
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from functools import lru_cache

import torch
from transformers import AutoTokenizer, AutoModelForMaskedLM
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Suppress common warnings
import warnings
warnings.filterwarnings("ignore", message="`clean_up_tokenization_spaces` was not set.*")

@dataclass
class EmbeddingModels:
    """Container for model components"""
    dense_model: Optional[SentenceTransformer] = None
    query_tokenizer: Optional[AutoTokenizer] = None
    query_model: Optional[AutoModelForMaskedLM] = None
    doc_tokenizer: Optional[AutoTokenizer] = None
    doc_model: Optional[AutoModelForMaskedLM] = None
    rerank_model: Optional[Any] = None
    device: Optional[torch.device] = None

class ModelManager:
    """Efficient model manager with lazy loading and memory optimization"""
    _instance = None
    
    def __init__(self):
        self.embeddings = EmbeddingModels()
        self._model_configs = {}
        self._is_initialized = False
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.embeddings.device = self.device
        self._log_system_info()
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _log_system_info(self):
        """Log system information including GPU details"""
        cuda = torch.cuda.is_available()
        logger.info(f"CUDA available: {cuda}")
        
        if cuda:
            n = torch.cuda.device_count()
            names = [torch.cuda.get_device_name(i) for i in range(n)]
            logger.info(f"Found {n} CUDA device(s): {names}")
            
            for i in range(n):
                free, total = self._get_gpu_memory(i)
                logger.info(f"GPU {i} - {names[i]}: {free/1024:.2f}GB free of {total/1024:.2f}GB total")
        
        logger.info(f"Using device: {self.device}")
    
    @staticmethod
    def _get_gpu_memory(device_id=0) -> Tuple[float, float]:
        """Get free and total memory for a GPU"""
        try:
            props = torch.cuda.get_device_properties(device_id)
            free = props.total_memory - torch.cuda.memory_allocated(device_id)
            return free, props.total_memory
        except Exception as e:
            logger.warning(f"Failed to get GPU memory stats: {e}")
            return 0, 0
    
    def configure_models(self, **model_names):
        """Configure models from arguments or environment variables"""
        types = ['query_model_name', 'doc_model_name', 'dense_model_name', 'rerank_model_name']
        
        for t in types:
            self._model_configs[t] = model_names.get(t) or os.environ.get(t.upper())
        
        configured = [f"{k.split('_')[0].title()}: {v}" for k, v in self._model_configs.items() if v]
        if configured:
            logger.info(f"Models configured: {', '.join(configured)}")
        else:
            logger.warning("No models configured from arguments or environment")
    
    @staticmethod
    @lru_cache(maxsize=4)
    def _load_tokenizer(model_name: str) -> AutoTokenizer:
        logger.info(f"Loading tokenizer: {model_name}")
        return AutoTokenizer.from_pretrained(model_name)
    
    @staticmethod
    @lru_cache(maxsize=4)
    def _load_masked_lm(model_name: str) -> AutoModelForMaskedLM:
        logger.info(f"Loading masked LM: {model_name}")
        return AutoModelForMaskedLM.from_pretrained(model_name)
    
    @staticmethod
    @lru_cache(maxsize=2)
    def _load_sentence_transformer(model_name: str, device_str: str) -> SentenceTransformer:
        """Load sentence transformer with optional ONNX backend"""
        backend = os.environ.get('SENTENCE_TRANSFORMER_BACKEND')
        
        if backend == 'onnx':
            onnx_path = os.environ.get('SENTENCE_TRANSFORMER_ONNX_PATH', 'onnx/model.onnx')
            logger.info(f"Loading sentence transformer: {model_name} with ONNX backend (path: {onnx_path})")
            return SentenceTransformer(
                model_name,
                backend="onnx",
                model_kwargs={"file_name": onnx_path},
                device=device_str
            )
        else:
            logger.info(f"Loading sentence transformer: {model_name}")
            return SentenceTransformer(model_name, device=device_str)
    
    def _check_gpu_memory(self, model_name: str, required_mb: int = 2000) -> bool:
        """Check if there's sufficient GPU memory for a model"""
        if not torch.cuda.is_available():
            return False
        
        required = required_mb * 1024 * 1024
        free_mems = [self._get_gpu_memory(i)[0] for i in range(torch.cuda.device_count())]
        max_free = max(free_mems) if free_mems else 0
        
        if max_free < required:
            logger.warning(f"Insufficient GPU memory for {model_name}. Required: {required_mb}MB, Available: {max_free/1024/1024:.2f}MB")
            return False
        
        return True
    
    def _load_model(self, model_type: str, model_name: str):
        """Load a specific model with GPU memory check"""
        if not model_name:
            return None
        
        use_gpu = self._check_gpu_memory(model_name)
        device_str = "cuda" if use_gpu else "cpu"
        
        if model_type == 'query':
            self.embeddings.query_tokenizer = self._load_tokenizer(model_name)
            self.embeddings.query_model = self._load_masked_lm(model_name)
            if use_gpu:
                self.embeddings.query_model = self.embeddings.query_model.to(self.device)
        elif model_type == 'doc':
            self.embeddings.doc_tokenizer = self._load_tokenizer(model_name)
            self.embeddings.doc_model = self._load_masked_lm(model_name)
            if use_gpu:
                self.embeddings.doc_model = self.embeddings.doc_model.to(self.device)
        elif model_type == 'dense':
            self.embeddings.dense_model = self._load_sentence_transformer(model_name, device_str)
            if use_gpu and device_str == "cuda":
                self.embeddings.dense_model = self.embeddings.dense_model.to(self.device)
        elif model_type == 'rerank':
            logger.info(f"Reranker model configured but not loaded: {model_name}")
            self.embeddings.rerank_model = None
    
    def initialize_models(self, **model_names):
        """Initialize models based on configuration"""
        if self._is_initialized:
            logger.info("Models already initialized")
            return
        
        if model_names:
            self.configure_models(**model_names)
        
        configs = {k.split('_')[0]: self._model_configs.get(k) for k in 
                  ['query_model_name', 'doc_model_name', 'dense_model_name', 'rerank_model_name']}
        
        if not any(configs[k] for k in ['query', 'doc', 'dense']):
            raise ValueError("No models configured. Call configure_models or set environment variables.")
        
        try:
            for mtype, mname in configs.items():
                if mname:
                    self._load_model(mtype, mname)
            
            self._is_initialized = True
            self._log_model_placement()
            logger.info("Model initialization complete")
        except Exception as e:
            logger.error(f"Error initializing models: {e}")
            self.cleanup()
            raise
    
    def _log_model_placement(self):
        """Log summary of model placement"""
        models = {
            "Dense Model": self.embeddings.dense_model,
            "Query Model": self.embeddings.query_model,
            "Doc Model": self.embeddings.doc_model,
            "Rerank Model": self.embeddings.rerank_model
        }
        
        logger.info("=== Model Placement Summary ===")
        for name, model in models.items():
            if model is None:
                device_str = "Not loaded"
            elif hasattr(model, "device"):
                device_str = str(model.device)
            else:
                try:
                    device_str = next(model.parameters()).device
                except (StopIteration, AttributeError):
                    device_str = "Unknown"
            
            # Check if Dense Model is using ONNX backend
            if name == "Dense Model" and model is not None:
                backend = os.environ.get('SENTENCE_TRANSFORMER_BACKEND')
                if backend == 'onnx':
                    onnx_path = os.environ.get('SENTENCE_TRANSFORMER_ONNX_PATH', 'onnx/model.onnx')
                    logger.info(f"{name}: {device_str} [ONNX Backend - {onnx_path}]")
                else:
                    logger.info(f"{name}: {device_str}")
            else:
                logger.info(f"{name}: {device_str}")
        logger.info("==============================")
    
    def get_components(self) -> EmbeddingModels:
        """Get all model components, initializing if necessary"""
        if not self._is_initialized:
            logger.info("Initializing models on first use")
            self.initialize_models()
        
        if not any([self.embeddings.dense_model, self.embeddings.query_model, self.embeddings.doc_model]):
            raise ValueError("No models were initialized successfully")
        
        return self.embeddings
    
    def cleanup(self):
        """Release all model resources and memory"""
        logger.info("Cleaning up resources")
        
        for attr in ['dense_model', 'query_model', 'doc_model', 'rerank_model']:
            if hasattr(self.embeddings, attr) and getattr(self.embeddings, attr) is not None:
                delattr(self.embeddings, attr)
                logger.info(f"{attr.replace('_', ' ').title()} freed")
        
        self._load_tokenizer.cache_clear()
        self._load_masked_lm.cache_clear()
        self._load_sentence_transformer.cache_clear()
        
        self.embeddings = EmbeddingModels(device=self.device)
        
        if torch.cuda.is_available():
            before = torch.cuda.memory_allocated()
            torch.cuda.empty_cache()
            after = torch.cuda.memory_allocated()
            logger.info(f"CUDA cache emptied. Freed approximately {(before - after) / (1024 * 1024):.2f}MB")
        
        self._is_initialized = False