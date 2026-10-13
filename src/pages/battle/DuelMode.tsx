import { useState } from 'react';
import type { Card, Rarity } from '../../data/types';
import { cardName, cards } from '../../data/cards';
import { useT } from '../../i18n';
import { rarityRank } from '../../data/rarity';
import { makeFighter, randomOpponent, simulateDuel, type Fighter } from '../../game/battle';
import { mulberry32, randomSeed } from '../../game/rng';
import { useGame } from '../../store/game';
import { ShareButton } from '../../components/ShareButton';
import type { ShareRequest } from '../../share/types';
import { CardPicker } from './CardPicker';
import { Arena, type ArenaSetup } from './Arena';
import { GradePicker, ModeHeader, ResultBanner, ResultCards, prepare } from './common';

type Step = 'pick' | 'grade' | 'fight' | 'result';

interface Outcome {
  result: 'win' | 'loss' | 'draw';
  reason: 'ko' | 'decision';
  turns: number;
  A: Fighter;
  B: Fighter;
}

export function DuelMode() {
  const [step, setStep] = useState<Step>('pick');
  const [sel, setSel] = useState<string[]>([]);
  const [grade, setGrade] = useState<Rarity>('C');
  const [rival, setRival] = useState<Card | null>(null);
  const [setup, setSetup] = useState<ArenaSetup | null>(null);
  const [out, setOut] = useState<Outcome | null>(null);
  const recordBattle = useGame((s) => s.recordBattle);
  const { t, fmt } = useT();
  const db = cards();
  const mine = sel[0] ? db.byId.get(sel[0]) : undefined;

  const fight = (g: Rarity, opp?: Card) => {
    if (!mine) return;
    const rng = mulberry32(randomSeed());
    const enemy = opp ?? randomOpponent(db, g, rng, mine.id);
    const A = makeFighter(mine, 'A', 'a');
    const B = makeFighter(enemy, 'B', 'b');
    let res!: ReturnType<typeof simulateDuel>;
    const s = prepare([A], [B], (ev) => (res = simulateDuel(A, B, rng, ev)));
    setGrade(g);
    setRival(enemy);
    setSetup(s);
    setOut({ result: res.winner === A ? 'win' : res.winner === B ? 'loss' : 'draw', reason: res.reason, turns: res.turns, A, B });
    setStep('fight');
  };

  const finish = () => {
    if (!out) return;
    const upset = out.result === 'win' && rarityRank(grade) - rarityRank(out.A.card.rarity) >= 2;
    recordBattle({
      mode: 'single',
      result: out.result,
      grade,
      upset,
      cards: [out.A.card.id],
      rival: out.B.card.code,
    });
    setStep('result');
  };

  if (step === 'fight' && setup) return <Arena setup={setup} onDone={finish} title={t('duel.arenaTitle', { grade })} />;

  if (step === 'result' && out) {
    const shareReq = (): ShareRequest => ({
      context: 'battle',
      cards: [out.A.card, out.B.card],
      layout: 'versus',
      badge: { text: out.result === 'win' ? t('result.win') : out.result === 'loss' ? t('result.loss') : t('result.draw'), tone: out.result },
      kicker: `${t('duel.arenaTitle', { grade })} · ${out.reason === 'ko' ? 'KO' : t('duel.decision')} · ${t('duel.turns', { n: out.turns })}`,
      title: `${out.A.card.code} VS ${out.B.card.code}`,
    });
    return (
      <div className="stack">
        <ResultBanner result={out.result}>
          {out.reason === 'ko' ? t('duel.byKo') : t('duel.byDecision')} · {t('duel.turns', { n: out.turns })} · {t('battle.grade', { r: grade })}
        </ResultBanner>
        <ResultCards a={out.A.card} b={out.B.card} hpA={out.A.hp} hpB={out.B.hp} maxA={out.A.maxHp} maxB={out.B.maxHp} winner={out.result === 'win' ? 'A' : out.result === 'loss' ? 'B' : null} />
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => rival && fight(grade, rival)}>
            {t('duel.rematch')}
          </button>
          <button className="btn" onClick={() => fight(grade)}>
            {t('duel.sameGrade')}
          </button>
          <button className="btn" onClick={() => setStep('grade')}>
            {t('battle.otherGrade')}
          </button>
          <button className="btn" onClick={() => setStep('pick')}>
            {t('duel.otherCard')}
          </button>
          <ShareButton compact request={shareReq} />
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <ModeHeader title={t('battle.duel.title')} subtitle={t('duel.subtitle')} />
      {step === 'pick' ? (
        <>
          <CardPicker max={1} selected={sel} onChange={setSel} />
          <div className="sticky-bar">
            <span className="dim">{mine ? t('duel.selected', { card: `${mine.code} ${cardName(mine)}` }) : t('duel.selectPrompt')}</span>
            <button className="btn btn-primary" disabled={!mine} onClick={() => setStep('grade')}>
              {t('battle.pickGrade')} →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="panel row">
            <span className="dim">{t('battle.yourCard')}:</span>
            <b>
              {mine?.code} {mine && cardName(mine)}
            </b>
            <span className="mono dim">
              [{mine?.rarity}] ATK {fmt(mine?.atk ?? 0)} / DEF {fmt(mine?.def ?? 0)}
            </span>
            <div className="grow" />
            <button className="btn btn-sm" onClick={() => setStep('pick')}>
              {t('duel.changeCard')}
            </button>
          </div>
          <GradePicker onPick={(g) => fight(g)} hint={t('duel.hint')} />
        </>
      )}
    </div>
  );
}
