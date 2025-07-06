interface LimeyLogoProps {
  className?: string;
  showText?: boolean;
  showCircle?: boolean;
}

const LimeyLogo = ({ className = "", showText = true, showCircle = false }: LimeyLogoProps) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        {/* Snake Logo */}
        <div className="flex items-center space-x-3">
          {/* Snake Circle Logo */}
          {showCircle && (
            <div className="relative">
              <div className="w-16 h-16 bg-black border-4 border-primary rounded-full flex items-center justify-center neon-glow">
                {/* Professional Snake Design */}
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 32 32" 
                  className="drop-shadow-[0_0_5px_hsl(120,100%,50%)]"
                >
                  {/* Snake body - more realistic */}
                  <path
                    d="M8 16 Q12 8 16 16 Q20 24 24 16"
                    stroke="hsl(120, 100%, 50%)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                  {/* Snake head */}
                  <circle
                    cx="24"
                    cy="16"
                    r="4"
                    fill="hsl(120, 100%, 50%)"
                    className="drop-shadow-[0_0_4px_hsl(120,100%,50%)]"
                  />
                  {/* Snake eyes */}
                  <circle cx="25.5" cy="14.5" r="0.8" fill="black" />
                  <circle cx="25.5" cy="17.5" r="0.8" fill="black" />
                  {/* Snake tongue */}
                  <path
                    d="M28 16 L30 14.5 M28 16 L30 17.5"
                    stroke="hsl(120, 100%, 50%)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  {/* Snake scales */}
                  <circle cx="12" cy="12" r="1" fill="hsl(120, 100%, 45%)" opacity="0.7" />
                  <circle cx="16" cy="20" r="1" fill="hsl(120, 100%, 45%)" opacity="0.7" />
                  <circle cx="20" cy="10" r="1" fill="hsl(120, 100%, 45%)" opacity="0.7" />
                </svg>
              </div>
            </div>
          )}
          
          {/* Fancy Instagram-style "Limey" text */}
          {showText && (
            <div className="flex items-center">
              <span className="text-4xl font-black text-primary tracking-wider logo-text-glow" style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: '900',
                letterSpacing: '0.15em',
                filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
              }}>
                Limey
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