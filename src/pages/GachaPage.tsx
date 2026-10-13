import { useEffect, useState } from 'react';
import type { PackType, Rarity } from '../data/types';
import { cards } from '../data/cards';
import { useGame, type PackResult } from '../store/game';
import { useSave } from '../store/game';
import { MAX_STAMINA, MISSION_REWARD, O5_EVERY_STAMPS, PACKS, THAUMIEL_EVERY, isPityPack, nextRegenIn, normalizeStamina, packsUntilPity } from '../game/gacha';
import { MISSIONS } from '../game/missions';
import { msUntilMidnight } from '../store/save';
import { formatClock, useNow } from '../hooks';
import { sfx } from '../fx/sfx';
import { notify } from '../store/ui';
import { Pack } from '../components/Pack';
import { OpeningScene } from '../components/OpeningScene';
import type { NextPack } from '../components/ResultsDock';
import { Emblem } from '../components/Emblem';
import { Icon } from '../components/Icon';
import { useT } from '../i18n';
import { Trans } from '../i18n/Trans';
import { packBlurb, packName } from '../i18n/labels';
import './gacha.css';

type Choice = 'standard' | 'thaumiel' | 'o5';

export function GachaPage() {
  const now = useNow(1000);
  const save = useSave((s) => s);
  const openPack = useGame((s) => s.openPack);
  const { t, tk, fmt } = useT();
  const [result, setResult] = useState<PackResult | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);

  // Sólo en desarrollo: window.__scpForce(['C','R','SR','UR','LR']) fuerza un paquete para probar animaciones.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __scpForce?: unknown }).__scpForce = (rarities: Rarity[], t: PackType = 'standard') => {
      const db = cards();
      const cs = rarities.map((r) => db.byRarity[r][Math.floor(Math.random() * db.byRarity[r].length)]);
      setResult({ type: t, cards: cs, isNew: cs.map(() => true), copies: cs.map(() => 1) });
    };
  }, []);

  const st = normalizeStamina(save, now);
  const regen = nextRegenIn(save, now);
  const { thaumiel, o5 } = save.bonus;
  // Por defecto se ofrece el mejor paquete disponible.
  const auto: Choice = o5 > 0 ? 'o5' : thaumiel > 0 ? 'thaumiel' : 'standard';
  const selected: Choice = choice && (choice === 'standard' || save.bonus[choice] > 0) ? choice : auto;
  const packType: PackType = selected === 'standard' ? (isPityPack(save.pityCounter) ? 'pity' : 'standard') : selected;
  const available = selected === 'standard' ? st.stamina > 0 : save.bonus[selected] > 0;
  const intense = save.settings.intense;

  const doOpen = () => {
    if (!available) {
      sfx.play('error');
      notify({ kind: 'info', icon: 'hourglass', title: t('gacha.noPacks'), text: regen ? t('gacha.noPacksNext', { time: formatClock(regen) }) : t('gacha.noPacksMissions') });
      return;
    }
    const r = openPack(selected);
    if (r) setResult(r);
  };

  // próximo paquete para el dock de resultados (mismo orden de prioridad que `again`)
  const next: NextPack | null = (() => {
    const s = useGame.getState().save;
    if (s.bonus.o5 > 0) return { type: 'o5', count: s.bonus.o5 };
    if (s.bonus.thaumiel > 0) return { type: 'thaumiel', count: s.bonus.thaumiel };
    const stn = normalizeStamina(s, Date.now()).stamina;
    return stn > 0 ? { type: isPityPack(s.pityCounter) ? 'pity' : 'standard', count: stn } : null;
  })();

  const again = () => {
    const s = useGame.getState().save;
    const kind: Choice = s.bonus.o5 > 0 ? 'o5' : s.bonus.thaumiel > 0 ? 'thaumiel' : 'standard';
    setResult(null);
    setChoice(null);
    requestAnimationFrame(() => {
      const r = useGame.getState().openPack(kind);
      if (r) setResult(r);
    });
  };

  const pity = packsUntilPity(save.pityCounter);
  const toHundred = THAUMIEL_EVERY - (save.packsOpened % THAUMIEL_EVERY);
  const stampInCycle = ((save.login.stamps - 1) % O5_EVERY_STAMPS) + 1;

  return (
    <div className="page gacha-page">
      <section className="pack-zone">
        <div className={`stamina ${st.stamina === 0 ? 'empty' : ''}`}>
          <span className="stamina-label mono">{t('gacha.dailyPacks')}</span>
          <span className="stamina-value display">
            {st.stamina} <i>/</i> {MAX_STAMINA}
          </span>
        </div>
        <div className="stamina-sub mono">{regen === null ? (st.stamina > MAX_STAMINA ? t('gacha.extra', { n: st.stamina - MAX_STAMINA }) : t('gacha.full')) : t('gacha.nextIn', { time: formatClock(regen) })}</div>

        {(thaumiel > 0 || o5 > 0) && (
          <div className="pack-picker" role="tablist" aria-label={t('gacha.packType')}>
            <button role="tab" aria-selected={selected === 'standard'} className={`chip ${selected === 'standard' ? 'on' : ''}`} onClick={() => setChoice('standard')}>
              {t('pack.standard.short')} · {st.stamina}
            </button>
            {thaumiel > 0 && (
              <button role="tab" aria-selected={selected === 'thaumiel'} className={`chip chip-thaumiel ${selected === 'thaumiel' ? 'on' : ''}`} onClick={() => setChoice('thaumiel')}>
                Thaumiel SSR+ ×{thaumiel}
              </button>
            )}
            {o5 > 0 && (
              <button role="tab" aria-selected={selected === 'o5'} className={`chip chip-o5 ${selected === 'o5' ? 'on' : ''}`} onClick={() => setChoice('o5')}>
                O5 UR+ ×{o5}
              </button>
            )}
          </div>
        )}

        <div className={`pack-guarantee pg-${packType}`}>{PACKS[packType].guarantee ? `${packName(packType)}: ${packBlurb(packType)}` : t(pity ? 'gacha.pityIn' : 'gacha.pityIn1', { n: pity + 1 })}</div>

        <div className="pack-stage">
          <div className={`pack-aura aura-${packType}`} />
          <Pack key={packType} type={packType} onOpen={doOpen} disabled={!available} className="pack-float" width="min(250px, 64vw)" />
        </div>
        <div className="pack-hint mono">{available ? t('gacha.hint') : `${t('gacha.noPacksShort')} · ${regen ? formatClock(regen) : ''}`}</div>
      </section>

      <div className="gacha-panels">
        <section className="panel missions">
          <h3 className="panel-title">{t('gacha.missions')}</h3>
          <ul className="mission-list">
            {MISSIONS.map((m) => {
              const p = save.daily.progress[m.id];
              const done = save.daily.done.includes(m.id);
              return (
                <li key={m.id} className={done ? 'done' : ''}>
                  <span className="m-check">{done && <Icon name="check" size={13} strokeWidth={3} />}</span>
                  <span className="m-label">{tk(`mission.${m.id}`)}</span>
                  <span className="m-prog mono">
                    {Math.min(p, m.target)}/{m.target}
                  </span>
                  <span className="m-bar" style={{ ['--p' as string]: Math.min(1, p / m.target) }} />
                </li>
              );
            })}
          </ul>
          <p className="panel-foot dim">
            <Trans k="gacha.missionsFoot" values={{ n: MISSION_REWARD, time: <span className="mono">{formatClock(msUntilMidnight(now))}</span> }} />
          </p>
        </section>

        <section className="panel stamps">
          <h3 className="panel-title">{t('gacha.stamps')}</h3>
          <div className="stamp-row">
            {Array.from({ length: O5_EVERY_STAMPS }, (_, i) => {
              const filled = i < stampInCycle;
              const isO5 = i === O5_EVERY_STAMPS - 1;
              return (
                <div key={i} className={`stamp-slot ${filled ? 'filled' : ''} ${isO5 ? 'o5' : ''}`}>
                  {filled ? <Emblem /> : <span className="mono">{i + 1}</span>}
                  <small>{isO5 ? 'O5' : 'SSR+'}</small>
                </div>
              );
            })}
          </div>
          <ul className="perks">
            <li>
              <Trans k="gacha.perk1" />
            </li>
            <li>
              <Trans k="gacha.perk2" values={{ n: O5_EVERY_STAMPS }} />
            </li>
            <li>
              <Trans k="gacha.perk3" values={{ n: THAUMIEL_EVERY, left: <span className="mono">{fmt(toHundred)}</span> }} />
            </li>
          </ul>
          <div className="stats-line mono">
            {t('gacha.statsLine', { stamps: save.login.stamps, packs: save.packsOpened })}
          </div>
        </section>
      </div>

      <footer className="legal">
        <Trans
          k="gacha.legal"
          values={{
            wiki: (
              <a href="https://scp-wiki.wikidot.com/" target="_blank" rel="noreferrer">
                SCP Foundation Wiki
              </a>
            ),
            license: (
              <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">
                CC BY-SA 3.0
              </a>
            ),
          }}
        />
      </footer>

      {result && (
        <OpeningScene
          key={result.cards.map((c) => c.id).join()}
          result={result}
          intense={intense}
          next={next}
          onAgain={again}
          onClose={() => {
            setResult(null);
            setChoice(null);
          }}
        />
      )}
    </div>
  );
}
