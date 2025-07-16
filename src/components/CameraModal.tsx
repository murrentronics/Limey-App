import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { X, Circle, Video, RefreshCw, Zap, User, Check, Music, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Placeholder filter list (to be replaced with real filter logic)
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

const DURATIONS = [
  { label: '10m', value: 600 },
  { label: '60s', value: 60 },
  { label: '15s', value: 15 },
];

const MODES = [
  { label: 'PHOTO', value: 'photo' },
  { label: 'TEXT', value: 'text' },
];

// Add more advanced CSS filter effects for demo
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
  // Advanced demo beauty filters:
  beautysmooth: 'blur(1.5px) brightness(1.1) contrast(1.1) saturate(1.2)',
  beautyskin: 'contrast(1.15) brightness(1.08) sepia(0.08) saturate(1.15)',
  beautysculpt: 'contrast(1.2) brightness(1.1) saturate(1.2) drop-shadow(0 0 10px #fff8)',
};

// Add a placeholder image for filter thumbnails
const FILTER_THUMB_PLACEHOLDER = '/public/placeholder.svg';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onVideoCaptured: (videoFile: File, previewUrl: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ open, onClose, onVideoCaptured }) => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [durationIdx, setDurationIdx] = useState(1); // default to 60s
  const [modeIdx, setModeIdx] = useState(0); // default to PHOTO
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // 1. Add upload form state and logic at the top of CameraModal
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('All');
  const [hasTriggeredInput, setHasTriggeredInput] = useState(false);

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
      // Generate thumbnail
      let thumbnailUrl = '';
      if (videoFile.type.startsWith('video/')) {
        // ... thumbnail generation logic can be added here if needed ...
      }
      // Upload video file to new bucket
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
      // Reset form
      setVideoFile(null);
      setVideoUrl(null);
      setTitle("");
      setDescription("");
      setCategory('All');
      onClose();
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

  // When modal opens, trigger device camera
  useEffect(() => {
    if (open && !videoFile && fileInputRef.current && !hasTriggeredInput) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
      setHasTriggeredInput(true);
    }
    if (!open) {
      setVideoFile(null);
      setVideoUrl(null);
      setHasTriggeredInput(false);
    }
  }, [open]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    } else {
      // If user cancels, close modal
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      setRecording(false);
      setChunks([]);
      setError(null);
    }
  }, [open]);

  // Handler for confirm (tick) button - REMOVE
  // const handleConfirmEdits = () => { ... }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Hidden file input for device camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 w-full absolute top-0 left-0 z-20">
        <button className="text-white" onClick={onClose}><X size={28} /></button>
        {/* Removed Add Sound button from here */}
        <div className="flex gap-3">
          <button className="text-white"><RefreshCw size={22} /></button>
          <button className="text-white"><Zap size={22} /></button>
        </div>
      </div>
      {/* Video Preview Fullscreen */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full" style={{paddingBottom: '160px'}}>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-cover transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black text-white text-lg">
            Loading camera...
          </div>
        )}
        {/* Overlay filter name */}
        {/* Filter Carousel - floating above video, just above bottom nav, no overlay */}
        {/* Filter Carousel - floating above video, just above bottom nav, no overlay */}
        {/* Right-side vertical icons */}
        <div className="absolute right-4 top-32 flex flex-col gap-4 z-10">
          <button className="bg-black/40 rounded-full p-2 text-white"><User size={22} /></button>
          <button className="bg-black/40 rounded-full p-2 text-white flex items-center justify-center">
            <Music size={22} />
            <Plus size={16} style={{ marginLeft: '-8px', marginTop: '-8px' }} />
          </button>
          {/* In the JSX, remove all filter UI and the green tick button */}
        </div>
      </div>
      {/* Controls on black padding at bottom */}
      {videoUrl && (
        <div className="fixed left-0 right-0 bottom-0 z-50 flex flex-col items-center justify-end bg-black/90 pt-2 pb-2" style={{minHeight: '120px'}}>
          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-black/80 border-t border-white/10 p-2 z-50 flex justify-around items-center">
            <span className="text-white text-base font-semibold opacity-60">LIVE</span>
            <span className="text-white text-base font-semibold">POST</span>
            <span className="text-white text-base font-semibold opacity-60">CREATE</span>
          </div>
          {error && <div className="text-red-400 mt-2 text-center absolute bottom-24 w-full">{error}</div>}
        </div>
      )}
    </div>,
    document.body
  );
};

export default CameraModal; 