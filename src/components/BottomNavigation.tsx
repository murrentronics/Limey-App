import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, Plus, MessageSquare, CircleUser, Crown } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnreadCount } = useUnreadCount();
  const { isAdmin, loading, user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  // Subscribe to profile changes for real-time updates
  useEffect(() => {
    if (!user) return;

    const profilesChannel = supabase
      .channel('profile_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new) {
          setUserProfile(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (!error && profile) {
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const navItems = isAdmin ? [
    { path: '/', icon: Home },
    { path: '/friends', icon: Users },
    { path: '/upload', icon: Plus, isUpload: true },
    { path: '/admin', icon: Crown, isCrown: true },
    { path: '/profile', icon: CircleUser }
  ] : [
    { path: '/', icon: Home },
    { path: '/friends', icon: Users },
    { path: '/upload', icon: Plus, isUpload: true },
    { path: '/inbox', icon: MessageSquare },
    { path: '/profile', icon: CircleUser }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Button
              key={item.path}
              variant={item.isUpload ? "neon" : "ghost"}
              size="sm"
              onClick={() => navigate(item.path)}
              className={`${item.isUpload ? "px-3" : "p-3"} ${
                location.pathname === item.path && !item.isUpload 
                  ? "relative border-b-2 border-green-500 rounded-none bg-transparent" 
                  : ""
              }`}
            >
              {item.isAdmin ? (
                <span className="text-xl" role="img" aria-label="Admin">👑</span>
              ) : item.path === '/inbox' ? (
                <div className="relative">
                  <span className="text-xl" role="img" aria-label="Messages">💬</span>
                  {!loading && totalUnreadCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold">
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </div>
                  )}
                </div>
              ) : item.path === '/profile' ? (
                <Avatar className="w-7 h-7">
                  <AvatarImage src={userProfile?.avatar_url || user?.user_metadata?.avatar_url || undefined} />
                  <AvatarFallback className="bg-white/10 text-white text-xs">
                    {userProfile?.username?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <IconComponent size={20} />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;