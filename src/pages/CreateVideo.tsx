import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Placeholder sound library
const SOUND_LIBRARY = [
  { name: 'Tropical Vibes', url: '/sounds/tropical-vibes.mp3', duration: '2:30' },
  { name: 'Steelpan Groove', url: '/sounds/steelpan-groove.mp3', duration: '1:45' },
  { name: 'Island Chill', url: '/sounds/island-chill.mp3', duration: '2:50' },
];

const FILTERS = [
  { name: 'None', filter: '' },
  { name: 'Grayscale', filter: 'grayscale(1)' },
  { name: 'Sepia', filter: 'sepia(1)' },
  { name: 'Blur', filter: 'blur(2px)' },
  { name: 'Brightness', filter: 'brightness(1.2)' },
];

const CreateVideo = () => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string>(FILTERS[0].filter); // ensure string type
  const [description, setDescription] = useState('');
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [soundPreview, setSoundPreview] = useState<HTMLAudioElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [soundStart, setSoundStart] = useState(0); // new: start time for trimming
  const [soundDuration, setSoundDuration] = useState(0); // new: duration of selected sound
  const [videoDuration, setVideoDuration] = useState(0); // new: duration of recorded video
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  // Camera/recording refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Start camera on mount
  useEffect(() => {
    if (!recording && !isPreview) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        });
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPreview]);

  // Draw video to canvas with filter
  useEffect(() => {
    if (!recording && !videoRef.current) return;
    if (!canvasRef.current) return;
    let draw = () => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.filter = selectedFilter;
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      animationFrameRef.current = requestAnimationFrame(draw);
    };
    if (recording) draw();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [selectedFilter, recording]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording) {
      setTimer(0);
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else if (!recording && timer !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [recording]);

  // When a sound is selected, load its duration
  useEffect(() => {
    if (selectedSound) {
      const audio = new Audio(selectedSound);
      audio.onloadedmetadata = () => {
        setSoundDuration(audio.duration);
        // Reset trim start if needed
        setSoundStart(0);
      };
      audio.load();
    }
  }, [selectedSound]);

  // When a video is recorded, load its duration
  useEffect(() => {
    if (videoUrl) {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
      };
    }
  }, [videoUrl]);

  // Play trimmed sound in sync with video preview
  const handlePlayPreview = () => {
    if (!videoUrl || !selectedSound) return;
    const video = document.getElementById('preview-video') as HTMLVideoElement;
    const audio = new Audio(selectedSound);
    audio.currentTime = soundStart;
    video.currentTime = 0;
    audio.play();
    video.play();
    // Stop audio when video ends
    video.onended = () => audio.pause();
  };

  // Start/stop recording
  const handleRecord = () => {
    if (!recording) {
      // Start recording
      if (!canvasRef.current) return;
      recordedChunks.current = [];
      const stream = (canvasRef.current as any).captureStream();
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        setVideoUrl(URL.createObjectURL(blob));
        setIsPreview(true);
      };
      mediaRecorder.start();
      setRecording(true);
    } else {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  // Redo recording
  const handleRedo = () => {
    setVideoUrl(null);
    setIsPreview(false);
    setTimer(0);
  };

  const handleSoundSelect = (url: string) => {
    setSelectedSound(url);
    if (soundPreview) {
      soundPreview.pause();
    }
    const audio = new Audio(url);
    setSoundPreview(audio);
    audio.play();
  };

  // Mux video and audio, then upload
  const handleCreateVideo = async () => {
    if (!videoUrl || !user) return;
    setProcessing(true);
    setProgress(0);
    try {
      let finalVideoBlob: Blob;
      if (selectedSound) {
        // Mux with ffmpeg.wasm
        const ffmpeg = createFFmpeg({ log: true });
        await ffmpeg.load();
        setProgress(0.1);
        // Fetch video and audio
        const videoData = await fetch(videoUrl).then(r => r.arrayBuffer());
        const audioData = await fetch(selectedSound).then(r => r.arrayBuffer());
        ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(videoData));
        ffmpeg.FS('writeFile', 'input.mp3', new Uint8Array(audioData));
        // Trim audio to match video duration
        const trimArgs = [
          '-ss', String(soundStart),
          '-t', String(videoDuration),
          '-i', 'input.mp3',
          '-acodec', 'copy',
          'trimmed.mp3',
        ];
        await ffmpeg.run(...trimArgs);
        setProgress(0.4);
        // Mux video and trimmed audio
        await ffmpeg.run(
          '-i', 'input.webm',
          '-i', 'trimmed.mp3',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          'output.mp4'
        );
        setProgress(0.7);
        const data = ffmpeg.FS('readFile', 'output.mp4');
        finalVideoBlob = new Blob([data.buffer], { type: 'video/mp4' });
      } else {
        // No sound selected, just use the recorded video
        finalVideoBlob = await fetch(videoUrl).then(r => r.blob());
      }
      setProgress(0.85);
      // Upload to Supabase
      const fileName = `${user.id}/${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('limeytt-uploads')
        .upload(fileName, finalVideoBlob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('limeytt-uploads')
        .getPublicUrl(fileName);
      // Save metadata
      const filterName = FILTERS.find(f => f.filter === selectedFilter)?.name ?? 'None'; // type-safe fallback
      const { error: dbError } = await supabase.from('videos').insert({
        user_id: user.id,
        video_url: publicUrl,
        description,
        filter: filterName, // always a string
        sound_url: selectedSound || null,
        sound_start: selectedSound ? soundStart : null,
        sound_duration: selectedSound ? videoDuration : null,
      });
      if (dbError) throw dbError;
      setProgress(1);
      toast({ title: 'Video Created!', description: 'Your video has been uploaded.' });
      // Reset UI
      setVideoUrl(null);
      setIsPreview(false);
      setDescription('');
      setSelectedSound(null);
      setSoundStart(0);
      setSoundDuration(0);
      setVideoDuration(0);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create video', variant: 'destructive' });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-2 flex items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mr-2">← Back</Button>
        <span className="text-xl font-black text-primary tracking-wider">Create Video</span>
      </div>
      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Camera Preview & Filters */}
        <Card className="p-4 flex flex-col items-center">
          <div className="mb-4 w-48 h-80 bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
            {/* Live camera or preview */}
            {!isPreview ? (
              <>
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} width={240} height={400} className="w-full h-full rounded-lg" />
                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{timer}s</span>
              </>
            ) : (
              <video id="preview-video" src={videoUrl!} controls className="absolute inset-0 w-full h-full object-cover rounded-lg" />
            )}
          </div>
          <div className="flex gap-2 mb-2">
            {FILTERS.map(f => (
              <Button
                key={f.name}
                variant={selectedFilter === f.filter ? 'neon' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(f.filter)}
                disabled={recording}
              >
                {f.name}
              </Button>
            ))}
          </div>
          {!isPreview ? (
            <Button
              variant="neon"
              className="w-full mt-2"
              onClick={handleRecord}
            >
              {recording ? 'Stop Recording' : 'Start Recording'}
            </Button>
          ) : (
            <Button variant="outline" className="w-full mt-2" onClick={handleRedo}>Redo Recording</Button>
          )}
        </Card>
        {/* Description */}
        <Card className="p-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
          <Textarea
            placeholder="Describe your video..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">{description.length}/200 characters</p>
        </Card>
        {/* Sound Selection */}
        <Card className="p-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Add a Sound</label>
          <div className="flex gap-2 mb-2">
            <Input
              type="file"
              accept="audio/*"
              className="w-auto"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setSelectedSound(url);
                  if (soundPreview) soundPreview.pause();
                  const audio = new Audio(url);
                  setSoundPreview(audio);
                  audio.play();
                }
              }}
            />
            <span className="text-xs text-muted-foreground">or pick from library:</span>
          </div>
          <div className="flex flex-col gap-2 mb-2">
            {SOUND_LIBRARY.map(sound => (
              <Button
                key={sound.url}
                variant={selectedSound === sound.url ? 'neon' : 'outline'}
                size="sm"
                className="flex justify-between items-center"
                onClick={() => handleSoundSelect(sound.url)}
              >
                <span>{sound.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{sound.duration}</span>
              </Button>
            ))}
          </div>
          {/* Sound trimming UI */}
          {selectedSound && soundDuration > 0 && videoDuration > 0 && (
            <div className="mt-4">
              <label className="block text-xs mb-1">Trim Sound (start point):</label>
              <input
                type="range"
                min={0}
                max={Math.max(0, soundDuration - videoDuration)}
                value={soundStart}
                step={0.1}
                onChange={e => setSoundStart(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Start: {soundStart.toFixed(1)}s</span>
                <span>End: {(soundStart + videoDuration).toFixed(1)}s</span>
                <span>Sound: {soundDuration.toFixed(1)}s</span>
              </div>
            </div>
          )}
        </Card>
        {/* Finalize/Create Button and Progress */}
        <div className="relative">
          <Button
            variant="neon"
            className="w-full py-3 text-lg font-bold"
            disabled={!isPreview || processing}
            onClick={handleCreateVideo}
          >
            {processing ? 'Processing...' : 'Create Video'}
          </Button>
          {processing && (
            <div className="w-full h-2 bg-muted rounded mt-2 overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateVideo;
