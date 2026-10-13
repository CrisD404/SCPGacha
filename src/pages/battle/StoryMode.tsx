import { useMemo, useState } from 'react';
import type { Card } from '../../data/types';
import { cards } from '../../data/cards';
import { CHAPTER_COUNT, levelUpCost, makeFighter, MAX_LEVEL, simulateTeam, stageInfo, STORY_STAGES, levelMult } from '../../game/battle';
import { mulberry32, randomSeed } from '../../game/rng';
import { useGame, useSave } from '../../store/game';
import { CardMini } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import { chapterName } from '../../i18n/labels';
import { sfx } from '../../fx/sfx';
import { CardPicker } from './CardPicker';
import { Arena, type ArenaSetup } from './Arena';
import { ModeHeader, ResultBanner, prepare } from './common';

type Step = 'map' | 'squad' | 'fight' | 'result';

export function StoryMode() {
  const story = useSave((s) => s.story);
  const setSquad = useGame((s) => s.setSquad);
  const levelUp = useGame((s) => s.levelUp);
  const completeStage = useGame((s) => s.completeStage);
  const { t, fmt } = useT();
  const [step, setStep] = useState<Step>('map');
  const [chapter, setChapter] = useState(() => Math.min(CHAPTER_COUNT, Math.floor(story.cleared / 10) + 1));
  const [stage, setStage] = useState(() => Math.min(STORY_STAGES, story.cleared + 1));
  const [sel, setSel] = useState<string[]>(story.squad);
  const [setup, setSetup] = useState<ArenaSetup | null>(null);
  const [outcome, setOutcome] = useState<{ won: boolean; xp: number } | null>(null);
  const db = cards();
  const squad = story.squad.map((id) => db.byId.get(id)).filter((c): c is Card => !!c);
  const info = useMemo(() => stageInfo(db, stage), [db, stage]);
  const unlocked = story.cleared + 1;

  const start = () => {
    const rng = mulberry32(randomSeed());
    const A = squad.map((c, i) => makeFighter(c, 'A', `a${i}`, story.levels[c.id] ?? 1));
    const B = info.enemies.map((c, i) => makeFighter(c, 'B', `b${i}`, info.enemyLevel));
    let won = false;
    const s = prepare(A, B, (ev) => {
      const r = simulateTeam(A, B, rng);
      ev.push(...r.events);
      won = r.winner === 'A';
    });
    setSetup(s);
    setOutcome({ won, xp: 0 });
    setStep('fight');
  };

  const finish = () => {
    if (!outcome) return;
    const xp = completeStage(stage, outcome.won, story.squad);
    setOutcome({ ...outcome, xp });
    setStep('result');
  };

  if (step === 'fight' && setup) return <Arena setup={setup} onDone={finish} title={`${t('story.op', { n: stage })} · ${chapterName(info.chapter)}`} />;

  if (step === 'result' && outcome) {
    return (
      <div className="stack">
        <ResultBanner result={outcome.won ? 'win' : 'loss'}>
          {t(outcome.won ? 'story.cleared' : 'story.failed', { n: stage })}
          {outcome.xp ? ` · ${t('story.xpGain', { n: outcome.xp })}` : ''}
        </ResultBanner>
        <div className="result-actions">
          {outcome.won && stage < STORY_STAGES && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setStage(stage + 1);
                setChapter(Math.ceil((stage + 1) / 10));
                setStep('map');
              }}
            >
              {t('story.next')} →
            </button>
          )}
          <button className="btn" onClick={() => setStep('map')}>
            {t('story.backToMap')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'squad') {
    return (
      <div className="stack">
        <ModeHeader title={t('story.squadTitle')} subtitle={t('story.squadSubtitle')} onBack={() => setStep('map')} backLabel={t('story.map')} />
        <CardPicker max={5} selected={sel} onChange={setSel} showLevels />
        <div className="sticky-bar">
          <span className="dim">{t('story.selected', { n: sel.length })}</span>
          <button
            className="btn btn-primary"
            disabled={sel.length !== 5}
            onClick={() => {
              setSquad(sel);
              setStep('map');
            }}
          >
            {t('story.saveSquad')}
          </button>
        </div>
      </div>
    );
  }

  const chapterStages = Array.from({ length: 10 }, (_, i) => (chapter - 1) * 10 + i + 1);

  return (
    <div className="stack">
      <ModeHeader title={t('battle.story.title')} subtitle={t('story.subtitle')} />

      <div className="story-top">
        <section className="panel">
          <h3 className="panel-title">{t('story.squad')}</h3>
          {squad.length === 5 ? (
            <div className="squad-list">
              {squad.map((c) => {
                const lvl = story.levels[c.id] ?? 1;
                const cost = levelUpCost(lvl);
                const m = levelMult(lvl);
                return (
                  <div key={c.id} className="squad-item">
                    <CardMini card={c} badge={`${t('card.lvShort')} ${lvl}`} />
                    <div className="squad-stats mono">
                      <span>ATK {fmt(Math.round(c.atk * m))}</span>
                      <span>DEF {fmt(Math.round(c.def * m))}</span>
                    </div>
                    <button
                      className="btn btn-sm"
                      disabled={lvl >= MAX_LEVEL || story.xp < cost}
                      onClick={() => {
                        if (levelUp(c.id)) sfx.play('heal');
                      }}
                    >
                      {lvl >= MAX_LEVEL ? t('story.maxLevel') : `▲ ${fmt(cost)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="dim">{t('story.needSquad')}</p>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <span className="xp mono">
              <Icon name="flask" size={15} /> {t('story.knowledge')}: <b>{fmt(story.xp)}</b>
            </span>
            <div className="grow" />
            <button
              className="btn btn-sm"
              onClick={() => {
                setSel(story.squad);
                setStep('squad');
              }}
            >
              {squad.length === 5 ? t('story.changeSquad') : t('story.formSquad')}
            </button>
          </div>
        </section>

        <section className="panel">
          <h3 className="panel-title">
            {t('story.op', { n: stage })} {info.boss && <span className="boss-tag">{t('story.boss')}</span>}
          </h3>
          <p className="dim small" style={{ margin: '0 0 8px' }}>
            {chapterName(info.chapter)} · {t('story.hostiles', { n: info.enemyLevel })} · {t(stage <= story.cleared ? 'story.rewardReplay' : 'story.reward', { n: stage <= story.cleared ? Math.floor(info.xp / 3) : info.xp })}
          </p>
          <div className="team-row">
            {info.enemies.map((c, i) => (
              <CardMini key={i} card={c} badge={`${t('card.lvShort')} ${info.enemyLevel}`} />
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={squad.length !== 5 || stage > unlocked} onClick={start}>
            {t('story.start')}
          </button>
        </section>
      </div>

      <section className="panel">
        <div className="row chapter-tabs">
          {Array.from({ length: CHAPTER_COUNT }, (_, i) => {
            const n = i + 1;
            const locked = (n - 1) * 10 + 1 > unlocked;
            return (
              <button key={n} className={`chip ${chapter === n ? 'on' : ''}`} disabled={locked} onClick={() => setChapter(n)} title={chapterName(n)}>
                {locked && <Icon name="lock" size={12} />} {t('story.chapterShort', { n })}
              </button>
            );
          })}
        </div>
        <h3 className="chapter-name display">{chapterName(chapter)}</h3>
        <div className="stage-grid">
          {chapterStages.map((n) => {
            const cleared = n <= story.cleared;
            const locked = n > unlocked;
            return (
              <button key={n} className={`stage-node ${cleared ? 'cleared' : ''} ${locked ? 'locked' : ''} ${n === stage ? 'cur' : ''} ${n % 10 === 0 ? 'boss' : ''}`} disabled={locked} onClick={() => setStage(n)}>
                <b className="display">{n}</b>
                <span className="mono">{cleared ? <Icon name="check" size={12} strokeWidth={2.6} /> : locked ? <Icon name="lock" size={12} /> : n % 10 === 0 ? t('story.boss') : '•'}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
