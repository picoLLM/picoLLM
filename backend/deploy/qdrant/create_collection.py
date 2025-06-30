import argparse
import gc
import os
import sys
from typing import Any, List
import asyncio

from datasets import load_dataset
from dotenv import load_dotenv
from tqdm import tqdm
from utils.qdrant import QdrantDBManager, ModelManager
import uuid

# Suppress all warnings and logging
import warnings
import logging

warnings.filterwarnings("ignore")
logging.getLogger().setLevel(logging.ERROR)

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a Qdrant collection with hybrid search using the QdrantDBManager"
    )
    
    parser.add_argument(
        "--collection-name",
        type=str,
        required=True,
        help="Name of the collection to create"
    )
    
    parser.add_argument(
        "--dataset-name",
        type=str,
        nargs="+",
        required=True,
        default="macadeliccc/US-SupremeCourtVerdicts",
        help="Names of the datasets to load (from Hub or local path)"
    )
    
    parser.add_argument(
        "--load-from-disk",
        action="store_true",
        help="Load dataset from disk instead of HuggingFace Hub"
    )
    
    parser.add_argument(
        "--split",
        type=str,
        default="train",
        help="Dataset split to load"
    )
    
    parser.add_argument(
        "--text-field",
        type=str,
        default="text",
        help="Field containing the text to index"
    )
    
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for processing"
    )
    
    parser.add_argument(
        "--use-quantization",
        action="store_true",
        help="Enable vector quantization"
    )
    
    parser.add_argument(
        "--use-matryoshka",
        action="store_true",
        help="Enable matryoshka embeddings"
    )

    return parser.parse_args()

def load_datasets(
    dataset_names: List[str],
    load_from_disk: bool,
    split: str
) -> List[Any]:
    datasets = []
    for name in dataset_names:
        try:
            if load_from_disk:
                dataset = load_from_disk(name)
            else:
                dataset = load_dataset(name, split=split, streaming=True)
            datasets.append(dataset)
        except Exception as e:
            print(f"\nError: Failed to load dataset {name}")
            print(f"Details: {str(e)}")
            sys.exit(1)
    return datasets

async def process_documents(
    dataset: Any,
    text_field: str,
    batch_size: int,
    collection_name: str,
    dbms: QdrantDBManager
):
    try:
        print("\nProcessing Dataset:")
        
        # First pass to count total documents
        total_count = 0
        print("→ Counting documents...", end="", flush=True)
        for _ in dataset:
            if text_field in _:
                total_count += 1
        print(f" Found {total_count} documents")
        
        # Reset the dataset iterator
        dataset = dataset.shuffle(seed=42)  # Reset and shuffle
        
        # Convert dataset to list with progress bar
        documents = []
        with tqdm(total=total_count, desc="→ Loading documents", 
                 unit="docs", position=0, leave=True,
                 ncols=80, bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{rate_fmt}]') as pbar:
            for item in dataset:
                if text_field in item:
                    doc = {
                        "document": item[text_field],
                        "id": str(item.get("id", uuid.uuid4())),
                        **{k: v for k, v in item.items() if k not in [text_field, "id"]}
                    }
                    documents.append(doc)
                    pbar.update(1)
        
        # Process documents in batches
        with tqdm(total=len(documents), desc="→ Inserting documents", 
                 unit="docs", position=0, leave=True,
                 ncols=80, bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{rate_fmt}]') as pbar:
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                try:
                    await dbms.process_and_insert_batch(collection_name, batch)
                    pbar.update(len(batch))
                    gc.collect()
                except Exception as e:
                    print(f"\nError processing batch starting at index {i}: {str(e)}")
                    continue
                
    except Exception as e:
        print(f"\nError: Document processing failed")
        print(f"Details: {str(e)}")
        raise

async def main():
    args = parse_args()
    load_dotenv(override=True)
    
    print("\nInitializing Collection Build:")
    print(f"• Collection: {args.collection_name}")
    print(f"• Dataset(s): {', '.join(args.dataset_name)}")
    
    try:
        # Initialize models
        dense_model_name = os.getenv("DENSE_MODEL", "mixedbread-ai/mxbai-embed-large-v1")
        sparse_model_doc = os.getenv("SPARSE_MODEL_DOCS", "naver/efficient-splade-VI-BT-large-doc")
        sparse_model_query = os.getenv("SPARSE_MODEL_QUERY", "naver/efficient-splade-VI-BT-large-query")
        rerank_model_name = os.getenv("RERANK_MODEL", "mixedbread-ai/mxbai-rerank-large-v1")

        print("\nLoading Models:")
        print("→ Initializing model components...", end="", flush=True)
        model_manager = ModelManager.get_instance()
        model_manager.initialize_models(
            query_model_name=sparse_model_query,
            doc_model_name=sparse_model_doc,
            dense_model_name=dense_model_name,
            rerank_model_name=rerank_model_name
        )
        print(" Done")
        
        # Initialize DB Manager
        print("→ Setting up database manager...", end="", flush=True)
        dbms = QdrantDBManager(
            embeddings=model_manager.get_components(),
            build_with_quantized=args.use_quantization,
            use_matryoshka=args.use_matryoshka
        )
        print(" Done")
        
        # Load datasets first
        datasets = load_datasets(
            args.dataset_name,
            args.load_from_disk,
            args.split
        )
        
        # Create collection with schema inferred from all datasets
        print("→ Creating collection with schema inference...", end="", flush=True)
        dbms.recreate_collection(
            collection_name=args.collection_name,
            datasets=datasets,
            text_field=args.text_field
        )
        print(" Done")
        
        # Process datasets
        for dataset in datasets:
            await process_documents(
                dataset=dataset,
                text_field=args.text_field,
                batch_size=args.batch_size,
                collection_name=args.collection_name,
                dbms=dbms
            )

        print("\nCollection build completed successfully!\n")
        
    except Exception as e:
        print(f"\nError: Build process failed")
        print(f"Details: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())