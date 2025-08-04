-- Enhanced User Sessions Schema Migration
-- This migration updates the user_sessions table to support enhanced session management
-- Requirements: 1.3, 2.2, 3.2

-- First, create the user_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Add session_data JSONB column to user_sessions table
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}';

-- Add performance optimization indexes
-- Index for efficient session cleanup based on expiration
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Index for session lookup by session_id
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

-- Composite index for user_id and expires_at for active session queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);

-- GIN index for JSONB session_data queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_data ON user_sessions USING GIN(session_data);

-- Create unique constraint to ensure only one session per user (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON user_sessions;

-- Create enhanced RLS policies with session_data validation
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON user_sessions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        -- Ensure session_data is valid JSON and not null
        session_data IS NOT NULL
    );

CREATE POLICY "Users can update their own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        -- Ensure session_data remains valid during updates
        session_data IS NOT NULL
    );

CREATE POLICY "Users can delete their own sessions" ON user_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Add a constraint to ensure session_data is not null
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'session_data_not_null' 
        AND table_name = 'user_sessions'
    ) THEN
        ALTER TABLE user_sessions 
        ADD CONSTRAINT session_data_not_null CHECK (session_data IS NOT NULL);
    END IF;
END $$;

-- Create or replace the cleanup function to handle the new schema
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function for automatic cleanup
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    PERFORM cleanup_expired_sessions();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic cleanup (drop first if exists)
DROP TRIGGER IF EXISTS cleanup_sessions_trigger ON user_sessions;
CREATE TRIGGER cleanup_sessions_trigger
    BEFORE INSERT OR UPDATE ON user_sessions
    EXECUTE FUNCTION trigger_cleanup_expired_sessions();

-- Function to validate session_data structure (utility function)
CREATE OR REPLACE FUNCTION validate_session_data(data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    -- Basic validation: ensure it's a valid JSON object
    IF data IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Additional validation can be added here as needed
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to document the enhanced schema
COMMENT ON COLUMN user_sessions.session_data IS 'JSONB column for storing additional session metadata and context information';
COMMENT ON INDEX idx_user_sessions_expires_at IS 'Index for efficient cleanup of expired sessions';
COMMENT ON INDEX idx_user_sessions_session_id IS 'Index for fast session lookup by session_id';
COMMENT ON INDEX idx_user_sessions_user_expires IS 'Composite index for active session queries by user';
COMMENT ON INDEX idx_user_sessions_session_data IS 'GIN index for JSONB session_data queries';