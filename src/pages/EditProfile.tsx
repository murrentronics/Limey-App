import { useState, useRef, useEffect } from "react";
import { Popover } from "@/components/ui/popover";
// import { Dialog } from "@/components/ui/dialog";
import Cropper from "react-easy-crop";
import { Dialog } from "@/components/ui/dialog";
import { getCroppedImg } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import BottomNavigation from "@/components/BottomNavigation";

const EditProfile = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();


  // Fetch profile info on mount and set all fields
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (!error && data) {
        setUsername(data.username || "");
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || null);
      }
    };
    fetchProfile();
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    // Reset input value so user can re-select the same file if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropConfirm = async () => {
    if (!selectedImage || !user || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const fileName = `avatars/${user.id}/profile.jpg`;
      // Remove old avatar first to avoid caching issues
      await supabase.storage.from('limeytt-uploads').remove([fileName]);
      const { error } = await supabase.storage.from('limeytt-uploads').upload(fileName, croppedBlob, { upsert: true });
      if (!error) {
        // Add cache-busting param
        const { data } = supabase.storage.from('limeytt-uploads').getPublicUrl(fileName);
        setAvatarUrl(data.publicUrl + '?t=' + Date.now());
        toast({ title: "Profile photo updated!" });
      } else {
        toast({ title: "Failed to upload photo", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Failed to crop photo", variant: "destructive" });
    }
    setUploading(false);
    setShowCropModal(false);
    setSelectedImage(null);
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setSelectedImage(null);
  };
  // Removed invalid top-level await statement. All upload logic is handled inside handleAvatarChange.

  const handleRemoveAvatar = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to remove your profile photo?")) return;
    const fileName = `avatars/${user.id}/profile.jpg`;
    await supabase.storage.from('limeytt-uploads').remove([fileName]);
    setAvatarUrl(null);
    toast({ title: "Profile photo removed" });
  };

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      username,
      display_name: displayName,
      bio,
      avatar_url: avatarUrl
    }).eq('user_id', user.id);
    if (!error) {
      toast({ title: "Profile updated!" });
      navigate('/profile');
    } else {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  };

  // Username uniqueness validation
  useEffect(() => {
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }

    if (username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');

    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('is_username_available', {
          username_to_check: username
        });

        if (error) {
          console.error('Error checking username:', error);
          setUsernameStatus('idle');
          return;
        }

        setUsernameStatus(data ? 'available' : 'taken');
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameStatus('idle');
      }
    }, 500);

    setUsernameCheckTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [username]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
      <h1 className="text-2xl font-bold text-primary">Edit Profile</h1>
      </div>
      <div className="p-4 max-w-lg mx-auto">
      <Card className="p-6 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative mb-6">
          <Popover open={showAvatarMenu} onOpenChange={setShowAvatarMenu}>
            <div
              className="w-28 h-28 rounded-full overflow-hidden border-2 border-primary flex items-center justify-center group"
              tabIndex={0}
              role="button"
              aria-label="Profile photo menu"
              onClick={e => {
                // Only open menu if camera button or image is clicked
                if (e.target === e.currentTarget) setShowViewModal(true);
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-28 h-28 object-cover"
                />
              ) : (
                <div className="w-28 h-28 bg-primary/20 flex items-center justify-center text-4xl font-bold text-primary">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-1 right-1 w-8 h-8 p-0 flex items-center justify-center bg-white/80 hover:bg-white border border-primary shadow"
                onClick={e => {
                  e.stopPropagation();
                  setShowAvatarMenu(true);
                }}
                aria-label="Edit profile photo"
                style={{ borderRadius: '50%' }}
              >
                <span role="img" aria-label="camera" style={{ fontSize: 18 }}>📷</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            {showAvatarMenu && (
              <div
                className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
                onClick={() => setShowAvatarMenu(false)}
              >
                <div
                  className="bg-white border rounded shadow-lg flex flex-col min-w-[140px] z-50"
                  onClick={e => e.stopPropagation()}
                >
                  <button className="px-4 py-2 hover:bg-gray-100 text-left font-bold text-black" onClick={() => { setShowViewModal(true); setShowAvatarMenu(false); }}>View</button>
                  <button className="px-4 py-2 hover:bg-gray-100 text-left font-bold text-black" onClick={() => { fileInputRef.current?.click(); setShowAvatarMenu(false); }}>
                    {uploading ? 'Uploading...' : 'Change'}
                  </button>
                  <button className="px-4 py-2 hover:bg-red-100 text-left text-red-600" onClick={() => { setShowAvatarMenu(false); handleRemoveAvatar(); }}>Remove</button>
                </div>
              </div>
            )}
          </Popover>
        </div>

        {/* View Modal - Regular size */}
        {showViewModal && avatarUrl ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowViewModal(false)}>
            <div className="relative">
              <button
                className="absolute top-2 right-2 text-white text-2xl bg-black/60 rounded-full w-8 h-8 flex items-center justify-center z-10"
                onClick={(e) => { e.stopPropagation(); setShowViewModal(false); }}
                aria-label="Close"
              >
                ×
              </button>
              <img
                src={avatarUrl}
                alt="Profile"
                className="max-w-xs max-h-[80vh] rounded-lg border-2 border-primary bg-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        ) : null}

        {/* Crop Modal */}
        <Dialog open={showCropModal} onOpenChange={setShowCropModal}>
          {showCropModal && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
              {/* Header */}
              <div className="p-4 bg-black text-white">
                <h2 className="text-xl font-bold text-center">Crop Profile Photo</h2>
              </div>
              
              {/* Cropper - takes full available height */}
              <div className="flex-1 flex items-center justify-center bg-black">
                <div className="relative w-full h-full max-w-md max-h-md">
                  <Cropper
                    image={selectedImage!}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    objectFit="contain"
                  />
                </div>
              </div>
              
              {/* Footer with buttons - raised above bottom navigation */}
              <div className="p-4 pb-24 bg-black border-t border-white/10 flex justify-between">
                <Button 
                  onClick={handleCropCancel} 
                  variant="outline"
                  className="flex-1 mr-2"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCropConfirm} 
                  variant="neon"
                  disabled={uploading}
                  className="flex-1 ml-2"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
        {/* Username */}
        <Input
        className="mb-4"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        />
        {usernameStatus === 'checking' && <p className="text-sm text-muted-foreground">Checking username...</p>}
        {usernameStatus === 'available' && <p className="text-sm text-green-600">Username is available!</p>}
        {usernameStatus === 'taken' && <p className="text-sm text-red-600">Username is already taken.</p>}
        {/* Display Name */}
        <Input
        className="mb-4"
        placeholder="Display Name"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        />
        {/* Bio */}
        <Textarea
        className="mb-4"
        placeholder="Bio"
        value={bio}
        onChange={e => setBio(e.target.value)}
        maxLength={200}
        />
        <Button variant="neon" className="w-full mb-3" onClick={handleSave} disabled={uploading}>
        {uploading ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => navigate('/profile')}>
        Cancel
        </Button>
      </Card>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default EditProfile;
