import { supabase } from "@/integrations/supabase/client";

// Check if current user is admin
export const isAdmin = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return data?.is_admin || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get admin user ID (for transferring boost payments)
export const getAdminUserId = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('is_admin', true)
      .single();
    
    if (error) {
      console.error('Error getting admin user:', error);
      return null;
    }
    
    return data?.user_id || null;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
};

// Boost pricing configuration
export const BOOST_PRICING = {
  1: 15,   // 1 day - $15
  3: 40,   // 3 days - $40
  7: 85,   // 7 days - $85
  14: 150, // 14 days - $150
  30: 250  // 30 days - $250
} as const;

export type BoostDuration = keyof typeof BOOST_PRICING;

// Calculate campaign end date
export const calculateCampaignEndDate = (startDate: Date, duration: BoostDuration): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + duration);
  return endDate;
};

// Transfer boost payment to admin wallet
export const transferBoostPaymentToAdmin = async (
  amount: number,
  userId: string,
  sponsoredAdId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return { success: false, error: 'Admin account not found' };
    }

    // Record the transaction
    const { error: transactionError } = await supabase
      .from('boost_transactions')
      .insert({
        sponsored_ad_id: sponsoredAdId,
        user_id: userId,
        admin_id: adminId,
        amount: amount,
        transaction_type: 'boost_payment',
        status: 'completed'
      });

    if (transactionError) {
      console.error('Error recording boost transaction:', transactionError);
      return { success: false, error: 'Failed to record transaction' };
    }

    // TODO: Integrate with ttpaypal API to actually transfer funds to admin wallet
    // For now, we'll just record the transaction
    
    return { success: true };
  } catch (error) {
    console.error('Error transferring boost payment:', error);
    return { success: false, error: 'Payment transfer failed' };
  }
};

// Create sponsored ad
export const createSponsoredAd = async (adData: {
  title: string;
  description: string;
  video_url: string;
  thumbnail_url?: string;
  duration: number;
  business_name?: string;
  contact_number?: string;
  website_url?: string;
  support_email?: string;
  price_info?: string;
  boost_duration: BoostDuration;
  user_id: string;
}): Promise<{ success: boolean; adId?: string; error?: string }> => {
  try {
    const cost = BOOST_PRICING[adData.boost_duration];
    const startDate = new Date();
    const endDate = calculateCampaignEndDate(startDate, adData.boost_duration);

    const { data, error } = await (supabase as any)
      .from('sponsored_ads')
      .insert({
        ...adData,
        boost_cost: cost,
        campaign_start: startDate.toISOString(),
        campaign_end: endDate.toISOString(),
        status: 'pending' // Will need admin approval
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating sponsored ad:', error);
      return { success: false, error: 'Failed to create sponsored ad' };
    }

    return { success: true, adId: data.id };
  } catch (error) {
    console.error('Error creating sponsored ad:', error);
    return { success: false, error: 'Failed to create sponsored ad' };
  }
};

// Get user's sponsored ads
export const getUserSponsoredAds = async (userId: string) => {
  try {
    const { data, error } = await (supabase as any)
      .from('sponsored_ads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sponsored ads:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching user sponsored ads:', error);
    return [];
  }
};

// Admin functions
export const getAllSponsoredAds = async () => {
  try {
    console.log('Fetching all sponsored ads for admin...');
    
    // First, get all sponsored ads without the relationship
    const { data: adsData, error: adsError } = await (supabase as any)
      .from('sponsored_ads')
      .select('*')
      .order('created_at', { ascending: false });

    if (adsError) {
      console.error('Error fetching sponsored ads:', adsError);
      return [];
    }

    if (!adsData || adsData.length === 0) {
      console.log('No sponsored ads found');
      return [];
    }

    // Get unique user IDs
    const userIds = [...new Set(adsData.map((ad: any) => ad.user_id))];
    
    // Fetch profiles separately
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      // Return ads without profile data
      console.log('Fetched sponsored ads (no profiles):', adsData.length, 'ads');
      return adsData;
    }

    // Create a map of profiles by user_id
    const profilesMap = new Map();
    profilesData?.forEach((profile: any) => {
      profilesMap.set(profile.user_id, profile);
    });

    // Combine ads with profile data
    const adsWithProfiles = adsData.map((ad: any) => ({
      ...ad,
      profiles: profilesMap.get(ad.user_id) || null
    }));

    console.log('Fetched sponsored ads with profiles:', adsWithProfiles.length, 'ads');
    return adsWithProfiles;
  } catch (error) {
    console.error('Error fetching all sponsored ads:', error);
    return [];
  }
};

