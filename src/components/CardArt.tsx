import { memo } from 'react';
import type { Card, ObjClass } from '../data/types';
import { RARITIES } from '../data/rarity';
import { CLASSES } from '../data/classes';
import { hash32, mulberry32 } from '../game/rng';

/** Glifo central según la clase de objeto. */
function ClassGlyph({ cls, color }: { cls: ObjClass; color: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (cls) {
    case 'safe':
      return (
        <g {...s}>
          <rect x="-7" y="-3" width="14" height="11" rx="1.5" />
          <path d="M-4.5 -3 v-3 a4.5 4.5 0 0 1 9 0 v3" />
          <circle cx="0" cy="2.5" r="1.4" fill={color} />
        </g>
      );
    case 'euclid':
      return (
        <g {...s}>
          <path d="M-10 0 Q0 -9 10 0 Q0 9 -10 0 Z" />
          <circle r="3.4" />
          <circle r="1.2" fill={color} />
        </g>
      );
    case 'keter':
      return (
        <g {...s}>
          <path d="M-9 -4 L-6 2 L-3 -4 L0 2 L3 -4 L6 2 L9 -4" />
          <path d="M-9 6 L-6 0.5 L-3 6 L0 0.5 L3 6 L6 0.5 L9 6" opacity="0.7" />
        </g>
      );
    case 'thaumiel':
      return (
        <g {...s}>
          {[[0, -8], [-5, -4], [5, -4], [-5, 3], [5, 3], [0, 0], [0, 8]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill={color} />
          ))}
          <path d="M0 -8 L-5 -4 L-5 3 L0 8 L5 3 L5 -4 Z M-5 -4 L5 3 M5 -4 L-5 3 M0 -8 L0 8" opacity="0.7" />
        </g>
      );
    case 'apollyon':
      return (
        <g {...s}>
          <circle r="8" strokeDasharray="10 3 6 4" />
          <path d="M-2 -8 L1 -2 L-2 1 L2 8" />
        </g>
      );
    case 'archon':
      return (
        <g {...s}>
          <path d="M0 -9 L8 5 L-8 5 Z" />
          <circle cy="1.5" r="2.5" />
        </g>
      );
    case 'esoteric':
      return (
        <g {...s}>
          <path d="M0 0 m0 -1.5 a1.5 1.5 0 1 1 -1.5 1.5 a3 3 0 1 1 3 3 a4.5 4.5 0 1 1 -4.5 -4.5 a6 6 0 1 1 6 6 a7.5 7.5 0 1 1 -7.5 -7.5" />
        </g>
      );
    case 'neutralized':
      return (
        <g {...s}>
          <circle r="8" opacity="0.6" />
          <path d="M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5" />
        </g>
      );
    case 'explained':
      return (
        <g {...s}>
          <circle cx="-1.5" cy="-1.5" r="5.5" />
          <path d="M2.5 2.5 L8 8" />
        </g>
      );
    case 'decommissioned':
      return (
        <g {...s}>
          <rect x="-8" y="-6" width="16" height="12" rx="1" />
          <path d="M-8 -6 L8 6" />
        </g>
      );
    default:
      return (
        <g {...s}>
          <path d="M-3.5 -4 a3.5 3.5 0 1 1 3.5 3.5 v2.5" />
          <circle cy="6" r="0.9" fill={color} />
        </g>
      );
  }
}

/**
 * Arte procedural de la carta: una "foto de contención" con sigilo generado
 * a partir del identificador. Siempre igual para la misma carta, sin imágenes externas.
 */
/** `bare`: sin el número de fondo (para rasterizar fuera del DOM, donde las fuentes web no cargan). */
export const CardArt = memo(function CardArt({ card, bare = false }: { card: Card; bare?: boolean }) {
  const rng = mulberry32(hash32(card.id));
  const rar = RARITIES[card.rarity];
  const clsColor = CLASSES[card.cls].color;
  const uid = `a${hash32(card.id).toString(36)}`;
  const sides = 3 + Math.floor(rng() * 6);
  const rot = rng() * 360;
  const rings = 1 + Math.floor(rng() * 3);
  const spokes = rng() < 0.6 ? 6 + Math.floor(rng() * 10) : 0;
  const polyR = 15 + rng() * 7;
  const poly = Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    return [Math.cos(a) * polyR, Math.sin(a) * polyR];
  });
  const inner = rng() < 0.5;
  // Barras de censura en los márgenes, sin tapar el sigilo central.
  const bars = Array.from({ length: Math.floor(rng() * 3) }, () => {
    const w = 10 + rng() * 14;
    const left = rng() < 0.5;
    return { x: left ? 3 + rng() * 8 : 97 - w - rng() * 8, y: 5 + rng() * 58, w };
  });
  const hue = Math.floor(rng() * 360);
  const num = card.num !== null ? String(card.num).padStart(3, '0') : card.code.replace(/^SCP-/, '');
  const dash = `${1 + Math.floor(rng() * 4)} ${1 + Math.floor(rng() * 3)}`;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="card-art-svg" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor={`hsl(${hue} 30% 16%)`} />
          <stop offset="55%" stopColor="#0c0f13" />
          <stop offset="100%" stopColor="#050607" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={rar.color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={rar.color} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}-grid`} width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0 H0 V5" fill="none" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="70" fill={`url(#${uid}-bg)`} />
      <rect width="100" height="70" fill={`url(#${uid}-grid)`} />
      {!bare && (
        <text x="96" y="66" textAnchor="end" fontFamily="Bebas Neue, sans-serif" fontSize="26" fill="#fff" fillOpacity="0.05">
          {num}
        </text>
      )}
      <circle cx="50" cy="35" r="30" fill={`url(#${uid}-glow)`} />
      <g transform={`translate(50 35) rotate(${rot})`} fill="none" stroke={rar.color} strokeOpacity="0.85">
        {Array.from({ length: rings }, (_, i) => (
          <circle key={i} r={20 + i * 5} strokeWidth={i === 0 ? 0.7 : 0.4} strokeDasharray={i === 1 ? dash : undefined} strokeOpacity={0.8 - i * 0.2} />
        ))}
        <polygon points={poly.map((p) => p.join(',')).join(' ')} strokeWidth="0.8" />
        {inner && <polygon points={poly.map(([x, y]) => `${x * 0.55},${y * 0.55}`).join(' ')} strokeWidth="0.5" transform={`rotate(${180 / sides})`} />}
        {poly.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.1" fill={rar.color} stroke="none" />
        ))}
        {spokes > 0 &&
          Array.from({ length: spokes }, (_, i) => {
            const a = (i / spokes) * Math.PI * 2;
            return <line key={i} x1={Math.cos(a) * 26} y1={Math.sin(a) * 26} x2={Math.cos(a) * 29} y2={Math.sin(a) * 29} strokeWidth="0.5" />;
          })}
      </g>
      <g transform="translate(50 35) scale(0.95)">
        <circle r="11" fill="#07080a" stroke={clsColor} strokeOpacity="0.5" strokeWidth="0.6" />
        <ClassGlyph cls={card.cls} color={clsColor} />
      </g>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height="3.2" fill="#000" opacity="0.92" />
      ))}
      <rect width="100" height="70" fill="none" stroke="#000" strokeWidth="2" />
    </svg>
  );
});
