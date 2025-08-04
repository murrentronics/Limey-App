-- Add admin field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create sponsored_ads table
CREATE TABLE IF NOT EXISTS sponsored_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER, -- video duration in seconds
    
    -- Business details
    business_name VARCHAR(100),
    contact_number VARCHAR(20),
    website_url TEXT,
    support_email VARCHAR(255),
    price_info TEXT, -- if applicable
    
    -- Boost campaign details
    boost_duration INTEGER NOT NULL, -- in days (1, 3, 7, 14, 30)
    boost_cost DECIMAL(10,2) NOT NULL, -- cost in dollars
    campaign_start TIMESTAMP WITH TIME ZONE,
    campaign_end TIMESTAMP WITH TIME ZONE,
    
    -- Status and tracking
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'active', 'expired', 'rejected', 'paused')),
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create boost_transactions table to track payments
CREATE TABLE IF NOT EXISTS boost_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsored_ad_id UUID NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id), -- admin who receives the payment
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(20) DEFAULT 'boost_payment' CHECK (transaction_type IN ('boost_payment', 'refund')),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ad_impressions table to track when ads are shown
CREATE TABLE IF NOT EXISTS ad_impressions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsored_ad_id UUID NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    view_duration INTEGER DEFAULT 0 -- how long they watched in seconds
);

-- Create ad_clicks table to track Learn More clicks
CREATE TABLE IF NOT EXISTS ad_clicks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsored_ad_id UUID NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_user_id ON sponsored_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_status ON sponsored_ads(status);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_campaign_dates ON sponsored_ads(campaign_start, campaign_end);
CREATE INDEX IF NOT EXISTS idx_boost_transactions_user_id ON boost_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_transactions_admin_id ON boost_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(sponsored_ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON ad_clicks(sponsored_ad_id);

-- Add RLS policies
ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE boost_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

-- Policies for sponsored_ads
CREATE POLICY "Users can view their own sponsored ads" ON sponsored_ads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sponsored ads" ON sponsored_ads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sponsored ads" ON sponsored_ads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sponsored ads" ON sponsored_ads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Everyone can view active sponsored ads" ON sponsored_ads
    FOR SELECT USING (status = 'active' AND campaign_start <= NOW() AND campaign_end >= NOW());

-- Policies for boost_transactions
CREATE POLICY "Users can view their own transactions" ON boost_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON boost_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Policies for ad_impressions
CREATE POLICY "Anyone can insert ad impressions" ON ad_impressions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins and ad owners can view impressions" ON ad_impressions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM sponsored_ads WHERE id = sponsored_ad_id
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Policies for ad_clicks
CREATE POLICY "Anyone can insert ad clicks" ON ad_clicks
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins and ad owners can view clicks" ON ad_clicks
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM sponsored_ads WHERE id = sponsored_ad_id
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Function to automatically update campaign status
CREATE OR REPLACE FUNCTION update_campaign_status()
RETURNS void AS $$
BEGIN
    -- Set campaigns to active if they've started
    UPDATE sponsored_ads 
    SET status = 'active', updated_at = NOW()
    WHERE status = 'approved' 
    AND campaign_start <= NOW() 
    AND campaign_end >= NOW();
    
    -- Set campaigns to expired if they've ended
    UPDATE sponsored_ads 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND campaign_end < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get active ads for feed
CREATE OR REPLACE FUNCTION get_active_sponsored_ads()
RETURNS TABLE (
    id UUID,
    title VARCHAR(100),
    description TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    duration INTEGER,
    business_name VARCHAR(100),
    contact_number VARCHAR(20),
    website_url TEXT,
    support_email VARCHAR(255),
    price_info TEXT,
    impressions INTEGER,
    clicks INTEGER
) AS $$
BEGIN
    -- Update campaign statuses first
    PERFORM update_campaign_status();
    
    -- Return active ads
    RETURN QUERY
    SELECT 
        sa.id,
        sa.title,
        sa.description,
        sa.video_url,
        sa.thumbnail_url,
        sa.duration,
        sa.business_name,
        sa.contact_number,
        sa.website_url,
        sa.support_email,
        sa.price_info,
        sa.impressions,
        sa.clicks
    FROM sponsored_ads sa
    WHERE sa.status = 'active'
    AND sa.campaign_start <= NOW()
    AND sa.campaign_end >= NOW()
    ORDER BY RANDOM(); -- Random order for fair distribution
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;