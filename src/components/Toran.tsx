/** A marigold toran: garland swags across the top with hanging strands ending in mango leaves. */

const W = 400
const SPAN = 100
const ANCHOR_Y = 3
const SAG = 40

function Marigold({ x, y, r, alt }: { x: number; y: number; r: number; alt: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={alt ? '#f2b705' : '#e9731c'} />
      <circle cx={x} cy={y} r={r * 0.78} fill="none" stroke={alt ? '#d99a00' : '#c95a10'} strokeWidth={r * 0.35} strokeDasharray="1.2 1.4" />
      <circle cx={x} cy={y} r={r * 0.32} fill={alt ? '#e9731c' : '#8e1b2c'} />
    </g>
  )
}

function Leaf({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x},${y} C${x - 6},${y + 6} ${x - 4},${y + 16} ${x},${y + 21} C${x + 4},${y + 16} ${x + 6},${y + 6} ${x},${y} Z`}
      fill="#3f5a2a"
      stroke="#2c4220"
      strokeWidth="0.6"
    />
  )
}

function swagPoints(x0: number): { x: number; y: number }[] {
  const steps = 11
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const cx = x0 + SPAN / 2
    const cy = ANCHOR_Y + SAG
    return {
      x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * (x0 + SPAN),
      y: (1 - t) ** 2 * ANCHOR_Y + 2 * (1 - t) * t * cy + t ** 2 * ANCHOR_Y,
    }
  })
}

export function Toran() {
  const anchors = Array.from({ length: W / SPAN + 1 }, (_, i) => i * SPAN)
  return (
    <svg
      viewBox={`0 0 ${W} 74`}
      className="block h-auto w-full"
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label="Marigold garland"
    >
      <line x1="0" y1="1.5" x2={W} y2="1.5" stroke="#8e1b2c" strokeWidth="3" />
      {anchors.slice(0, -1).map((x0) =>
        swagPoints(x0).map((p, i) => <Marigold key={`${x0}-${i}`} x={p.x} y={p.y} r={4.6} alt={i % 2 === 1} />),
      )}
      {anchors.map((x, i) => (
        <g key={x} className="sway" style={{ animationDelay: `${i * -0.7}s` }}>
          {[10, 19, 28, 37].map((y, j) => (
            <Marigold key={y} x={x} y={y} r={4.2} alt={(i + j) % 2 === 0} />
          ))}
          <Leaf x={x} y={41} />
        </g>
      ))}
    </svg>
  )
}
