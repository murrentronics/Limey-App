-- Unit tests for create_user_session function with simple token signature
-- Requirements: 1.1, 1.2, 3.1, 3.3

-- Test setup: Create a test user and set up authentication context
DO $
DECLARE
    test_user_id UUID;
    session_uuid UUID;
    session_count INTEGER;
    test_token TEXT := 'test_session_token_123';
    test_token_2 TEXT := 'test_session_token_456';
BEGIN
    -- Clean up any existing test data
    DELETE FROM user_sessions WHERE session_id LIKE 'test_session_token_%';
    
    -- Test 1: Verify function fails when user is not authenticated
    BEGIN
        -- This should fail because auth.uid() will return NULL in test context
        SELECT create_user_session(test_token) INTO session_uuid;
        RAISE EXCEPTION 'Test 1 FAILED: Function should fail when user is not authenticated';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%User must be authenticated%' THEN
                RAISE NOTICE 'Test 1 PASSED: Function correctly rejects unauthenticated users';
            ELSE
                RAISE EXCEPTION 'Test 1 FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;
    
    -- Test 2: Verify function fails with null session token
    BEGIN
        SELECT create_user_session(NULL) INTO session_uuid;
        RAISE EXCEPTION 'Test 2 FAILED: Function should fail with null session token';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Session token cannot be null or empty%' THEN
                RAISE NOTICE 'Test 2 PASSED: Function correctly rejects null session token';
            ELSE
                RAISE EXCEPTION 'Test 2 FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;
    
    -- Test 3: Verify function fails with empty session token
    BEGIN
        SELECT create_user_session('') INTO session_uuid;
        RAISE EXCEPTION 'Test 3 FAILED: Function should fail with empty session token';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Session token cannot be null or empty%' THEN
                RAISE NOTICE 'Test 3 PASSED: Function correctly rejects empty session token';
            ELSE
                RAISE EXCEPTION 'Test 3 FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;
    
    -- Test 4: Verify function fails with whitespace-only session token
    BEGIN
        SELECT create_user_session('   ') INTO session_uuid;
        RAISE EXCEPTION 'Test 4 FAILED: Function should fail with whitespace-only session token';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Session token cannot be null or empty%' THEN
                RAISE NOTICE 'Test 4 PASSED: Function correctly rejects whitespace-only session token';
            ELSE
                RAISE EXCEPTION 'Test 4 FAILED: Unexpected error: %', SQLERRM;
            END IF;
    END;
    
    RAISE NOTICE 'All input validation tests completed successfully';
    
END $;

-- Test function signature and return type
DO $
DECLARE
    function_exists BOOLEAN;
    return_type TEXT;
BEGIN
    -- Test 5: Verify function exists with correct signature
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'create_user_session'
        AND pg_get_function_arguments(p.oid) = 'session_token text'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE 'Test 5 PASSED: Function exists with correct signature';
    ELSE
        RAISE EXCEPTION 'Test 5 FAILED: Function does not exist with expected signature';
    END IF;
    
    -- Test 6: Verify function return type is UUID
    SELECT pg_get_function_result(p.oid) INTO return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'create_user_session'
    AND pg_get_function_arguments(p.oid) = 'session_token text';
    
    IF return_type = 'uuid' THEN
        RAISE NOTICE 'Test 6 PASSED: Function returns UUID type';
    ELSE
        RAISE EXCEPTION 'Test 6 FAILED: Function return type is % instead of uuid', return_type;
    END IF;
    
END $;

-- Test security attributes
DO $
DECLARE
    is_security_definer BOOLEAN;
BEGIN
    -- Test 7: Verify function has SECURITY DEFINER
    SELECT prosecdef INTO is_security_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'create_user_session'
    AND pg_get_function_arguments(p.oid) = 'session_token text';
    
    IF is_security_definer THEN
        RAISE NOTICE 'Test 7 PASSED: Function has SECURITY DEFINER attribute';
    ELSE
        RAISE EXCEPTION 'Test 7 FAILED: Function does not have SECURITY DEFINER attribute';
    END IF;
    
END $;

-- Test function behavior with mock authentication (simulated)
-- Note: In a real test environment, you would set up proper authentication context
DO $
BEGIN
    RAISE NOTICE 'All unit tests for create_user_session(TEXT) completed successfully';
    RAISE NOTICE 'Note: Full integration tests require proper authentication context';
END $;