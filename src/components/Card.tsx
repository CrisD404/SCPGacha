import { memo, useCallback, useRef, type CSSProperties, type PointerEvent } from 'react';
import type { Card } from '../data/types';
import { RARITIES } from '../data/rarity';
import { CLASSES } from '../data/classes';
import { cardName, cardSummary } from '../data/cards';
import { useT } from '../i18n';
import { classLabel, rarityName } from '../i18n/labels';
import { CardArt } from './CardArt';
import { Emblem } from './Emblem';
import './card.css';

interface CardProps {
  card: Card;
  width?: number | string;
  tilt?: boolean;
  level?: number;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}


/** Inclinación 3D + brillo holográfico que sigue al puntero (sin re-render de React). */
export function useTilt(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!enabled || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const el = ref.current;
      el.style.setProperty('--rx', `${(0.5 - py) * 18}deg`);
      el.style.setProperty('--ry', `${(px - 0.5) * 22}deg`);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      el.style.setProperty('--hover', '1');
    },
    [enabled],
  );
  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--hover', '0');
  }, []);
  return { ref, onPointerMove, onPointerLeave };
}

export const CardFace = memo(function CardFace({ card, width, tilt = false, level, onClick, className = '', style }: CardProps) {
  const rar = RARITIES[card.rarity];
  const cls = CLASSES[card.cls];
  const { t, fmt } = useT();
  const name = cardName(card);
  const { ref, onPointerMove, onPointerLeave } = useTilt(tilt);
  const w = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      ref={ref}
      className={`card r-${card.rarity} ${tilt ? 'tilt' : ''} ${onClick ? 'clickable' : ''} ${className}`}
      style={{ ...(w ? { ['--w' as string]: w } : {}), ['--rc' as string]: rar.color, ['--rg' as string]: rar.glow, ['--cc' as string]: cls.color, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      aria-label={`${card.code} ${name}, ${rarityName(card.rarity)}`}
    >
      <div className="card-inner">
        <div className="card-frame">
          <header className="card-head">
            <span className="card-rarity">{card.rarity}</span>
            <span className="card-code">{card.code}</span>
            <span className="card-cls">{classLabel(card)}</span>
          </header>
          <div className="card-art">
            <CardArt card={card} />
            <div className="card-holo" />
            <span className="card-q" title={t('card.qTitle')}>
              {t('card.qShort')} {fmt(card.q, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            {level && level > 1 ? <span className="card-lvl">{t('card.lvShort')} {level}</span> : null}
            <div className="card-name">{name || <span className="redacted">██████████</span>}</div>
          </div>
          <div className="card-body">
            <p className="card-desc">
              <b>{t('card.description')}</b> {cardSummary(card) || t('card.expunged')}
            </p>
          </div>
          <footer className="card-stats">
            <div className="stat atk">
              <span>ATK</span>
              <b>{fmt(card.atk)}</b>
            </div>
            <div className="stat def">
              <span>DEF</span>
              <b>{fmt(card.def)}</b>
            </div>
          </footer>
        </div>
        <div className="card-sheen" />
        <div className="card-glare" />
      </div>
    </div>
  );
});

export function CardBack({ width, glow, className = '', style }: { width?: number | string; glow?: string; className?: string; style?: CSSProperties }) {
  const { t } = useT();
  const w = typeof width === 'number' ? `${width}px` : width;
  return (
    <div className={`card card-back ${className}`} style={{ ...(w ? { ['--w' as string]: w } : {}), ...(glow ? { ['--bg-glow' as string]: glow } : {}), ...style }}>
      <div className="card-inner">
        <div className="back-frame">
          <div className="back-stripes top" />
          <div className="back-center">
            <Emblem className="back-emblem" />
            <div className="back-title">SCP</div>
            <div className="back-sub">SECURE · CONTAIN · PROTECT</div>
          </div>
          <div className="back-stamp">{t('card.classified')}</div>
          <div className="back-stripes bottom" />
        </div>
      </div>
    </div>
  );
}

/** Miniatura compacta para listas, equipos y combate. */
export function CardMini({ card, onClick, selected, badge, dim }: { card: Card; onClick?: () => void; selected?: boolean; badge?: string; dim?: boolean }) {
  const rar = RARITIES[card.rarity];
  useT();
  return (
    <button
      type="button"
      className={`card-mini r-${card.rarity} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}`}
      style={{ ['--rc' as string]: rar.color, ['--rg' as string]: rar.glow, ['--cc' as string]: CLASSES[card.cls].color }}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="mini-art">
        <CardArt card={card} />
        <span className="mini-rarity">{card.rarity}</span>
        {badge && <span className="mini-badge">{badge}</span>}
      </div>
      <div className="mini-info">
        <b>{card.code}</b>
        <span>{cardName(card) || '—'}</span>
      </div>
    </button>
  );
}
