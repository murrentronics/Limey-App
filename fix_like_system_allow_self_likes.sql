-- Enable full data in DELETE events for video_likes table
ALTER TABLE video_likes REPLICA IDENTITY FULL;

-- Check the current REPLICA IDENTITY setting
SELECT relname, relreplident
FROM pg_class
WHERE relname = 'video_likes';

-- If the REPLICA IDENTITY is not FULL, try again with a different approach
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class
        WHERE relname = 'video_likes'
        AND relreplident != 'f'
    ) THEN
        RAISE NOTICE 'REPLICA IDENTITY already set to FULL';
    ELSE
        -- Try with explicit schema
        ALTER TABLE public.video_likes REPLICA IDENTITY FULL;
    END IF;
END $$;

-- Check again to verify
SELECT relname, relreplident
FROM pg_class
WHERE relname = 'video_likes';