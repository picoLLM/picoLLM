from typing import List, Tuple, Dict, Any, Union, Optional
import traceback
import logging
import asyncio
import uuid
import re

from sentence_transformers.quantization import quantize_embeddings

from datasets import load_dataset
from qdrant_client.http import models
from qdrant_client import QdrantClient
import numpy as np

from utils.nodes import TextNode
from embeddings.models import EmbeddingModels 
from routes.collections.filters import FilterBuilder

import warnings
warnings.filterwarnings(
    "ignore", message="`clean_up_tokenization_spaces` was not set.*")

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
        host: str = "qdrant",
        port: int = 6333
    ):
        """
        Initialize QdrantDBManager with optional deferred model loading.

        Args:
            embeddings: EmbeddingModels instance containing all necessary models (optional)
            host: Qdrant server host
            port: Qdrant server port
        """
        self.client = QdrantClient(host, port=port)
        self.embeddings = embeddings
        
        # Initialize model components if embeddings are provided
        if self.embeddings:
            self._load_model_components()

    def _load_model_components(self):
        """Load all model components from embeddings"""
        if not self.embeddings:
            self.embeddings = EmbeddingModels()

        # Ensure models are initialized
        if not any([self.embeddings.dense, self.embeddings.query_sparse, self.embeddings.doc_sparse]):
            logging.info("Models not initialized, initializing now...")
            self.embeddings.initialize()

        self.device = self.embeddings.device
        
        self.dense_model = self.embeddings.dense
        self.query_sparse_model = self.embeddings.query_sparse
        self.doc_sparse_model = self.embeddings.doc_sparse

        # Backward compatibility aliases
        self.query_model = self.embeddings.query_sparse
        self.doc_model = self.embeddings.doc_sparse

    def _build_vectors_config(
        self, 
        build_with_quantized: bool = False,
        use_matryoshka: bool = False,
        matryoshka_levels: int = 3
    ) -> Dict[str, models.VectorParams]:
        """
        Build the vectors configuration for the Qdrant collection.

        Args:
            build_with_quantized: Whether to include quantized vectors
            use_matryoshka: Whether to use matryoshka embeddings
            matryoshka_levels: Number of matryoshka embedding levels

        Returns:
            Dict[str, models.VectorParams]: The vectors configuration.
        """
        # Ensure models are loaded
        if not hasattr(self, 'dense_model') or self.dense_model is None:
            self._load_model_components()
            
        vectors_config = {}

        if use_matryoshka:
            for i in range(matryoshka_levels):
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
            # Conditionally include the quantized dense vector
            if build_with_quantized:
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
            logging.info(
                f"Vector '{name}': size={config.size}, distance={config.distance}")

        return vectors_config

    def recreate_collection(
        self,
        collection_name: str,
        datasets: List[Any] = None,
        text_field: str = None,
        sample_size: int = 5,
        build_with_quantized: bool = False,
        use_matryoshka: bool = False,
        matryoshka_levels: int = 3
    ):
        """
        Create a Qdrant collection with automatic schema inference and proper payload indexing.

        Args:
            collection_name (str): Name of the collection to create
            datasets (List[Any], optional): List of datasets to analyze for schema inference
            text_field (str, optional): Name of the text field in the datasets
            sample_size (int, optional): Number of samples per dataset for schema inference
            build_with_quantized (bool): Whether to include quantized vectors
            use_matryoshka (bool): Whether to use matryoshka embeddings
            matryoshka_levels (int): Number of matryoshka embedding levels
        """
        # At the beginning of any method that needs models
        if not hasattr(self, 'dense_model') or self.dense_model is None:
            self._load_model_components()
        try:
            # Collection existence check and deletion if needed
            if self.client.collection_exists(collection_name):
                logging.info(
                    f"Collection '{collection_name}' already exists. Deleting it...")
                self.client.delete_collection(collection_name)
                logging.info(
                    f"Collection '{collection_name}' deleted successfully.")

            # Create base collection first
            creation_params = {
                "collection_name": collection_name,
                "vectors_config": self._build_vectors_config(
                    build_with_quantized=build_with_quantized,
                    use_matryoshka=use_matryoshka,
                    matryoshka_levels=matryoshka_levels
                ),
                "on_disk_payload": True,
                "sparse_vectors_config": {
                    "sparse": models.SparseVectorParams(
                        index=models.SparseIndexParams(on_disk=False)
                    )
                }
            }

            self.client.recreate_collection(**creation_params)
            logging.info(
                f"Collection '{collection_name}' created successfully.")

            # Infer and create payload indexes if datasets provided
            if datasets and text_field:
                self._setup_collection_schema(
                    collection_name=collection_name,
                    datasets=datasets,
                    text_field=text_field,
                    sample_size=sample_size
                )

        except Exception as e:
            logging.error(f"Failed during collection creation: {e}")
            logging.error(traceback.format_exc())
            raise

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
            samples = self._get_dataset_sample(
                dataset, text_field, sample_size)
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
                            field_schema=models.TextIndexParams(
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

                    logging.info(
                        f"Created index for field '{field_name}' with type '{field_type}'")
                except Exception as e:
                    logging.warning(
                        f"Could not create index for {field_name}: {e}")
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
        """
        # Get the predefined text field
        text_field = getattr(self, 'text_field', 'document')

        payload_data = {}
        schema = {}
        field_types = {}

        # First pass: collect ALL fields and their values
        for doc in sample_docs:
            for field, value in doc.items():
                if field not in payload_data:
                    payload_data[field] = []
                    field_types[field] = set()

                payload_data[field].append(value)

                # Track types, including list contents
                if isinstance(value, list):
                    if value:
                        field_types[field].add(
                            f"list_{type(value[0]).__name__}")
                        for item in value:
                            payload_data[field].append(item)
                else:
                    field_types[field].add(type(value).__name__)

        # ISO datetime pattern
        date_pattern = re.compile(
            r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$')

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

    async def process_and_insert_batch(
        self, 
        collection_name: str, 
        batch: List[Dict[str, Any]],
        build_with_quantized: bool = False,
        calibration_embeddings: Optional[np.ndarray] = None
    ):
        """
        Process and insert a batch of documents with optimized sparse encoding.
        
        Args:
            collection_name: Name of the collection
            batch: List of documents to insert
            build_with_quantized: Whether to include quantized vectors
            calibration_embeddings: Calibration embeddings for quantization (required if build_with_quantized=True)
        """
        try:
            if not hasattr(self, 'dense_model') or self.dense_model is None:
                self._load_model_components()

            # Extract valid documents and texts
            texts = []
            valid_docs = []
            for doc in batch:
                document_text = doc.get("document", "")
                if isinstance(document_text, str) and document_text.strip():
                    texts.append(document_text)
                    valid_docs.append(doc)
                else:
                    logging.warning(
                        f"Invalid document text for ID {doc.get('id', 'unknown')}, skipping")

            if not texts:
                logging.warning("No valid documents in batch")
                return

            # Batch encode all texts at once for efficiency
            logging.debug(f"Encoding {len(texts)} texts...")

            # Dense embeddings
            dense_embeddings = self.dense_model.encode(
                texts,
                batch_size=32,
                convert_to_tensor=True,
                show_progress_bar=False
            ).cpu().numpy()

            # Sparse embeddings - using batch encoding
            sparse_indices, sparse_values = self.sparse_vectors(
                texts, is_query=False)

            # Create points
            points = []
            for idx, (doc, dense_emb, sparse_idx, sparse_val) in enumerate(
                zip(valid_docs, dense_embeddings, sparse_indices, sparse_values)
            ):
                payload = doc.copy()
                payload.pop('id', None)
                payload["sparse"] = list(zip(sparse_idx, sparse_val))

                vector = {"dense": dense_emb.tolist()}
                if build_with_quantized:
                    if calibration_embeddings is None:
                        raise ValueError("Calibration embeddings required for quantization")
                    uint8_vector = self.quantize_vector(dense_emb, calibration_embeddings)
                    vector["dense-uint8"] = uint8_vector.tolist()

                points.append(models.PointStruct(
                    id=doc["id"],
                    vector=vector,
                    payload=payload
                ))

            # Insert with retry logic
            for attempt in range(3):
                try:
                    self.client.upsert(
                        collection_name=collection_name, points=points)
                    logging.info(f"Successfully inserted {len(points)} points")
                    break
                except Exception as e:
                    if attempt < 2:
                        logging.warning(
                            f"Error inserting batch (attempt {attempt+1}/3): {e}, retrying...")
                        await asyncio.sleep(1 * (attempt + 1))
                    else:
                        logging.error(
                            f"Failed to insert batch after 3 attempts: {e}")
                        raise

        except Exception as e:
            logging.error(f"Error processing batch: {e}")
            logging.error(traceback.format_exc())

    def get_dense_embedding(self, text: str, **kwargs) -> Dict[str, Union[List[float], List[int]]]:
        """Generate dense embeddings for the given text."""
        if not self.embeddings:
            self._load_model_components()
        return self.embeddings.get_dense_embedding(text, **kwargs)
    
    def generate_calibration_embeddings(self, calibration_sample_size: int = 120) -> np.ndarray:
        """
        Generate calibration embeddings for quantization.
        
        Args:
            calibration_sample_size: Number of samples to use for calibration
        """
        logging.info("Generating calibration embeddings...")
        try:
            if not hasattr(self, 'dense_model') or self.dense_model is None:
                self._load_model_components()
                
            calibration_dataset = load_dataset(
                "macadeliccc/US-SupremeCourtVerdicts",
                split=f"train[:{calibration_sample_size}]",
                streaming=True,
            )
            calibration_texts = [item["document"] for item in calibration_dataset]

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

    def quantize_vector(self, vector: np.ndarray, calibration_embeddings: np.ndarray) -> np.ndarray:
        """
        Quantize dense vectors to int8.
        
        Args:
            vector: Vector to quantize
            calibration_embeddings: Calibration embeddings for quantization
        """
        logging.debug(
            f"Original vector type: {type(vector)}, shape: {vector.shape}")

        if vector.ndim == 1:
            vector = vector.reshape(1, -1)

        uint8_embeddings = quantize_embeddings(
            vector,
            precision="int8",
            calibration_embeddings=calibration_embeddings
        )

        logging.debug(
            f"Quantized embeddings type: {type(uint8_embeddings)}, shape: {uint8_embeddings.shape}")

        # Remove batch dimension if it was added
        if uint8_embeddings.shape[0] == 1:
            return uint8_embeddings[0]

        return uint8_embeddings

    def get_sparse_embedding(self, text: str, is_query: bool = False) -> Any:
        """Generate sparse embedding."""
        if not self.embeddings:
            self._load_model_components()
        return self.embeddings.get_sparse_embedding(text, is_query)

    def sparse_vectors(self, texts: List[str], is_query: bool) -> Tuple[List[List[int]], List[List[float]]]:
        """Generate sparse vectors for batch processing."""
        if not hasattr(self, 'query_sparse_model') or self.query_sparse_model is None:
            self._load_model_components()

        model = self.query_sparse_model if is_query else self.doc_sparse_model
        embeddings = model.encode(texts)

        indices_list = []
        values_list = []

        for i in range(len(texts)):
            indices, values = self._extract_sparse_indices_values(
                embeddings, i)
            indices_list.append(indices)
            values_list.append(values)

        return indices_list, values_list

    def _extract_sparse_indices_values(self, embeddings, index: int) -> Tuple[List[int], List[float]]:
        """Extract indices and values from sparse embeddings.

        Handles both scipy sparse matrices and torch sparse tensors.
        """
        # Handle scipy sparse matrix format (most common from SparseEncoder)
        if hasattr(embeddings, 'tocoo'):
            if len(embeddings.shape) == 1:
                # Single embedding returned as 1D
                coo = embeddings.tocoo()
                return coo.col.tolist(), coo.data.tolist()
            else:
                # Batch - get specific row
                row = embeddings.getrow(index).tocoo()
                return row.col.tolist(), row.data.tolist()

        # Handle torch sparse tensor format
        elif hasattr(embeddings, 'is_sparse') and embeddings.is_sparse:
            # Coalesce the tensor first to avoid the error
            embeddings = embeddings.coalesce()

            if embeddings.dim() == 1:
                # Single embedding
                indices = embeddings.indices().tolist()
                values = embeddings.values().tolist()
                return indices, values
            else:
                # Batch - extract specific embedding
                # Get all indices and values
                all_indices = embeddings.indices()
                all_values = embeddings.values()

                # Find entries for the specific row
                row_mask = all_indices[0] == index
                col_indices = all_indices[1][row_mask].tolist()
                row_values = all_values[row_mask].tolist()

                return col_indices, row_values

        elif hasattr(embeddings, 'shape'):
            import numpy as np

            if len(embeddings.shape) == 1:
                nonzero = np.nonzero(embeddings)[0]
                return nonzero.tolist(), embeddings[nonzero].tolist()
            else:
                row = embeddings[index]
                nonzero = np.nonzero(row)[0]
                return nonzero.tolist(), row[nonzero].tolist()

        else:
            raise ValueError(f"Unknown embedding format: {type(embeddings)}")

    async def advanced_search(
        self,
        collection_name: str,
        query: str,
        filter_params: Dict[str, Any] = None,
        top_k: int = 10,
        use_matryoshka: bool = False,
        matryoshka_levels: int = 3,
        build_with_quantized: bool = False,
        calibration_embeddings: Optional[np.ndarray] = None
    ) -> List[TextNode]:
        """
        Execute hybrid search on the specified collection.
        
        Args:
            collection_name: Name of collection to search
            query: Search query
            filter_params: Optional filters
            top_k: Number of results to return
            use_matryoshka: Whether the collection uses matryoshka embeddings
            matryoshka_levels: Number of matryoshka levels if enabled
            build_with_quantized: Whether the collection has quantized vectors
            calibration_embeddings: Calibration embeddings if using quantization
        """
        try:
            # Ensure models are loaded
            if not hasattr(self, 'dense_model') or self.dense_model is None:
                self._load_model_components()
                    
            dense_vectors = self.get_dense_embedding(
                query, 
                use_matryoshka=use_matryoshka,
                matryoshka_levels=matryoshka_levels,
                build_with_quantized=build_with_quantized,
                calibration_embeddings=calibration_embeddings
            )
            sparse_indices, sparse_values = self.sparse_vectors(
                [query], is_query=True)

            search_params = models.SearchParams(hnsw_ef=128, exact=False)
            prefetch = []

            if use_matryoshka:
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
            elif build_with_quantized and "dense-uint8" in dense_vectors:
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

            search_filter = self._create_filter(
                filter_params) if filter_params else None

            if use_matryoshka:
                dim = self.dense_model.get_sentence_embedding_dimension()
                primary_vector = dense_vectors[f"matryoshka-{dim}dim"]
                using_vector = f"matryoshka-{dim}dim"
            elif build_with_quantized and "dense-uint8" in dense_vectors:
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
        metadata = {key: value for key,
                    value in result.payload.items() if key != 'sparse'}
        metadata['score'] = result.score
        text = metadata.pop('document', '')
        dense_embedding = np.array(result.vector.get(
            'dense', [])) if result.vector else np.array([])
        sparse_embedding = result.payload.get('sparse', [])
        sparse_indices, sparse_values = zip(
            *sparse_embedding) if sparse_embedding else ([], [])
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