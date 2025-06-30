from fastapi import APIRouter, Depends, HTTPException, Query, Body, Response
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import List, Optional, Dict
from datetime import datetime
import databases
import json

from models import http as rest
from dependencies import get_database
from utils.documents import save_attachment 
from utils.title import generate_title
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat-sessions", tags=["chat_history"])

# Root-level operations
@router.get("", response_model=List[rest.ChatSession])
async def get_chat_sessions(db: databases.Database = Depends(get_database)):
    try:
        query = "SELECT * FROM chat_sessions ORDER BY created_at DESC"
        rows = await db.fetch_all(query)
        return [rest.ChatSession(**row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching chat sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while fetching chat sessions")

@router.post("", response_model=rest.ChatSession)
async def create_chat_session(
    session: rest.ChatSessionCreate, 
    db: databases.Database = Depends(get_database)
):
    query = """
        INSERT INTO chat_sessions (name)
        VALUES (:name)
        RETURNING *
    """
    values = {"name": ""}
    row = await db.fetch_one(query, values=values)
    new_session = rest.ChatSession(**row)
    
    if session.first_message:
        message_query = """
            INSERT INTO messages (chat_session_id, role, content)
            VALUES (:chat_session_id, 'user', :content)
        """
        await db.execute(
            message_query, 
            values={
                "chat_session_id": new_session.id, 
                "content": session.first_message
            }
        )
        
        await generate_title(
            first_message=session.first_message,
            session_id=new_session.id,
            db=db,
            model=session.model,
            provider_name=session.provider
        )
        
        updated_session = await get_chat_session_by_id(new_session.id, db)
        return updated_session
        
    return new_session

# Session-specific operations
@router.get("/{session_id}", response_model=rest.ChatSession)
async def get_chat_session(session_id: int, db: databases.Database = Depends(get_database)):
    return await get_chat_session_by_id(session_id, db)

async def get_chat_session_by_id(session_id: int, db: databases.Database):
    query = """
    SELECT cs.id, cs.name, cs.created_at, 
           COALESCE(json_agg(
               CASE WHEN m.id IS NOT NULL THEN
                   json_build_object(
                       'id', m.id,
                       'chat_session_id', m.chat_session_id,
                       'role', m.role, 
                       'content', m.content, 
                       'metadata', m.metadata,
                       'created_at', m.created_at
                   )
               ELSE NULL END
           ) FILTER (WHERE m.id IS NOT NULL), '[]'::json) as messages
    FROM chat_sessions cs
    LEFT JOIN messages m ON cs.id = m.chat_session_id
    WHERE cs.id = :session_id
    GROUP BY cs.id
    """
    row = await db.fetch_one(query, values={"session_id": session_id})
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    session_data = dict(row)
    session_data['messages'] = json.loads(session_data['messages'])
    
    return rest.ChatSession(**session_data)

@router.put("/{session_id}")
async def rename_chat_session(session_id: int, rename_data: rest.ChatSessionRename, db: databases.Database = Depends(get_database)):
    query = "UPDATE chat_sessions SET name = :new_name WHERE id = :session_id RETURNING *"
    values = {"new_name": rename_data.new_name, "session_id": session_id}
    
    result = await db.fetch_one(query, values)
    if result is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    return dict(result)

@router.delete("/{session_id}", status_code=204)
async def delete_chat_session(session_id: int, db: databases.Database = Depends(get_database)):
    async with db.transaction():
        delete_messages_query = "DELETE FROM messages WHERE chat_session_id = :session_id"
        await db.execute(delete_messages_query, values={"session_id": session_id})
        
        delete_session_query = "DELETE FROM chat_sessions WHERE id = :session_id"
        result = await db.execute(delete_session_query, values={"session_id": session_id})
        
        if result == 0:
            raise HTTPException(status_code=404, detail="Chat session not found")
    
    return None

@router.options("/{session_id}")
async def options_chat_session(session_id: int):
    return JSONResponse(
        content={"allow": "GET, DELETE"},
        headers={
            "Allow": "GET, DELETE",
            "Access-Control-Allow-Methods": "GET, DELETE",
        },
    )

@router.get("/{session_id}/count")
async def get_session_message_count(session_id: int, db: databases.Database = Depends(get_database)):
    query = """
    SELECT COUNT(*) as total
    FROM messages
    WHERE chat_session_id = :session_id
    """
    result = await db.fetch_one(query, values={"session_id": session_id})
    return {"total": result['total']}

# Message operations
@router.options("/{session_id}/messages")
async def options_chat_session_messages(session_id: int):
    return {"allow": "GET, POST, OPTIONS"}

@router.post("/{session_id}/messages", response_model=rest.Message)
async def add_message(session_id: int, message: rest.MessageCreate, db: databases.Database = Depends(get_database)):
    async with db.transaction():
        has_attachment = hasattr(message, 'image_data') and message.image_data is not None
        
        metadata = message.metadata or {}
        if has_attachment:
            metadata["hasAttachment"] = True
        
        query = """
        INSERT INTO messages (chat_session_id, role, content, metadata)
        VALUES (:session_id, :role, :content, :metadata)
        RETURNING id, chat_session_id, role, content, metadata, created_at
        """
        
        values = {
            "session_id": session_id,
            "role": message.role,
            "content": message.content,
            "metadata": json.dumps(metadata) if metadata else None
        }
        
        try:
            row = await db.fetch_one(query, values)
            
            if not row:
                raise HTTPException(status_code=500, detail="Failed to insert message")
                
            message_id = row["id"]
            row_dict = dict(row)
            
            attachments = []
            if has_attachment:
                attachments = await save_attachment(
                    db=db,
                    message_id=message_id,
                    session_id=session_id,
                    image_data=message.image_data
                )
            
            if row_dict['metadata']:
                row_dict['metadata'] = json.loads(row_dict['metadata'])
                
            row_dict['attachments'] = attachments
            
            return rest.Message(**row_dict)
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/{session_id}/messages", response_model=List[rest.Message])
async def get_messages(
    session_id: int,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = None,
    direction: str = Query('backward', pattern='^(forward|backward)$'),
    db: databases.Database = Depends(get_database)
):
    try:
        query_params = {
            "session_id": session_id,
            "limit": limit + 1
        }

        if cursor and cursor.strip():
            try:
                timestamp_str, id_str = cursor.split(',')
                query_params["cursor_timestamp"] = datetime.fromisoformat(timestamp_str)
                query_params["cursor_id"] = int(id_str)
                cursor_condition = """
                    AND (created_at, id) < (:cursor_timestamp, :cursor_id)
                """ if direction == 'backward' else """
                    AND (created_at, id) > (:cursor_timestamp, :cursor_id)
                """
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid cursor format: {cursor}, {str(e)}")
                cursor_condition = ""
        else:
            cursor_condition = ""

        query = f"""
        SELECT 
            id, chat_session_id, role, content, metadata, created_at
        FROM messages
        WHERE chat_session_id = :session_id
        {cursor_condition}
        ORDER BY created_at {'DESC' if direction == 'backward' else 'ASC'}
        LIMIT :limit
        """

        rows = await db.fetch_all(query, values=query_params)
        messages = []
        has_more = len(rows) > limit
        rows = rows[:limit]

        for row in rows:
            message_data = dict(row)
            if message_data['metadata']:
                message_data['metadata'] = json.loads(message_data['metadata'])
            messages.append(rest.Message(**message_data))

        return JSONResponse(
            content={
                "data": jsonable_encoder(messages),
                "has_more": has_more,
                "cursor": f"{messages[-1].created_at.isoformat()},{messages[-1].id}" if messages else None
            }
        )

    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while fetching messages")