-- Create user session function with simple token signature
-- Requirements: 1.1, 1.2, 3.1, 3.3

CREATE OR REPLACE FUNCTION create_user_session(session_token TEXT)
RETURNS UUID AS $
DECLARE
    current_user_id UUID;
    session_uuid UUID;
BEGIN
    -- Set search_path for security (Requirement 3.1)
    PERFORM set_config('search_path', 'public', true);
    
    -- Input validation (Requirement 3.3)
    IF session_token IS NULL OR trim(session_token) = '' THEN
        RAISE EXCEPTION 'Session token cannot be null or empty';
    END IF;
    
    -- Get current authenticated user ID (Requirement 1.1)
    current_user_id := auth.uid();
    
    -- Validate that user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create a session';
    END IF;
    
    -- Check if user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = current_user_id) THEN
        RAISE EXCEPTION 'Invalid user ID: user does not exist';
    END IF;
    
    -- Handle existing session: update or create new based on unique constraint
    -- Since we have unique constraint on user_id, we'll update existing session
    BEGIN
        -- Try to update existing session first
        UPDATE user_sessions 
        SET 
            session_id = session_token,
            created_at = NOW(),
            expires_at = NOW() + INTERVAL '24 hours',
            session_data = '{}'
        WHERE user_id = current_user_id
        RETURNING id INTO session_uuid;
        
        -- If no existing session was updated, create a new one
        IF session_uuid IS NULL THEN
            INSERT INTO user_sessions (user_id, session_id, session_data)
            VALUES (current_user_id, session_token, '{}')
            RETURNING id INTO session_uuid;
        END IF;
        
    EXCEPTION
        WHEN unique_violation THEN
            -- Handle race condition: another session was created concurrently
            -- Update the existing session
            UPDATE user_sessions 
            SET 
                session_id = session_token,
                created_at = NOW(),
                expires_at = NOW() + INTERVAL '24 hours',
                session_data = '{}'
            WHERE user_id = current_user_id
            RETURNING id INTO session_uuid;
            
        WHEN foreign_key_violation THEN
            RAISE EXCEPTION 'Invalid user ID: foreign key constraint violation';
            
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to create session: %', SQLERRM;
    END;
    
    -- Ensure we have a session UUID (Requirement 1.2)
    IF session_uuid IS NULL THEN
        RAISE EXCEPTION 'Failed to create or update session';
    END IF;
    
    RETURN session_uuid;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function comment
COMMENT ON FUNCTION create_user_session(TEXT) IS 'Creates a user session with simple token signature using current authenticated user ID';