-- Integration tests for create_user_session function with simple token signature
-- These tests require a running Supabase instance with proper authentication setup
-- Requirements: 1.1, 1.2, 3.1, 3.3

-- Test with authenticated user context
-- This would typically be run in a test environment where auth.uid() returns a valid user ID

-- Test case 1: Successful session creation
DO $
DECLARE
    session_uuid UUID;
    session_record RECORD;
    test_token TEXT := 'integration_test_token_001';
BEGIN
    -- This test assumes auth.uid() returns a valid user ID
    -- In a real test environment, you would authenticate a test user first
    
    -- Clean up any existing test sessions
    DELETE FROM user_sessions WHERE session_id = test_token;
    
    -- Test successful session creation
    BEGIN
        SELECT create_user_session(test_token) INTO session_uuid;
        
        -- Verify the session was created
        SELECT * INTO session_record 
        FROM user_sessions 
        WHERE id = session_uuid;
        
        -- Verify session properties
        IF session_record.id IS NULL THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: Session not found after creation';
        END IF;
        
        IF session_record.session_id != test_token THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: Session token mismatch';
        END IF;
        
        IF session_record.user_id != auth.uid() THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: User ID mismatch';
        END IF;
        
        IF session_record.session_data::text != '{}'::text THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: Session data should be empty JSON object';
        END IF;
        
        IF session_record.expires_at <= NOW() THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: Session should not be expired immediately';
        END IF;
        
        IF session_record.expires_at > NOW() + INTERVAL '25 hours' THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: Session expiration too far in future';
        END IF;
        
        RAISE NOTICE 'Integration Test 1 PASSED: Session created successfully with UUID %', session_uuid;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Integration Test 1 FAILED: %', SQLERRM;
    END;
    
END $;

-- Test case 2: Session update when user already has a session
DO $
DECLARE
    first_session_uuid UUID;
    second_session_uuid UUID;
    session_count INTEGER;
    test_token_1 TEXT := 'integration_test_token_002a';
    test_token_2 TEXT := 'integration_test_token_002b';
BEGIN
    -- Clean up
    DELETE FROM user_sessions WHERE session_id LIKE 'integration_test_token_002%';
    
    -- Create first session
    SELECT create_user_session(test_token_1) INTO first_session_uuid;
    
    -- Create second session (should update the first one due to unique constraint)
    SELECT create_user_session(test_token_2) INTO second_session_uuid;
    
    -- Verify only one session exists for the user
    SELECT COUNT(*) INTO session_count
    FROM user_sessions 
    WHERE user_id = auth.uid();
    
    IF session_count != 1 THEN
        RAISE EXCEPTION 'Integration Test 2 FAILED: Expected 1 session, found %', session_count;
    END IF;
    
    -- Verify the session has the latest token
    IF NOT EXISTS (
        SELECT 1 FROM user_sessions 
        WHERE user_id = auth.uid() 
        AND session_id = test_token_2
    ) THEN
        RAISE EXCEPTION 'Integration Test 2 FAILED: Session was not updated with new token';
    END IF;
    
    RAISE NOTICE 'Integration Test 2 PASSED: Session updated correctly when user already had a session';
    
END $;

-- Test case 3: Verify RLS policies work correctly
DO $
DECLARE
    session_uuid UUID;
    session_count INTEGER;
    test_token TEXT := 'integration_test_token_003';
BEGIN
    -- Clean up
    DELETE FROM user_sessions WHERE session_id = test_token;
    
    -- Create session
    SELECT create_user_session(test_token) INTO session_uuid;
    
    -- Verify user can see their own session
    SELECT COUNT(*) INTO session_count
    FROM user_sessions 
    WHERE id = session_uuid;
    
    IF session_count != 1 THEN
        RAISE EXCEPTION 'Integration Test 3 FAILED: User cannot see their own session';
    END IF;
    
    RAISE NOTICE 'Integration Test 3 PASSED: RLS policies allow user to see their own session';
    
END $;

-- Test case 4: Performance test with multiple rapid session creations
DO $
DECLARE
    session_uuid UUID;
    i INTEGER;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
BEGIN
    start_time := clock_timestamp();
    
    -- Create 10 sessions rapidly (each will update the previous one)
    FOR i IN 1..10 LOOP
        SELECT create_user_session('perf_test_token_' || i) INTO session_uuid;
    END LOOP;
    
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    -- Verify only one session exists
    SELECT COUNT(*) INTO i
    FROM user_sessions 
    WHERE user_id = auth.uid() 
    AND session_id LIKE 'perf_test_token_%';
    
    IF i != 1 THEN
        RAISE EXCEPTION 'Integration Test 4 FAILED: Expected 1 session after rapid creation, found %', i;
    END IF;
    
    RAISE NOTICE 'Integration Test 4 PASSED: Performance test completed in % (10 rapid session creations)', duration;
    
END $;

-- Cleanup test data
DO $
BEGIN
    DELETE FROM user_sessions WHERE session_id LIKE 'integration_test_token_%';
    DELETE FROM user_sessions WHERE session_id LIKE 'perf_test_token_%';
    RAISE NOTICE 'Test cleanup completed';
END $;