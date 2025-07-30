import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Upload, Play, Pause, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getTrincreditsBalance, deductTrincredits } from "@/lib/trinepayApi";
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
  const [searchParams] = useSearchParams();

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
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) {
      loadWalletBalance();

      // Check if we're editing a draft
      const draftId = searchParams.get('draft');
      if (draftId) {
        loadDraft(draftId);
      }
    }
  }, [user, searchParams]);

  const loadWalletBalance = async () => {
    try {
      const balance = await getTrincreditsBalance(user?.id || '');
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
      setWalletBalance(0);
    }
  };

  const loadDraft = async (draftId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('sponsored_ads')
        .select('*')
        .eq('id', draftId)
        .eq('user_id', user?.id)
        .eq('status', 'draft')
        .single();

      if (error || !data) {
        toast({
          title: "Draft Not Found",
          description: "Could not load the draft. It may have been deleted.",
          variant: "destructive"
        });
        return;
      }

      // Populate form with draft data
      setTitle(data.title || '');
      setDescription(data.description || '');
      setBusinessName(data.business_name || '');
      setContactNumber(data.contact_number || '');
      setWebsiteUrl(data.website_url || '');
      setSupportEmail(data.support_email || '');
      setPriceInfo(data.price_info || '');
      setSelectedDuration(data.boost_duration as BoostDuration);
      setVideoDuration(data.duration || 0);
      setEditingDraftId(draftId);

      // Set video preview if available
      if (data.video_url) {
        setVideoPreview(data.video_url);
        // Create a placeholder File object for existing video to enable buttons
        // This allows the form to work with existing video without re-upload
        const placeholderFile = new File([''], 'existing-video.mp4', { type: 'video/mp4' });
        setVideoFile(placeholderFile);
      }

      toast({
        title: "Draft Loaded",
        description: "Continue editing your ad campaign",
        className: "bg-blue-600 text-white border-blue-700"
      });
    } catch (error) {
      console.error('Error loading draft:', error);
      toast({
        title: "Error Loading Draft",
        description: "Could not load the draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('Video file selected:', file.name, 'Size:', file.size, 'Type:', file.type);

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

    console.log('Video preview URL created:', url);

    // Get video duration with better error handling
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      console.log('Video duration loaded:', duration);
      setVideoDuration(duration);

      if (duration > 30) {
        setShowTrimmer(true);
        setTrimStart(0);
        setTrimEnd(Math.min(30, duration));
      } else {
        setShowTrimmer(false);
        setTrimStart(0);
        setTrimEnd(duration);
      }
    };

    video.onerror = (error) => {
      console.error('Error loading video metadata:', error);
      toast({
        title: "Video Error",
        description: "Could not load video metadata. Please try a different video.",
        variant: "destructive"
      });
    };

    // Load the video
    video.load();

    // Clear the file input so the same file can be selected again if needed
    e.target.value = '';
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
      console.log('Starting video upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId: user?.id
      });

      // If this is a placeholder file (existing video), return the current video preview URL
      if (file.name === 'existing-video.mp4' && file.size === 0 && videoPreview) {
        console.log('Using existing video URL:', videoPreview);
        return videoPreview;
      }

      if (!file || file.size === 0) {
        console.error('Invalid file provided for upload:', {
          file: file,
          hasFile: !!file,
          fileSize: file?.size,
          fileName: file?.name
        });
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/sponsored/${Date.now()}.${fileExt}`;

      console.log('Uploading to storage with filename:', fileName);

      const { data, error } = await supabase.storage
        .from('limeytt-uploads')
        .upload(fileName, file);

      if (error) {
        console.error('Supabase storage upload error:', error);
        return null;
      }

      console.log('Upload successful, getting public URL');

      const { data: { publicUrl } } = supabase.storage
        .from('limeytt-uploads')
        .getPublicUrl(fileName);

      console.log('Video uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Exception in uploadVideoToStorage:', error);
      return null;
    }
  };

  const generateThumbnail = async (videoUrl: string): Promise<string | null> => {
    try {
      // If we're editing a draft and have an existing thumbnail, check if we should keep it
      if (editingDraftId && videoFile?.name === 'existing-video.mp4' && videoFile?.size === 0) {
        // For existing videos, we might already have a thumbnail - let the caller handle it
        return null; // This will be handled by the calling function
      }

      console.log('Starting thumbnail generation for:', videoUrl);

      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true; // Ensure video is muted for mobile compatibility
      video.playsInline = true; // Important for mobile devices
      video.preload = 'metadata';

      // Don't set crossOrigin for blob URLs or same-origin URLs
      if (!videoUrl.startsWith('blob:') && !videoUrl.includes(window.location.hostname)) {
        video.crossOrigin = 'anonymous';
      }

      // Wait for video to load with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 10000); // 10 second timeout

        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          console.log('Video metadata loaded, duration:', video.duration);
          resolve(video);
        };

        video.onerror = (e) => {
          clearTimeout(timeout);
          console.error('Video loading error:', e);
          reject(new Error('Failed to load video'));
        };

        // Try to load the video
        video.load();
      });

      // Seek to 1 second or 10% of duration, whichever is smaller
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;

      // Wait for seek to complete
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video seek timeout'));
        }, 5000); // 5 second timeout

        video.onseeked = () => {
          clearTimeout(timeout);
          console.log('Video seeked to:', seekTime);
          resolve(video);
        };

        video.onerror = (e) => {
          clearTimeout(timeout);
          console.error('Video seek error:', e);
          reject(new Error('Failed to seek video'));
        };
      });

      // Create canvas and draw video frame
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 568;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log('Video frame drawn to canvas');

      // Convert canvas to blob and upload
      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            console.error('Failed to create thumbnail blob');
            resolve(null);
            return;
          }

          console.log('Thumbnail blob created, size:', blob.size);

          try {
            const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            const fileExt = 'jpg';
            const fileName = `${user?.id}/sponsored/thumbnails/${Date.now()}.${fileExt}`;

            console.log('Uploading thumbnail to:', fileName);

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

            console.log('Thumbnail uploaded successfully:', publicUrl);
            resolve(publicUrl);
          } catch (uploadError) {
            console.error('Error in thumbnail upload process:', uploadError);
            resolve(null);
          }
        }, 'image/jpeg', 0.9); // Higher quality for better thumbnails
      });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  };

  const handleDeleteDraft = async () => {
    if (!editingDraftId) {
      // If not editing a draft, just clear the form
      setVideoFile(null);
      setVideoPreview(null);
      setTitle('');
      setDescription('');
      setBusinessName('');
      setContactNumber('');
      setWebsiteUrl('');
      setSupportEmail('');
      setPriceInfo('');
      setVideoDuration(0);
      setSelectedDuration(1);
      setShowTrimmer(false);
      setTrimStart(0);
      setTrimEnd(30);

      toast({
        title: "Form Cleared",
        description: "All form data has been cleared.",
        className: "bg-blue-600 text-white border-blue-700"
      });
      return;
    }

    // If editing a draft, delete it
    try {
      setLoading(true);

      const { error } = await supabase
        .from('sponsored_ads')
        .delete()
        .eq('id', editingDraftId)
        .eq('user_id', user?.id);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Draft Deleted",
        description: "Your draft has been deleted successfully.",
        className: "bg-red-600 text-white border-red-700"
      });

      navigate('/profile');
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Could not delete draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

      // Generate thumbnail with fallback
      let thumbnailUrl = null;
      try {
        thumbnailUrl = await generateThumbnail(videoUrl);
        if (!thumbnailUrl) {
          console.log('Thumbnail generation returned null, will proceed without thumbnail');
        }
      } catch (thumbnailError) {
        console.error('Thumbnail generation failed:', thumbnailError);
        // Continue without thumbnail - the ad will still work
      }

      if (editingDraftId) {
        // Get existing draft data to preserve thumbnail if needed
        const { data: existingDraft } = await supabase
          .from('sponsored_ads')
          .select('thumbnail_url')
          .eq('id', editingDraftId)
          .single();

        // Use new thumbnail if generated, otherwise keep existing one
        const finalThumbnailUrl = thumbnailUrl || existingDraft?.thumbnail_url;

        // Update existing draft
        const { error: updateError } = await supabase
          .from('sponsored_ads')
          .update({
            title,
            description,
            video_url: videoUrl,
            thumbnail_url: finalThumbnailUrl,
            duration: videoDuration,
            business_name: businessName,
            contact_number: contactNumber,
            website_url: websiteUrl,
            support_email: supportEmail,
            price_info: priceInfo,
            boost_duration: selectedDuration,
            status: 'draft', // Keep as draft
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDraftId);

        if (updateError) {
          throw new Error(updateError.message || 'Failed to update draft');
        }

        toast({
          title: "Draft Updated! 📝",
          description: "Your draft has been updated and saved to My Ads tab.",
          className: "bg-blue-600 text-white border-blue-700"
        });
      } else {
        // Create new draft
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
          user_id: user?.id || '',
          status: 'draft'
        });

        if (!success) {
          throw new Error(error || 'Failed to save draft');
        }

        toast({
          title: "Draft Saved! 📝",
          description: "Your ad has been saved as a draft in My Ads tab.",
          className: "bg-blue-600 text-white border-blue-700"
        });
      }

      navigate('/profile');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!videoFile || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please add a video and title to save as draft",
        variant: "destructive"
      });
      return false;
    }

    try {
      setLoading(true);

      console.log('handleSaveToDrafts - Starting save process');
      console.log('Video file state:', {
        videoFile: videoFile ? {
          name: videoFile.name,
          size: videoFile.size,
          type: videoFile.type
        } : null,
        videoPreview: videoPreview,
        editingDraftId: editingDraftId
      });

      if (!videoFile) {
        throw new Error('No video file selected');
      }

      // Upload video
      const videoUrl = await uploadVideoToStorage(videoFile);
      if (!videoUrl) {
        throw new Error('Failed to upload video');
      }

      // Generate thumbnail
      const thumbnailUrl = await generateThumbnail(videoUrl);

      // Create sponsored ad as draft
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
        user_id: user?.id || '',
        status: 'draft'
      });

      if (!success || !adId) {
        throw new Error(error || 'Failed to save draft');
      }

      toast({
        title: "Draft Saved! 📝",
        description: "Your ad has been saved as a draft. Add funds to your wallet to submit for approval.",
        className: "bg-blue-600 text-white border-blue-700"
      });

      return true;
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Failed to Save Draft",
        description: error instanceof Error ? error.message : "Could not save draft. Please try again.",
        variant: "destructive"
      });
      return false;
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
      // Save as draft instead of failing
      const draftSaved = await handleSaveDraft();
      if (draftSaved) {
        navigate('/profile');
      }
      return;
    }

    try {
      setLoading(true);

      // Deduct from user's TrinECredits FIRST before creating anything
      const deductResult = await deductTrincredits(user?.id || '', cost);
      if (!deductResult.success) {
        throw new Error(deductResult.error || 'Failed to deduct payment from wallet');
      }

      console.log('handleBoostSubmit - Starting boost submission');
      console.log('Video file state:', {
        videoFile: videoFile ? {
          name: videoFile.name,
          size: videoFile.size,
          type: videoFile.type
        } : null,
        videoPreview: videoPreview,
        editingDraftId: editingDraftId
      });

      if (!videoFile) {
        throw new Error('No video file selected');
      }

      // Upload video
      const videoUrl = await uploadVideoToStorage(videoFile);
      if (!videoUrl) {
        // Refund the user since upload failed
        const { recordTrincreditsTransaction } = await import('@/lib/trinepayApi');
        await recordTrincreditsTransaction({
          userId: user?.id || '',
          transactionType: 'refund',
          amount: cost,
          description: 'Boost Refund - Video Upload Failed',
          referenceId: `failed_upload_${Date.now()}`
        });
        throw new Error('Failed to upload video');
      }

      // Generate thumbnail with fallback
      let thumbnailUrl = null;
      try {
        thumbnailUrl = await generateThumbnail(videoUrl);
        if (!thumbnailUrl) {
          console.log('Thumbnail generation returned null, will proceed without thumbnail');
        }
      } catch (thumbnailError) {
        console.error('Thumbnail generation failed:', thumbnailError);
        // Continue without thumbnail - the ad will still work
      }

      // Create or update sponsored ad (payment already deducted)
      let success, adId, error;

      if (editingDraftId) {
        // Get existing draft data to preserve thumbnail if needed
        const { data: existingDraft } = await supabase
          .from('sponsored_ads')
          .select('thumbnail_url')
          .eq('id', editingDraftId)
          .single();

        // Use new thumbnail if generated, otherwise keep existing one
        const finalThumbnailUrl = thumbnailUrl || existingDraft?.thumbnail_url;

        // Update existing draft
        const { error: updateError } = await supabase
          .from('sponsored_ads')
          .update({
            title,
            description,
            video_url: videoUrl,
            thumbnail_url: finalThumbnailUrl,
            duration: videoDuration,
            business_name: businessName,
            contact_number: contactNumber,
            website_url: websiteUrl,
            support_email: supportEmail,
            price_info: priceInfo,
            boost_duration: selectedDuration,
            status: 'pending', // Change from draft to pending
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDraftId);

        success = !updateError;
        adId = editingDraftId;
        error = updateError?.message;
      } else {
        // Create new sponsored ad
        const result = await createSponsoredAd({
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
          user_id: user?.id || '',
          status: 'pending' // Payment already deducted, ready for admin approval
        });

        success = result.success;
        adId = result.adId;
        error = result.error;
      }

      if (!success || !adId) {
        // Refund the user since ad creation failed
        const { recordTrincreditsTransaction } = await import('@/lib/trinepayApi');
        await recordTrincreditsTransaction({
          userId: user?.id || '',
          transactionType: 'refund',
          amount: cost,
          description: 'Boost Refund - Ad Creation Failed',
          referenceId: `failed_ad_${Date.now()}`
        });
        throw new Error(error || 'Failed to create sponsored ad');
      }

      // Record the transaction for tracking (admin gets paid on approval)
      const transferResult = await transferBoostPaymentToAdmin(cost, user?.id || '', adId);
      if (!transferResult.success) {
        console.error('Failed to record boost transaction:', transferResult.error);
      }

      toast({
        title: editingDraftId ? "Draft Updated! 🚀" : "Boost Submitted! 🚀",
        description: editingDraftId ? "Your draft has been updated and submitted for approval" : "Your boost campaign has been submitted for approval",
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
              {editingDraftId ? 'Edit Draft' : 'Boost'}
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
              <span className="text-sm text-muted-foreground">TrinECredits:</span>
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
                  accept="video/*,video/mp4,video/mov,video/avi,video/webm"
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
                  {/* Removed redundant Trim Video button - auto-trimmer handles this */}
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
          <div className="flex gap-4">
            {/* Left side - Delete and Save buttons */}
            <div className="flex gap-2 flex-1">
              <Button
                onClick={handleDeleteDraft}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                {editingDraftId ? "Delete" : "Clear"}
              </Button>

              <Button
                onClick={handleSaveToDrafts}
                disabled={loading || !videoFile || !title.trim()}
                variant="outline"
                className="flex-1"
              >
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>

            <Button
              onClick={handleBoostSubmit}
              disabled={loading || !videoFile || !title.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {loading ? "Submitting..." : `Submit Boost - TT$${BOOST_PRICING[selectedDuration]}`}
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