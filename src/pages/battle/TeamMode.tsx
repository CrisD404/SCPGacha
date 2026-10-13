import { useState } from 'react';
import type { Rarity } from '../../data/types';
import { cards } from '../../data/cards';
import { makeFighter, randomTeam, simulateTeam, type Fighter } from '../../game/battle';
import { mulberry32, randomSeed } from '../../game/rng';
import { useGame } from '../../store/game';
import { ShareButton } from '../../components/ShareButton';
import type { ShareRequest } from '../../share/types';
import { CardMini } from '../../components/Card';
import { useT } from '../../i18n';
import { CardPicker } from './CardPicker';
import { Arena, type ArenaSetup } from './Arena';
import { GradePicker, ModeHeader, ResultBanner, prepare } from './common';

type Step = 'pick' | 'grade' | 'fight' | 'result';
let lastTeam: string[] = [];

export function TeamMode() {
  const [step, setStep] = useState<Step>('pick');
  const [sel, setSel] = useState<string[]>(lastTeam);
  const [grade, setGrade] = useState<Rarity>('C');
  const [setup, setSetup] = useState<ArenaSetup | null>(null);
  const [res, setRes] = useState<{ winner: 'A' | 'B' | null; A: Fighter[]; B: Fighter[] } | null>(null);
  const recordBattle = useGame((s) => s.recordBattle);
  const { t } = useT();
  const db = cards();

  const fight = (g: Rarity) => {
    lastTeam = sel;
    const rng = mulberry32(randomSeed());
    const A = sel.map((id, i) => makeFighter(db.byId.get(id)!, 'A', `a${i}`));
    const B = randomTeam(db, g, rng).map((c, i) => makeFighter(c, 'B', `b${i}`));
    let winner: 'A' | 'B' | null = null;
    const s = prepare(A, B, (ev) => {
      const r = simulateTeam(A, B, rng);
      ev.push(...r.events);
      winner = r.winner;
    });
    setGrade(g);
    setSetup(s);
    setRes({ winner, A, B });
    setStep('fight');
  };

  const finish = () => {
    if (!res) return;
    const result = res.winner === 'A' ? 'win' : res.winner === 'B' ? 'loss' : 'draw';
    recordBattle({ mode: 'team', result, grade, cards: sel });
    setStep('result');
  };

  if (step === 'fight' && setup) return <Arena setup={setup} onDone={finish} title={t('team.arenaTitle', { grade })} />;

  if (step === 'result' && res) {
    const result = res.winner === 'A' ? 'win' : res.winner === 'B' ? 'loss' : 'draw';
    const alive = (team: Fighter[]) => team.filter((f) => f.hp > 0).length;
    const shareReq = (): ShareRequest => ({
      context: 'battle',
      cards: res.A.map((f) => f.card),
      badge: { text: result === 'win' ? t('result.win') : result === 'loss' ? t('result.loss') : t('result.draw'), tone: result },
      kicker: `${t('team.arenaTitle', { grade })} · ${t('team.survivors', { a: alive(res.A), b: alive(res.B) })}`,
      title: t('share.title.team'),
    });
    return (
      <div className="stack">
        <ResultBanner result={result}>
          {t('battle.grade', { r: grade })} · {t('team.survivors', { a: alive(res.A), b: alive(res.B) })}
        </ResultBanner>
        <div className="team-result">
          {[
            { label: t('team.yours'), t: res.A },
            { label: t('battle.rival'), t: res.B },
          ].map((x) => (
            <div key={x.label} className="panel">
              <h3 className="panel-title">{x.label}</h3>
              <div className="team-row">
                {x.t.map((f) => (
                  <CardMini key={f.key} card={f.card} dim={f.hp <= 0} badge={f.hp > 0 ? `${Math.round((f.hp / f.maxHp) * 100)}%` : 'KO'} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => fight(grade)}>
            {t('team.rematch')}
          </button>
          <button className="btn" onClick={() => setStep('grade')}>
            {t('battle.otherGrade')}
          </button>
          <button className="btn" onClick={() => setStep('pick')}>
            {t('team.change')}
          </button>
          <ShareButton compact request={shareReq} />
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <ModeHeader title={t('battle.team.title')} subtitle={t('team.subtitle')} />
      {step === 'pick' ? (
        <>
          <div className="panel">
            <h3 className="panel-title">{t('team.order', { n: sel.length })}</h3>
            <div className="team-row">
              {Array.from({ length: 5 }, (_, i) => {
                const c = sel[i] ? db.byId.get(sel[i]) : undefined;
                return c ? <CardMini key={c.id} card={c} badge={`#${i + 1}`} onClick={() => setSel(sel.filter((x) => x !== c.id))} /> : <div key={i} className="slot-empty mono">#{i + 1}</div>;
              })}
            </div>
            <p className="dim small">{t('team.help')}</p>
          </div>
          <CardPicker max={5} selected={sel} onChange={setSel} />
          <div className="sticky-bar">
            <span className="dim">{sel.length < 5 ? t(5 - sel.length === 1 ? 'team.pickMore1' : 'team.pickMore', { n: 5 - sel.length }) : t('team.ready')}</span>
            <button className="btn btn-primary" disabled={sel.length < 5} onClick={() => setStep('grade')}>
              {t('battle.pickGrade')} →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="panel">
            <div className="team-row">
              {sel.map((id, i) => (
                <CardMini key={id} card={db.byId.get(id)!} badge={`#${i + 1}`} />
              ))}
            </div>
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setStep('pick')}>
              {t('team.change')}
            </button>
          </div>
          <GradePicker onPick={fight} hint={t('team.hint')} />
        </>
      )}
    </div>
  );
}
