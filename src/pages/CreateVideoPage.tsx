import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from "react-router-dom";
import CameraModal from '@/components/CameraModal';

// Remove FILTERS, FILTER_CSS, filterIdx, and all filter carousel/filter overlay UI.
// In the video preview, remove any style applying a filter.
// Only show the video preview, recapture, and upload form.

const FILTER_THUMB_PLACEHOLDER = '/public/placeholder.svg';

// Utility to extract video duration
const extractVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      if (duration > 300) { // 5 minutes = 300 seconds
        reject(new Error('Video duration exceeds 5 minutes'));
        return;
      }
      resolve(duration);
    };
    video.onerror = (e) => {
      reject(new Error('Failed to load video for metadata extraction'));
    };
  });
};

// Generate thumbnail from video file
const generateThumbnail = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Seek to 1 second or 25% of the video, whichever is shorter
      const seekTime = Math.min(1, video.duration * 0.25);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 320; // Thumbnail width
      canvas.height = 568; // Thumbnail height (9:16 aspect ratio)

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        }, 'image/jpeg', 0.8);
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    video.onerror = (e) => reject(new Error('Failed to load video for thumbnail generation'));
  });
};

const CreateVideoPage: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('All');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Read video file and preview from navigation state
  useEffect(() => {
    if (location.state && location.state.file && location.state.preview) {
      setVideoFile(location.state.file);
      setVideoUrl(location.state.preview);
    } else {
      // If no video, redirect to upload page or show message
      navigate("/upload");
    }
  }, [location.state, navigate]);

  const handleRecapture = () => {
    setShowCameraModal(true);
  };

  // Handler for when a new video is captured in CameraModal
  const handleCameraVideo = (file: File, preview: string) => {
    setVideoFile(file);
    setVideoUrl(preview);
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setShowCameraModal(false);
  };

  const handleUpload = async () => {
    if (!videoFile || !user || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please record a video and add a title",
        variant: "destructive"
      });
      return;
    }
    setUploading(true);
    try {
      // Extract video duration and generate thumbnail
      let duration = 0;
      let thumbnailUrl = '';

      // Extract video duration
      try {
        duration = await extractVideoDuration(videoFile);
        if (!Number.isFinite(duration) || duration <= 0) {
          toast({
            title: "Invalid Video Duration",
            description: "Could not determine video duration. Please try a different video.",
            variant: "destructive"
          });
          setUploading(false);
          return;
        }
      } catch (durationError) {
        console.warn('Failed to extract duration:', durationError);
        toast({
          title: "Video Duration Issue",
          description: "Could not determine video duration. Continuing with upload.",
          variant: "warning"
        });
      }

      // If user picked a custom cover image, upload it
      if (coverImageFile) {
        const coverFileName = `${user.id}/thumbnails/cover_${Date.now()}.jpg`;
        const { error: coverError } = await supabase.storage
          .from('limeytt-uploads')
          .upload(coverFileName, coverImageFile);
        if (!coverError) {
          thumbnailUrl = coverFileName;
        } else {
          toast({ title: "Cover upload failed", description: coverError.message, variant: "destructive" });
        }
      } else {
        // Generate thumbnail from video
        try {
          const thumbnailBlob = await generateThumbnail(videoFile);
          const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const thumbnailFileName = `${user.id}/thumbnails/${Date.now()}.jpg`;
          const { error: thumbnailError } = await supabase.storage
            .from('limeytt-uploads')
            .upload(thumbnailFileName, thumbnailFile);
          if (!thumbnailError) {
            thumbnailUrl = thumbnailFileName;
          }
        } catch (thumbnailError) {
          console.warn('Failed to generate thumbnail:', thumbnailError);
          // Continue without thumbnail
        }
      }

      // Upload video file to storage
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('limeytt-uploads')
        .upload(fileName, videoFile);
      if (error) {
        toast({
          title: "File Too Large",
          description: "Your video is too large. The maximum allowed size is 50 MB.",
          variant: "destructive"
        });
        setUploading(false);
        return;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('limeytt-uploads')
        .getPublicUrl(fileName);
        
      // Fetch username and avatar_url from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (profileError || !profile) {
        throw new Error('Could not fetch user profile for video upload.');
      }
      
      // Insert metadata into videos table
      const { data: insertData, error: dbError } = await supabase.from('videos').insert({
        title,
        description,
        video_url: publicUrl,
        thumbnail_url: thumbnailUrl,
        duration,
        user_id: user.id,
        category,
        username: profile.username,
        avatar_url: profile.avatar_url,
      }).select();
      
      if (dbError) {
        throw dbError;
      }
      
      toast({
        title: "Upload Successful! 🎉",
        description: "Your content has been uploaded to Limey",
        className: "bg-green-600 text-white border-green-700"
      });
      
      setVideoFile(null);
      setVideoUrl(null);
      setTitle("");
      setDescription("");
      setCategory('All');
      setCoverImageFile(null);
      setCoverImagePreview(null);
      navigate("/upload");
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-8">
      {/* Camera/filter UI section */}
      <div className="max-w-2xl mx-auto p-4">
        {/* Remove file input for initial video selection, as video comes from navigation state */}
        {!videoUrl ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-400 rounded-lg">
            <Button variant="neon" onClick={handleRecapture}>
              Go Back
            </Button>
            <p className="text-muted-foreground mt-2">No video found. Please record a video first.</p>
          </div>
        ) : (
          <>
            <div className="w-full max-w-xs mx-auto aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center mb-4">
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              preload="metadata"
              poster=""
              style={{ backgroundColor: '#000000' }}
              className="w-full h-full object-cover"
            />
          </div>
            {/* Filter carousel */}
            {/* Remove FILTERS, FILTER_CSS, filterIdx, and all filter carousel/filter overlay UI. */}
            {/* In the video preview, remove any style applying a filter. */}
            {/* Only show the video preview, recapture, and upload form. */}
            {/* Centered Recapture button below video preview */}
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={handleRecapture}>
                Recapture
              </Button>
            </div>
            <CameraModal open={showCameraModal} onClose={() => setShowCameraModal(false)} onVideoCaptured={handleCameraVideo} />
          </>
        )}
      </div>
      {/* Upload form card below filter section */}
      {videoUrl && (
        <Card className="mt-6 p-6 max-w-md mx-auto">
          <div className="space-y-4">
            {/* Cover Image Selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Cover Image
              </label>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-24 h-36 bg-black rounded overflow-hidden flex items-center justify-center border border-border">
                  {coverImagePreview ? (
                    <img src={coverImagePreview} alt="Cover Preview" className="w-full h-full object-cover" />
                  ) : videoUrl ? (
                    <video src={videoUrl} preload="metadata" poster="" style={{ backgroundColor: '#000000' }} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs">No Cover</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="cover-image-input"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCoverImageFile(file);
                        setCoverImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <label htmlFor="cover-image-input">
                    <Button variant="outline" asChild className="cursor-pointer">
                      <span>Choose Cover Image</span>
                    </Button>
                  </label>
                  {coverImageFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCoverImageFile(null);
                        setCoverImagePreview(null);
                      }}
                    >
                      Use Default Thumbnail
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a custom cover image or use the default video thumbnail.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Title *
              </label>
              <Input
                placeholder="Give your content a catchy title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.length}/100 characters
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Category
              </label>
              <select
                className="w-full border rounded px-3 py-2 bg-background text-foreground"
                value={category || 'All'}
                onChange={e => setCategory(e.target.value)}
                required
              >
                <option value="All">All</option>
                <option value="Anime">Anime</option>
                <option value="Bar Limes">Bar Limes</option>
                <option value="Cartoon">Cartoon</option>
                <option value="Carnival">Carnival</option>
                <option value="Comedy">Comedy</option>
                <option value="Dance">Dance</option>
                <option value="Dancehall">Dancehall</option>
                <option value="DIY Projects">DIY Projects</option>
                <option value="Educational">Educational</option>
                <option value="Events">Events</option>
                <option value="Fete">Fete</option>
                <option value="Funny Vids">Funny Vids</option>
                <option value="HOW TOs">HOW TOs</option>
                <option value="Local News">Local News</option>
                <option value="Music Vids">Music Vids</option>
                <option value="Parties">Parties</option>
                <option value="Soca">Soca</option>
                <option value="Trini Celebs">Trini Celebs</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Description
              </label>
              <Textarea
                placeholder="Tell viewers about your content..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {description.length}/500 characters
              </p>
            </div>
            <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/upload")}
              disabled={uploading}
            >
              Cancel
            </Button>
              <Button
                variant="neon"
                onClick={handleUpload}
                disabled={uploading || !title.trim()}
                className="flex-1"
              >
                {uploading ? "Uploading..." : "Share to Limey 🚀"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CreateVideoPage; 