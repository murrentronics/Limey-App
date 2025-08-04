-- Function to increment ad impressions
CREATE OR REPLACE FUNCTION increment_ad_impressions(ad_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE sponsored_ads 
    SET impressions = impressions + 1,
        updated_at = NOW()
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment ad clicks
CREATE OR REPLACE FUNCTION increment_ad_clicks(ad_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE sponsored_ads 
    SET clicks = clicks + 1,
        updated_at = NOW()
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;