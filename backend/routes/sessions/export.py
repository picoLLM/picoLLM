from fastapi import APIRouter, Depends, HTTPException, Query, Response, Body
from typing import List, Dict
import databases
from datetime import datetime
import json

from models import http as rest
from dependencies import get_database


router = APIRouter(prefix="/export", tags=["export"])


@router.get("/chat-sessions/all")
async def export_all_sessions(
    include_metadata: bool = Query(False),
    include_empty: bool = Query(False, description="Include sessions without messages"),
    db: databases.Database = Depends(get_database)
):
    """Export all chat sessions - each line is a complete conversation"""
    
    sessions_query = "SELECT id FROM chat_sessions WHERE is_active = true ORDER BY created_at ASC"
    session_rows = await db.fetch_all(sessions_query)
    
    if not session_rows:
        raise HTTPException(status_code=404, detail="No chat sessions found")
    
    session_ids = [row['id'] for row in session_rows]
    
    query = """
    SELECT chat_session_id, id, role, content, metadata, created_at
    FROM messages
    WHERE chat_session_id = ANY(:session_ids)
    AND is_active = true
    ORDER BY chat_session_id, created_at ASC
    """
    
    rows = await db.fetch_all(query, values={"session_ids": session_ids})
    
    if not rows and not include_empty:
        raise HTTPException(status_code=404, detail="No messages found in any session")
    
    sessions = {}
    for row in rows:
        sid = row['chat_session_id']
        if sid not in sessions:
            sessions[sid] = []
        sessions[sid].append(row)
    
    if include_empty:
        for sid in session_ids:
            if sid not in sessions:
                sessions[sid] = []
    
    lines = _export_sessions(sessions, include_metadata)
    
    content = "\n".join(lines)
    filename = f"picollm_conversations_chatml_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
    
    return Response(
        content=content,
        media_type="application/jsonl",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.post("/chat-sessions")
async def export_sessions(
    session_ids: List[int] = Body(..., description="List of session IDs to export"),
    include_metadata: bool = Query(False),
    db: databases.Database = Depends(get_database)
):
    """Export specific chat sessions - each line is a complete conversation"""
    
    if not session_ids:
        raise HTTPException(status_code=400, detail="No session IDs provided")
    
    if isinstance(session_ids, int):
        session_ids = [session_ids]
    
    query = """
    SELECT chat_session_id, id, role, content, metadata, created_at
    FROM messages
    WHERE chat_session_id = ANY(:session_ids)
    AND is_active = true
    ORDER BY chat_session_id, created_at ASC
    """
    
    rows = await db.fetch_all(query, values={"session_ids": session_ids})
    
    if not rows:
        raise HTTPException(status_code=404, detail="No messages found for specified sessions")
    
    sessions = {}
    for row in rows:
        sid = row['chat_session_id']
        if sid not in sessions:
            sessions[sid] = []
        sessions[sid].append(row)
    
    lines = _export_sessions(sessions, include_metadata)
    
    content = "\n".join(lines)
    filename = f"picollm_conversations_chatml_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
    
    return Response(
        content=content,
        media_type="application/jsonl",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

def _export_sessions(sessions: Dict[int, List], include_metadata: bool) -> List[str]:
    """Export sessions in ChatML format - returns list of JSONL lines"""
    lines = []
    
    for sid in sorted(sessions.keys()):
        messages = sessions[sid]
        
        if not messages:
            continue
            
        conversation = []
        for msg in messages:
            from_field = "human" if msg['role'] == 'user' else "gpt"
            message = {
                "from": from_field,
                "value": msg['content']
            }
            if include_metadata and msg['metadata']:
                message['metadata'] = json.loads(msg['metadata'])
            conversation.append(message)
        
        lines.append(json.dumps({"conversations": [conversation]}, ensure_ascii=False))
    
    return lines