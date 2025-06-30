from typing import List, Tuple, Dict, Any, Union, Optional
import traceback
import logging
import asyncio
import uuid
import os
import re

from sentence_transformers.quantization import quantize_embeddings

from datasets import load_dataset
from qdrant_client.http import models
from qdrant_client import QdrantClient
import numpy as np
import torch

from utils.nodes import TextNode
from embeddings.models import ModelManager, EmbeddingModels
from routes.collections.filters import FilterBuilder, create_filter

import warnings
warnings.filterwarnings("ignore", message="`clean_up_tokenization_spaces` was not set.*")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class QdrantDBManager:
    """Qdrant database manager with lazy model initialization"""
    def __init__(
        self,
        embeddings: Optional[EmbeddingModels] = None,
        model_manager: Optional[ModelManager] = None,
        build_with_quantized: bool = False,
        use_matryoshka: bool = False,
        matryoshka_levels: int = 3,
        calibration_sample_size: int = 120,
        host: str = "qdrant",
        port: int = 6333
    ):
        """
        Initialize QdrantDBManager with optional deferred model loading.
        
        Args:
            embeddings: EmbeddingModels instance containing all necessary models (optional)
            model_manager: ModelManager instance for lazy loading (optional)
            build_with_quantized: Whether to use quantization for embeddings
            use_matryoshka: Whether to use matryoshka embeddings
            matryoshka_levels: Number of matryoshka embedding levels
            calibration_sample_size: Sample size for quantization calibration
            host: Qdrant server host
            port: Qdrant server port
        """
        self.client = QdrantClient(host, port=port)
        self.BUILD_WITH_QUANTIZED = build_with_quantized
        self.USE_MATRYOSHKA = use_matryoshka
        self.MATRYOSHKA_LEVELS = matryoshka_levels if use_matryoshka else 1
        self.calibration_sample_size = calibration_sample_size
        self.calibration_embeddings = None
        self._model_manager = model_manager
        self.embeddings = embeddings
        
        # Initialize model components if embeddings are provided
        if embeddings:
            self._load_model_components()
            
    def _load_model_components(self):
        """Load all model components from embeddings"""
        if not self.embeddings:
            if not self._model_manager:
                raise ValueError("No embeddings or model manager provided")
            self.embeddings = self._model_manager.get_components()
            
        # Set model components from embeddings
        self.device = self.embeddings.device
        self.dense_model = self.embeddings.dense_model
        self.query_tokenizer = self.embeddings.query_tokenizer
        self.query_model = self.embeddings.query_model
        self.doc_tokenizer = self.embeddings.doc_tokenizer
        self.doc_model = self.embeddings.doc_model
        
        # Generate calibration embeddings if needed
        if self.BUILD_WITH_QUANTIZED and self.calibration_embeddings is None:
            logging.info("Quantization enabled: Generating calibration embeddings...")
            self.calibration_embeddings = self.generate_calibration_embeddings()


    def _build_vectors_config(self) -> Dict[str, models.VectorParams]:
        """
        Build the vectors configuration for the Qdrant collection based on the initialization parameters.

        Returns:
            Dict[str, models.VectorParams]: The vectors configuration.
        """
        vectors_config = {}

        if self.USE_MATRYOSHKA:
            for i in range(self.MATRYOSHKA_LEVELS):
                size = self.dense_model.get_sentence_embedding_dimension() // (2 ** i)
                vectors_config[f"matryoshka-{size}dim"] = models.VectorParams(
                    size=size,
                    distance=models.Distance.COSINE,
                )
        else:
            # Always include the original dense vector
            vectors_config["dense"] = models.VectorParams(
                size=self.dense_model.get_sentence_embedding_dimension(),
                distance=models.Distance.COSINE,
            )
            # Conditionally include the quantized dense vector for building the collection
            if self.BUILD_WITH_QUANTIZED:
                vectors_config["dense-uint8"] = models.VectorParams(
                    size=self.dense_model.get_sentence_embedding_dimension(),
                    distance=models.Distance.COSINE,
                    quantization_config=models.ScalarQuantization(
                        scalar=models.ScalarQuantizationConfig(
                            type=models.ScalarType.INT8,
                            quantile=0.99,
                            always_ram=True,
                        ),
                    ),
                )

        # Log vector configurations for verification
        for name, config in vectors_config.items():
            logging.info(f"Vector '{name}': size={config.size}, distance={config.distance}")

        return vectors_config
    
    def _setup_collection_schema(
        self,
        collection_name: str,
        datasets: List[Any],
        text_field: str,
        sample_size: int
    ):
        """Set up collection schema and indexes."""
        logging.info("Inferring and creating payload indexes...")
        
        all_samples = []
        for dataset in datasets:
            samples = self._get_dataset_sample(dataset, text_field, sample_size)
            all_samples.extend(samples)
            
        if all_samples:
            schema = self._infer_payload_schema(all_samples)
            
            for field_name, field_config in schema.items():
                try:
                    if field_name == "sparse":
                        continue
                        
                    field_type = field_config["type"]
                    if field_type == models.PayloadSchemaType.TEXT:
                        self.client.create_payload_index(
                            collection_name=collection_name,
                            field_name=field_name,
                            field_schema="text",
                            field_index_params=models.TextIndexParams(
                                type="text",
                                tokenizer=models.TokenizerType.WORD,
                                lowercase=True
                            )
                        )
                    else:
                        self.client.create_payload_index(
                            collection_name=collection_name,
                            field_name=field_name,
                            field_schema=str(field_type).split('.')[-1].lower()
                        )
                    
                    logging.info(f"Created index for field '{field_name}' with type '{field_type}'")
                except Exception as e:
                    logging.warning(f"Could not create index for {field_name}: {e}")
                    continue

    def _get_dataset_sample(
        self,
        dataset: Any,
        text_field: str,
        sample_size: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get a sample of documents from a dataset for schema inference.
        """
        sample_docs = []
        try:
            for item in dataset:
                if len(sample_docs) >= sample_size:
                    break
                    
                if text_field in item:
                    doc = {
                        "document": item[text_field],
                        "id": str(item.get("id", uuid.uuid4())),
                        **{k: v for k, v in item.items() if k not in [text_field, "id"]}
                    }
                    sample_docs.append(doc)
                    
            return sample_docs
        except Exception as e:
            logging.error(f"Failed to get sample documents: {e}")
            logging.error(traceback.format_exc())
            raise

    def _infer_payload_schema(self, sample_docs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Generate payload schema from sample documents with proper type detection.
        Preserves all the field detection logic from the original while adding text field handling.
        """
        # Get the predefined text field
        text_field = getattr(self, 'text_field', 'document')
        
        payload_data = {}
        schema = {}
        field_types = {}

        # First pass: collect ALL fields and their values (exactly like original)
        for doc in sample_docs:
            for field, value in doc.items():
                if field not in payload_data:
                    payload_data[field] = []
                    field_types[field] = set()
                
                payload_data[field].append(value)
                
                # Track types, including list contents
                if isinstance(value, list):
                    if value:
                        field_types[field].add(f"list_{type(value[0]).__name__}")
                        for item in value:
                            payload_data[field].append(item)
                else:
                    field_types[field].add(type(value).__name__)

        # ISO datetime pattern
        date_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$')

        # Second pass: determine schema types
        for field, values in payload_data.items():
            if field == "sparse":
                continue
            
            types = field_types[field]
            
            # Log field discovery
            logging.info(f"Processing field: {field} with types: {types}")
            
            # Handle the predefined text field
            if field == text_field:
                field_type = models.PayloadSchemaType.TEXT
            else:
                # Infer type from content
                non_null_values = [v for v in values if v is not None]
                
                if not non_null_values:
                    field_type = models.PayloadSchemaType.KEYWORD
                elif all(isinstance(v, bool) for v in non_null_values):
                    field_type = models.PayloadSchemaType.BOOL
                elif all(isinstance(v, int) and not isinstance(v, bool) for v in non_null_values):
                    field_type = models.PayloadSchemaType.INTEGER
                elif all(isinstance(v, float) for v in non_null_values):
                    field_type = models.PayloadSchemaType.FLOAT
                elif all(isinstance(v, str) for v in non_null_values):
                    # Sample for performance on large datasets
                    sample_values = non_null_values[:100]
                    
                    # Check for dates first
                    if all(date_pattern.match(str(v)) for v in sample_values[:20]):
                        field_type = models.PayloadSchemaType.DATETIME
                    elif all(str(v).isdigit() for v in sample_values):
                        field_type = models.PayloadSchemaType.INTEGER
                    elif all(re.match(r'^\d+\.\d+$', str(v)) for v in sample_values):
                        field_type = models.PayloadSchemaType.FLOAT
                    elif all(len(str(v)) < 50 for v in sample_values):
                        field_type = models.PayloadSchemaType.KEYWORD
                    else:
                        field_type = models.PayloadSchemaType.TEXT
                else:
                    field_type = models.PayloadSchemaType.KEYWORD

            schema[field] = {
                "type": field_type,
                "index": True
            }
            
            logging.info(f"Decided type for {field}: {field_type}")

        return schema

    def _create_payload_schema(self, schema: Dict[str, models.PayloadSchemaType]) -> Dict[str, models.PayloadField]:
        """
        Create PayloadField objects from schema.
        """
        payload_schema = {}
        for field_name, field_type in schema.items():
            payload_schema[field_name] = models.PayloadField(
                key=field_name,
                data_type=field_type
            )
        return payload_schema
    
    def generate_calibration_embeddings(self) -> np.ndarray:
        """
        Generate calibration embeddings for quantization.
        """
        logging.info("Generating calibration embeddings...")
        try:
        
            calibration_dataset = load_dataset(
                "macadeliccc/US-SupremeCourtVerdicts",
                split=f"train[:{self.calibration_sample_size}]",
                streaming=True,
            )
            calibration_texts = calibration_dataset["document"]

            calibration_embeddings = self.dense_model.encode(
                calibration_texts,
                batch_size=32,
                show_progress_bar=False,
                convert_to_tensor=True
            )

            logging.info("Calibration embeddings generated successfully.")
            return calibration_embeddings.cpu().numpy()
        except Exception as e:
            logging.error(f"Error generating calibration embeddings: {e}")
            logging.error(traceback.format_exc())
            raise

    def recreate_collection(
        self,
        collection_name: str,
        datasets: List[Any] = None,
        text_field: str = None,
        sample_size: int = 5
    ):
        """
        Create a Qdrant collection with automatic schema inference and proper payload indexing.
        
        Args:
            collection_name (str): Name of the collection to create
            datasets (List[Any], optional): List of datasets to analyze for schema inference
            text_field (str, optional): Name of the text field in the datasets
            sample_size (int, optional): Number of samples per dataset for schema inference
        """
        # At the beginning of any method that needs models
        if not hasattr(self, 'dense_model') or self.dense_model is None:
            self._load_model_components()
        try:
            # Collection existence check and deletion if needed
            if self.client.collection_exists(collection_name):
                logging.info(f"Collection '{collection_name}' already exists. Deleting it...")
                self.client.delete_collection(collection_name)
                logging.info(f"Collection '{collection_name}' deleted successfully.")

            # Create base collection first
            creation_params = {
                "collection_name": collection_name,
                "vectors_config": self._build_vectors_config(),
                "on_disk_payload": True,
                "sparse_vectors_config": {
                    "sparse": models.SparseVectorParams(
                        index=models.SparseIndexParams(on_disk=False)
                    )
                }
            }

            self.client.recreate_collection(**creation_params)
            logging.info(f"Collection '{collection_name}' created successfully.")

            # Infer and create payload indexes if datasets provided
            if datasets and text_field:
                logging.info("Inferring and creating payload indexes...")
                
                all_samples = []
                for dataset in datasets:
                    samples = self._get_dataset_sample(
                        dataset=dataset,
                        text_field=text_field,
                        sample_size=sample_size
                    )
                    all_samples.extend(samples)
                    
                if all_samples:
                    schema = self._infer_payload_schema(all_samples)
                    
                    # Create payload indexes according to schema
                    for field_name, field_config in schema.items():
                        try:
                            # Skip sparse vector field
                            if field_name == "sparse":
                                continue
                                
                            # Default to text for long string fields
                            field_type = field_config["type"]
                            
                            if field_type == models.PayloadSchemaType.TEXT:
                                # Create text index with updated parameters structure
                                self.client.create_payload_index(
                                    collection_name=collection_name,
                                    field_name=field_name,
                                    field_schema=models.TextIndexParams(
                                        type="text",
                                        tokenizer=models.TokenizerType.WORD,
                                        lowercase=True
                                    )
                                )
                            else:
                                # Create regular field index with appropriate schema type
                                field_schema = str(field_type).split('.')[-1].lower()
                                self.client.create_payload_index(
                                    collection_name=collection_name,
                                    field_name=field_name,
                                    field_schema=field_schema
                                )
                            
                            logging.info(f"Created index for field '{field_name}' with type '{field_type}'")
                        except Exception as e:
                            logging.warning(f"Could not create index for {field_name}: {e}")
                            continue

        except Exception as e:
            logging.error(f"Failed during collection creation: {e}")
            logging.error(traceback.format_exc())
            raise
    
    def insert_documents(
        self,
        dataset_name: str,
        text_field: str,
        split: str = "train",
        max_samples: int = None,
        cache_dir: str = None,
        batch_size: int = 100
    ):
        """
        Load a Hugging Face dataset and insert its documents into the Qdrant collection.
        """
        logging.info(f"Loading dataset: {dataset_name}")

        cache_dir = cache_dir or os.path.join(os.getcwd(), "hf_cache")
        os.makedirs(cache_dir, exist_ok=True)

        try:
            # Load dataset
            dataset = load_dataset(
                dataset_name,
                split=split,
                streaming=True,
                cache_dir=cache_dir
            )
            
            # Convert dataset to list for better progress tracking
            documents = []
            for item in dataset:  # Removed tqdm here
                if max_samples and len(documents) >= max_samples:
                    break
                    
                if text_field in item:
                    doc = {
                        "document": item[text_field],
                        "id": str(item.get("id", uuid.uuid4())),
                        **{k: v for k, v in item.items() if k not in [text_field, "id"]}
                    }
                    documents.append(doc)
            
            total_docs = len(documents)
            logging.info(f"Loaded {total_docs} documents for processing")
            
            # Process documents in batches
            batches = [documents[i:i + batch_size] for i in range(0, len(documents), batch_size)]
            
            for batch in batches:  # No tqdm here either
                self.process_and_insert_batch(batch)
            
            logging.info(f"Successfully processed and inserted {total_docs} documents")
            
        except Exception as e:
            logging.error(f"Failed during dataset processing: {e}")
            logging.error(traceback.format_exc())

    async def process_and_insert_batch(
        self,
        collection_name: str,
        batch: List[Dict[str, Any]]
    ):
        """Process and insert a batch of documents into the specified collection with parallel processing."""
        try:
            # Ensure models are loaded before processing
            if not hasattr(self, 'dense_model') or self.dense_model is None:
                self._load_model_components()
                            
            from concurrent.futures import ThreadPoolExecutor
            import os
            
            def process_document(doc):
                """Process a single document in a worker thread"""
                try:
                    # Make sure document is a valid string
                    document_text = doc.get("document", "")
                    if not isinstance(document_text, str) or not document_text.strip():
                        logging.warning(f"Invalid document text for ID {doc.get('id', 'unknown')}, skipping")
                        return None
                        
                    dense_vectors = self.get_dense_embedding(doc["document"])
                    sparse_vector = self.get_sparse_embedding(doc["document"], is_query=False)
                    payload = doc.copy()
                    payload.pop('id', None)
                    payload["sparse"] = sparse_vector
                    vector = {"dense": dense_vectors["dense"]}
                    if hasattr(self, 'BUILD_WITH_QUANTIZED') and self.BUILD_WITH_QUANTIZED and "dense-uint8" in dense_vectors:
                        vector["dense-uint8"] = dense_vectors["dense-uint8"]
                        
                    return models.PointStruct(
                        id=doc["id"],
                        vector=vector,
                        payload=payload
                    )
                except Exception as doc_e:
                    logging.error(f"Error processing document ID {doc.get('id', 'unknown')}: {doc_e}")
                    return None
            
            # Determine optimal thread count based on CPU cores and batch size
            cpu_count = os.cpu_count() or 4
            # Use fewer threads for very small batches to avoid overhead
            max_workers = min(max(cpu_count - 1, 2), len(batch), 32)
            
            points = []
            # Process documents in parallel using thread pool
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Map the processing function across all documents
                futures = list(executor.map(process_document, batch))
                # Filter out None results (failed documents)
                points = [point for point in futures if point is not None]
                
            if points:
                # Try up to 3 times with exponential backoff
                for attempt in range(3):
                    try:
                        # Single upsert operation for all successfully processed points
                        self.client.upsert(
                            collection_name=collection_name,
                            points=points
                        )
                        logging.info(f"Successfully inserted {len(points)} points out of {len(batch)} documents")
                        break
                    except Exception as e:
                        if attempt < 2:  # If not the last attempt
                            logging.warning(f"Error inserting batch (attempt {attempt+1}/3): {e}, retrying...")
                            await asyncio.sleep(1 * (attempt + 1))  # Exponential backoff
                        else:
                            logging.error(f"Failed to insert batch after 3 attempts: {e}")
                            raise  # Re-raise on final attempt
            else:
                logging.warning("No valid points to insert after processing batch")
                
        except Exception as e:
            logging.error(f"Error processing batch: {e}")
            logging.error(traceback.format_exc())

    def get_dense_embedding(self, text: str) -> Dict[str, Union[List[float], List[int]]]:
        """
        Generate dense embeddings for the given text.
        """
        # At the beginning of any method that needs models
        if not hasattr(self, 'dense_model') or self.dense_model is None:
            self._load_model_components()
        dense_vector = self.dense_model.encode(text, convert_to_tensor=True, show_progress_bar=False).cpu().numpy()
        if self.USE_MATRYOSHKA:
            matryoshka_vectors = {}
            for i in range(self.MATRYOSHKA_LEVELS):
                size = dense_vector.shape[0] // (2 ** i)
                matryoshka_vectors[f"matryoshka-{size}dim"] = dense_vector[:size].tolist()
            return matryoshka_vectors
        else:
            result = {"dense": dense_vector.tolist()}
            if self.BUILD_WITH_QUANTIZED:
                uint8_vector = self.quantize_vector(dense_vector)
                result["dense-uint8"] = uint8_vector.tolist()
            return result

    def quantize_vector(self, vector: np.ndarray) -> np.ndarray:
        """
        Quantize dense vectors to int8.
        """
        if self.calibration_embeddings is None:
            raise ValueError("Calibration embeddings are not available. Ensure quantization is enabled and calibrated.")

        logging.debug(f"Original vector type: {type(vector)}, shape: {vector.shape}")
        vector_tensor = torch.tensor(vector).unsqueeze(0)  # Add batch dimension
        logging.debug(f"Vector tensor type: {type(vector_tensor)}, shape: {vector_tensor.shape}")

        uint8_embeddings = quantize_embeddings(
            vector_tensor,
            precision="int8",
            calibration_embeddings=self.calibration_embeddings
        )
        logging.debug(f"Quantized embeddings type: {type(uint8_embeddings)}, shape: {uint8_embeddings.shape}")

        return uint8_embeddings.squeeze()  # Already a NumPy array

    def get_sparse_embedding(self, text: str, is_query: bool = False) -> Any:
        # At the beginning of any method that needs models
        if not hasattr(self, 'dense_model') or self.dense_model is None:
            self._load_model_components()
        indices, vecs = self.sparse_vectors([text], is_query)
        return list(zip(indices[0], vecs[0])) if indices and vecs else []

    def sparse_vectors(self, texts: List[str], is_query: bool) -> Tuple[List[List[int]], List[List[float]]]:
        """
        Generate sparse vectors for the given texts using the appropriate model.
        """
        model = self.query_model if is_query else self.doc_model
        tokenizer = self.query_tokenizer if is_query else self.doc_tokenizer

        tokens = tokenizer(texts, truncation=True, padding=True, return_tensors="pt")
        tokens = tokens.to(self.device)  # Move tokens to the correct device

        output = model(**tokens)
        logits, attention_mask = output.logits, tokens.attention_mask
        relu_log = torch.log(1 + torch.relu(logits))
        weighted_log = relu_log * attention_mask.unsqueeze(-1)
        tvecs, _ = torch.max(weighted_log, dim=1)

        indices = []
        vecs = []
        for batch in tvecs:
            nonzero_indices = batch.nonzero(as_tuple=True)[0].tolist()
            nonzero_values = batch[nonzero_indices].tolist() if nonzero_indices else []
            indices.append(nonzero_indices)
            vecs.append(nonzero_values)

        return indices, vecs

    def simple_search(self, query: str, filter_params: Dict[str, Any] = None, limit: int = 2):
        """
        Perform a simple search using dense embeddings.

        Args:
            query (str): The search query.
            filter_params (Dict[str, Any], optional): Filter parameters. Defaults to None.
            limit (int, optional): Number of results to return. Defaults to 2.
        """
        dense_query_vector = self.get_dense_embedding(query)

        search_filter = create_filter(filter_params) if filter_params else None

        vector_name = "dense"  # Always use 'dense' for simple search
        query_vector = models.NamedVector(
            name=vector_name,
            vector=dense_query_vector[vector_name].tolist()
        )

        print(f"Performing simple search for query: '{query}'")
        try:
            search_result = self.client.search(
                collection_name=self.COLLECTION_NAME,
                query_vector=query_vector,
                query_filter=search_filter,
                with_payload=True,
                limit=limit
            )

            print("Simple search results:")
            for result in search_result:
                print(f"ID: {result.id}, Score: {result.score}, Payload: {result.payload}")
        except Exception as e:
            logging.error(f"Error during simple search: {e}")
            logging.error(traceback.format_exc())

    async def advanced_search(
        self,
        collection_name: str,
        query: str,
        filter_params: Dict[str, Any] = None,
        top_k: int = 10
    ) -> List[TextNode]:
        """Execute hybrid search on the specified collection."""
        try:
            dense_vectors = self.get_dense_embedding(query)
            sparse_indices, sparse_values = self.sparse_vectors([query], is_query=True)

            search_params = models.SearchParams(hnsw_ef=128, exact=False)
            prefetch = []

            if self.USE_MATRYOSHKA:
                dim = self.dense_model.get_sentence_embedding_dimension()
                matryoshka_prefetch = models.Prefetch(
                    prefetch=[
                        models.Prefetch(
                            prefetch=[
                                models.Prefetch(
                                    query=dense_vectors[f"matryoshka-{dim//4}dim"],
                                    using=f"matryoshka-{dim//4}dim",
                                    params=search_params,
                                    limit=100,
                                ),
                            ],
                            query=dense_vectors[f"matryoshka-{dim//2}dim"],
                            using=f"matryoshka-{dim//2}dim",
                            params=search_params,
                            limit=50,
                        )
                    ],
                    query=dense_vectors[f"matryoshka-{dim}dim"],
                    using=f"matryoshka-{dim}dim",
                    params=search_params,
                    limit=25,
                )
                prefetch.append(matryoshka_prefetch)
            elif self.BUILD_WITH_QUANTIZED and "dense-uint8" in dense_vectors:
                quantized_prefetch = models.Prefetch(
                    prefetch=[
                        models.Prefetch(
                            query=dense_vectors["dense-uint8"],
                            using="dense-uint8",
                            params=search_params,
                            limit=100,
                        )
                    ],
                    query=dense_vectors["dense"],
                    using="dense",
                    params=search_params,
                    limit=top_k * 2,
                )
                prefetch.append(quantized_prefetch)
            else:
                dense_prefetch = models.Prefetch(
                    query=dense_vectors["dense"],
                    using="dense",
                    params=search_params,
                    limit=top_k * 2,
                )
                prefetch.append(dense_prefetch)

            sparse_prefetch = models.Prefetch(
                query=models.SparseVector(
                    indices=sparse_indices[0],
                    values=sparse_values[0],
                ),
                using="sparse",
                params=search_params,
                limit=top_k * 2,
            )
            prefetch.append(sparse_prefetch)

            fusion_prefetch = models.Prefetch(
                prefetch=prefetch,
                query=models.FusionQuery(fusion=models.Fusion.RRF),
            )

            search_filter = self._create_filter(filter_params) if filter_params else None

            if self.USE_MATRYOSHKA:
                dim = self.dense_model.get_sentence_embedding_dimension()
                primary_vector = dense_vectors[f"matryoshka-{dim}dim"]
                using_vector = f"matryoshka-{dim}dim"
            elif self.BUILD_WITH_QUANTIZED and "dense-uint8" in dense_vectors:
                primary_vector = dense_vectors["dense-uint8"]
                using_vector = "dense-uint8"
            else:
                primary_vector = dense_vectors["dense"]
                using_vector = "dense"

            search_result = self.client.query_points(
                collection_name=collection_name,
                prefetch=[fusion_prefetch],
                query=primary_vector,
                query_filter=search_filter,
                using=using_vector,
                with_payload=True,
                limit=top_k,
                search_params=search_params,
            )

            return self._process_search_results(search_result.points)

        except Exception as e:
            logging.error(f"Search failed: {str(e)}")
            logging.error(traceback.format_exc())
            return []


    def _process_search_results(self, results: List[models.ScoredPoint]) -> List[TextNode]:
        """
        Convert Qdrant search results to TextNode objects.
        """
        text_nodes = []
        for result in results:
            text_node = self._convert_to_text_node(result)
            text_nodes.append(text_node)
        return text_nodes

    def _convert_to_text_node(self, result: models.ScoredPoint) -> TextNode:
        """
        Convert a single Qdrant ScoredPoint to a TextNode.
        """
        doc_id = str(result.id)
        metadata = {key: value for key, value in result.payload.items() if key != 'sparse'}
        metadata['score'] = result.score
        text = metadata.pop('document', '')
        dense_embedding = np.array(result.vector.get('dense', [])) if result.vector else np.array([])
        sparse_embedding = result.payload.get('sparse', [])
        sparse_indices, sparse_values = zip(*sparse_embedding) if sparse_embedding else ([], [])
        combined_embedding = dense_embedding.tolist() + list(sparse_values)

        return TextNode(
            text=text,
            id_=doc_id,
            embedding=combined_embedding,
            metadata=metadata
        )

    def _create_filter(self, filter_params: Dict[str, Any]) -> models.Filter:
        """
        Create a Qdrant filter with json input.
        """
        builder = FilterBuilder()
        if 'must' in filter_params:
            builder.add_must(filter_params['must'])
        if 'should' in filter_params:
            builder.add_should(filter_params['should'])
        if 'must_not' in filter_params:
            builder.add_must_not(filter_params['must_not'])
        return builder.build()
