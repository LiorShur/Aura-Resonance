import { useMemo } from 'react';
import { hashSeed } from '@/lib/avatar';

// Deterministic, seed-derived identicon: a symmetric 5×5 glyph over a hue picked
// from the same hash. Same seed always yields the same avatar.

interface AvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

export function Avatar({ seed, size = 64, className }: AvatarProps) {
  const { hue, cells } = useMemo(() => {
    const h = hashSeed(seed || 'seed');
    const hueVal = h % 360;
    // 5×5 grid mirrored across the vertical axis (columns 0..2 drive it).
    const grid: boolean[] = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        const bit = (h >> (y * 3 + x)) & 1;
        grid[y * 5 + x] = bit === 1;
        grid[y * 5 + (4 - x)] = bit === 1;
      }
    }
    return { hue: hueVal, cells: grid };
  }, [seed]);

  const fg = `hsl(${hue} 80% 65%)`;
  const bg = `hsl(${(hue + 40) % 360} 40% 18%)`;

  return (
    <svg
      viewBox="0 0 5 5"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Avatar"
      style={{ borderRadius: size * 0.28, background: bg }}
    >
      {cells.map((on, i) =>
        on ? (
          <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1.02} height={1.02} fill={fg} />
        ) : null,
      )}
    </svg>
  );
}
