import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CategoryTabsProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}
const categories = ["All", "Soca", "Dancehall", "Carnival", "Comedy", "Dance", "Music", "Local News"];
export const CategoryTabs = ({
  selectedCategory,
  onCategoryChange
}: CategoryTabsProps) => {
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Limey Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-black border-2 border-green-500 flex items-center justify-center relative">
            <span className="text-green-500 font-bold text-lg">🐍</span>
          </div>
          <span className="text-green-500 font-bold text-2xl">Limey</span>
        </div>

        {/* Search & Upload */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-green-500 border border-green-500/20 hover:bg-green-500/10">Search</Button>
          <Button variant="ghost" size="sm" className="text-green-500 border border-green-500/20 hover:bg-green-500/10">Upload</Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:text-green-500">Logout</Button>
        </div>
      </div>
      
      {/* Category Scroll */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 pb-2 mx-[10px] my-[50px]">
        {categories.map(category => <Button key={category} variant={selectedCategory === category ? "default" : "ghost"} size="sm" className={`flex-shrink-0 mr-2 ${selectedCategory === category ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => onCategoryChange(category)}>
            {category}
          </Button>)}
      </div>
    </div>;
};