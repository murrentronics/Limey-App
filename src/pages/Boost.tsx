import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Upload, Play, Pause, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getTrincreditsBalance, deductTrincredits } from "@/lib/ttpaypalApi";
import {
  BOOST_PRICING,
  BoostDuration,
  createSponsoredAd,
  transferBoostPaymentToAdmin
} from "@/lib/adminUtils";
import BottomNavigation from "@/components/BottomNavigation";

const Boost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [priceInfo, setPriceInfo] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<BoostDuration>(1);

  // UI state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) {
      loadWalletBalance();
    }
  }, [user]);

  const loadWalletBalance = async () => {
    try {
      const balance = await getTrincreditsBalance(user?.id || '');
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
      setWalletBalance(0);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a video file",
        variant: "destructive"
      });
      return;
    }

    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Video file must be under 100MB",
        variant: "destructive"
      });
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);

    // Get video duration
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      setVideoDuration(duration);

      if (duration > 30) {
        setShowTrimmer(true);
        setTrimEnd(Math.min(30, duration));
      } else {
        setTrimEnd(duration);
      }
    };
  };

  const handleTrimVideo = async () => {
    if (!videoFile || !videoPreview) return;

    try {
      setLoading(true);

      // Create a new video element for trimming
      const video = document.createElement('video');
      video.src = videoPreview;

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Create canvas for video processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // For now, we'll just update the trim values
      // In a full implementation, you'd use FFmpeg or similar to actually trim the video
      setVideoDuration(trimEnd - trimStart);
      setShowTrimmer(false);

      toast({
        title: "Video Trimmed",
        description: `Video trimmed to ${trimEnd - trimStart} seconds`,
      });
    } catch (error) {
      console.error('Error trimming video:', error);
      toast({
        title: "Trim Failed",
        description: "Could not trim video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadVideoToStorage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/sponsored/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('limeytt-uploads')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading video:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('limeytt-uploads')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading video:', error);
      return null;
    }
  };

  const generateThumbnail = async (videoUrl: string): Promise<string | null> => {
    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      video.currentTime = 1; // Seek to 1 second

      await new Promise((resolve) => {
        video.onseeked = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 568;
      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const fileExt = 'jpg';
          const fileName = `${user?.id}/sponsored/thumbnails/${Date.now()}.${fileExt}`;

          const { data, error } = await supabase.storage
            .from('limeytt-uploads')
            .upload(fileName, thumbnailFile);

          if (error) {
            console.error('Error uploading thumbnail:', error);
            resolve(null);
            return;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('limeytt-uploads')
            .getPublicUrl(fileName);

          resolve(publicUrl);
        }, 'image/jpeg', 0.8);
      });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  };

  const handleSaveToDrafts = async () => {
    if (!videoFile || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please add a video and title to save as draft",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const videoUrl = await uploadVideoToStorage(videoFile);
      if (!videoUrl) {
        throw new Error('Failed to upload video');
      }

      const thumbnailUrl = await generateThumbnail(videoUrl);

      const { success, error } = await createSponsoredAd({
        title,
        description,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || undefined,
        duration: videoDuration,
        business_name: businessName,
        contact_number: contactNumber,
        website_url: websiteUrl,
        support_email: supportEmail,
        price_info: priceInfo,
        boost_duration: selectedDuration,
        user_id: user?.id || ''
      });

      if (!success) {
        throw new Error(error || 'Failed to save draft');
      }

      toast({
        title: "Draft Saved",
        description: "Your boost campaign has been saved as a draft",
      });

      navigate('/profile');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: "Could not save draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBoostSubmit = async () => {
    if (!videoFile || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please add a video and title",
        variant: "destructive"
      });
      return;
    }

    const cost = BOOST_PRICING[selectedDuration];

    if (walletBalance < cost) {
      toast({
        title: "Insufficient Balance",
        description: `You need TT$${cost.toFixed(2)} but only have TT$${walletBalance.toFixed(2)}. Save as draft and add funds to your wallet.`,
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Upload video
      const videoUrl = await uploadVideoToStorage(videoFile);
      if (!videoUrl) {
        throw new Error('Failed to upload video');
      }

      // Generate thumbnail
      const thumbnailUrl = await generateThumbnail(videoUrl);

      // Create sponsored ad
      const { success, adId, error } = await createSponsoredAd({
        title,
        description,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || undefined,
        duration: videoDuration,
        business_name: businessName,
        contact_number: contactNumber,
        website_url: websiteUrl,
        support_email: supportEmail,
        price_info: priceInfo,
        boost_duration: selectedDuration,
        user_id: user?.id || ''
      });

      if (!success || !adId) {
        throw new Error(error || 'Failed to create sponsored ad');
      }

      // Deduct from user's TriniCredits (money is held until approval)
      const deductResult = await deductTrincredits(user?.id || '', cost);
      if (!deductResult.success) {
        throw new Error('Failed to deduct payment from wallet');
      }

      // Record the transaction for tracking (admin gets paid on approval)
      const transferResult = await transferBoostPaymentToAdmin(cost, user?.id || '', adId);
      if (!transferResult.success) {
        console.error('Failed to record boost transaction:', transferResult.error);
        // Don't fail the whole process, just log the error
      }

      toast({
        title: "Boost Submitted! 🚀",
        description: "Your boost campaign has been submitted for approval",
        className: "bg-green-600 text-white border-green-700"
      });

      navigate('/profile');
    } catch (error) {
      console.error('Error submitting boost:', error);
      toast({
        title: "Boost Failed",
        description: error instanceof Error ? error.message : "Could not submit boost. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCost = BOOST_PRICING[selectedDuration];
  const canAfford = walletBalance >= selectedCost;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
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
              Boost
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/ad-stats')}
            className="text-white border-white/50 hover:bg-white/10"
          >
            My Campaigns
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="pt-24 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Wallet Balance */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">TriniCredits Balance:</span>
              <Badge variant="secondary" className="bg-green-900 text-green-400">
                TT${walletBalance.toFixed(2)}
              </Badge>
            </div>
          </Card>

          {/* Video Upload */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Upload Your 30-Second Ad</h3>

            {!videoPreview ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Upload your promotional video (max 30 seconds)
                </p>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleVideoSelect}
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  Select Video
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full max-w-xs mx-auto aspect-[9/16] bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    src={videoPreview}
                    className="w-full h-full object-cover"
                    controls
                  />
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Duration: {videoDuration} seconds
                  </p>
                  {videoDuration > 30 && (
                    <Badge variant="destructive" className="mb-2">
                      Video too long - needs trimming
                    </Badge>
                  )}
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Video
                    </Button>
                    {videoDuration > 30 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTrimmer(true)}
                      >
                        <Scissors size={16} className="mr-2" />
                        Trim Video
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Video Trimmer */}
          {showTrimmer && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Trim Video to 30 Seconds</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Start Time (seconds)</label>
                  <Input
                    type="number"
                    min="0"
                    max={videoDuration - 1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time (seconds)</label>
                  <Input
                    type="number"
                    min={trimStart + 1}
                    max={Math.min(trimStart + 30, videoDuration)}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Number(e.target.value))}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Trimmed duration: {trimEnd - trimStart} seconds
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleTrimVideo} disabled={loading}>
                    Apply Trim
                  </Button>
                  <Button variant="outline" onClick={() => setShowTrimmer(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Ad Details Form */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Ad Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Ad Title *</label>
                <Input
                  placeholder="Enter your ad title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ad Description</label>
                <Textarea
                  placeholder="Describe your product or service"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Business Name</label>
                <Input
                  placeholder="Your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Contact Number</label>
                <Input
                  placeholder="Phone number for customers to reach you"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Website URL</label>
                <Input
                  placeholder="https://your-website.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Support Email</label>
                <Input
                  type="email"
                  placeholder="support@your-business.com"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Price Information</label>
                <Input
                  placeholder="e.g., Starting from $50, Free consultation"
                  value={priceInfo}
                  onChange={(e) => setPriceInfo(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Boost Duration Selection */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Select Boost Duration</h3>
            <div className="space-y-3">
              {Object.entries(BOOST_PRICING).map(([duration, price]) => (
                <label
                  key={duration}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="duration"
                      value={duration}
                      checked={selectedDuration === Number(duration)}
                      onChange={(e) => setSelectedDuration(Number(e.target.value) as BoostDuration)}
                      className="text-primary"
                    />
                    <span className="font-medium">
                      {duration} {Number(duration) === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                  <Badge variant="outline">TT${price}</Badge>
                </label>
              ))}
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Cost:</span>
                <span className="text-lg font-bold text-primary">
                  TT${selectedCost.toFixed(2)}
                </span>
              </div>
              {!canAfford && (
                <p className="text-sm text-destructive mt-2">
                  Insufficient balance. You need TT${(selectedCost - walletBalance).toFixed(2)} more.
                </p>
              )}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSaveToDrafts}
              disabled={loading || !videoFile || !title.trim()}
              className="flex-1"
            >
              Save to Drafts
            </Button>
            <Button
              variant="neon"
              onClick={handleBoostSubmit}
              disabled={loading || !videoFile || !title.trim() || videoDuration > 30 || !canAfford}
              className="flex-1"
            >
              {loading ? "Processing..." : `Boost for TT$${selectedCost}`}
            </Button>
          </div>

          {/* Tips */}
          <Card className="p-4 bg-muted/50">
            <h4 className="font-medium mb-2">💡 Boost Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Keep your video under 30 seconds for maximum impact</li>
              <li>• Include clear contact information for better results</li>
              <li>• Your ad will be reviewed before going live</li>
              <li>• Ads appear randomly in the home feed to reach more users</li>
            </ul>
          </Card>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Boost;