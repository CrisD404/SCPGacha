import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleEvent, Fighter } from '../../game/battle';
import { RARITIES } from '../../data/rarity';
import { CLASSES } from '../../data/classes';
import { cardName } from '../../data/cards';
import { t, useT } from '../../i18n';
import { classLabel } from '../../i18n/labels';
import { CardArt } from '../../components/CardArt';
import { Icon } from '../../components/Icon';
import { useGame } from '../../store/game';
import { sfx, vibrate } from '../../fx/sfx';
import { fx, centerOf } from '../../fx/particles';

export interface ArenaSetup {
  teamA: Fighter[];
  teamB: Fighter[];
  /** HP al inicio (antes de simular) */
  startHp: Record<string, number>;
  events: BattleEvent[];
}

interface Popup {
  id: number;
  key: string;
  text: string;
  kind: 'dmg' | 'crit' | 'miss' | 'heal' | 'info';
}

const short = (f: Fighter) => {
  const name = cardName(f.card);
  return name ? `${f.card.code} «${name}»` : f.card.code;
};

function describe(e: BattleEvent, by: Map<string, Fighter>): string | null {
  const n = (k: string) => {
    const f = by.get(k);
    return f ? short(f) : k;
  };
  switch (e.kind) {
    case 'enter':
      return t('log.enter', { a: n(e.a), b: n(e.b) });
    case 'hit':
      if (e.crit) return t('log.crit', { a: n(e.from), b: n(e.to), n: e.dmg });
      if (e.extra) return t('log.extra', { a: n(e.from), n: e.dmg });
      return t('log.hit', { a: n(e.from), b: n(e.to), n: e.dmg });
    case 'miss':
      return t('log.miss', { a: n(e.from), b: n(e.to) });
    case 'heal':
      return t('log.heal', { a: n(e.who), n: e.amount });
    case 'laststand':
      return t('log.lastStand', { a: n(e.who) });
    case 'ko':
      return t('log.ko', { a: n(e.who) });
    case 'decision':
      return t('log.decision');
  }
}

