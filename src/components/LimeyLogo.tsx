interface LimeyLogoProps {
  className?: string;
  showText?: boolean;
}

const LimeyLogo = ({ className = "", showText = true }: LimeyLogoProps) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        {/* Circular logo with neon green accent */}
        <div className="relative">
          <div className="w-20 h-20 bg-black border-4 border-primary rounded-full flex items-center justify-center neon-glow">
            <span className="text-primary text-3xl font-bold">L</span>
          </div>
        </div>
        
        {showText && (
          <div className="mt-3 text-center">
            <h1 className="text-3xl font-bold text-primary">Limey</h1>
            <p className="text-muted-foreground text-sm">Trinidad & Tobago</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LimeyLogo;