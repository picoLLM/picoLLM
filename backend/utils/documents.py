from typing import List, Dict, Any
import os
import uuid
import base64
import logging
import re
from fastapi import HTTPException
import databases

logger = logging.getLogger(__name__)

def secure_filename(filename: str) -> str:
    """Sanitize filename for safe filesystem storage."""
    if not filename:
        return "unnamed_file"
    filename = re.sub(r'[^\w\s.-]', '', os.path.basename(filename)).strip().replace(' ', '_')
    return filename or "unnamed_file"

async def save_attachment(
    db: databases.Database,
    message_id: int,
    session_id: int,
    image_data: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Save image attachment from base64 data."""
    image_base64 = image_data.get("data")
    if not image_base64:
        logger.warning("Attachment processing failed: Image data is missing")
        return []
    
    file_name = image_data.get("fileName", "image.jpg")
    file_type = image_data.get("fileType", "image/jpeg")
    
    # Setup file path
    attachment_dir = os.path.join("uploads", str(session_id), str(message_id))
    os.makedirs(attachment_dir, exist_ok=True)
    file_path = os.path.join(attachment_dir, f"{uuid.uuid4()}_{secure_filename(file_name)}")
    
    # Save file
    try:
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(image_base64))
    except Exception as e:
        logger.error(f"Failed to write image file: {e}")
        return []
    
    # Save to database
    try:
        row = await db.fetch_one(
            """INSERT INTO attachments (message_id, file_name, file_type, file_size, file_path)
               VALUES (:message_id, :file_name, :file_type, :file_size, :file_path)
               RETURNING id, file_name, file_type, file_size""",
            {
                "message_id": message_id,
                "file_name": file_name,
                "file_type": file_type,
                "file_size": os.path.getsize(file_path),
                "file_path": file_path
            }
        )
        return [{
            "id": row["id"],
            "file_name": row["file_name"],
            "file_type": row["file_type"],
            "file_size": row["file_size"],
            "url": f"/attachments/{row['id']}"
        }]
    except Exception as e:
        logger.error(f"Database error while saving attachment: {e}")
        try:
            os.path.exists(file_path) and os.remove(file_path)
        except:
            pass
        return []

async def get_attachment_file(
    db: databases.Database,
    attachment_id: int
) -> Dict[str, Any]:
    """Retrieve attachment information from database."""
    try:
        row = await db.fetch_one(
            "SELECT * FROM attachments WHERE id = :attachment_id",
            {"attachment_id": attachment_id}
        )
        
        if not row:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        if not os.path.exists(row["file_path"]):
            logger.error(f"Attachment file not found on disk: {row['file_path']}")
            raise HTTPException(status_code=404, detail="Attachment file not found")
        
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving attachment: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving attachment")