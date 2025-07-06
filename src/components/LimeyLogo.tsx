interface LimeyLogoProps {
  className?: string;
  showText?: boolean;
  showCircle?: boolean;
}

const LimeyLogo = ({ className = "", showText = true, showCircle = false }: LimeyLogoProps) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {showCircle && (
        <div className="relative mb-4 flex justify-center">
          <div className="w-24 h-24 bg-black border-4 border-primary rounded-full neon-glow overflow-hidden flex items-end justify-center relative">
            {/* Snake image, head overlaps top */}
            <img
              src="/snake-logo.png"
              alt="Limey Snake Logo"
              className="absolute left-1/2 -translate-x-1/2 -top-14 w-32 h-40 object-contain drop-shadow-[0_0_16px_hsl(120,100%,50%)]"
              style={{ zIndex: 2 }}
            />
          </div>
        </div>
      )}
      {showText && (
        <span
          className="text-4xl font-black text-primary tracking-wider logo-text-glow"
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 900,
            letterSpacing: "0.15em",
            filter: "drop-shadow(0 0 8px hsl(120, 100%, 50%))",
          }}
        >
          Limey
        </span>
      )}
      {showText && (
        <div className="mt-2 text-center">
          <p className="text-muted-foreground text-sm">Trinidad & Tobago</p>
        </div>
      )}
    </div>
  );
};

export default LimeyLogo;