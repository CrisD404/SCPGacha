import { useId } from 'react';
import { Glyph, type IconName } from './Icon';

export type InsigniaTier = 'bronze' | 'silver' | 'gold' | 'o5' | 'mission' | 'reward' | 'info';

interface TierStyle {
  ring: string[];
  glyph: string;
  glow: string;
}

export const TIER_STYLES: Record<InsigniaTier, TierStyle> = {
  bronze: { ring: ['#f0b98a', '#8a5527', '#d39257', '#6e4019'], glyph: '#f3cba4', glow: '#d39257' },
  silver: { ring: ['#ffffff', '#7f8995', '#d5dce4', '#5d6672'], glyph: '#eef2f6', glow: '#c9d1dc' },
  gold: { ring: ['#fff3bf', '#a87a08', '#f5c518', '#7a5806'], glyph: '#ffe27a', glow: '#f5c518' },
  o5: { ring: ['#ff8cf0', '#ffc845', '#5fe0ff', '#b57bff'], glyph: '#ffffff', glow: '#ff8cf0' },
  mission: { ring: ['#b8ecff', '#1f6f9c', '#5fc6f0', '#164f70'], glyph: '#b3e9ff', glow: '#4ea8ff' },
  reward: { ring: ['#ead6ff', '#5b33b3', '#b57bff', '#3f2386'], glyph: '#e6d1ff', glow: '#b57bff' },
  info: { ring: ['#d5dae2', '#4a515c', '#9aa3b2', '#363c45'], glyph: '#d5dae2', glow: '#9aa3b2' },
};

const HEX = (r: number, cx = 32, cy = 32) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

interface Props {
  icon: IconName;
  tier: InsigniaTier;
  label?: string;
  size?: number;
  locked?: boolean;
  /** logro secreto: oculta el glifo con un "?" mientras está bloqueado */
  secret?: boolean;
  className?: string;
}

/** Insignia hexagonal de la Fundación: anillo metálico por nivel + glifo propio. */
export function Insignia({ icon, tier, label, size = 56, locked = false, secret = false, className = '' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const t = TIER_STYLES[tier];
  const ring = locked ? ['#4a515c', '#262b33', '#3a414d', '#1d2127'] : t.ring;
  const glyphColor = locked ? '#5d6470' : t.glyph;
  const showLabel = label && !locked;

  return (
    <svg className={`insignia ${locked ? 'locked' : ''} ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ring[0]} />
          <stop offset="38%" stopColor={ring[1]} />
          <stop offset="62%" stopColor={ring[2]} />
          <stop offset="100%" stopColor={ring[3]} />
        </linearGradient>
        <radialGradient id={`${uid}g`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={locked ? '#1a1e24' : t.glow} stopOpacity={locked ? 1 : 0.32} />
          <stop offset="100%" stopColor="#090b0e" stopOpacity="1" />
        </radialGradient>
      </defs>
      <polygon points={HEX(30)} fill={`url(#${uid}r)`} />
      <polygon points={HEX(26)} fill="#07090c" />
      <polygon points={HEX(25)} fill={`url(#${uid}g)`} />
      <polygon points={HEX(21.5)} fill="none" stroke={locked ? '#2a303a' : t.glow} strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2.5 2" />
      {/* remaches */}
      {HEX(27.8)
        .split(' ')
        .map((p) => p.split(',').map(Number))
        .map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.9" fill={locked ? '#2f353f' : '#0b0d10'} opacity="0.75" />
        ))}
      <g transform={`translate(17.6 ${showLabel ? 12.4 : 17.6}) scale(1.2)`} fill="none" stroke={glyphColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: glyphColor }}>
        <Glyph name={locked && secret ? 'question' : icon} />
      </g>
      {showLabel && (
        <g>
          <rect x={32 - Math.max(9, label.length * 3.1 + 4)} y="44" width={Math.max(18, label.length * 6.2 + 8)} height="11" rx="2" fill={`url(#${uid}r)`} />
          <text x="32" y="52.3" textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontWeight="600" fontSize="8" fill="#0b0d10" letterSpacing="0.3">
            {label}
          </text>
        </g>
      )}
    </svg>
  );
}
