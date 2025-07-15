import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { X, Circle, Video, RefreshCw, Zap, User, Check, Music, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Placeholder filter list (to be replaced with real filter logic)
const FILTERS = [
  { name: 'Cosmic', style: 'cosmicaura', icon: '/filters/cosmic.png' },
  { name: 'Dream', style: 'dreamglow', icon: '/filters/dream.png' },
  { name: 'Peach', style: 'peachypop', icon: '/filters/peach.png' },
  { name: 'Frost', style: 'frostedglass', icon: '/filters/frost.png' },
  { name: 'Neon', style: 'neonmuse', icon: '/filters/neon.png' },
  { name: 'Retro', style: 'retrovibe', icon: '/filters/retro.png' },
  { name: 'Blush', style: 'blushbloom', icon: '/filters/blush.png' },
  { name: 'Urban', style: 'urbanfade', icon: '/filters/urban.png' },
  { name: '', style: 'blank' },
  { name: '', style: 'blank' },
  { name: '', style: 'blank' },
  { name: 'None', style: 'none', icon: '/filters/none.png' },
  { name: 'Sun', style: 'sunkissed', icon: '/filters/sun.png' },
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
  const [filterIdx, setFilterIdx] = useState(0); // default to 0 (Cosmic)
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [durationIdx, setDurationIdx] = useState(1); // default to 60s
  const [modeIdx, setModeIdx] = useState(0); // default to PHOTO
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filterListRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // When modal opens, trigger device camera
  useEffect(() => {
    if (open && !videoFile && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
    if (!open) {
      setVideoFile(null);
      setVideoUrl(null);
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

  // Center the first filter (Cosmic) on modal open
  useEffect(() => {
    if (open && videoUrl && filterListRef.current) {
      // Wait for DOM to render
      setTimeout(() => {
        filterListRef.current.scrollTo({ left: 0, behavior: 'auto' });
      }, 0);
    }
  }, [open, videoUrl]);

  // Update filterIdx based on scroll position
  const handleFilterScroll = useCallback(() => {
    if (!filterListRef.current) return;
    const container = filterListRef.current;
    const containerRect = container.getBoundingClientRect();
    let minDiff = Infinity;
    let selectedIdx = 0;
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      const childRect = child.getBoundingClientRect();
      const childCenter = childRect.left + childRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;
      const diff = Math.abs(childCenter - containerCenter);
      if (diff < minDiff) {
        minDiff = diff;
        selectedIdx = i;
      }
    }
    if (selectedIdx !== filterIdx) setFilterIdx(selectedIdx);
  }, [filterIdx]);

  const handleStartRecording = () => {
    setChunks([]);
    setRecording(true);
    const stream = webcamRef.current?.stream;
    if (stream) {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) setChunks((prev) => [...prev, e.data]);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        onVideoCaptured(file, url);
      };
      mediaRecorder.start();
    } else {
      setError('Camera not available');
    }
  };

  const handleStopRecording = () => {
    setRecording(false);
    mediaRecorderRef.current?.stop();
  };

  const handlePrevFilter = () => {
    setFilterIdx((idx) => (idx === 0 ? FILTERS.length - 1 : idx - 1));
  };
  const handleNextFilter = () => {
    setFilterIdx((idx) => (idx === FILTERS.length - 1 ? 0 : idx + 1));
  };

  // Handler for confirm (tick) button
  const handleConfirmEdits = () => {
    if (videoFile && videoUrl) {
      // Navigate to upload page, passing video file and preview URL via state
      navigate('/upload', { state: { file: videoFile, preview: videoUrl } });
    }
  };

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
            style={{ filter: FILTER_CSS[FILTERS[filterIdx].style] || 'none', zIndex: 1 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black text-white text-lg">
            Loading camera...
          </div>
        )}
        {/* Overlay filter name */}
        {videoUrl && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 rounded-full text-white text-sm font-semibold z-10">
            {FILTERS[filterIdx].name}
          </div>
        )}
        {/* Duration Selector and Mode Switcher - REMOVE THIS SECTION */}
        {/* Filter Carousel - floating above video, just above bottom nav, no overlay */}
        {videoUrl && (
          <div className="fixed left-0 right-0 z-[99999] flex items-center justify-center pointer-events-none" style={{bottom: '70px'}}>
            <div className="flex items-center justify-center w-full pointer-events-auto" style={{height: 60, margin: 0, paddingTop: 0, paddingBottom: 0}}>
              <div
                ref={filterListRef}
                className="flex overflow-x-auto gap-3 px-2 w-full justify-center relative no-scrollbar"
                style={{ pointerEvents: 'auto', scrollSnapType: 'x mandatory', paddingLeft: 'calc(60vw - 44px)', paddingRight: 'calc(50vw - 44px)' }}
                onScroll={handleFilterScroll}
              >
                {FILTERS.map((filter, idx) => (
                  <div
                    key={filter.name + idx}
                    className={`flex flex-col items-center transition-transform duration-200 px-1 ${idx === filterIdx ? 'scale-125 z-20' : 'opacity-60 z-10'}`}
                    style={{ minWidth: 60, scrollSnapAlign: 'center', paddingTop: 9, paddingBottom: 8 }}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-1`}
                      style={filter.style === 'blank' ? { background: '#000', border: '2px solid #000' } : { background: 'rgba(255,255,255,0.1)', border: idx === filterIdx ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.2)' }}
                    >
                      {filter.style !== 'blank' && (
                        <img src={filter.icon || FILTER_THUMB_PLACEHOLDER} alt={filter.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span
                      className="text-xs whitespace-nowrap"
                      style={filter.style === 'blank' ? { color: '#000' } : { color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '0 4px' }}
                    >
                      {filter.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Right-side vertical icons */}
        <div className="absolute right-4 top-32 flex flex-col gap-4 z-10">
          <button className="bg-black/40 rounded-full p-2 text-white"><User size={22} /></button>
          <button className="bg-black/40 rounded-full p-2 text-white" onClick={handleConfirmEdits}><Check size={22} /></button>
          <button className="bg-black/40 rounded-full p-2 text-white flex items-center justify-center">
            <Music size={22} />
            <Plus size={16} style={{ marginLeft: '-8px', marginTop: '-8px' }} />
          </button>
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