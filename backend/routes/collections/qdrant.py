from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from datetime import datetime
from typing import Dict, Any, List, AsyncGenerator
from datasets import load_dataset, load_dataset_builder
import os
import uuid
import logging
import asyncio
import json
import gc
import torch

import models.http as rest
from .filters import FilterBuilder

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/collections", tags=["qdrant"])

# Shared state for active builds
active_builds: Dict[str, Dict[str, Any]] = {}

# Global reference to qdrant_manager (will be set by main app)
qdrant_manager = None

def set_qdrant_manager(manager):
    """Set the qdrant_manager instance from main app"""
    global qdrant_manager
    qdrant_manager = manager

async def _build_collection_stream(
    dataset_names: List[str],
    collection_name: str,
    split: str = "train",
    text_field: str = "text",
    batch_size: int = 4,
    load_from_disk: bool = False
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Memory-optimized streaming generator for building collections.
    """
    def progress(status: str, message: str, **kwargs) -> Dict[str, Any]:
        return {"status": status, "message": message, **kwargs}
    
    try:
        yield progress("initializing", f"Starting collection build process for '{collection_name}'")
        
        # Disable CUDA if memory is a concern
        if torch.cuda.is_available():
            # Reduce CUDA memory usage
            torch.cuda.empty_cache()
            torch.cuda.set_per_process_memory_fraction(0.5)  # Use only 50% of GPU memory
            yield progress("info", "CUDA acceleration enabled with memory limits")
        else:
            # Limit CPU threads to prevent memory bloat
            torch.set_num_threads(min(4, os.cpu_count()))
            yield progress("info", f"CPU optimization: using {min(4, os.cpu_count())} threads")
        
        # Verify datasets without loading full data
        dataset_info = {}
        
        for name in dataset_names:
            try:
                # Get info without loading data
                builder = load_dataset_builder(name)
                info = builder.info
                
                # Store minimal info
                dataset_info[name] = {
                    'size': info.splits.get(split, {}).num_examples if hasattr(info.splits.get(split, {}), 'num_examples') else None,
                    'features': list(info.features.keys()) if hasattr(info, 'features') else []
                }
                
                # Verify text field exists
                if text_field not in dataset_info[name]['features']:
                    raise ValueError(f"Text field '{text_field}' not found in {name}")
                
                yield progress("verified", f"Verified dataset: {name}", size=dataset_info[name]['size'])
                
            except Exception as e:
                logger.error(f"Failed to verify dataset {name}: {e}")
                yield progress("error", f"Failed to verify dataset {name}: {str(e)}")
                continue
        
        if not dataset_info:
            yield progress("error", "No datasets were successfully verified")
            return

        # Create collection with minimal schema
        yield progress("creating", f"Creating collection '{collection_name}'")
        
        # Load just one sample for schema
        sample_data = None
        for name in dataset_names:
            try:
                sample = load_dataset(
                    name, 
                    split=f"{split}[:1]",  # Just 1 sample
                    trust_remote_code=True
                ) if not load_from_disk else load_dataset(name, split=f"{split}[:1]")
                sample_data = sample
                break
            except:
                continue
        
        if sample_data:
            qdrant_manager.recreate_collection(
                collection_name=collection_name,
                datasets=[sample_data],
                text_field=text_field
            )
            del sample_data  # Free memory immediately
            gc.collect()
    
        
        # Process datasets with aggressive memory management
        total_processed = 0
        
        for idx, name in enumerate(dataset_names):
            try:
                # Force garbage collection before each dataset
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                # Always use streaming to minimize memory
                dataset = load_dataset(
                    name, 
                    split=split,
                    streaming=True,
                    trust_remote_code=True
                ) if not load_from_disk else load_dataset(name, split=split, streaming=True)
                
                # Smaller buffer for shuffle to reduce memory
                dataset = dataset.shuffle(buffer_size=1000, seed=42)
                
                total_count = dataset_info[name].get('size', 10000)
                yield progress(
                    "processing",
                    f"Processing dataset {idx + 1}/{len(dataset_names)}: {name}",
                    total=total_count,
                    streaming=True
                )
                
                processed = 0
                batch = []
                
                # Reduce batch size for memory efficiency
                effective_batch_size = min(batch_size, 4)

                for item in dataset:
                    if text_field not in item:
                        continue
                    
                    # Create minimal document
                    doc = {
                        "document": item[text_field],  # Limit text length
                        "id": str(uuid.uuid4()),  # Generate ID instead of using dataset ID
                        "dataset": name  # Just track source dataset
                    }
                    
                    # Only include essential metadata
                    essential_fields = ['title', 'author', 'date', 'category', 'label']
                    for field in essential_fields:
                        if field in item and field != text_field:
                            doc[field] = item[field]
                    
                    batch.append(doc)
                    
                    if len(batch) >= effective_batch_size:
                        await qdrant_manager.process_and_insert_batch(
                            collection_name=collection_name,
                            batch=batch
                        )
                        processed += len(batch)
                        batch = []
                        
                        yield progress(
                            "inserting",
                            f"Processing {name}",
                            current=processed,
                            total=total_count,
                            dataset=idx + 1,
                            total_datasets=len(dataset_names)
                        )
                        
                        # Aggressive cleanup every few batches
                        if processed % (effective_batch_size * 5) == 0:
                            await asyncio.sleep(0.1)  # Give system time to breathe
                            gc.collect()
                            if torch.cuda.is_available():
                                torch.cuda.empty_cache()
                        
                        # Hard limit to prevent memory overflow
                        if processed >= min(total_count, 50000):  # Max 50k per dataset
                            yield progress("info", f"Reached processing limit for {name}")
                            break

                # Final batch
                if batch:
                    await qdrant_manager.process_and_insert_batch(
                        collection_name=collection_name,
                        batch=batch
                    )
                    processed += len(batch)
                
                total_processed += processed
                yield progress(
                    "completed_dataset",
                    f"Completed dataset {idx + 1}/{len(dataset_names)}: {name}",
                    processed=processed,
                    total_processed=total_processed
                )
                
                # Force cleanup after each dataset
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    
            except Exception as e:
                logger.exception(f"Error processing dataset {idx + 1}")
                yield progress("error", f"Error processing dataset {idx + 1}: {str(e)}")
                # Force cleanup on error
                gc.collect()
                continue

        yield progress("completed", f"Collection build completed. Processed {total_processed} documents.", total_processed=total_processed)

    except Exception as e:
        logger.exception("Build process failed")
        yield progress("error", f"Build process failed: {str(e)}")
        raise
    finally:
        # Final cleanup
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

@router.post("/build")
async def build_collection_endpoint(
    request: rest.CollectionBuildRequest,
    background_tasks: BackgroundTasks
):
    """Build collection endpoint with streaming progress updates."""
    collection_name = request.collection_name
    
    if collection_name in active_builds:
        raise HTTPException(status_code=409, detail=f"Build already in progress for collection '{collection_name}'")
    
    active_builds[collection_name] = {"start_time": datetime.now().isoformat(), "status": "initializing"}
    
    async def event_generator():
        try:
            # Override batch size for memory efficiency
            request.batch_size = min(request.batch_size, 4)
            
            # Stream progress updates
            async for update in _build_collection_stream(
                dataset_names=request.dataset_names,
                collection_name=collection_name,
                split=request.split,
                text_field=request.text_field,
                batch_size=request.batch_size,
                load_from_disk=request.load_from_disk
            ):
                active_builds[collection_name]["status"] = update["status"]
                update["timestamp"] = datetime.now().isoformat()
                yield {"event": "progress", "data": json.dumps(update)}
                await asyncio.sleep(0)
            
        except Exception as e:
            logger.exception("Build process error")
            yield {"event": "progress", "data": json.dumps({
                "status": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            })}
        finally:
            active_builds.pop(collection_name, None)
            background_tasks.add_task(gc.collect)
    
    return EventSourceResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept"
        }
    )


@router.get("/build/status/{collection_name}")
async def get_build_status(collection_name: str):
    """Get the current status of a collection build"""
    if collection_name in active_builds:
        return JSONResponse(content={"status": "active", "details": active_builds[collection_name]})
    
    try:
        collection_info = qdrant_manager.client.get_collection(collection_name)
        return JSONResponse(content={
            "status": "complete",
            "points_count": collection_info.points_count,
            "collection_info": {
                "vectors_count": collection_info.vectors_count,
                "segments_count": collection_info.segments_count,
                "status": str(collection_info.status)
            }
        })
    except Exception:
        return JSONResponse(
            status_code=404,
            content={"status": "not_found", "message": f"Collection '{collection_name}' not found"}
        )

@router.delete("/build/{collection_name}")
async def cancel_build(collection_name: str):
    """Cancel an in-progress build operation"""
    if collection_name not in active_builds:
        raise HTTPException(status_code=404, detail=f"No active build found for collection '{collection_name}'")
    
    active_builds[collection_name]["status"] = "cancelling"
    return JSONResponse(content={
        "status": "cancelling",
        "message": f"Requested cancellation of build for collection '{collection_name}'"
    })

@router.post("/search", response_model=rest.SearchResponse)
async def filtered_search_endpoint(request: rest.FilteredSearchRequest):
    """
    Endpoint for filtered search with hybrid vector search capabilities.
    """
    try:
        qdrant_filter = None
        if request.filters:
            filter_builder = FilterBuilder()
            if 'must' in request.filters:
                filter_builder.add_must(request.filters['must'])
            if 'should' in request.filters:
                filter_builder.add_should(request.filters['should'])
            if 'must_not' in request.filters:
                filter_builder.add_must_not(request.filters['must_not'])
            qdrant_filter = filter_builder.build()

        search_results = await qdrant_manager.advanced_search(
            collection_name=request.collection_name,
            query=request.query,
            filter_params=qdrant_filter.model_dump() if qdrant_filter else None,
            top_k=request.top_k
        )

        if not search_results:
            return rest.SearchResponse(results=[])

        formatted_results = [
            rest.SearchResult(
                content=node.text,
                metadata={
                    k: v for k, v in node.metadata.items()
                    if k not in ['_node_content', 'embedding']
                },
                score=float(node.metadata.get('score', 0.0))
            )
            for node in search_results
        ]

        return rest.SearchResponse(results=formatted_results)

    except ValueError as ve:
        logger.error(f"Value error in search endpoint: {ve}")
        raise HTTPException(status_code=400, detail=f"Invalid request parameters: {str(ve)}")
    except Exception as e:
        logger.error(f"Error in filtered_search_endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal server error occurred during search")