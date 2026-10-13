import { useEffect, type ReactNode } from 'react';
import type { Card, Rarity } from '../../data/types';
import { RARITIES, RARITY_ORDER } from '../../data/rarity';
import type { BattleEvent, Fighter } from '../../game/battle';
import type { ArenaSetup } from './Arena';
import { CardFace } from '../../components/Card';
import { fx } from '../../fx/particles';
import { sfx } from '../../fx/sfx';
import { navigate } from '../../hooks';
import { t, useT } from '../../i18n';
import { clearance, clearanceName } from '../../i18n/labels';

/** Captura el HP inicial y ejecuta la simulación (que muta a los luchadores). */
export function prepare(teamA: Fighter[], teamB: Fighter[], run: (events: BattleEvent[]) => void): ArenaSetup {
  const startHp = Object.fromEntries([...teamA, ...teamB].map((f) => [f.key, f.hp]));
  const events: BattleEvent[] = [];
  run(events);
  return { teamA, teamB, startHp, events };
}

export function ModeHeader({ title, subtitle, onBack, backLabel }: { title: string; subtitle?: string; onBack?: () => void; backLabel?: string }) {
  useT();
  return (
    <div className="mode-head">
      <div>
        <h2 className="display">{title}</h2>
        {subtitle && <p className="dim">{subtitle}</p>}
      </div>
      <button className="btn btn-sm" onClick={onBack ?? (() => navigate('combate'))}>
        ← {backLabel ?? t('battle.menu')}
      </button>
    </div>
  );
}

export function GradePicker({ onPick, hint }: { onPick: (r: Rarity) => void; hint?: ReactNode }) {
  useT();
  return (
    <div className="grade-grid">
      {RARITY_ORDER.map((r) => (
        <button key={r} className="grade" style={{ ['--rc' as string]: RARITIES[r].color }} onClick={() => onPick(r)}>
          <b className="display">{r}</b>
          <span>{t('battle.grade', { r })}</span>
          <small className="mono">
            {clearance(r)} · {clearanceName(r)}
          </small>
        </button>
      ))}
      {hint && <div className="grade-hint dim">{hint}</div>}
    </div>
  );
}

export function ResultBanner({ result, children, label: customLabel }: { result: 'win' | 'loss' | 'draw'; children?: ReactNode; label?: string }) {
  useEffect(() => {
    if (result === 'win') {
      sfx.play('victory');
      fx.rain(['#ffc845', '#43d39e', '#4ea8ff', '#ffffff'], 90, 'square');
    } else if (result === 'loss') sfx.play('defeat');
    else sfx.play('chime');
  }, [result]);
  useT();
  const label = customLabel ?? (result === 'win' ? t('result.win') : result === 'loss' ? t('result.loss') : t('result.draw'));
  return (
    <div className={`result-banner rb-${result}`}>
      <div className="rb-label display">{label}</div>
      {children && <div className="rb-sub">{children}</div>}
    </div>
  );
}

export function ResultCards({ a, b, hpA, hpB, maxA, maxB, winner }: { a: Card; b: Card; hpA: number; hpB: number; maxA: number; maxB: number; winner: 'A' | 'B' | null }) {
  const { fmt } = useT();
  return (
    <div className="result-cards">
      {[
        { c: a, hp: hpA, max: maxA, side: 'A' as const, label: t('battle.yourCard') },
        { c: b, hp: hpB, max: maxB, side: 'B' as const, label: t('battle.rival') },
      ].map((x) => (
        <div key={x.side} className={`rc ${winner === x.side ? 'won' : winner ? 'lost' : ''}`}>
          <span className="rc-label mono">{x.label}</span>
          <CardFace card={x.c} width="min(200px, 40vw)" />
          <span className="rc-hp mono">
            HP {fmt(Math.max(0, x.hp))} / {fmt(x.max)}
          </span>
        </div>
      ))}
    </div>
  );
}
