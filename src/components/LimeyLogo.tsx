interface LimeyLogoProps {
  className?: string;
  showText?: boolean;
  showCircle?: boolean;
  circleSize?: number; // in pixels, optional
  wordmark?: boolean; // if true, render the SVG wordmark
}

const LimeyLogo = ({ className = "", showText = true, showCircle = false, circleSize, wordmark = false }: LimeyLogoProps) => {
  // Default to 96px (w-24 h-24) if not provided
  const size = circleSize || 96;
  const imgWidth = size * 1.33; // keep image larger than circle for effect
  const imgHeight = size * 1.66;
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {showCircle && (
        <div className="relative mb-4 flex justify-center">
          <div
            className="bg-black border-4 border-primary rounded-full neon-glow overflow-hidden flex items-center justify-center relative"
            style={{ width: size, height: size }}
          >
            {/* Snake image, centered */}
            <img
              src="/limey-tree-logo.png"
              alt="Limey Tree Logo"
              style={{ width: imgWidth, height: imgHeight, zIndex: 2 }}
              className="object-contain drop-shadow-[0_0_16px_hsl(120,100%,50%)]"
            />
          </div>
        </div>
      )}
      {showText && wordmark && (
        <svg
          width="420"
          height="120"
          viewBox="0 0 420 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="block mx-auto"
          style={{ maxWidth: '100%', height: 'auto' }}
        >
          <defs>
            <filter id="neon" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#39FF14"/>
              <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#39FF14"/>
              <feDropShadow dx="0" dy="0" stdDeviation="24" floodColor="#39FF14"/>
            </filter>
          </defs>
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Pacifico', 'Inter', cursive, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontSize="84"
            stroke="#000"
            strokeWidth="10"
            fill="#39FF14"
            filter="url(#neon)"
            style={{
              letterSpacing: '0.08em',
              paintOrder: 'stroke fill',
            }}
            transform="rotate(-8 210 60) skewX(-8)"
          >
            Limey
          </text>
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Pacifico', 'Inter', cursive, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontSize="84"
            fill="#39FF14"
            style={{
              letterSpacing: '0.08em',
            }}
            transform="rotate(-8 210 60) skewX(-8)"
          >
            Limey
          </text>
        </svg>
      )}
      {showText && !wordmark && (
        <span
          className="text-4xl font-black text-primary tracking-wider logo-text-glow"
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 900,
            letterSpacing: "0.15em",
            filter: "drop-shadow(0 0 8px hsl(120, 100%, 50%))",
            WebkitTextStroke: '2px black',
            textShadow: '0 0 2px black, 0 0 4px black',
            backgroundImage: 'url(/limey-tree-logo.png)',
            backgroundSize: 'cover',
            backgroundRepeat: 'repeat',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
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