-- Complete database schema fix after reset

-- 1. Ensure profiles table exists with proper structure
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_creator BOOLEAN DEFAULT false,
    likes_received INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Ensure videos table has all required columns
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'user_id' AND table_schema = 'public') THEN
        ALTER TABLE videos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'username' AND table_schema = 'public') THEN
        ALTER TABLE videos ADD COLUMN username TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'avatar_url' AND table_schema = 'public') THEN
        ALTER TABLE videos ADD COLUMN avatar_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'like_count' AND table_schema = 'public') THEN
        ALTER TABLE videos ADD COLUMN like_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'view_count' AND table_schema = 'public') THEN
        ALTER TABLE videos ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5. Ensure videos table has proper RLS policies
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view videos" ON videos;
DROP POLICY IF EXISTS "Users can create their own videos" ON videos;
DROP POLICY IF EXISTS "Users can update their own videos" ON videos;
DROP POLICY IF EXISTS "Users can delete their own videos" ON videos;

CREATE POLICY "Users can view videos" ON videos
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own videos" ON videos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" ON videos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" ON videos
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Grant all necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO authenticated;
GRANT SELECT ON videos TO anon;

GRANT SELECT, INSERT, DELETE ON video_views TO authenticated;
GRANT SELECT ON video_views TO anon;

GRANT SELECT, INSERT, DELETE ON video_likes TO authenticated;
GRANT SELECT ON video_likes TO anon;

-- 7. Create video_likes table if it doesn't exist (needed for likes functionality)
CREATE TABLE IF NOT EXISTS video_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate likes
    UNIQUE(video_id, user_id)
);

-- Enable RLS on video_likes
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for video_likes
DROP POLICY IF EXISTS "Users can view all likes" ON video_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON video_likes;

CREATE POLICY "Users can view all likes" ON video_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON video_likes
    FOR ALL USING (auth.uid() = user_id);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_video_likes_video_id ON video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user_id ON video_likes(user_id);

-- 9. Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema setup complete';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ profiles table exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'videos' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ videos table exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_likes' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ video_likes table exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_views' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ video_views table exists';
    END IF;
END $$;