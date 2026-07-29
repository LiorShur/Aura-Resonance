import { useMemo, useRef } from 'react';
import type { LatLng } from '@/lib/geo';
import { makeProjection } from './projection';
import { FRACTURE_STYLE, isActiveNow, type Fracture } from './types';

interface SchematicMapProps {
  centre: LatLng;
  fractures: Fracture[];
  player: LatLng;
  secondPlayer: LatLng | null;
  selectedId: string | null;
  /** Whether the pin can be dragged (sim mode only). */
  draggable: boolean;
  onSelect: (id: string) => void;
  onPlayerMove: (pos: LatLng) => void;
}

/**
 * Dependency-free schematic map for the v0 sim harness. Renders seeded Fractures
 * and a draggable player pin so the whole location loop runs at a desk with no
 * GPS and no Mapbox token. M2 replaces this with a styled Mapbox GL basemap.
 */
export function SchematicMap({
  centre,
  fractures,
  player,
  secondPlayer,
  selectedId,
  draggable,
  onSelect,
  onPlayerMove,
}: SchematicMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const proj = useMemo(() => makeProjection(centre), [centre]);

  const clientToLatLng = (clientX: number, clientY: number): LatLng => {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return player;
    const x = ((clientX - rect.left) / rect.width) * proj.size;
    const y = ((clientY - rect.top) / rect.height) * proj.size;
    return proj.toLatLng({ x, y });
  };

  const pin = proj.toXY(player);
  const partner = secondPlayer ? proj.toXY(secondPlayer) : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${proj.size} ${proj.size}`}
      className="h-full w-full touch-none select-none"
      role="img"
      aria-label="Neighbourhood map"
      onPointerMove={(e) => {
        if (!dragging.current) return;
        onPlayerMove(clientToLatLng(e.clientX, e.clientY));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        dragging.current = false;
      }}
    >
      <defs>
        <radialGradient id="bg" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#141b3a" />
          <stop offset="100%" stopColor="#070b1c" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={proj.size} height={proj.size} fill="url(#bg)" />

      {/* Faint grid for spatial reference. */}
      <g stroke="#ffffff" strokeOpacity={0.04}>
        {Array.from({ length: 11 }, (_, i) => i * (proj.size / 10)).map((n) => (
          <g key={n}>
            <line x1={n} y1={0} x2={n} y2={proj.size} />
            <line x1={0} y1={n} x2={proj.size} y2={n} />
          </g>
        ))}
      </g>

      {/* Fractures */}
      {fractures.map((f) => {
        const { x, y } = proj.toXY(f.geo);
        const style = FRACTURE_STYLE[f.type];
        const active = isActiveNow(f);
        const isSelected = f.id === selectedId;
        return (
          <g
            key={f.id}
            transform={`translate(${x} ${y})`}
            className="cursor-pointer"
            opacity={active ? 1 : 0.35}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(f.id);
            }}
          >
            <circle r={isSelected ? 16 : 12} fill={style.color} fillOpacity={0.18} filter="url(#glow)" />
            <circle r={6} fill={style.color} />
            {isSelected && <circle r={20} fill="none" stroke={style.color} strokeOpacity={0.6} />}
          </g>
        );
      })}

      {/* Fake co-op partner */}
      {partner && (
        <g transform={`translate(${partner.x} ${partner.y})`}>
          <circle r={7} fill="#ffca61" />
          <circle r={13} fill="none" stroke="#ffca61" strokeOpacity={0.5} />
        </g>
      )}

      {/* Player pin */}
      <g
        transform={`translate(${pin.x} ${pin.y})`}
        className={draggable ? 'cursor-grab' : ''}
        onPointerDown={(e) => {
          if (!draggable) return;
          e.stopPropagation();
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
      >
        <circle r={22} fill="#4fd6ff" fillOpacity={0.12} filter="url(#glow)" />
        <circle r={9} fill="#4fd6ff" stroke="#eaffff" strokeWidth={2} />
      </g>
    </svg>
  );
}
