import { pieceSettle } from './pacer';

// A shattered mandala (GDD 3.2 reference: unstable pieces that snap into place as
// stability rises). Purely a function of `stability` — no drag, no sensor. Eight
// petals scatter/spin/fade when unstable and settle into an aligned mandala at
// stability 1.

const PETALS = 8;
const CENTER = 100;

// One petal pointing "up" from the centre; rotated into position per index.
const PETAL_PATH = 'M100,100 L84,64 L100,26 L116,64 Z';
const COLORS = ['#38e1ff', '#9b7bff']; // aura cyan / violet, alternating

export function Mandala({ stability }: { stability: number }) {
  return (
    <svg viewBox="0 0 200 200" className="h-56 w-56" role="img" aria-label="Fracture stability">
      <defs>
        <radialGradient id="mandala-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38e1ff" stopOpacity={0.9 * stability} />
          <stop offset="100%" stopColor="#9b7bff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Glow at the core grows as the mandala stabilises. */}
      <circle cx={CENTER} cy={CENTER} r={70} fill="url(#mandala-core)" />

      {Array.from({ length: PETALS }, (_, i) => {
        const settle = pieceSettle(i, PETALS, stability);
        const baseAngle = (360 / PETALS) * i;
        const scatter = (1 - settle) * 46; // px outward when unstable
        const spin = (1 - settle) * 80; // extra chaotic rotation when unstable
        const opacity = 0.12 + 0.88 * settle;
        return (
          <path
            key={i}
            d={PETAL_PATH}
            fill={COLORS[i % COLORS.length]}
            opacity={opacity}
            transform={`rotate(${baseAngle + spin} ${CENTER} ${CENTER}) translate(0 ${-scatter})`}
            style={{ transition: 'transform 500ms ease-out, opacity 500ms ease-out' }}
          />
        );
      })}

      <circle
        cx={CENTER}
        cy={CENTER}
        r={6}
        fill="#e6f7ff"
        opacity={0.4 + 0.6 * stability}
      />
    </svg>
  );
}
