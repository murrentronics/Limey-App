import { Button } from "@/components/ui/button";

interface CategoryTabsProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  "All",
  "Soca", 
  "Dancehall",
  "Carnival",
  "Comedy",
  "Dance",
  "Music",
  "Local News"
];

export const CategoryTabs = ({ selectedCategory, onCategoryChange }: CategoryTabsProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Limey Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-card flex items-center justify-center border border-border">
            <span className="text-lg">🐍</span>
          </div>
          <span className="text-primary font-bold text-lg">Limey</span>
        </div>

        {/* Search & Upload */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">Search</Button>
          <Button variant="ghost" size="sm">Upload</Button>
          <Button variant="ghost" size="sm">Logout</Button>
        </div>
      </div>
      
      {/* Category Scroll */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 pb-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "ghost"}
            size="sm"
            className={`flex-shrink-0 mr-2 ${
              selectedCategory === category 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  );
};