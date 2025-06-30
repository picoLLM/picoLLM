import logging
import databases
from utils.handlers import get_provider

logger = logging.getLogger(__name__)

async def generate_title(
    first_message: str,
    session_id: int,
    db: databases.Database,
    model: str,
    provider_name: str
) -> None:
    """
    Generate a title for a chat session using the specified provider.
    
    Args:
        first_message: The initial message to base the title on
        session_id: The database ID of the chat session
        db: Database connection
        model: Model name for the specific provider
        provider_name: Name of the provider to use
    """
    logger.info(f"Starting title generation for session {session_id} using {provider_name}")
    
    try:
        # Get the appropriate provider instance
        provider = get_provider(provider_name)
        
        # Create simple message structure
        messages = [
            {
                "role": "user",
                "content": f"Generate a short, catchy title (max 5 words) for a conversation starting with: '{first_message}'"
            }
        ]
        
        # Get title from provider
        response = await provider.chat(
            messages=messages,
            model=model,
            temperature=0.3,
            max_tokens=20,
            stream=False
        )
        
        # Extract and clean title
        generated_title = response["answer"].strip()[:50]  # Limit title length
        
        # Update database
        update_query = "UPDATE chat_sessions SET name = :name WHERE id = :id"
        await db.execute(
            update_query,
            values={"name": generated_title, "id": session_id}
        )
        
        logger.info(f"Updated session {session_id} with title: {generated_title}")
        
    except Exception as e:
        logger.error(f"Error generating title for session {session_id}: {str(e)}")
        # Use a default title if generation fails
        default_title = f"Chat {session_id}"
        await db.execute(
            "UPDATE chat_sessions SET name = :name WHERE id = :id",
            values={"name": default_title, "id": session_id}
        )