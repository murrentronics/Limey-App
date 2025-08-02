import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, Plus, MessageSquare, CircleUser, Crown } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useAuth } from "@/hooks/useAuth";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalUnreadCount } = useUnreadCount();
  const { isAdmin, loading } = useAuth();

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
              variant={item.isUpload ? "neon" : location.pathname === item.path ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate(item.path)}
              className={item.isUpload ? "px-3" : "p-3"}
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