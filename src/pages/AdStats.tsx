import { useState, useEffect } from "react";
import { ArrowLeft, Eye, MousePointer, DollarSign, TrendingUp, BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getUserSponsoredAds } from "@/lib/adminUtils";
import BottomNavigation from "@/components/BottomNavigation";

interface SponsoredAdStats {
    id: string;
    title: string;
    description?: string;
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    business_name?: string;
    boost_duration: number;
    boost_cost: number;
    campaign_start?: string;
    campaign_end?: string;
    status: string;
    impressions: number;
    clicks: number;
    created_at: string;
}

const AdStats = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [ads, setAds] = useState<SponsoredAdStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadUserAds();
        }
    }, [user]);

    const loadUserAds = async () => {
        try {
            setLoading(true);
            const data = await getUserSponsoredAds(user?.id || '');
            // Transform the data to match our interface
            const transformedData: SponsoredAdStats[] = (data || []).map((ad: any) => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                video_url: ad.video_url,
                thumbnail_url: ad.thumbnail_url,
                duration: ad.duration || 0,
                business_name: ad.business_name,
                boost_duration: ad.boost_duration,
                boost_cost: ad.boost_cost,
                campaign_start: ad.campaign_start,
                campaign_end: ad.campaign_end,
                status: ad.status,
                impressions: ad.impressions || 0,
                clicks: ad.clicks || 0,
                created_at: ad.created_at
            }));
            setAds(transformedData);
        } catch (error) {
            console.error('Error loading ads:', error);
            toast({
                title: "Error",
                description: "Failed to load your ad campaigns",
                variant: "destructive"
            });
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
            day: 'numeric'
        });
    };

    const calculateCTR = (clicks: number, impressions: number) => {
        if (impressions === 0) return 0;
        return ((clicks / impressions) * 100).toFixed(2);
    };

    const getTotalSpent = () => {
        return ads
            .filter(ad => ad.status !== 'draft' && ad.status !== 'rejected')
            .reduce((total, ad) => total + ad.boost_cost, 0);
    };

    const getTotalImpressions = () => {
        return ads.reduce((total, ad) => total + ad.impressions, 0);
    };

    const getTotalClicks = () => {
        return ads.reduce((total, ad) => total + ad.clicks, 0);
    };

    const getActiveCampaigns = () => {
        return ads.filter(ad => ad.status === 'active').length;
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(-1)}
                        className="p-2"
                    >
                        <ArrowLeft size={20} className="text-white" />
                    </Button>
                    <span
                        className="text-2xl font-black text-white tracking-wider logo-text-glow absolute left-1/2 transform -translate-x-1/2"
                        style={{
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            fontWeight: '900',
                            letterSpacing: '0.15em',
                            filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
                        }}
                    >
                        Ad Statistics
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/profile')}
                        className="p-2"
                    >
                        <X size={20} className="text-white" />
                    </Button>
                </div>
            </div>

            {/* Main content */}
            <div className="pt-24 p-4">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-2">
                                <DollarSign size={20} className="text-green-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Spent</p>
                                    <p className="text-lg font-bold text-green-400">
                                        TT${getTotalSpent().toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center gap-2">
                                <BarChart3 size={20} className="text-blue-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Active Ads</p>
                                    <p className="text-lg font-bold text-blue-400">
                                        {getActiveCampaigns()}
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
                                <MousePointer size={20} className="text-orange-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Clicks</p>
                                    <p className="text-lg font-bold text-orange-400">
                                        {getTotalClicks().toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Campaign List */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-white">My Campaigns</h2>
                            <Button
                                variant="neon"
                                size="sm"
                                onClick={() => navigate('/boost')}
                            >
                                Create New Campaign
                            </Button>
                        </div>

                        {loading ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">Loading your campaigns...</p>
                            </div>
                        ) : ads.length === 0 ? (
                            <div className="text-center py-12">
                                <BarChart3 size={48} className="mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-semibold mb-2 text-white">No campaigns yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Create your first boost campaign to start promoting your business
                                </p>
                                <Button
                                    variant="neon"
                                    onClick={() => navigate('/boost')}
                                >
                                    Create Campaign
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {ads.map(ad => (
                                    <Card
                                        key={ad.id}
                                        className="p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                                        onClick={() => navigate(`/campaign/${ad.id}`)}
                                    >
                                        <div className="flex gap-4">
                                            {/* Thumbnail */}
                                            <div className="w-20 h-28 bg-black rounded overflow-hidden flex-shrink-0">
                                                {ad.thumbnail_url ? (
                                                    <img
                                                        src={ad.thumbnail_url}
                                                        alt={ad.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                        <BarChart3 size={24} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Campaign Details */}
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="font-semibold text-white">{ad.title}</h3>
                                                        {ad.business_name && (
                                                            <p className="text-sm text-muted-foreground">{ad.business_name}</p>
                                                        )}
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

                                                {/* Campaign Stats */}
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-muted-foreground">Duration:</span>
                                                        <span className="ml-1 text-white">{ad.boost_duration} days</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Cost:</span>
                                                        <span className="ml-1 text-green-400">TT${ad.boost_cost}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Impressions:</span>
                                                        <span className="ml-1 text-purple-400">{ad.impressions.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Clicks:</span>
                                                        <span className="ml-1 text-orange-400">{ad.clicks.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">CTR:</span>
                                                        <span className="ml-1 text-blue-400">{calculateCTR(ad.clicks, ad.impressions)}%</span>
                                                    </div>
                                                </div>

                                                {/* Campaign Dates */}
                                                {(ad.campaign_start || ad.campaign_end) && (
                                                    <div className="flex gap-4 text-xs">
                                                        {ad.campaign_start && (
                                                            <div>
                                                                <span className="text-muted-foreground">Started:</span>
                                                                <span className="ml-1 text-white">{formatDate(ad.campaign_start)}</span>
                                                            </div>
                                                        )}
                                                        {ad.campaign_end && (
                                                            <div>
                                                                <span className="text-muted-foreground">Ends:</span>
                                                                <span className="ml-1 text-white">{formatDate(ad.campaign_end)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Performance Indicator */}
                                                {ad.status === 'active' && ad.impressions > 0 && (
                                                    <div className="flex items-center gap-2 pt-2">
                                                        <TrendingUp size={16} className="text-green-400" />
                                                        <span className="text-sm text-green-400">
                                                            {ad.impressions > 100 ? 'Performing well' : 'Building momentum'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Performance Tips */}
                    {ads.length > 0 && (
                        <Card className="p-4 bg-muted/50">
                            <h4 className="font-medium mb-2">📈 Performance Tips</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Higher CTR (Click-Through Rate) indicates more engaging content</li>
                                <li>• Active campaigns get more impressions during peak hours (6-9 PM)</li>
                                <li>• Include clear contact information for better conversion</li>
                                <li>• Longer campaigns (7+ days) typically perform better</li>
                            </ul>
                        </Card>
                    )}
                </div>
            </div>

            <BottomNavigation />
        </div>
    );
};

export default AdStats;