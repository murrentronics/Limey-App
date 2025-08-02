-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comment_likes_comment_id_user_id_key'
    ) THEN
        ALTER TABLE comment_likes ADD CONSTRAINT comment_likes_comment_id_user_id_key UNIQUE(comment_id, user_id);
    END IF;
END $$;

-- Add comment_count column to videos table if it doesn't exist
ALTER TABLE videos ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- Create function to increment comment count
CREATE OR REPLACE FUNCTION increment_comment_count(video_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE videos 
    SET comment_count = COALESCE(comment_count, 0) + 1 
    WHERE id = video_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create function to decrement comment count
CREATE OR REPLACE FUNCTION decrement_comment_count(video_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE videos 
    SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) 
    WHERE id = video_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment comment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(comment_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE comments 
    SET like_count = COALESCE(like_count, 0) + 1 
    WHERE id = comment_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create function to decrement comment likes
CREATE OR REPLACE FUNCTION decrement_comment_likes(comment_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE comments 
    SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) 
    WHERE id = comment_uuid;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (Row Level Security)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
DROP POLICY IF EXISTS "Comment likes are viewable by everyone" ON comment_likes;
DROP POLICY IF EXISTS "Users can insert their own comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON comment_likes;

-- Create RLS policies for comments
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for comment_likes
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comment likes" ON comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment likes" ON comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update comment count when comments are added/deleted
CREATE OR REPLACE FUNCTION update_video_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Only count top-level comments (not replies)
        IF NEW.parent_id IS NULL THEN
            UPDATE videos 
            SET comment_count = COALESCE(comment_count, 0) + 1 
            WHERE id = NEW.video_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Only count top-level comments (not replies)
        IF OLD.parent_id IS NULL THEN
            UPDATE videos 
            SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) 
            WHERE id = OLD.video_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_update_video_comment_count ON comments;
CREATE TRIGGER trigger_update_video_comment_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_video_comment_count();

-- Initialize comment_count for existing videos (set to 0 if NULL)
UPDATE videos SET comment_count = 0 WHERE comment_count IS NULL;