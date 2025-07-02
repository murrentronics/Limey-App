import { Button } from "@/components/ui/button";
import { Home, TrendingUp, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface NavigationProps {
  currentUser: SupabaseUser | null;
}

export const Navigation = ({ currentUser }: NavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/", key: "home" },
    { icon: TrendingUp, label: "Trending", path: "/trending", key: "trending" },
    { icon: User, label: "Profile", path: "/profile", key: "profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Button
              key={item.key}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center space-y-1 h-auto py-2 px-4 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              onClick={() => navigate(item.path)}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </Button>
          );
        })}
        
        {/* Live Button */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center space-y-1 h-auto py-2 px-4 text-muted-foreground"
          onClick={() => navigate("/live")}
        >
          <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
          <span className="text-xs font-medium">Live</span>
        </Button>
      </div>
    </div>
  );
};