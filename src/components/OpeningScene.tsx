import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Card, Rarity } from '../data/types';
import { RARITIES, maxRarity, rarityRank } from '../data/rarity';
import { t, useT } from '../i18n';
import { clearance, clearanceName, packName } from '../i18n/labels';
import type { PackResult } from '../store/game';
import { useGame } from '../store/game';
import { useUi } from '../store/ui';
import { fx, centerOf } from '../fx/particles';
import { sfx, vibrate } from '../fx/sfx';
import { prefersReducedMotion, wait } from '../hooks';
import { CardBack, CardFace } from './Card';
import { Pack } from './Pack';
import { PackLight } from './PackLight';
import { Emblem } from './Emblem';
import { Icon } from './Icon';
import { ResultsDock, type NextPack } from './ResultsDock';
import './opening.css';

type Phase = 'tear' | 'deal' | 'reveal' | 'results';

interface StageFx {
  dim: boolean;
  alarm: boolean;
  black: boolean;
  breach: boolean;
  banner: string | null;
  bannerSub: string | null;
  stamp: string | null;
  glitch: boolean;
  cracks: boolean;
  glow: string | null;
  charge: boolean;
  shake: 0 | 1 | 2 | 3;
  rays: Rarity | null;
  sigil: boolean;
}

const NO_FX: StageFx = { dim: false, alarm: false, black: false, breach: false, banner: null, bannerSub: null, stamp: null, glitch: false, cracks: false, glow: null, charge: false, shake: 0, rays: null, sigil: false };

const PRISM = ['#ff8cf0', '#ffc845', '#5fe0ff', '#43d39e', '#b57bff', '#ffffff'];
const GOLD = ['#ffc845', '#fff1c4', '#ffdd80', '#ffffff'];

interface Props {
  result: PackResult;
  intense: boolean;
  /** próximo paquete disponible (null si no queda ninguno) */
  next: NextPack | null;
  onAgain: () => void;
  onClose: () => void;
}