function FighterPanel({ f, hp, active, ko, popups, panelRef, side }: { f: Fighter; hp: number; active: boolean; ko: boolean; popups: Popup[]; panelRef?: (el: HTMLDivElement | null) => void; side: 'A' | 'B' }) {
  const rar = RARITIES[f.card.rarity];
  const pct = Math.max(0, hp / f.maxHp);
  const { fmt } = useT();
  return (
    <div ref={panelRef} className={`fighter side-${side} ${active ? 'active' : ''} ${ko ? 'ko' : ''} ${f.boss ? 'boss' : ''}`} style={{ ['--rc' as string]: rar.color }}>
      <div className="fighter-art">
        <CardArt card={f.card} />
        <span className="mini-rarity">{f.card.rarity}</span>
        {f.level > 1 && <span className="fighter-lvl mono">{t('card.lvShort')} {f.level}</span>}
        {ko && <span className="ko-stamp display">{t('battle.neutralized')}</span>}
      </div>
      <div className="fighter-info">
        <div className="fighter-name">
          <b className="display">{f.card.code}</b>
          <span>{cardName(f.card)}</span>
        </div>
        <div className="fighter-meta mono">
          <span style={{ color: CLASSES[f.card.cls].color }}>{classLabel(f.card)}</span> · ATK {fmt(f.atk)} · DEF {fmt(f.def)}
        </div>
        <div className="hp">
          <div className="hp-bar">
            <i className="hp-lag" style={{ width: `${pct * 100}%` }} />
            <i className={`hp-fill ${pct < 0.25 ? 'low' : pct < 0.5 ? 'mid' : ''}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <span className="hp-num mono">
            {fmt(Math.max(0, Math.round(hp)))} / {fmt(f.maxHp)}
          </span>
        </div>
      </div>
      <div className="popups">
        {popups.map((p) => (
          <span key={p.id} className={`popup popup-${p.kind}`}>
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Reproduce los eventos de una simulación con animación, sonido y registro. */
export function Arena({ setup, onDone, title }: { setup: ArenaSetup; onDone: () => void; title?: string }) {
  const { teamA, teamB, startHp, events } = setup;
  const speed = useGame((s) => s.save.settings.battleSpeed);
  const { fmt } = useT();
  const setSettings = useGame((s) => s.setSettings);
  const all = useMemo(() => [...teamA, ...teamB], [teamA, teamB]);
  const byKey = useMemo(() => new Map(all.map((f) => [f.key, f])), [all]);
  const [idx, setIdx] = useState(0);
  const [hp, setHp] = useState<Record<string, number>>(startHp);
  const [ko, setKo] = useState<Set<string>>(new Set());
  const [pair, setPair] = useState<[string, string]>([teamA[0].key, teamB[0].key]);
  const [log, setLog] = useState<{ id: number; text: string; kind: string }[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [turn, setTurn] = useState(0);
  const panels = useRef(new Map<string, HTMLDivElement | null>());
  const done = idx >= events.length;
  const popId = useRef(0);

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
    const e = events[idx];
    const base = e.kind === 'enter' ? 750 : e.kind === 'decision' || e.kind === 'ko' ? 850 : 480;
    const t = setTimeout(() => {
      apply(e);
      setIdx((i) => i + 1);
    }, base / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done, speed]);

  const pop = (key: string, text: string, kind: Popup['kind']) => {
    const id = ++popId.current;
    setPopups((p) => [...p.slice(-6), { id, key, text, kind }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1100);
  };

  function apply(e: BattleEvent) {
    const text = describe(e, byKey);
    if (text) setLog((l) => [{ id: Date.now() + Math.random(), text, kind: e.kind === 'hit' && e.crit ? 'crit' : e.kind }, ...l].slice(0, 40));
    switch (e.kind) {
      case 'enter':
        setPair([e.a, e.b]);
        sfx.play('deal');
        break;
      case 'hit': {
        setTurn(e.turn);
        setHp((h) => ({ ...h, [e.to]: e.hp }));
        pop(e.to, `-${fmt(e.dmg)}`, e.crit ? 'crit' : 'dmg');
        const amp = e.crit ? 9 : 4;
        panels.current.get(e.to)?.animate(
          [
            { transform: 'translate(0,0)', filter: 'brightness(1)' },
            { transform: `translate(${-amp}px, ${amp / 2}px)`, filter: 'brightness(1.8) saturate(0.4)' },
            { transform: `translate(${amp}px, ${-amp / 2}px)` },
            { transform: `translate(${-amp / 2}px, 0)` },
            { transform: 'translate(0,0)', filter: 'brightness(1)' },
          ],
          { duration: e.crit ? 380 : 260, easing: 'ease-out' },
        );
        sfx.play(e.crit ? 'crit' : 'hit');
        if (e.crit) {
          vibrate(30);
          const { x, y } = centerOf(panels.current.get(e.to) ?? null);
          fx.burst({ x, y, count: 18, colors: ['#ff4d5e', '#ffd0d5', '#fff'], speed: [3, 9], life: [0.3, 0.7] });
        }
        break;
      }
      case 'miss':
        pop(e.to, t('battle.dodge'), 'miss');
        sfx.play('miss');
        break;
      case 'heal':
        setHp((h) => ({ ...h, [e.who]: e.hp }));
        pop(e.who, `+${fmt(e.amount)}`, 'heal');
        sfx.play('heal');
        break;
      case 'laststand':
        pop(e.who, t('battle.lastBreath'), 'info');
        break;
      case 'ko': {
        setKo((s) => new Set(s).add(e.who));
        sfx.play('ko');
        const { x, y } = centerOf(panels.current.get(e.who) ?? null);
        fx.burst({ x, y, count: 30, colors: ['#9aa3b2', '#ff4d5e', '#fff'], shape: 'shard', speed: [3, 10], gravity: 0.3 });
        break;
      }
      case 'decision':
        sfx.play('chime');
        break;
    }
  }

  const skip = () => {
    // aplica el estado final directamente
    const final: Record<string, number> = { ...hp };
    const kos = new Set(ko);
    let last: [string, string] = pair;
    for (let i = idx; i < events.length; i++) {
      const e = events[i];
      if (e.kind === 'hit') final[e.to] = e.hp;
      else if (e.kind === 'heal') final[e.who] = e.hp;
      else if (e.kind === 'ko') kos.add(e.who);
      else if (e.kind === 'enter') last = [e.a, e.b];
    }
    setHp(final);
    setKo(kos);
    setPair(last);
    setIdx(events.length);
  };

  const a = byKey.get(pair[0])!;
  const b = byKey.get(pair[1])!;
  const team = teamA.length > 1 || teamB.length > 1;

  return (
    <div className="arena">
      {title && <div className="arena-title mono">{title}</div>}
      {team && (
        <div className="lineups">
          <Lineup team={teamA} ko={ko} current={pair[0]} />
          <Lineup team={teamB} ko={ko} current={pair[1]} />
        </div>
      )}
      <div className="duel">
        {[a, b].map((f) => (
          <div key={f.key} className="duel-slot">
            <FighterPanel
              f={f}
              side={f.side}
              hp={hp[f.key] ?? f.maxHp}
              active={!done}
              ko={ko.has(f.key)}
              popups={popups.filter((p) => p.key === f.key)}
              panelRef={(el) => panels.current.set(f.key, el)}
            />
          </div>
        ))}
        <div className="versus display">VS</div>
      </div>
      <div className="arena-bar row">
        <span className="mono dim">{t('battle.turn', { n: turn })}</span>
        <div className="grow" />
        <div className="seg">
          {[1, 2, 4].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSettings({ battleSpeed: s })}>
              ×{s}
            </button>
          ))}
        </div>
        {!done && (
          <button className="btn btn-sm" onClick={skip}>
            {t('common.skip')} <Icon name="skip" size={14} />
          </button>
        )}
      </div>
      <div className="battle-log" aria-live="polite">
        {log.map((l) => (
          <div key={l.id} className={`log-line log-${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Lineup({ team, ko, current }: { team: Fighter[]; ko: Set<string>; current: string }) {
  return (
    <div className="lineup">
      {team.map((f, i) => (
        <div key={f.key} className={`lu-slot ${ko.has(f.key) ? 'ko' : ''} ${f.key === current ? 'cur' : ''}`} style={{ ['--rc' as string]: RARITIES[f.card.rarity].color }} title={short(f)}>
          <CardArt card={f.card} />
          <span className="lu-n mono">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
