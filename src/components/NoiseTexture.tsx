export function NoiseTexture() {
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none z-[9999]" style={{ opacity: 0.03 }}>
      <filter id="noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="4"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  );
}