// Approve sponsored ad
export const approveSponsoredAd = async (adId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // First, get the ad details to know the cost and user
    const { data: adData, error: adError } = await (supabase as any)
      .from('sponsored_ads')
      .select('boost_cost, user_id, title')
      .eq('id', adId)
      .single();

    if (adError || !adData) {
      console.error('Error fetching ad details:', adError);
      return { success: false, error: 'Failed to fetch ad details' };
    }

    // Get admin user ID
    const adminId = await getAdminUserId();
    if (!adminId) {
      return { success: false, error: 'Admin account not found' };
    }

    // Update ad status to approved
    const { error: updateError } = await (supabase as any)
      .from('sponsored_ads')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', adId);

    if (updateError) {
      console.error('Error approving sponsored ad:', updateError);
      return { success: false, error: 'Failed to approve ad' };
    }

    // Transfer the boost payment to admin's TriniCredits
    try {
      const { recordTrincreditsTransaction } = await import('@/lib/ttpaypalApi');
      
      await recordTrincreditsTransaction({
        userId: adminId,
        transactionType: 'deposit',
        amount: adData.boost_cost,
        description: `Boost revenue from "${adData.title}" - TT$${adData.boost_cost.toFixed(2)}`,
        referenceId: `boost_revenue_${adId}`
      });

      console.log(`Admin credited TT$${adData.boost_cost} for approving ad: ${adData.title}`);
    } catch (paymentError) {
      console.error('Error crediting admin:', paymentError);
      // Don't fail the approval if payment fails, but log it
      // The ad is still approved, but admin payment needs manual handling
    }

    return { success: true };
  } catch (error) {
    console.error('Error approving sponsored ad:', error);
    return { success: false, error: 'Failed to approve ad' };
  }
};

// Reject sponsored ad
export const rejectSponsoredAd = async (adId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // First, get the ad details to know the cost and user for refund
    const { data: adData, error: adError } = await (supabase as any)
      .from('sponsored_ads')
      .select('boost_cost, user_id, title')
      .eq('id', adId)
      .single();

    if (adError || !adData) {
      console.error('Error fetching ad details:', adError);
      return { success: false, error: 'Failed to fetch ad details' };
    }

    // Update ad status to rejected
    const { error: updateError } = await (supabase as any)
      .from('sponsored_ads')
      .update({ 
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', adId);

    if (updateError) {
      console.error('Error rejecting sponsored ad:', updateError);
      return { success: false, error: 'Failed to reject ad' };
    }

    // Refund the user's TriniCredits
    try {
      const { recordTrincreditsTransaction } = await import('@/lib/ttpaypalApi');
      
      await recordTrincreditsTransaction({
        userId: adData.user_id,
        transactionType: 'refund',
        amount: adData.boost_cost,
        description: `Boost refund for "${adData.title}" - TT$${adData.boost_cost.toFixed(2)}`,
        referenceId: `boost_refund_${adId}`
      });

      console.log(`User refunded TT$${adData.boost_cost} for rejected ad: ${adData.title}`);
    } catch (refundError) {
      console.error('Error refunding user:', refundError);
      // Don't fail the rejection if refund fails, but log it
      // The ad is still rejected, but refund needs manual handling
    }

    return { success: true };
  } catch (error) {
    console.error('Error rejecting sponsored ad:', error);
    return { success: false, error: 'Failed to reject ad' };
  }
};

// Track ad impression
export const trackAdImpression = async (adId: string, viewerId?: string, viewDuration: number = 0) => {
  try {
    // Insert impression record
    await (supabase as any)
      .from('ad_impressions')
      .insert({
        sponsored_ad_id: adId,
        viewer_id: viewerId,
        view_duration: viewDuration
      });

    // Update impression count on the ad
    await supabase.rpc('increment_ad_impressions', { ad_id: adId });
  } catch (error) {
    console.error('Error tracking ad impression:', error);
  }
};

// Track ad click (Learn More)
export const trackAdClick = async (adId: string, viewerId?: string) => {
  try {
    // Insert click record
    await (supabase as any)
      .from('ad_clicks')
      .insert({
        sponsored_ad_id: adId,
        viewer_id: viewerId
      });

    // Update click count on the ad
    await supabase.rpc('increment_ad_clicks', { ad_id: adId });
  } catch (error) {
    console.error('Error tracking ad click:', error);
  }
};