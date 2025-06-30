-- init.sql
-- Production-ready initialization script for PostgreSQL in Docker Compose

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Function to update chat session metadata
-- Using CREATE OR REPLACE to ensure idempotency
CREATE OR REPLACE FUNCTION public.update_chat_session_metadata()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE chat_sessions
        SET 
            last_message_at = (
                SELECT MAX(created_at)
                FROM messages
                WHERE chat_session_id = NEW.chat_session_id
                AND is_active = true
            ),
            message_count = (
                SELECT COUNT(*)
                FROM messages
                WHERE chat_session_id = NEW.chat_session_id
                AND is_active = true
            )
        WHERE id = NEW.chat_session_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_sessions
        SET 
            last_message_at = (
                SELECT MAX(created_at)
                FROM messages
                WHERE chat_session_id = OLD.chat_session_id
                AND is_active = true
            ),
            message_count = (
                SELECT COUNT(*)
                FROM messages
                WHERE chat_session_id = OLD.chat_session_id
                AND is_active = true
            )
        WHERE id = OLD.chat_session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create tables if they don't exist
DO $$ 
BEGIN
    -- Chat Sessions Table
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_sessions') THEN
        CREATE TABLE public.chat_sessions (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name character varying(255) DEFAULT ''::character varying NOT NULL,
            created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
            last_message_at timestamp with time zone,
            message_count integer DEFAULT 0,
            is_active boolean DEFAULT true
        );
        
        -- Performance indexes for chat_sessions
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_active 
            ON public.chat_sessions USING btree (is_active) 
            WHERE (is_active = true);
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_created 
            ON public.chat_sessions USING btree (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message 
            ON public.chat_sessions USING btree (last_message_at DESC);
    END IF;

    -- Messages Table
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        CREATE TABLE public.messages (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            chat_session_id integer REFERENCES public.chat_sessions(id),
            role character varying(50) NOT NULL,
            content text NOT NULL,
            metadata jsonb,
            created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
            is_active boolean DEFAULT true
        );
        
        -- Performance indexes for messages
        CREATE INDEX IF NOT EXISTS idx_messages_active 
            ON public.messages USING btree (is_active) 
            WHERE (is_active = true);
        CREATE INDEX IF NOT EXISTS idx_messages_chat_session 
            ON public.messages USING btree (chat_session_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_metadata 
            ON public.messages USING gin (metadata);
        CREATE INDEX IF NOT EXISTS idx_messages_role 
            ON public.messages USING btree (role, chat_session_id) 
            WHERE (is_active = true);
    END IF;
END $$;

-- Drop trigger if it exists and create it again
DROP TRIGGER IF EXISTS update_chat_session_after_message ON public.messages;
CREATE TRIGGER update_chat_session_after_message
    AFTER INSERT OR DELETE OR UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_chat_session_metadata();

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;


-- Create attachments table
CREATE TABLE public.attachments (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id integer REFERENCES public.messages(id) ON DELETE CASCADE,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    file_path character varying(512) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);

-- Create indexes for performance
CREATE INDEX idx_attachments_message_id ON public.attachments(message_id);
CREATE INDEX idx_attachments_active ON public.attachments(is_active) WHERE (is_active = true);
CREATE INDEX idx_attachments_type ON public.attachments(file_type);

-- Add simplified tool_definitions table
CREATE TABLE dynamic_tools (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    parameters JSONB NOT NULL,
    required_params JSONB DEFAULT '[]'::jsonb,
    allow_network BOOLEAN DEFAULT FALSE,
    allow_filesystem BOOLEAN DEFAULT FALSE,
    timeout INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dynamic_tools_name ON dynamic_tools(name);
CREATE INDEX idx_dynamic_tools_active ON dynamic_tools(is_active);
