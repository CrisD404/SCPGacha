import { cards } from '../data/cards';
import { useSave } from '../store/game';
import { navigate } from '../hooks';
import { sfx } from '../fx/sfx';
import { RAID_ATTEMPTS_PER_DAY } from '../game/battle';
import { dayKey, type BattleRecord } from '../store/save';
import { Icon, type IconName } from '../components/Icon';
import { t, useT, type Key } from '../i18n';
import { DuelMode } from './battle/DuelMode';
import { TeamMode } from './battle/TeamMode';
import { RaidMode } from './battle/RaidMode';
import { StoryMode } from './battle/StoryMode';
import './battle/battle.css';

const MODES: { id: string; icon: IconName; title: Key; desc: Key; tag?: Key }[] = [
  { id: 'brecha', icon: 'siren', title: 'battle.raid.title', desc: 'battle.raid.desc', tag: 'battle.tag.daily' },
  { id: 'duelo', icon: 'swords', title: 'battle.duel.title', desc: 'battle.duel.desc' },
  { id: 'equipos', icon: 'shield', title: 'battle.team.title', desc: 'battle.team.desc' },
  { id: 'recontencion', icon: 'compass', title: 'battle.story.title', desc: 'battle.story.desc', tag: 'battle.tag.story' },
];

export function BattlePage({ sub }: { sub: string[] }) {
  const mode = sub[0];
  return (
    <div className="page battle-page">
      {mode === 'duelo' ? <DuelMode /> : mode === 'equipos' ? <TeamMode /> : mode === 'brecha' ? <RaidMode /> : mode === 'recontencion' ? <StoryMode /> : <BattleMenu />}
    </div>
  );
}

/** Resumen de un registro del historial en el idioma activo. */
function recordSummary(r: BattleRecord): string {
  if (r.summary) return r.summary; // registros antiguos
  const db = cards();
  const code = (id?: string) => (id ? (db.byId.get(id)?.code ?? id) : '?');
  switch (r.mode) {
    case 'single':
      return t('history.single', { a: code(r.cards[0]), b: r.rival ?? '?', grade: r.grade ?? '?' });
    case 'team':
      return t('history.team', { grade: r.grade ?? '?' });
    case 'raid':
      return t('history.raid', { damage: r.damage ?? 0, boss: r.rival ?? '?' });
    case 'story':
      return t(r.result === 'win' ? 'history.storyWin' : 'history.storyLoss', { n: r.stage ?? 0 });
  }
}

function BattleMenu() {
  const log = useSave((s) => s.battleLog);
  const counters = useSave((s) => s.counters);
  const raid = useSave((s) => s.raid);
  const story = useSave((s) => s.story);
  const owned = useSave((s) => Object.keys(s.collection).length);
  const { fmt, fmtDate } = useT();
  const db = cards();
  const today = dayKey(Date.now());
  const raidLeft = raid && raid.date === today ? RAID_ATTEMPTS_PER_DAY - raid.attempts : RAID_ATTEMPTS_PER_DAY;

  return (
    <div className="stack">
      <div className="mode-head">
        <div>
          <h2 className="display">{t('battle.menu')}</h2>
          <p className="dim">{t('battle.stats', { won: counters.battlesWon, played: counters.battlesPlayed, raids: counters.raidsDefeated, stage: story.cleared })}</p>
        </div>
      </div>
      {owned === 0 && <div className="empty-note">{t('battle.noCards')}</div>}
      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-tile mt-${m.id}`}
            onClick={() => {
              sfx.play('tap');
              navigate(`combate/${m.id}`);
            }}
          >
            <span className="mt-icon">
              <Icon name={m.icon} size={26} />
            </span>
            <span className="mt-body">
              <b>
                {t(m.title)} {m.tag && <em>{t(m.tag)}</em>}
              </b>
              <span>{t(m.desc)}</span>
              {m.id === 'brecha' && (
                <span className="mt-extra mono">
                  {raid?.defeated && raid.date === today ? t('battle.raid.doneToday') : t(raidLeft === 1 ? 'battle.raid.attempts1' : 'battle.raid.attempts', { n: raidLeft })}
                  {raid && !raid.defeated ? ` · ${t('battle.raid.bossAt', { boss: db.byId.get(raid.bossId)?.code ?? '?', pct: fmt((raid.hp / raid.maxHp) * 100, { maximumFractionDigits: 0 }) })}` : ''}
                </span>
              )}
              {m.id === 'recontencion' && <span className="mt-extra mono">{t('battle.story.knowledge', { n: story.xp })}</span>}
            </span>
          </button>
        ))}
      </div>

      <section className="panel">
        <h3 className="panel-title">{t('history.title')}</h3>
        {log.length === 0 ? (
          <p className="dim small">{t('history.empty')}</p>
        ) : (
          <ul className="history">
            {log.map((r, i) => (
              <li key={i} className={`h-${r.result}`}>
                <span className="h-res mono">{r.result === 'win' ? t('result.win') : r.result === 'loss' ? t('result.loss') : r.mode === 'raid' ? t('result.damage') : t('result.draw')}</span>
                <span className="h-sum">{recordSummary(r)}</span>
                <span className="h-date mono faint">{fmtDate(r.at, { dateStyle: 'short', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