export function OpeningScene({ result, intense, next, onAgain, onClose }: Props) {
  const { cards, isNew, copies, type } = result;
  const [phase, setPhase] = useState<Phase>('tear');
  const [torn, setTorn] = useState(false);
  const [flipped, setFlipped] = useState<boolean[]>(() => cards.map(() => false));
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sfxState, setFx] = useState<StageFx>(NO_FX);
  const [flash, setFlash] = useState<{ key: number; color: string; dur: number } | null>(null);
  const skip = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);
  const releasePackNotes = useGame((s) => s.releasePackNotes);
  const openShare = useUi((s) => s.openShare);
  const openDetail = useUi((s) => s.openDetail);
  const reduced = useMemo(prefersReducedMotion, []);
  useT();

  const best = maxRarity(cards.map((c) => c.rarity));
  const tellRarity: Rarity = rarityRank(best) >= rarityRank('SSR') ? 'SSR' : best;
  const tell = RARITIES[tellRarity];

  const sleep = useCallback((ms: number) => (skip.current ? Promise.resolve() : wait(reduced ? ms * 0.35 : ms)), [reduced]);
  const patch = (p: Partial<StageFx>) => setFx((s) => ({ ...s, ...p }));
  const doFlash = (color: string, dur = 450) => setFlash({ key: Date.now() + Math.random(), color, dur });

  // ───────────── apertura del paquete ─────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wait(250);
      if (cancelled) return;
      sfx.play('tear');
      vibrate(20);
      setTorn(true);
      const level = rarityRank(tellRarity);
      if (level >= 3) {
        await wait(150);
        sfx.play('charge');
        vibrate(level >= 4 ? [30, 40, 30] : 25);
      }
      await wait(level >= 3 ? 950 : 650);
      if (cancelled) return;
      sfx.play('whoosh');
      setPhase('deal');
      await wait(intense ? 700 : 650);
      if (cancelled) return;
      setPhase('reveal');
    })();
    return () => {
      cancelled = true;
    };
  }, [tellRarity, intense]);

  // ───────────── efectos por nivel de dramatismo ─────────────
  const celebrate = useCallback(
    (card: Card, el: Element | null, scale = 1) => {
      const { x, y } = centerOf(el);
      const r = RARITIES[card.rarity];
      const d = r.drama;
      const n = (k: number) => Math.round(k * scale);
      if (d === 0) {
        if (card.rarity === 'UC') fx.burst({ x, y, count: n(10), colors: [r.color], speed: [2, 5], life: [0.4, 0.8], gravity: 0.05 });
        sfx.play('reveal0');
        return;
      }
      if (d === 1) {
        fx.burst({ x, y, count: n(26), colors: [r.color, '#ffffff'], speed: [3, 8], life: [0.5, 1], gravity: 0.08 });
        fx.ring(x, y, r.color, 180 * scale, 0.55, 3);
        sfx.play('reveal1');
        return;
      }
      if (d === 2) {
        fx.burst({ x, y, count: n(60), colors: [r.color, '#e9d8ff', '#ffffff'], speed: [3, 12], shape: ['spark', 'star'], life: [0.6, 1.3] });
        fx.ring(x, y, r.color, 240 * scale, 0.6, 4);
        fx.ring(x, y, '#ffffff', 160 * scale, 0.45, 2);
        sfx.play('reveal2');
        vibrate(25);
        return;
      }
      if (d === 3) {
        fx.burst({ x, y, count: n(110), colors: [r.color, '#ffb3bb', '#ffffff'], speed: [4, 16], shape: ['spark', 'star', 'dot'], life: [0.7, 1.6] });
        for (let i = 0; i < 3; i++) setTimeout(() => fx.ring(x, y, i === 1 ? '#ffffff' : r.color, (220 + i * 90) * scale, 0.7, 5 - i), i * 110);
        sfx.play('fanfare3');
        vibrate(60);
        return;
      }
      if (d === 4) {
        fx.burst({ x, y, count: n(170), colors: GOLD, speed: [5, 20], shape: ['spark', 'star', 'dot'], life: [0.8, 1.9], gravity: 0.1 });
        for (let i = 0; i < 4; i++) setTimeout(() => fx.ring(x, y, i % 2 ? '#ffffff' : r.color, (240 + i * 110) * scale, 0.8, 6 - i), i * 120);
        if (scale >= 1) fx.rain(GOLD, 70, 'star');
        sfx.play('boom');
        sfx.play('fanfare4');
        vibrate([80, 40, 120]);
        return;
      }
      fx.burst({ x, y, count: n(240), colors: PRISM, speed: [5, 24], shape: ['spark', 'star', 'square'], life: [1, 2.2], gravity: 0.08 });
      for (let i = 0; i < 5; i++) setTimeout(() => fx.ring(x, y, PRISM[i], (260 + i * 120) * scale, 0.9, 7 - i), i * 130);
      if (scale >= 1) {
        fx.rain(PRISM, 140, 'square');
        setTimeout(() => fx.rain(PRISM, 80, 'star'), 600);
      }
      sfx.play('boom');
      sfx.play('fanfare5');
      vibrate([100, 50, 100, 50, 300]);
    },
    [],
  );

  /** Amago: empieza como si fuera SR y "escala" con un fallo de contención. */
  const fakeOut = useCallback(async () => {
    patch({ glow: RARITIES.SR.color, charge: true, shake: 1 });
    sfx.play('charge');
    await sleep(900);
    patch({ glitch: true, shake: 2 });
    sfx.play('glitch');
    doFlash('rgba(255,40,60,.55)', 260);
    vibrate([15, 30, 15]);
    await sleep(520);
    patch({ glitch: false, charge: false });
  }, [sleep]);

  const flipCard = (i: number) => setFlipped((f) => f.map((v, k) => (k === i ? true : v)));

  /** Secuencia cinematográfica completa (modo intenso). */
  const revealIntense = useCallback(
    async (i: number) => {
      const card = cards[i];
      const r = RARITIES[card.rarity];
      const d = r.drama;
      skip.current = false;
      setBusy(true);
      const el = stageRef.current;

      const fake = !reduced && ((d === 5 && Math.random() < 0.5) || (d === 4 && Math.random() < 0.4) || (d === 3 && Math.random() < 0.2));
      if (fake) await fakeOut();

      if (d <= 1) {
        if (d === 1) {
          patch({ glow: r.color });
          await sleep(260);
        }
        sfx.play('flip');
        flipCard(i);
        await sleep(180);
        celebrate(card, el);
      } else if (d === 2) {
        patch({ glow: r.color, charge: true, shake: 1 });
        sfx.play('charge');
        await sleep(800);
        patch({ charge: false, shake: 0 });
        doFlash('rgba(255,255,255,.55)', 300);
        sfx.play('flip');
        flipCard(i);
        await sleep(120);
        celebrate(card, el);
      } else if (d === 3) {
        patch({ dim: true, glow: r.color, shake: 0 });
        await sleep(350);
        patch({ stamp: t('scene.topSecret'), shake: 2 });
        sfx.play('stamp');
        vibrate(40);
        await sleep(160);
        patch({ shake: 0 });
        await sleep(650);
        patch({ glitch: true });
        await sleep(200);
        patch({ glitch: false, stamp: null, rays: card.rarity });
        doFlash('rgba(255,255,255,.8)', 380);
        sfx.play('flip');
        flipCard(i);
        await sleep(100);
        celebrate(card, el);
      } else if (d === 4) {
        patch({ dim: true, alarm: true, glow: '#ff2a3a', banner: t('scene.anomaly'), bannerSub: t('scene.anomalySub'), shake: 1, glitch: true });
        sfx.play('alarm');
        vibrate([40, 60, 40, 60, 40]);
        await sleep(700);
        patch({ glitch: false, shake: 2 });
        await sleep(650);
        patch({ glow: r.color, charge: true, shake: 3 });
        sfx.play('charge');
        await sleep(450);
        doFlash('#ffffff', 700);
        await sleep(90);
        patch({ alarm: false, banner: null, bannerSub: null, charge: false, shake: 0, rays: card.rarity });
        flipCard(i);
        celebrate(card, el);
      } else {
        // LR: brecha de contención
        patch({ black: true, glow: null });
        sfx.play('blackout');
        await sleep(650);
        for (let k = 0; k < 2; k++) {
          patch({ black: false });
          await sleep(70);
          patch({ black: true });
          await sleep(110);
        }
        sfx.play('heartbeat');
        vibrate([60, 160, 60]);
        await sleep(520);
        sfx.play('heartbeat');
        patch({ black: false, breach: true, dim: true, banner: t('scene.breach'), bannerSub: t('scene.breachSub'), glow: '#ff2a3a', shake: 1 });
        sfx.play('alarm');
        await sleep(1100);
        patch({ cracks: true, glitch: true, shake: 2 });
        sfx.play('glitch');
        await sleep(450);
        patch({ shake: 3 });
        sfx.play('glitch');
        await sleep(450);
        const { x, y } = centerOf(el);
        doFlash('#ffffff', 900);
        sfx.play('shatter');
        fx.burst({ x, y, count: 120, colors: ['#ffffff', '#d8e6ff', '#ff8cf0'], shape: 'shard', speed: [6, 22], size: [4, 10], life: [0.8, 1.6], gravity: 0.25 });
        patch({ breach: false, banner: null, bannerSub: null, cracks: false, glitch: false, shake: 0, glow: r.color, rays: 'LR', sigil: true });
        flipCard(i);
        await sleep(60);
        celebrate(card, el);
      }
      skip.current = false;
      setBusy(false);
    },
    [cards, celebrate, fakeOut, reduced, sleep],
  );

  const resetStageFx = () => setFx(NO_FX);

  const goResults = useCallback(() => {
    resetStageFx();
    setFlipped(cards.map(() => true));
    setPhase('results');
  }, [cards]);

  useEffect(() => {
    if (phase === 'results') {
      const t = setTimeout(releasePackNotes, 350);
      return () => clearTimeout(t);
    }
  }, [phase, releasePackNotes]);

  // normal: revelar una carta de la cuadrícula con efectos compactos
  const revealGrid = useCallback(
    async (i: number) => {
      if (flipped[i]) return;
      const card = cards[i];
      const d = RARITIES[card.rarity].drama;
      const el = gridRefs.current[i];
      if (d >= 4) {
        doFlash(d === 5 ? '#000000' : 'rgba(255,40,60,.5)', d === 5 ? 650 : 400);
        sfx.play(d === 5 ? 'blackout' : 'alarm');
        await wait(d === 5 ? 420 : 300);
        doFlash('#ffffff', 450);
      } else if (d === 3) {
        sfx.play('stamp');
        doFlash('rgba(255,255,255,.5)', 300);
      }
      sfx.play('flip');
      flipCard(i);
      await wait(120);
      celebrate(card, el, 0.6);
    },
    [cards, celebrate, flipped],
  );

  const revealAll = async () => {
    for (let i = 0; i < cards.length; i++) {
      if (flipped[i]) continue;
      sfx.play('flip');
      flipCard(i);
      const card = cards[i];
      if (RARITIES[card.rarity].drama >= 2) celebrate(card, gridRefs.current[i], 0.5);
      await wait(140);
    }
  };

  const allFlipped = flipped.every(Boolean);

  useEffect(() => {
    if (!intense && phase === 'reveal' && allFlipped) {
      const t = setTimeout(() => setPhase('results'), 500);
      return () => clearTimeout(t);
    }
  }, [intense, phase, allFlipped]);

  // ───────────── interacción ─────────────
  const advance = useCallback(() => {
    if (phase !== 'reveal' || !intense) return;
    if (busy) {
      skip.current = true;
      return;
    }
    if (!flipped[current]) {
      void revealIntense(current);
      return;
    }
    if (current < cards.length - 1) {
      sfx.play('deal');
      resetStageFx();
      setCurrent(current + 1);
    } else goResults();
  }, [phase, intense, busy, flipped, current, cards.length, revealIntense, goResults]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'results') onClose();
        else goResults();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'reveal' && intense) advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, intense, advance, goResults, onClose]);

  useEffect(() => () => fx.clear(), []);

  const doShare = () => {
    sfx.play('tap');
    openShare({ context: 'pack', cards, packType: type, newIds: cards.filter((_, i) => isNew[i]).map((c) => c.id) });
  };

  const card = cards[current];
  const stageW = 'min(300px, 70vw, calc((100dvh - 250px) * 0.716))';
  const sceneCls = [
    'scene',
    `phase-${phase}`,
    sfxState.dim && 'fx-dim',
    sfxState.alarm && 'fx-alarm',
    sfxState.black && 'fx-black',
    sfxState.breach && 'fx-breach',
  ]
    .filter(Boolean)
    .join(' ');
  const shakeCls = !reduced && sfxState.shake ? `shake-${sfxState.shake}` : '';

  // Bloquea el scroll de la página mientras la escena está abierta.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className={sceneCls} style={{ ['--tell' as string]: tell.color }}>
      <div className="scene-bg" />
      <div className="scene-alarm" />
      <div className="scene-dim" />

      <div className="scene-top">
        <div className="scene-title mono">{packName(type).toUpperCase()}</div>
        {phase === 'reveal' && intense && (
          <div className="scene-counter mono">
            {t('scene.file')} <b>{current + 1}</b> / {cards.length}
          </div>
        )}
        {phase === 'results' && <div className="scene-counter mono">{t('scene.results')}</div>}
      </div>

      {phase === 'tear' || phase === 'deal' ? (
        <div className={`scene-pack-wrap ${phase === 'deal' ? 'dealing' : ''} tell-${rarityRank(tellRarity)}`}>
          <PackLight pack={packRef} color={tell.color} level={rarityRank(tellRarity)} torn={torn} dealing={phase === 'deal'} reduced={reduced} />
          <Pack ref={packRef} type={type} torn={torn} width="min(250px, 62vw)" className="scene-pack" />
          {phase === 'deal' && (
            <div className="deal-cards">
              {cards.map((_, i) => (
                <div key={i} className="deal-card" style={{ ['--i' as string]: i }}>
                  <CardBack width="min(150px, 36vw)" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {phase === 'reveal' && intense && (
        <div className={`stage ${shakeCls}`} onClick={advance}>
          {sfxState.rays && <div className={`rays rays-${sfxState.rays}`} />}
          {sfxState.sigil && <Emblem className="stage-sigil" />}
          <div key={current} ref={stageRef} className={`stage-card enter ${sfxState.glitch ? 'glitch' : ''} ${sfxState.charge ? 'charging' : ''}`} style={{ ['--glow' as string]: sfxState.glow ?? 'transparent' }}>
            <div className={`flip ${flipped[current] ? 'flipped' : ''}`}>
              <div className="flip-face flip-back">
                <CardBack width={stageW} glow={sfxState.glow ?? undefined} />
                {sfxState.stamp && <div className="stamp display">{sfxState.stamp}</div>}
                {sfxState.cracks && (
                  <svg className="cracks" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M52 0 L47 22 L58 38 L44 60 L55 78 L41 102 L50 140" />
                    <path d="M47 22 L22 30 L10 48" />
                    <path d="M58 38 L80 44 L95 62" />
                    <path d="M44 60 L20 72 L4 70" />
                    <path d="M55 78 L78 92 L90 120" />
                    <path d="M41 102 L18 118" />
                  </svg>
                )}
              </div>
              <div className="flip-face flip-front">
                <CardFace card={card} width={stageW} tilt={flipped[current] && !busy} />
                {flipped[current] && isNew[current] && <div className="new-badge">{t('scene.new')}</div>}
              </div>
            </div>
          </div>
          {flipped[current] && !busy && (
            <div className="stage-caption" key={`cap-${current}`}>
              <span className="cap-rarity" style={{ color: RARITIES[card.rarity].color }}>
                {clearance(card.rarity)} · {clearanceName(card.rarity)}
              </span>
              <span className="cap-hint mono">{current < cards.length - 1 ? t('scene.tapContinue') : t('scene.tapResults')}</span>
            </div>
          )}
          {!flipped[current] && !busy && <div className="stage-caption"><span className="cap-hint mono">{t('scene.tapDeclassify')}</span></div>}
        </div>
      )}

      {phase === 'reveal' && intense && (
        <div className="strip">
          {cards.map((c, i) => (
            <div key={i} className={`strip-slot ${i === current ? 'cur' : ''} ${flipped[i] ? 'done' : ''}`} style={{ ['--rc' as string]: flipped[i] ? RARITIES[c.rarity].color : undefined }}>
              {flipped[i] ? <span className="display">{c.rarity}</span> : <Emblem />}
            </div>
          ))}
        </div>
      )}

      {((phase === 'reveal' && !intense) || phase === 'results') && (
        <div className={`grid-wrap ${phase === 'results' ? 'is-results' : ''}`}>
          <div className="reveal-grid">
            {cards.map((c, i) => (
              <div key={i} ref={(el) => void (gridRefs.current[i] = el)} className="grid-cell" style={{ ['--i' as string]: i }}>
                <div className={`flip ${flipped[i] ? 'flipped' : ''}`} onClick={() => (flipped[i] ? openDetail(c.id) : void revealGrid(i))}>
                  <div className="flip-face flip-back">
                    <CardBack width="var(--gw)" />
                  </div>
                  <div className="flip-face flip-front">
                    <CardFace card={c} width="var(--gw)" />
                  </div>
                </div>
                {flipped[i] && (
                  <div className="cell-tags">
                    {isNew[i] ? <span className="new-pill">{t('scene.new')}</span> : <span className="dupe-pill mono">×{copies[i]}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase !== 'results' && (
      <div className="scene-actions">
        {phase === 'reveal' && intense && (
          <button className="btn btn-ghost btn-sm" onClick={goResults}>
            {t('common.skip')} <Icon name="skip" size={14} />
          </button>
        )}
        {phase === 'reveal' && !intense && !allFlipped && (
          <button className="btn btn-hazard" onClick={() => void revealAll()}>
            {t('scene.revealAll')}
          </button>
        )}
      </div>
      )}
      {phase === 'results' && <ResultsDock onBack={onClose} onShare={doShare} onAgain={onAgain} next={next} />}

      <div className="scene-black" />
      {flash && <div key={flash.key} className="scene-flash" style={{ background: flash.color, animationDuration: `${flash.dur}ms` }} />}
      {sfxState.banner && (
        <div className={`banner ${sfxState.breach ? 'breach' : ''}`}>
          <Icon name="warning" className="banner-icon" size={sfxState.breach ? 34 : 28} strokeWidth={2.2} />
          <div className="banner-main display" data-text={sfxState.banner}>
            {sfxState.banner}
          </div>
          {sfxState.bannerSub && <div className="banner-sub mono">{sfxState.bannerSub}</div>}
        </div>
      )}
    </div>,
    document.body,
  );
}
