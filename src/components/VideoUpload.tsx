import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Play } from "lucide-react";

interface VideoUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const VideoUpload = ({ isOpen, onClose, onUploadComplete }: VideoUploadProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("All");
  const [tags, setTags] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const categories = ["All", "Soca", "Dancehall", "Carnival", "Comedy", "Dance", "Music", "Local News"];

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a video file",
          variant: "destructive"
        });
      }
    }
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setThumbnailFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select an image file for thumbnail",
          variant: "destructive"
        });
      }
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleUpload = async () => {
    if (!videoFile || !title) {
      toast({
        title: "Missing information",
        description: "Please provide a title and select a video file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload video file
      const videoUrl = await uploadFile(videoFile, 'video-uploads', 'videos');
      
      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile) {
        thumbnailUrl = await uploadFile(thumbnailFile, 'video-uploads', 'thumbnails');
      }

      // Get video duration
      const video = document.createElement('video');
      video.src = previewUrl!;
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
      const duration = Math.floor(video.duration);

      // Save to database
      const { error } = await supabase
        .from('videos')
        .insert({
          title,
          description,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          category: category === "All" ? null : category,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : null,
          duration,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Video uploaded!",
        description: "Your video has been uploaded successfully",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("All");
      setTags("");
      setVideoFile(null);
      setThumbnailFile(null);
      setPreviewUrl(null);
      
      onUploadComplete();
      onClose();

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-green-500">Upload Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Preview */}
          {previewUrl ? (
            <div className="relative">
              <video 
                src={previewUrl} 
                className="w-full aspect-video rounded-lg object-cover"
                controls
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 text-white hover:bg-black/50"
                onClick={() => {
                  setVideoFile(null);
                  setPreviewUrl(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div 
              onClick={() => videoInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400">Click to select video</p>
              <p className="text-xs text-gray-500">MP4, MOV, AVI supported</p>
            </div>
          )}

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />

          {/* Title */}
          <Input
            placeholder="Video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          />

          {/* Description */}
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            rows={3}
          />

          {/* Category */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Tags */}
          <Input
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          />

          {/* Thumbnail */}
          <div>
            <Button
              variant="outline"
              onClick={() => thumbnailInputRef.current?.click()}
              className="w-full border-gray-700 text-gray-300 hover:text-white"
            >
              {thumbnailFile ? "Thumbnail Selected" : "Add Thumbnail (Optional)"}
            </Button>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailSelect}
              className="hidden"
            />
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || !videoFile || !title}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold"
          >
            {uploading ? "Uploading..." : "Upload Video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoUpload;