-- Create wallet_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallet_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one wallet link per user
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE wallet_links ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "wallet_links_select" ON wallet_links;
DROP POLICY IF EXISTS "wallet_links_insert" ON wallet_links;
DROP POLICY IF EXISTS "wallet_links_update" ON wallet_links;
DROP POLICY IF EXISTS "wallet_links_delete" ON wallet_links;

-- Users can only see their own wallet links
CREATE POLICY "wallet_links_select" ON wallet_links
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own wallet links
CREATE POLICY "wallet_links_insert" ON wallet_links
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own wallet links
CREATE POLICY "wallet_links_update" ON wallet_links
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own wallet links
CREATE POLICY "wallet_links_delete" ON wallet_links
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_links_user_id ON wallet_links(user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_links TO authenticated;

-- Test the table exists
SELECT 'wallet_links table created successfully!' as status;