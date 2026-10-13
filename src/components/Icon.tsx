import type { CSSProperties, ReactNode } from 'react';

/**
 * Set de íconos propio (trazo de 24×24, estilo de terminal de la Fundación).
 * Todo en SVG con currentColor: sin emojis ni archivos externos.
 */
const GLYPHS = {
  pack: (
    <>
      <path d="M5 4.5l1.75 1.4L8.5 4.5l1.75 1.4L12 4.5l1.75 1.4 1.75-1.4 1.75 1.4L19 4.5V20H5z" />
      <circle cx="12" cy="12.5" r="3.2" />
      <path d="M5 8.5h14" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <path d="M3 10h18" />
    </>
  ),
  archive: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
      <path d="M4.5 9h15M4.5 15h15M10 6h4M10 12h4M10 18h4" />
    </>
  ),
  keycard: (
    <>
      <rect x="3" y="6" width="18" height="12.5" rx="2" />
      <path d="M3 10h18" />
      <rect x="6" y="13" width="4" height="3" rx=".5" />
      <path d="M13 14h5M13 16.2h3" />
    </>
  ),
  cards: (
    <>
      <rect x="4" y="5" width="10" height="14" rx="1.5" transform="rotate(-10 9 12)" />
      <rect x="10" y="5" width="10" height="14" rx="1.5" transform="rotate(8 15 12)" />
    </>
  ),
  copies: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v10A1.5 1.5 0 0 0 5.5 17H8" />
    </>
  ),
  sword: (
    <>
      <path d="M19.5 4.5L9.5 14.5M15 4.5h4.5V9" />
      <path d="M6.5 12.5l5 5M8.5 16.5l-4 4" />
    </>
  ),
  swords: (
    <>
      <path d="M4 4l9.5 9.5M4 4h3.5L15 11.5M4 4v3.5L11.5 15" />
      <path d="M20 4l-9.5 9.5M20 4h-3.5L9 11.5M20 4v3.5L12.5 15" />
      <path d="M7 15.5l2 2M5 19l2.5-2.5M17 15.5l-2 2M19 19l-2.5-2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z" />
      <path d="M12 7.5v9M8.5 11h7" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  leaf: <path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14zM5 19l8-8" />,
  bug: (
    <>
      <ellipse cx="12" cy="14" rx="3.5" ry="4.5" />
      <circle cx="12" cy="7.2" r="2" />
      <path d="M8.5 12.5L5 10.5M8.5 15H4.5M9 17.5l-3 2.5M15.5 12.5l3.5-2M15.5 15h4M15 17.5l3 2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12C5 7 8.5 5 12 5s7 2 9.5 7c-2.5 5-6 7-9.5 7s-7-2-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2.5 12C5 7 8.5 5 12 5s7 2 9.5 7c-2.5 5-6 7-9.5 7s-7-2-9.5-7z" />
      <path d="M4 20L20 4" />
    </>
  ),
  keter: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v5.5M4.6 16.3l4.8-2.8M19.4 16.3l-4.8-2.8" />
    </>
  ),
  nodes: (
    <>
      <path d="M12 4L7 8v7l5 5 5-5V8zM7 8l10 7M17 8L7 15M12 4v16" />
      {[
        [12, 4],
        [7, 8],
        [17, 8],
        [7, 15],
        [17, 15],
        [12, 20],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />
      ))}
    </>
  ),
  crack: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" />
      <path d="M12 3.5l-1.5 5 3 3-3 3 1.5 6" />
    </>
  ),
  triangle: (
    <>
      <path d="M12 3.5l9 16H3z" />
      <circle cx="12" cy="13.5" r="2.5" />
    </>
  ),
  spiral: <path d="M12 12m0-1.5a1.5 1.5 0 1 1-1.5 1.5 3 3 0 1 1 3 3 4.5 4.5 0 1 1-4.5-4.5 6 6 0 1 1 6 6 7.5 7.5 0 1 1-7.5-7.5" />,
  xcircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </>
  ),
  magnifier: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </>
  ),
  stamp: (
    <>
      <path d="M9.5 3.5h5v4l2.5 3.5H7l2.5-3.5z" />
      <rect x="4.5" y="11" width="15" height="4.5" rx="1" />
      <path d="M5 19.5h14" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M8 14l2.5 2.5L16 12" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 4.5V3h6v1.5M8.5 10l1.5 1.5 3-3M8.5 15.5l1.5 1.5 3-3M15 11h1.5M15 16.5h1.5" />
    </>
  ),
  antenna: (
    <>
      <circle cx="12" cy="10" r="1.6" />
      <path d="M12 11.6V21M8.5 21h7M8.2 6.2a5.3 5.3 0 0 0 0 7.6M15.8 6.2a5.3 5.3 0 0 1 0 7.6M5.4 3.4a9.3 9.3 0 0 0 0 13.2M18.6 3.4a9.3 9.3 0 0 1 0 13.2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
      <path d="M6.5 8h2.5M6.5 11h2.5M15 8h2.5M15 11h2.5" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    </>
  ),
  helmet: (
    <>
      <path d="M4 15.5a8 8 0 0 1 16 0V17H4z" />
      <path d="M2.5 17h19M12 7.5v4.5M8 9.5l1.5 2.5M16 9.5l-1.5 2.5" />
    </>
  ),
  rock: (
    <>
      <path d="M4 17l2.5-6 4-3.5 5 1 3.5 4.5L20 17z" />
      <path d="M3 20.5h18M10.5 7.5l1 4.5 4.5-3" />
    </>
  ),
  siren: (
    <>
      <path d="M7 18v-5.5a5 5 0 0 1 10 0V18" />
      <rect x="5" y="18" width="14" height="3" rx="1" />
      <path d="M12 2.5v2.2M4.3 5.3l1.6 1.6M19.7 5.3l-1.6 1.6M12 10v4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  flag: <path d="M5.5 21V3.5M5.5 4.5H17l-2.5 4 2.5 4H5.5" />,
  trophy: (
    <>
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.8 10.5M16.5 6h3v1.5a3 3 0 0 1-3.3 3M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  bolt: <path d="M13.5 2.5L4.5 14h6.5l-1 7.5L19.5 10H13z" />,
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  skip: <path d="M5 5.5l8 6.5-8 6.5zM16.5 5.5v13" />,
  warning: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.3" />
    </>
  ),
  hourglass: <path d="M6.5 3.5h11M6.5 20.5h11M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5s8 3.5 8 8.5" />,
  flask: <path d="M9 3h6M10 3v6l-5.2 9.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9V3M7.5 15h9" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  jaw: (
    <>
      <path d="M3 8.5h18l-2.5 3.5h-13z" />
      <path d="M7 12l1.2 2 1.2-2M11 12l1 2 1-2M14.6 12l1.2 2 1.2-2" />
      <path d="M5.5 16.5h13l-2 3.5h-9z" />
    </>
  ),
  statue: (
    <>
      <circle cx="12" cy="5.5" r="2.8" />
      <path d="M8.5 10h7l1 6.5h-2V21h-5v-4.5h-2z" />
    </>
  ),
  blob: (
    <>
      <path d="M4.5 16.5c0-5.5 3.3-10 7.5-10s7.5 4.5 7.5 10c0 2.2-1.8 3.5-4 3.5h-7c-2.2 0-4-1.3-4-3.5z" />
      <path d="M9.5 12v1M14.5 12v1M9.5 16a3.5 3.5 0 0 0 5 0" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  mask: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 10.5l1.5-1 1.5 1M13 10.5l1.5-1 1.5 1M7.5 14a5 5 0 0 0 9 0" />
    </>
  ),
  wall: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19" />
    </>
  ),
  broom: <path d="M15.5 3.5l-4 8M7.5 11.5h8l1.5 9h-11zM9 15.5l-.5 5M12.5 15.5v5" />,
  scale: <path d="M12 3.5v17M7.5 20.5h9M5 7h14M5 7l-2.5 6h5zM19 7l-2.5 6h5z" />,
  vault: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 7.5v9M7.5 12h9M20.5 9v6" />
    </>
  ),
  house: <path d="M3.5 11L12 4l8.5 7M6 9v11h12V9M10 20v-5h4v5" />,
  prism: (
    <>
      <path d="M12 4l7 13H5z" />
      <path d="M2 11.5l7.2 1.3M14.8 12.2L22 9.5M15.3 13.2l6.7 1.3M15.8 14.2L22 19" />
    </>
  ),
  grid: (
    <>
      {[6, 12, 18].map((x) => [6, 12, 18].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" />))}
    </>
  ),
  medal: (
    <>
      <path d="M8 3l2.5 6M16 3l-2.5 6" />
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="M12 11.5l.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z" />
    </>
  ),
  spark: <path d="M12 3c.6 4.8 2.9 7.4 8 9-5.1 1.6-7.4 4.2-8 9-.6-4.8-2.9-7.4-8-9 5.1-1.6 7.4-4.2 8-9z" />,
  question: (
    <>
      <path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.2-1.5 2.2v.7" />
      <path d="M12 17.6v.4" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4" />
    </>
  ),
  chevron: <path d="M9 5.5l6.5 6.5L9 18.5" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.6 3.7 5.4 3.7 8.5s-1.3 5.9-3.7 8.5M12 3.5C9.6 6.1 8.3 8.9 8.3 12s1.3 5.9 3.7 8.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPHS;

interface IconProps {
  name: IconName;
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  title?: string;
}

export function Icon({ name, size = 20, className = '', strokeWidth = 1.8, style, title }: IconProps) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {GLYPHS[name]}
    </svg>
  );
}

/** Uso dentro de otro <svg> (insignias): mismo dibujo, posicionado por el contenedor. */
export function Glyph({ name }: { name: IconName }) {
  return <>{GLYPHS[name]}</>;
}
