-- Simple debug - check what actually exists

-- Check all tables in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('follows', 'profiles', 'system_notifications', 'users');

-- Check follows table structure (if it exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'follows';

-- Check profiles table structure (if it exists)  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles';

-- Check if any functions exist with 'follow' in the name
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%follow%';

-- Check if any triggers exist with 'follow' in the name
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE '%follow%';