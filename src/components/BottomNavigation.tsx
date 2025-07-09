import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, TrendingUp, Plus, Radio, CircleUser } from "lucide-react";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home },
    { path: '/trending', icon: TrendingUp },
    { path: '/upload', icon: Plus, isUpload: true },
    { path: '/live', icon: Radio },
    { path: '/profile', icon: CircleUser }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-50">
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
              <IconComponent size={20} />
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;