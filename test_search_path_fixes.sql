-- Get the exact signature of the remaining update_profile function
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as exact_signature,
    'DROP FUNCTION IF EXISTS ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') CASCADE;' as drop_command
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'update_profile';

-- Try to drop with the most common signatures
DROP FUNCTION IF EXISTS public.update_profile(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_profile(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_profile(text, text) CASCADE;

-- Nuclear option: drop by OID if we can find it
DO $$
DECLARE
    func_oid OID;
BEGIN
    SELECT p.oid INTO func_oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'update_profile'
    LIMIT 1;
    
    IF func_oid IS NOT NULL THEN
        EXECUTE 'DROP FUNCTION ' || func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE 'Dropped function with OID: %', func_oid;
    END IF;
END $$;

-- Verify it's gone
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'update_profile';