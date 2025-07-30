import { useState, useEffect } from "react";
import { ArrowLeft, Eye, MousePointer, DollarSign, Calendar, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";

interface CampaignDetail {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration: number;
  business_name?: string;
  contact_number?: string;
  website_url?: string;
  support_email?: string;
  price_info?: string;
  boost_duration: number;
  boost_cost: number;
  campaign_start?: string;
  campaign_end?: string;
  status: string;
  impressions: number;
  clicks: number;
  created_at: string;
}

const CampaignDetail = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (campaignId && user) {
      loadCampaign();
    }
  }, [campaignId, user]);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('sponsored_ads')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user?.id) // Ensure user can only view their own campaigns
        .single();

      if (error) {
        console.error('Error loading campaign:', error);
        toast({
          title: "Error",
          description: "Failed to load campaign details",
          variant: "destructive"
        });
        navigate('/ad-stats');
        return;
      }

      setCampaign(data);
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign details",
        variant: "destructive"
      });
      navigate('/ad-stats');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-900 text-yellow-400';
      case 'approved': return 'bg-blue-900 text-blue-400';
      case 'active': return 'bg-green-900 text-green-400';
      case 'expired': return 'bg-gray-900 text-gray-400';
      case 'rejected': return 'bg-red-900 text-red-400';
      case 'draft': return 'bg-purple-900 text-purple-400';
      default: return 'bg-gray-900 text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateCTR = (clicks: number, impressions: number) => {
    if (impressions === 0) return 0;
    return ((clicks / impressions) * 100).toFixed(2);
  };

  const handleVideoToggle = () => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video) {
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Campaign not found</h2>
          <Button onClick={() => navigate('/ad-stats')}>Back to My Campaigns</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/ad-stats')}
              className="p-2"
            >
              <ArrowLeft size={20} className="text-white" />
            </Button>
            <span
              className="text-2xl font-black text-white tracking-wider logo-text-glow"
              style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: '900',
                letterSpacing: '0.15em',
                filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
              }}
            >
              Campaign Details
            </span>
          </div>
          
          {/* Edit Button - Only show for drafts */}
          {campaign?.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/boost?draft=${campaign.id}`)}
              className="text-white border-white/50 hover:bg-white/10"
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="pt-24 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Video Preview */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Video */}
              <div className="relative w-full md:w-80 aspect-[9/16] bg-black rounded-lg overflow-hidden">
                {/* Status Badge Overlay */}
                <div className="absolute top-4 left-4 z-10">
                  <Badge className={getStatusColor(campaign.status)}>
                    {campaign.status.toUpperCase()}
                  </Badge>
                </div>

                <video
                  src={campaign.video_url}
                  className="w-full h-full object-cover"
                  controls={false}
                  onClick={handleVideoToggle}
                />

                {/* Play/Pause Overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-pointer"
                  onClick={handleVideoToggle}
                >
                  <div className="bg-black/50 rounded-full p-4">
                    {isPlaying ? (
                      <Pause size={32} className="text-white" />
                    ) : (
                      <Play size={32} className="text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Campaign Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">{campaign.title}</h1>
                  {campaign.description && (
                    <p className="text-muted-foreground">{campaign.description}</p>
                  )}
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <DollarSign size={20} className="text-green-400 mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-bold text-green-400">TT${campaign.boost_cost}</p>
                  </div>
                  <div className="text-center">
                    <Calendar size={20} className="text-blue-400 mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-bold text-blue-400">{campaign.boost_duration} days</p>
                  </div>
                  <div className="text-center">
                    <Eye size={20} className="text-purple-400 mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="font-bold text-purple-400">{campaign.impressions.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <MousePointer size={20} className="text-orange-400 mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">Clicks</p>
                    <p className="font-bold text-orange-400">{campaign.clicks.toLocaleString()}</p>
                  </div>
                </div>

                {/* CTR */}
                {campaign.impressions > 0 && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Click-Through Rate</p>
                    <p className="text-xl font-bold text-primary">{calculateCTR(campaign.clicks, campaign.impressions)}%</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Business Details */}
          {(campaign.business_name || campaign.contact_number || campaign.website_url || campaign.support_email || campaign.price_info) && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaign.business_name && (
                  <div>
                    <h3 className="font-medium text-white mb-1">Business Name</h3>
                    <p className="text-muted-foreground">{campaign.business_name}</p>
                  </div>
                )}
                {campaign.contact_number && (
                  <div>
                    <h3 className="font-medium text-white mb-1">Contact Number</h3>
                    <p className="text-muted-foreground">{campaign.contact_number}</p>
                  </div>
                )}
                {campaign.website_url && (
                  <div>
                    <h3 className="font-medium text-white mb-1">Website</h3>
                    <p className="text-blue-400">{campaign.website_url}</p>
                  </div>
                )}
                {campaign.support_email && (
                  <div>
                    <h3 className="font-medium text-white mb-1">Support Email</h3>
                    <p className="text-blue-400">{campaign.support_email}</p>
                  </div>
                )}
                {campaign.price_info && (
                  <div className="md:col-span-2">
                    <h3 className="font-medium text-white mb-1">Pricing Information</h3>
                    <p className="text-muted-foreground">{campaign.price_info}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Campaign Timeline */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Campaign Timeline</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-white">{formatDate(campaign.created_at)}</span>
              </div>
              {campaign.campaign_start && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Started:</span>
                  <span className="text-white">{formatDate(campaign.campaign_start)}</span>
                </div>
              )}
              {campaign.campaign_end && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ends:</span>
                  <span className="text-white">{formatDate(campaign.campaign_end)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={getStatusColor(campaign.status)}>
                  {campaign.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Status-specific messages */}
          {campaign.status === 'pending' && (
            <Card className="p-4 bg-yellow-900/20 border-yellow-600">
              <p className="text-yellow-400 text-center">
                ⏳ Your campaign is pending approval. It will go live once approved by our team.
              </p>
            </Card>
          )}

          {campaign.status === 'rejected' && (
            <Card className="p-4 bg-red-900/20 border-red-600">
              <p className="text-red-400 text-center">
                ❌ Your campaign was rejected. Please review our advertising guidelines and try again.
              </p>
            </Card>
          )}

          {campaign.status === 'approved' && (
            <Card className="p-4 bg-blue-900/20 border-blue-600">
              <p className="text-blue-400 text-center">
                ✅ Your campaign has been approved and will start running soon!
              </p>
            </Card>
          )}

          {campaign.status === 'active' && (
            <Card className="p-4 bg-green-900/20 border-green-600">
              <p className="text-green-400 text-center">
                🟢 Your campaign is currently active and reaching users!
              </p>
            </Card>
          )}

          {campaign.status === 'expired' && (
            <Card className="p-4 bg-gray-900/20 border-gray-600">
              <p className="text-gray-400 text-center">
                ⏰ Your campaign has ended. Create a new campaign to continue promoting your business.
              </p>
            </Card>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default CampaignDetail;