interface LimeyLogoProps {
  className?: string;
  showText?: boolean;
}

const LimeyLogo = ({ className = "", showText = true }: LimeyLogoProps) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        {/* New logo with snake L and Instagram-style font */}
        <div className="flex items-center space-x-1">
          {/* Python snake L */}
          <div className="relative">
            <svg 
              width="60" 
              height="60" 
              viewBox="0 0 60 60" 
              className="drop-shadow-[0_0_10px_hsl(120,100%,50%)] logo-snake"
            >
              {/* Snake body */}
              <path
                d="M10 30 Q20 10 30 30 Q40 50 50 30"
                stroke="hsl(120, 100%, 50%)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                className="animate-pulse"
              />
              {/* Snake head */}
              <circle
                cx="50"
                cy="30"
                r="6"
                fill="hsl(120, 100%, 50%)"
                className="drop-shadow-[0_0_8px_hsl(120,100%,50%)]"
              />
              {/* Snake eyes */}
              <circle cx="52" cy="28" r="1.5" fill="black" />
              <circle cx="52" cy="32" r="1.5" fill="black" />
              {/* Snake tongue */}
              <path
                d="M56 30 L60 28 M56 30 L60 32"
                stroke="hsl(120, 100%, 50%)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* L shape formed by snake */}
              <path
                d="M10 30 L10 50 L30 50"
                stroke="hsl(120, 100%, 50%)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                className="drop-shadow-[0_0_5px_hsl(120,100%,50%)]"
              />
            </svg>
          </div>
          
          {/* Instagram-style "imey" text */}
          {showText && (
            <div className="flex items-center">
              <span className="text-4xl font-black text-primary tracking-wider logo-text-glow" style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: '900',
                letterSpacing: '0.15em',
                filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
              }}>
                imey
              </span>
            </div>
          )}
        </div>
        
        {showText && (
          <div className="mt-2 text-center">
            <p className="text-muted-foreground text-sm">Trinidad & Tobago</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LimeyLogo;