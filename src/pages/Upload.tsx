import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Paintbrush, Plus, RotateCcw, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNavigation from "@/components/BottomNavigation";
import { useNavigate, useLocation } from "react-router-dom";

const Upload = () => {
  const location = useLocation();
  const changeVideoInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('All');
  const { toast } = useToast();
  const { user } = useAuth();
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const navigate = useNavigate();

  // For direct camera capture
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (location.state?.file) setFile(location.state.file);
    if (location.state?.preview) setPreview(location.state.preview);
  }, [location.state]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: 'camera' | 'gallery') => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Only allow supported video types
      const supportedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/mov", "video/3gpp", "video/ogg", "video/x-matroska"];
      if (!supportedTypes.includes(selectedFile.type)) {
        toast({
          title: "Unsupported File Type",
          description: "Please select a supported video file (mp4, webm, mov, etc.)",
          variant: "destructive"
        });
        e.target.value = "";
        setFile(null);
        setPreview(null);
        return;
      }
      // Check file size (50 MB = 50 * 1024 * 1024 bytes)
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Your video is too large. The maximum allowed size is 50 MB. Please use a mobile app (like InShot, CapCut, or your phone's built-in editor) to compress your video before uploading.",
          variant: "destructive"
        });
        e.target.value = "";
        setFile(null);
        setPreview(null);
        return;
      }
      setFile(selectedFile);

      // Create preview for videos/images
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      // Auto-generate title from filename
      if (!title) {
        const name = selectedFile.name.split('.')[0];
        setTitle(name.charAt(0).toUpperCase() + name.slice(1));
      }
    }
  };

  // Direct camera capture: open camera and go to create-video page
  const handleCreateClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleCreateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      navigate('/create-video', { state: { file: selectedFile, preview: url } });
    }
  };

  // Utility to extract video duration only
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
          toast({
            title: "Video Too Long",
            description: "Please select a video that is 5 minutes or less.",
            variant: "destructive"
          });
          setFile(null);
          setPreview(null);
          reject(new Error('Video duration exceeds 5 minutes'));
          return;
        }
        resolve(duration);
      };
      video.onerror = (e) => {
        // Show toast error and reset file input
        console.error('Video metadata extraction error:', e);
        toast({
          title: "Failed to Load Video",
          description: "Could not read video metadata. This may happen with unsupported formats or corrupted files. Try a different video, preferably one recorded with your phone camera (mp4, mov, webm).",
          variant: "destructive"
        });
        setFile(null);
        setPreview(null);
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

  // After successful upload to storage, insert metadata into the videos table
  const handleUpload = async () => {
    if (!file || !user || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a file and add a title",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Extract video duration and generate thumbnail
      let duration = 0;
      let thumbnailUrl = '';

      if (file.type.startsWith('video/')) {
        duration = await extractVideoDuration(file);

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
            const thumbnailBlob = await generateThumbnail(file);
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
      }

      // Upload video file to new bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('limeytt-uploads')
        .upload(fileName, file);
      if (error) {
        // Check for file size error
        if (error.message && error.message.toLowerCase().includes('maximum allowed size')) {
          toast({
            title: "File Too Large",
            description: "Your video is too large. The maximum allowed size is 50 MB.",
            variant: "destructive"
          });
          setUploading(false);
          return;
        }
        throw error;
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
        // Add more fields as needed (e.g., tags)
      }).select();

      if (dbError) {
        console.error('Database error details:', {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint
        });
        throw dbError;
      }

      toast({
        title: "Upload Successful! 🎉",
        description: "Your content has been uploaded to Limey",
        className: "bg-green-600 text-white border-green-700"
      });

      // Reset form
      setFile(null);
      setTitle("");
      setDescription("");
      setPreview(null);
      setCoverImageFile(null);
      setCoverImagePreview(null);
    } catch (error: any) {
      console.error('Upload error:', error);

      let errorMessage = "Something went wrong";

      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === '23503') {
        errorMessage = "User profile not found. Please try logging out and back in.";
      } else if (error.code === '23505') {
        errorMessage = "A video with this title already exists. Please choose a different title.";
      } else if (error.code === '42501') {
        errorMessage = "Permission denied. Please check your account status.";
      }

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Please Sign In</h1>
          <p className="text-muted-foreground mb-4">You need to be signed in to upload content.</p>
          <Button onClick={() => window.location.href = '/'} variant="neon">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center">
          <span
            className="text-2xl font-black text-white tracking-wider logo-text-glow"
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: '900',
              letterSpacing: '0.15em',
              filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
            }}
          >
            Upload
          </span>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* File Upload Area */}
        <Card className="p-8 border-2 border-dashed border-border hover:border-primary transition-colors">
        <div className="text-center">
          {preview ? (
            <>
              <div className="mb-2 w-full max-w-xs mx-auto aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {file?.type.startsWith('video/') ? (
                  <video 
                    src={preview} 
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img 
                    src={preview} 
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {file?.name} ({((file?.size || 0) / 1024 / 1024).toFixed(2)} MB)
              </p>
              {/* Hidden file input for changing video */}
              <input
        type="file"
        accept="video/*"
        className="hidden"
        ref={changeVideoInputRef}
        onChange={e => handleFileSelect(e, 'gallery')}
      />
      <div className="flex justify-center mt-4">
        <Button
          variant="outline"
          onClick={() => {
            if (changeVideoInputRef.current) changeVideoInputRef.current.value = '';
            changeVideoInputRef.current?.click();
          }}
        >
          Change Video
        </Button>
      </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📁</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Create or Upload Your Content</h3>
                <p className="text-muted-foreground mb-4">
                  Use the Create button to record a new video, or Upload to select an existing video or image to share with the Limey community.
                </p>
              </div>
              {/* Hidden file input for Create (camera) */}
              <input
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleCreateFile}
              />
              {/* Upload/Change Video button triggers the regular input (no capture) */}
              <input
                type="file"
                accept="video/*"
                onChange={e => handleFileSelect(e, 'gallery')}
                className="hidden"
                id="file-upload"
              />
              <div className="flex gap-3 justify-center">
                <Button variant="neon" className="flex items-center gap-2" onClick={handleCreateClick}>
                  <Paintbrush size={18} />
                  Create
                </Button>
                <label htmlFor="file-upload">
                  <Button variant="neon" asChild className="cursor-pointer flex items-center gap-2">
                    <span className="flex items-center gap-2">
                      <Plus size={18} />
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
            </>
          )}
        </div>
      </Card>

        {/* Upload Form */}
        {file && (
          <Card className="mt-6 p-6">
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
                    ) : preview ? (
                      <video src={preview} className="w-full h-full object-cover" />
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
                      <Button variant="outline" className="cursor-pointer" asChild>
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

              {/* Content Type Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {file.type.startsWith('video/') && (
                  <Badge variant="secondary">🎬 Video</Badge>
                )}
                {file.type.startsWith('image/') && (
                  <Badge variant="secondary">📷 Image</Badge>
                )}
                {file.type.startsWith('audio/') && (
                  <Badge variant="secondary">🎵 Audio</Badge>
                )}
                <Badge variant="outline">Trinidad & Tobago</Badge>
              </div>

              {/* Upload Button */}
              <div className="flex space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setTitle("");
                    setDescription("");
                  }}
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

        {/* Upload Tips */}
        <Card className="mt-6 p-4 bg-muted/50">
          <h4 className="font-medium text-foreground mb-2 text-center">📝 Upload Tips</h4>
          <ul className="text-sm text-muted-foreground space-y-4 text-center">
            <li>• <b>Max video duration:</b> 5 minutes</li>
            <li>• <b>Max file size:</b> 50 MB</li>
            <li>• <b>Supported file types:</b> mp4, mov, webm, 3gp, ogg, mkv</li>
            <li>• If your video is too large, use free apps like <b>CapCut</b>, <b>InShot</b>, or your phone's built-in editor to compress the video and maintain quality before uploading.</li>
            <li>• Keep videos under 60 seconds for best engagement</li>
            <li>• Use good lighting and clear audio</li>
            <li>• Add hashtags in your description to reach more viewers</li>
            <li>• Upload during peak hours (6-9 PM) for maximum views</li>
          </ul>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Upload;