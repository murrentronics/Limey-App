import { Navigation } from "@/components/Navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [likedVideos, setLikedVideos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'videos' | 'liked' | 'saved'>('videos');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchUserVideos(session.user.id);
        fetchLikedVideos(session.user.id);
      }
    });
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserVideos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const fetchLikedVideos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('video_likes')
        .select(`
          videos (
            id,
            title,
            thumbnail_url,
            video_url,
            view_count,
            like_count
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;
      setLikedVideos(data?.map(item => item.videos).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching liked videos:', error);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-primary animate-pulse"></div>
      </div>
    );
  }

  const displayVideos = activeTab === 'videos' ? videos : activeTab === 'liked' ? likedVideos : [];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-lg font-medium text-green-500">Profile</h1>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="text-green-500 border border-green-500/20">
            Settings
          </Button>
          <Button variant="ghost" size="sm" className="text-green-500 border border-green-500/20">
            Logout
          </Button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="flex flex-col items-center py-8">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4">
          <span className="text-black font-bold text-3xl">
            {profile.display_name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || 'M'}
          </span>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-1">
          @{profile.username || 'user'}
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          {profile.display_name || profile.username}
        </p>

        {/* Stats */}
        <div className="flex space-x-8 mb-6">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{profile.following_count || 0}</div>
            <div className="text-sm text-gray-400">Following</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{profile.follower_count || 0}</div>
            <div className="text-sm text-gray-400">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{profile.likes_received || 0}</div>
            <div className="text-sm text-gray-400">Likes</div>
          </div>
        </div>

        {/* TriniCredits */}
        <div className="flex items-center space-x-2 mb-6">
          <span className="text-sm text-gray-400">TriniCredits:</span>
          <div className="flex items-center space-x-1">
            <span className="text-yellow-500">💰</span>
            <span className="text-white font-medium">{profile.trini_credits || 0}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 mb-8">
          <Button className="px-6 py-2 bg-gray-800 border border-gray-700 text-white rounded-md hover:bg-gray-700">
            Edit Profile
          </Button>
          <Button className="px-6 py-2 bg-green-500 hover:bg-green-600 text-black rounded-md font-medium">
            Share Profile
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex">
          {['videos', 'liked', 'saved'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 text-center font-medium ${
                activeTab === tab
                  ? 'text-white border-b-2 border-white'
                  : 'text-gray-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {displayVideos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📹</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {activeTab === 'videos' ? 'No videos yet' : `No ${activeTab} videos`}
            </h3>
            <p className="text-gray-400">
              {activeTab === 'videos' 
                ? 'Upload your first video to get started!' 
                : `Videos you've ${activeTab} will appear here`
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {displayVideos.map((video) => (
              <div key={video.id} className="aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden">
                {video.thumbnail_url ? (
                  <img 
                    src={video.thumbnail_url} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <span className="text-white text-2xl">📹</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation currentUser={user} />
    </div>
  );
};

export default Profile;