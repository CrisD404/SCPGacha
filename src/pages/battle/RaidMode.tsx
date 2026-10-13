import { useEffect, useState } from 'react';
import { cards } from '../../data/cards';
import { makeFighter, RAID_ATTEMPTS_PER_DAY, RAID_MAX_CARDS, simulateRaid } from '../../game/battle';
import { mulberry32, randomSeed } from '../../game/rng';
import { useGame, useSave } from '../../store/game';
import { msUntilMidnight } from '../../store/save';
import { formatClock, useNow } from '../../hooks';
import { CardFace, CardMini } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { ShareButton } from '../../components/ShareButton';
import { useT } from '../../i18n';
import { cardName } from '../../data/cards';
import { CardPicker } from './CardPicker';
import { Arena, type ArenaSetup } from './Arena';
import { ModeHeader, ResultBanner, prepare } from './common';

type Step = 'home' | 'pick' | 'fight' | 'result';
let lastRaidTeam: string[] = [];

export function RaidMode() {
  const ensureRaid = useGame((s) => s.ensureRaid);
  const commitRaid = useGame((s) => s.commitRaid);
  const raid = useSave((s) => s.raid);
  const [step, setStep] = useState<Step>('home');
  const [sel, setSel] = useState<string[]>(lastRaidTeam);
  const [setup, setSetup] = useState<ArenaSetup | null>(null);
  const [dmg, setDmg] = useState(0);
  const [defeated, setDefeated] = useState(false);
  const now = useNow(1000);
  const { t } = useT();
  const db = cards();

  useEffect(() => {
    ensureRaid();
  }, [ensureRaid]);

  if (!raid) return null;
  const boss = db.byId.get(raid.bossId)!;
  const left = RAID_ATTEMPTS_PER_DAY - raid.attempts;
  const pct = raid.hp / raid.maxHp;

  const attack = () => {
    lastRaidTeam = sel;
    const rng = mulberry32(randomSeed());
    const team = sel.map((id, i) => makeFighter(db.byId.get(id)!, 'A', `a${i}`));
    const B = makeFighter(boss, 'B', 'boss', 1, { hp: raid.maxHp, atkMult: 1.25, boss: true });
    B.hp = raid.hp;
    let damage = 0;
    const s = prepare(team, [B], (ev) => {
      const r = simulateRaid(team, B, rng);
      ev.push(...r.events);
      damage = r.damage;
    });
    setDmg(damage);
    setSetup(s);
    setStep('fight');
  };

  const finish = () => {
    const r = commitRaid(dmg, sel);
    setDefeated(r.defeated);
    setStep('result');
  };

  if (step === 'fight' && setup) return <Arena setup={setup} onDone={finish} title={`${t('battle.raid.title')} · ${boss.code}`} />;

  if (step === 'result') {
    return (
      <div className="stack">
        <ResultBanner result={defeated ? 'win' : 'draw'} label={defeated ? t('raid.contained') : t('raid.attackDone')}>
          {defeated ? t('raid.containedText', { boss: boss.code }) : t('raid.damageDealt', { n: dmg })}
        </ResultBanner>
        <BossBar hp={raid.hp} max={raid.maxHp} />
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => setStep('home')}>
            {t('raid.back')}
          </button>
          <ShareButton
            compact
            request={() => ({
              context: 'battle',
              cards: [boss],
              badge: { text: defeated ? t('raid.contained') : t('raid.attackDone'), tone: defeated ? 'win' : 'info' },
              kicker: t('battle.raid.title'),
              title: defeated ? t('share.title.raidWin') : t('raid.damageDealt', { n: dmg }),
            })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <ModeHeader title={t('battle.raid.title')} subtitle={t('raid.subtitle')} />
      <div className="raid-hero panel">
        <div className="raid-boss">
          <CardFace card={boss} width="min(230px, 58vw)" tilt />
        </div>
        <div className="raid-info">
          <div className="raid-alert mono">
            <Icon name="warning" size={14} /> {t('raid.alert')}
          </div>
          <h3 className="display raid-name">
            {boss.code} <span>{cardName(boss)}</span>
          </h3>
          <BossBar hp={raid.hp} max={raid.maxHp} />
          <div className="raid-stats mono">
            <span>{t('raid.attemptsToday', { n: left, total: RAID_ATTEMPTS_PER_DAY })}</span>
            <span>{t('raid.bestHit', { n: raid.bestHit })}</span>
            <span>{t('raid.resetIn', { time: formatClock(msUntilMidnight(now)) })}</span>
          </div>
          {raid.defeated ? (
            <p className="ok">{t('raid.doneToday')}</p>
          ) : left <= 0 ? (
            <p className="dim">{t('raid.noAttempts')}</p>
          ) : (
            <p className="dim">
              {t(pct < 1 ? 'raid.howWounded' : 'raid.how', { n: RAID_MAX_CARDS })}
            </p>
          )}
          {step === 'home' && !raid.defeated && left > 0 && (
            <button className="btn btn-primary" onClick={() => setStep('pick')}>
              {t('raid.form')} →
            </button>
          )}
        </div>
      </div>
      {step === 'pick' && (
        <>
          <div className="panel">
            <h3 className="panel-title">{t('raid.team', { n: sel.length, max: RAID_MAX_CARDS })}</h3>
            <div className="team-row">
              {sel.map((id, i) => (
                <CardMini key={id} card={db.byId.get(id)!} badge={`#${i + 1}`} onClick={() => setSel(sel.filter((x) => x !== id))} />
              ))}
              {!sel.length && <span className="dim small">{t('raid.tapToAdd')}</span>}
            </div>
          </div>
          <CardPicker max={RAID_MAX_CARDS} selected={sel} onChange={setSel} />
          <div className="sticky-bar">
            <span className="dim">{sel.length ? t(sel.length === 1 ? 'raid.ready1' : 'raid.ready', { n: sel.length }) : t('raid.pickOne')}</span>
            <button className="btn btn-primary" disabled={!sel.length} onClick={attack}>
              {t('raid.attack')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BossBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, hp / max);
  const { fmt } = useT();
  return (
    <div className="boss-bar">
      <div className="boss-bar-track">
        <i style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="mono">
        HP {fmt(hp)} / {fmt(max)} ({fmt(pct * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
      </span>
    </div>
  );
}
