import os
import logging
from functools import lru_cache
from typing import Optional, Dict, List, Union, Any, Tuple
import torch
import numpy as np
from sentence_transformers import SentenceTransformer, SparseEncoder

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

import warnings
warnings.filterwarnings("ignore", message="`clean_up_tokenization_spaces` was not set.*")


class EmbeddingModels:
    """Singleton manager for embedding models with lazy loading"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.dense = None
            self.query_sparse = None
            self.doc_sparse = None
            self._configs = {}
            self._initialized = True
            self._log_system_info()
    
    def _log_system_info(self):
        """Log GPU details if available"""
        if torch.cuda.is_available():
            n = torch.cuda.device_count()
            for i in range(n):
                name = torch.cuda.get_device_name(i)
                props = torch.cuda.get_device_properties(i)
                free = props.total_memory - torch.cuda.memory_allocated(i)
                logger.info(f"GPU {i} - {name}: {free/1024**3:.2f}GB free of {props.total_memory/1024**3:.2f}GB")
        logger.info(f"Using device: {self.device}")
    
    def configure(self, **kwargs):
        """Configure models from kwargs or environment"""
        model_types = ['query', 'doc', 'dense']
        for t in model_types:
            key = f"{t}_model_name"
            self._configs[t] = kwargs.get(key) or os.environ.get(key.upper())
        
        configured = [f"{k}: {v}" for k, v in self._configs.items() if v]
        if configured:
            logger.info(f"Configured: {', '.join(configured)}")
    
    @staticmethod
    @lru_cache(maxsize=4)
    def _load_sparse(model_name: str) -> SparseEncoder:
        """Load sparse encoder with optional ONNX backend"""
        backend = os.environ.get('SENTENCE_TRANSFORMER_BACKEND')
        if backend == 'onnx':
            try:
                onnx_path = os.environ.get('SENTENCE_TRANSFORMER_ONNX_PATH', 'onnx/model.onnx')
                logger.info(f"Loading sparse {model_name} with ONNX")
                return SparseEncoder(model_name, backend="onnx", model_kwargs={"file_name": onnx_path})
            except Exception as e:
                logger.warning(f"ONNX failed for {model_name}: {e}, using default")
        
        logger.info(f"Loading sparse {model_name}")
        return SparseEncoder(model_name)
    
    @staticmethod
    @lru_cache(maxsize=2)
    def _load_dense(model_name: str, device: str) -> SentenceTransformer:
        """Load sentence transformer with optional ONNX backend"""
        backend = os.environ.get('SENTENCE_TRANSFORMER_BACKEND')
        kwargs = {"device": device}
        
        if backend == 'onnx':
            onnx_path = os.environ.get('SENTENCE_TRANSFORMER_ONNX_PATH', 'onnx/model.onnx')
            logger.info(f"Loading dense {model_name} with ONNX")
            kwargs.update({"backend": "onnx", "model_kwargs": {"file_name": onnx_path}})
        else:
            logger.info(f"Loading dense {model_name}")
        
        return SentenceTransformer(model_name, **kwargs)
    
    def _check_gpu_memory(self, required_mb: int = 2000) -> bool:
        """Check if sufficient GPU memory available"""
        if not torch.cuda.is_available():
            return False
        
        props = torch.cuda.get_device_properties(0)
        free = props.total_memory - torch.cuda.memory_allocated(0)
        return free >= required_mb * 1024 * 1024
    
    def initialize(self, **kwargs):
        """Initialize models based on configuration"""
        if any([self.dense, self.query_sparse, self.doc_sparse]):
            logger.info("Models already initialized")
            return
        
        if kwargs:
            self.configure(**kwargs)
        
        if not any(self._configs.values()):
            raise ValueError("No models configured")
        
        use_gpu = self._check_gpu_memory()
        device_str = "cuda" if use_gpu else "cpu"
        
        # Load configured models
        if self._configs.get('query'):
            self.query_sparse = self._load_sparse(self._configs['query'])
            if use_gpu:
                self.query_sparse.to(self.device)
        
        if self._configs.get('doc'):
            self.doc_sparse = self._load_sparse(self._configs['doc'])
            if use_gpu:
                self.doc_sparse.to(self.device)
        
        if self._configs.get('dense'):
            self.dense = self._load_dense(self._configs['dense'], device_str)
            if use_gpu and device_str == "cuda":
                self.dense = self.dense.to(self.device)
        
        self._log_model_status()
    
    def _log_model_status(self):
        """Log model placement summary"""
        models = {"Dense": self.dense, "Query Sparse": self.query_sparse, "Doc Sparse": self.doc_sparse}
        logger.info("=== Model Status ===")
        for name, model in models.items():
            if model is None:
                logger.info(f"{name}: Not loaded")
            else:
                device = getattr(model, 'device', 'Unknown')
                logger.info(f"{name}: {device}")
        logger.info("==================")
    
    def get_components(self):
        """Get models, initializing if needed"""
        if not any([self.dense, self.query_sparse, self.doc_sparse]):
            self.initialize()
        return self
    
    def cleanup(self):
        """Release all resources"""
        logger.info("Cleaning up models")
        
        for attr in ['dense', 'query_sparse', 'doc_sparse']:
            if hasattr(self, attr):
                setattr(self, attr, None)
        
        self._load_sparse.cache_clear()
        self._load_dense.cache_clear()
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("Cleanup complete")
    
    # Backward compatibility properties
    @property
    def dense_model(self):
        return self.dense
    
    @property
    def query_sparse_model(self):
        return self.query_sparse
    
    @property
    def doc_sparse_model(self):
        return self.doc_sparse
    
def get_dense_embedding(
    self, 
    text: str,
    use_matryoshka: bool = False,
    matryoshka_levels: int = 3,
    build_with_quantized: bool = False,
    calibration_embeddings: Optional[np.ndarray] = None
) -> Dict[str, Union[List[float], List[int]]]:
    """Generate dense embeddings for the given text."""
    if not self.dense:
        self.initialize()
        
    dense_vector = self.dense.encode(
        text, convert_to_tensor=True, show_progress_bar=False
    ).cpu().numpy()
    
    if use_matryoshka:
        matryoshka_vectors = {}
        for i in range(matryoshka_levels):
            size = dense_vector.shape[0] // (2 ** i)
            matryoshka_vectors[f"matryoshka-{size}dim"] = dense_vector[:size].tolist()
        return matryoshka_vectors
    else:
        result = {"dense": dense_vector.tolist()}
        if build_with_quantized:
            if calibration_embeddings is None:
                raise ValueError("Calibration embeddings required for quantization")
            uint8_vector = self.quantize_vector(dense_vector, calibration_embeddings)
            result["dense-uint8"] = uint8_vector.tolist()
        return result

def get_sparse_embedding(self, text: str, is_query: bool = False) -> Any:
    """Generate sparse embedding using appropriate SparseEncoder."""
    if not self.query_sparse:
        self.initialize()
        
    model = self.query_sparse if is_query else self.doc_sparse
    embedding = model.encode([text])
    indices, values = self._extract_sparse_indices_values(embedding, 0)
    return list(zip(indices, values)) if indices else []

def batch_encode_sparse(self, texts: List[str], is_query: bool) -> Tuple[List[List[int]], List[List[float]]]:
    """Generate sparse vectors for batch processing."""
    if not self.query_sparse:
        self.initialize()
        
    model = self.query_sparse if is_query else self.doc_sparse
    embeddings = model.encode(texts)
    
    indices_list = []
    values_list = []
    for i in range(len(texts)):
        indices, values = self._extract_sparse_indices_values(embeddings, i)
        indices_list.append(indices)
        values_list.append(values)
    
    return indices_list, values_list