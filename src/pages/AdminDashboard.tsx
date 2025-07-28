import { useState, useEffect } from "react";
import { ArrowLeft, Eye, Check, X, DollarSign, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  getAllSponsoredAds, 
  approveSponsoredAd, 
  rejectSponsoredAd 
} from "@/lib/adminUtils";
import BottomNavigation from "@/components/BottomNavigation";

interface SponsoredAd {
  id: string;
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
  boost_duration: number;
  boost_cost: number;
  campaign_start?: string;
  campaign_end?: string;
  status: string;
  impressions: number;
  clicks: number;
  created_at: string;
  profiles?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadAds();
  }, [isAdmin, navigate]);

  const loadAds = async () => {
    try {
      setLoading(true);
      console.log('Admin dashboard loading ads...');
      const data = await getAllSponsoredAds();
      console.log('Admin dashboard received ads:', data?.length || 0);
      setAds(data);
    } catch (error) {
      console.error('Error loading ads:', error);
      toast({
        title: "Error",
        description: "Failed to load sponsored ads",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (adId: string) => {
    setProcessingId(adId);
    try {
      const result = await approveSponsoredAd(adId);
      if (result.success) {
        toast({
          title: "Ad Approved",
          description: "The sponsored ad has been approved and will go live",
          className: "bg-green-600 text-white border-green-700"
        });
        loadAds(); // Refresh the list
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve ad",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (adId: string) => {
    setProcessingId(adId);
    try {
      const result = await rejectSponsoredAd(adId);
      if (result.success) {
        toast({
          title: "Ad Rejected",
          description: "The sponsored ad has been rejected",
          className: "bg-red-600 text-white border-red-700"
        });
        loadAds(); // Refresh the list
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject ad",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
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

  const calculateRevenue = () => {
    return ads
      .filter(ad => ad.status !== 'draft' && ad.status !== 'rejected')
      .reduce((total, ad) => total + ad.boost_cost, 0);
  };

  const getActiveAdsCount = () => {
    return ads.filter(ad => ad.status === 'active').length;
  };

  const getTotalImpressions = () => {
    return ads.reduce((total, ad) => total + ad.impressions, 0);
  };

  const getTotalClicks = () => {
    return ads.reduce((total, ad) => total + ad.clicks, 0);
  };

  const filterAdsByStatus = (status: string) => {
    return ads.filter(ad => ad.status === status);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
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
            Admin Dashboard
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="pt-24 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign size={20} className="text-green-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-lg font-bold text-green-400">
                    TT${calculateRevenue().toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Ads</p>
                  <p className="text-lg font-bold text-blue-400">
                    {getActiveAdsCount()}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Eye size={20} className="text-purple-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Impressions</p>
                  <p className="text-lg font-bold text-purple-400">
                    {getTotalImpressions().toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-orange-400">👆</span>
                <div>
                  <p className="text-sm text-muted-foreground">Clicks</p>
                  <p className="text-lg font-bold text-orange-400">
                    {getTotalClicks().toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Ads Management */}
          <Card className="p-6">
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger 
                  value="pending"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                  title="Pending Ads"
                >
                  ⏳ {filterAdsByStatus('pending').length}
                </TabsTrigger>
                <TabsTrigger 
                  value="active"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                  title="Active Ads"
                >
                  🟢 {filterAdsByStatus('active').length}
                </TabsTrigger>
                <TabsTrigger 
                  value="approved"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                  title="Approved Ads"
                >
                  ✅ {filterAdsByStatus('approved').length}
                </TabsTrigger>
                <TabsTrigger 
                  value="expired"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                  title="Expired Ads"
                >
                  ⏰ {filterAdsByStatus('expired').length}
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                  title="Rejected Ads"
                >
                  ❌ {filterAdsByStatus('rejected').length}
                </TabsTrigger>
              </TabsList>

              {['pending', 'active', 'approved', 'expired', 'rejected'].map(status => (
                <TabsContent key={status} value={status} className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading ads...</p>
                    </div>
                  ) : filterAdsByStatus(status).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No {status} ads found</p>
                    </div>
                  ) : (
                    filterAdsByStatus(status).map(ad => (
                      <Card key={ad.id} className="p-4">
                        <div className="flex gap-4">
                          {/* Video Thumbnail */}
                          <div className="w-24 h-32 bg-black rounded overflow-hidden flex-shrink-0">
                            {ad.thumbnail_url ? (
                              <img 
                                src={ad.thumbnail_url} 
                                alt={ad.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                No thumbnail
                              </div>
                            )}
                          </div>

                          {/* Ad Details */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-white">{ad.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  by @{ad.profiles?.username || 'Unknown'}
                                </p>
                              </div>
                              <Badge className={getStatusColor(ad.status)}>
                                {ad.status.toUpperCase()}
                              </Badge>
                            </div>

                            {ad.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {ad.description}
                              </p>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="ml-1 text-white">{ad.duration}s</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Boost:</span>
                                <span className="ml-1 text-white">{ad.boost_duration} days</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Cost:</span>
                                <span className="ml-1 text-green-400">TT${ad.boost_cost}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Created:</span>
                                <span className="ml-1 text-white">{formatDate(ad.created_at)}</span>
                              </div>
                            </div>

                            {(ad.impressions > 0 || ad.clicks > 0) && (
                              <div className="flex gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Impressions:</span>
                                  <span className="ml-1 text-purple-400">{ad.impressions.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Clicks:</span>
                                  <span className="ml-1 text-orange-400">{ad.clicks.toLocaleString()}</span>
                                </div>
                                {ad.impressions > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">CTR:</span>
                                    <span className="ml-1 text-blue-400">
                                      {((ad.clicks / ad.impressions) * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Business Details */}
                            {(ad.business_name || ad.contact_number || ad.website_url) && (
                              <div className="text-xs space-y-1 pt-2 border-t border-border">
                                {ad.business_name && (
                                  <div>
                                    <span className="text-muted-foreground">Business:</span>
                                    <span className="ml-1 text-white">{ad.business_name}</span>
                                  </div>
                                )}
                                {ad.contact_number && (
                                  <div>
                                    <span className="text-muted-foreground">Contact:</span>
                                    <span className="ml-1 text-white">{ad.contact_number}</span>
                                  </div>
                                )}
                                {ad.website_url && (
                                  <div>
                                    <span className="text-muted-foreground">Website:</span>
                                    <span className="ml-1 text-blue-400">{ad.website_url}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Action Buttons */}
                            {ad.status === 'pending' && (
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(ad.id)}
                                  disabled={processingId === ad.id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check size={16} className="mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(ad.id)}
                                  disabled={processingId === ad.id}
                                >
                                  <X size={16} className="mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default AdminDashboard;