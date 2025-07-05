import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNavigation from "@/components/BottomNavigation";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('All');
  // Thumbnail selection removed, handled by backend or default
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
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
        resolve(duration);
      };
      video.onerror = (e) => reject(new Error('Failed to load video for metadata extraction'));
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
        
        // Generate thumbnail
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

      // Upload video file to new bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('limeytt-uploads')
        .upload(fileName, file);
      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('limeytt-uploads')
        .getPublicUrl(fileName);

      // Insert metadata into videos table
      const { data: insertData, error: dbError } = await supabase.from('videos').insert({
        title,
        description,
        video_url: publicUrl,
        thumbnail_url: thumbnailUrl,
        duration,
        user_id: user.id,
        category,
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
        description: "Your content has been uploaded to Limey"
      });

      // Reset form
      setFile(null);
      setTitle("");
      setDescription("");
      setPreview(null);
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Upload</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* File Upload Area */}
        <Card className="p-8 border-2 border-dashed border-border hover:border-primary transition-colors">
          <div className="text-center">
            {preview ? (
              <div className="mb-4">
                {file?.type.startsWith('video/') ? (
                  <video 
                    src={preview} 
                    className="max-w-full h-64 mx-auto rounded-lg"
                    controls
                  />
                ) : (
                  <img 
                    src={preview} 
                    alt="Preview"
                    className="max-w-full h-64 mx-auto rounded-lg object-cover"
                  />
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {file?.name} ({(file?.size || 0 / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📁</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Upload Your Content</h3>
                <p className="text-muted-foreground mb-4">
                  Select videos, images, or audio files to share with the Limey community
                </p>
              </div>
            )}
            
            <Input
              type="file"
              accept="video/*,image/*,audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="neon" asChild className="cursor-pointer">
                <span>{file ? "Change File" : "Select File"}</span>
              </Button>
            </label>
          </div>
        </Card>

        {/* Upload Form */}
        {file && (
          <Card className="mt-6 p-6">
            <div className="space-y-4">

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
                  <option value="Soca">Soca</option>
                  <option value="Dancehall">Dancehall</option>
                  <option value="Carnival">Carnival</option>
                  <option value="Comedy">Comedy</option>
                  <option value="Dance">Dance</option>
                  <option value="Music">Music</option>
                  <option value="Local News">Local News</option>
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

              {/* Thumbnail selection removed */}

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
          <h4 className="font-medium text-foreground mb-2">📝 Upload Tips</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
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