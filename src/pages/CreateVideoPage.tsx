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

const FILTERS = [
  { name: 'None', style: 'none', icon: '/filters/none.png' },
  { name: 'Dream', style: 'dreamglow', icon: '/filters/dream.png' },
  { name: 'Peach', style: 'peachypop', icon: '/filters/peach.png' },
  { name: 'Frost', style: 'frostedglass', icon: '/filters/frost.png' },
  { name: 'Neon', style: 'neonmuse', icon: '/filters/neon.png' },
  { name: 'Retro', style: 'retrovibe', icon: '/filters/retro.png' },
  { name: 'Blush', style: 'blushbloom', icon: '/filters/blush.png' },
  { name: 'Sun', style: 'sunkissed', icon: '/filters/sun.png' },
  { name: 'Urban', style: 'urbanfade', icon: '/filters/urban.png' },
  { name: 'Cosmic', style: 'cosmicaura', icon: '/filters/cosmic.png' },
  { name: 'Honey', style: 'honeyhaze', icon: '/filters/honey.png' },
  { name: 'Velvet', style: 'velvetskin', icon: '/filters/velvet.png' },
  { name: 'Arctic', style: 'arcticchill', icon: '/filters/arctic.png' },
  { name: 'Noir', style: 'noirchic', icon: '/filters/noir.png' },
  { name: 'Citrus', style: 'citrussplash', icon: '/filters/citrus.png' },
  { name: 'Mint', style: 'mintyfresh', icon: '/filters/mint.png' },
  { name: 'Dusk', style: 'duskdream', icon: '/filters/dusk.png' },
  { name: 'Glam', style: 'glamourdust', icon: '/filters/glam.png' },
  { name: 'Latte', style: 'lattecream', icon: '/filters/latte.png' },
  { name: 'Sapphire', style: 'sapphireshine', icon: '/filters/sapphire.png' },
  { name: 'Candy', style: 'candycloud', icon: '/filters/candy.png' },
];

const FILTER_CSS: Record<string, string> = {
  none: '',
  dreamglow: 'contrast(1.2) brightness(1.1) saturate(1.3) drop-shadow(0 0 8px #fff)',
  peachypop: 'sepia(0.3) hue-rotate(-10deg) brightness(1.1) saturate(1.2)',
  frostedglass: 'blur(2px) brightness(1.2)',
  neonmuse: 'contrast(1.5) saturate(2) drop-shadow(0 0 8px #0ff)',
  retrovibe: 'sepia(0.7) contrast(1.2)',
  sunkissed: 'brightness(1.2) sepia(0.2) hue-rotate(-20deg)',
  velvetskin: 'contrast(1.1) brightness(1.05) saturate(1.1)',
  cosmicaura: 'hue-rotate(90deg) saturate(1.5)',
  blushbloom: 'hue-rotate(-20deg) saturate(1.3)',
  urbanfade: 'grayscale(0.5) contrast(1.1)',
  honeyhaze: 'sepia(0.4) brightness(1.1)',
  arcticchill: 'hue-rotate(180deg) brightness(1.1)',
  noirchic: 'grayscale(1) contrast(1.2)',
  citrussplash: 'hue-rotate(30deg) saturate(1.3)',
  mintyfresh: 'hue-rotate(120deg) saturate(1.2)',
  duskdream: 'brightness(0.9) contrast(1.1) hue-rotate(-40deg)',
  glamourdust: 'contrast(1.3) brightness(1.2) drop-shadow(0 0 6px #fff)',
  lattecream: 'sepia(0.2) brightness(1.1)',
  sapphireshine: 'hue-rotate(200deg) saturate(1.4)',
  candycloud: 'hue-rotate(-90deg) brightness(1.1)',
};

const FILTER_THUMB_PLACEHOLDER = '/public/placeholder.svg';

const CreateVideoPage: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [filterIdx, setFilterIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('All');
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
    navigate("/upload");
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
      let thumbnailUrl = '';
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
      const { data: { publicUrl } } = supabase.storage
        .from('limeytt-uploads')
        .getPublicUrl(fileName);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (profileError || !profile) {
        throw new Error('Could not fetch user profile for video upload.');
      }
      const { data: insertData, error: dbError } = await supabase.from('videos').insert({
        title,
        description,
        video_url: publicUrl,
        thumbnail_url: thumbnailUrl,
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
      navigate("/feed");
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
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              className="w-full h-64 object-cover rounded-lg mb-4"
              style={{ filter: FILTER_CSS[FILTERS[filterIdx].style] || 'none' }}
            />
            {/* Filter carousel */}
            <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div
                className="flex gap-3 px-2 min-w-max relative scrollbar-thin scrollbar-thumb-gray-500"
                style={{ pointerEvents: 'auto', scrollSnapType: 'x mandatory', paddingLeft: 24, paddingRight: 24 }}
              >
                {FILTERS.map((filter, idx) => (
                  <div
                    key={filter.name + idx}
                    className={`flex flex-col items-center transition-transform duration-200 px-1 flex-shrink-0 ${idx === filterIdx ? 'scale-125 z-20' : 'opacity-60 z-10'}`}
                    style={{ minWidth: 60, scrollSnapAlign: 'center', paddingTop: 9, paddingBottom: 8 }}
                    onClick={() => setFilterIdx(idx)}
                    role="button"
                    tabIndex={0}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-1"
                      style={{ background: 'rgba(255,255,255,0.1)', border: idx === filterIdx ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.2)' }}
                    >
                      <img src={filter.icon || FILTER_THUMB_PLACEHOLDER} alt={filter.name} className="w-full h-full object-cover" />
                    </div>
                    <span
                      className="text-xs whitespace-nowrap"
                      style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '0 4px' }}
                    >
                      {filter.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="outline" onClick={handleRecapture}>
                Recapture
              </Button>
            </div>
          </>
        )}
      </div>
      {/* Upload form card below filter section */}
      {videoUrl && (
        <Card className="mt-6 p-6 max-w-md mx-auto">
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
            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={handleRecapture}
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