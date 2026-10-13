import { forwardRef, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { PackType } from '../data/types';
import { useT } from '../i18n';
import { packName, packSub, packTitle } from '../i18n/labels';
import { Emblem } from './Emblem';
import './pack.css';

interface PackProps {
  type: PackType;
  width?: string;
  /** progreso del rasgado 0–1 (controlado) */
  tear?: number;
  torn?: boolean;
  disabled?: boolean;
  onOpen?: () => void;
  className?: string;
  style?: CSSProperties;
}


/** Paquete de 5 expedientes. Se abre tocando o deslizando el dedo por la línea de corte. */
export const Pack = forwardRef<HTMLDivElement, PackProps>(function Pack({ type, width, tear: tearProp, torn, disabled, onOpen, className = '', style }, ref) {
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const { t } = useT();
  const tear = tearProp ?? drag;

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || !onOpen) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const w = (e.currentTarget as HTMLElement).getBoundingClientRect().width;
    const dx = Math.abs(e.clientX - start.current.x);
    if (dx > 8) start.current.moved = true;
    setDrag(Math.min(1, dx / (w * 0.75)));
  };
  const onUp = () => {
    if (!start.current) return;
    const { moved } = start.current;
    start.current = null;
    if (!moved || drag > 0.55) onOpen?.();
    setDrag(0);
  };

  return (
    <div
      ref={ref}
      className={`pack pack-${type} ${torn ? 'torn' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      style={{ ...(width ? { ['--pw' as string]: width } : {}), ['--tear' as string]: tear, ...style }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        start.current = null;
        setDrag(0);
      }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen && !disabled ? 0 : undefined}
      aria-label={onOpen ? t('pack.open', { name: packName(type) }) : packName(type)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && onOpen?.()}
    >
      <div className="pack-cap">
        <div className="pack-foil" />
        <span className="pack-cap-text mono">◤ {t('pack.tear')} ◥</span>
      </div>
      <div className="pack-body">
        <div className="pack-foil" />
        <div className="pack-band hazard-stripes" />
        <div className="pack-content">
          <div className="pack-kicker mono">SCP FOUNDATION · {packSub(type)}</div>
          <Emblem className="pack-emblem" />
          <div className="pack-name display">{packTitle(type)}</div>
          <div className="pack-count mono">{t('pack.count')}</div>
        </div>
        <div className="pack-barcode" />
        <div className="pack-motto mono">SECURE · CONTAIN · PROTECT</div>
      </div>
      <div className="pack-tearline" />
    </div>
  );
});
