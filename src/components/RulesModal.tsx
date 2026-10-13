import { cards } from '../data/cards';
import { RARITIES, RARITY_ORDER, formatPct } from '../data/rarity';
import { CLASSES, CLASS_ORDER } from '../data/classes';
import { MAX_STAMINA, MISSION_REWARD, O5_EVERY_STAMPS, PITY_EVERY, THAUMIEL_EVERY, guaranteedRates } from '../game/gacha';
import { useGame } from '../store/game';
import { locale, useT } from '../i18n';
import { Trans } from '../i18n/Trans';
import { classAbility, classAbilityDesc, className, clearance, clearanceName, rarityName } from '../i18n/labels';
import { Modal } from './Modal';
import { Icon } from './Icon';

export function RulesModal({ onClose }: { onClose: () => void }) {
  const db = cards();
  const hideRules = useGame((s) => s.save.settings.hideRules);
  const setSettings = useGame((s) => s.setSettings);
  const { t, fmt } = useT();
  const ssrRates = guaranteedRates('SSR');
  const pct = (p: number) => formatPct(p, locale());

  const close = () => {
    if (!hideRules) setSettings({ hideRules: true });
    onClose();
  };

  return (
    <Modal
      title={t('rules.title')}
      icon={<Icon name="book" size={24} />}
      onClose={close}
      wide
      footer={
        <button className="btn btn-primary" onClick={close}>
          {t('rules.ok')}
        </button>
      }
    >
      <div className="rules">
        <section>
          <h3>◆ {t('rules.about.h')}</h3>
          <p>
            <Trans k="rules.about.p" values={{ n: db.all.length }} />
          </p>
        </section>

        <section>
          <h3>◆ {t('rules.packs.h')}</h3>
          <ul>
            <li>
              <Trans k="rules.packs.1" values={{ max: MAX_STAMINA, reward: MISSION_REWARD }} />
            </li>
            <li>
              <Trans k="rules.packs.2" values={{ n: PITY_EVERY }} />
            </li>
            <li>
              <Trans k="rules.packs.3" values={{ stamps: O5_EVERY_STAMPS, every: THAUMIEL_EVERY }} />
            </li>
            <li>
              <Trans k="rules.packs.4" />
            </li>
          </ul>
        </section>

        <section>
          <h3>◆ {t('rules.rarity.h')}</h3>
          <p>
            <Trans k="rules.rarity.p" />
          </p>
          <div className="formula mono">{t('rules.rarity.formula')}</div>
          <ul>
            <li>
              <Trans k="rules.rarity.1" />
            </li>
            <li>
              <Trans k="rules.rarity.2" />
            </li>
            <li>
              <Trans k="rules.rarity.3" />
            </li>
            <li>
              <Trans k="rules.rarity.4" />
            </li>
          </ul>
          <table className="rules-table">
            <thead>
              <tr>
                <th>{t('rules.table.rank')}</th>
                <th>{t('rules.table.clearance')}</th>
                <th>{t('rules.table.q')}</th>
                <th>{t('rules.table.cards')}</th>
                <th>{t('rules.table.prob')}</th>
              </tr>
            </thead>
            <tbody>
              {[...RARITY_ORDER].reverse().map((r) => {
                const info = RARITIES[r];
                return (
                  <tr key={r}>
                    <td>
                      <b className="display" style={{ color: info.color, fontSize: 18 }}>
                        {r}
                      </b>{' '}
                      <span className="dim">{rarityName(r)}</span>
                    </td>
                    <td>
                      {clearance(r)} · {clearanceName(r)}
                    </td>
                    <td className="mono">{info.minQ > 0 ? `≥ ${fmt(info.minQ)}` : `< ${fmt(RARITIES.UC.minQ)}`}</td>
                    <td className="mono">{fmt(db.byRarity[r].length)}</td>
                    <td className="mono">{pct(info.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="dim small">
            <Trans k="rules.rarity.legends" values={{ ssr: pct(ssrRates.SSR ?? 0), ur: pct(ssrRates.UR ?? 0), lr: pct(ssrRates.LR ?? 0) }} />
          </p>
        </section>

        <section>
          <h3>◆ {t('rules.stats.h')}</h3>
          <ul>
            <li>
              <Trans k="rules.stats.atk" />
            </li>
            <li>
              <Trans k="rules.stats.def" />
            </li>
            <li>{t('rules.stats.max')}</li>
          </ul>
        </section>

        <section>
          <h3>◆ {t('rules.classes.h')}</h3>
          <div className="class-grid">
            {CLASS_ORDER.filter((c) => c !== 'unknown').map((c) => (
              <div key={c} className="class-item" style={{ borderColor: CLASSES[c].color }}>
                <b style={{ color: CLASSES[c].color }}>{className(c)}</b> · {classAbility(c)}
                <span>{classAbilityDesc(c)}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>◆ {t('rules.battle.h')}</h3>
          <ul>
            <li>
              <Trans k="rules.battle.duel" />
            </li>
            <li>
              <Trans k="rules.battle.team" />
            </li>
            <li>
              <Trans k="rules.battle.raid" />
            </li>
            <li>
              <Trans k="rules.battle.story" />
            </li>
          </ul>
        </section>

        <section>
          <h3>◆ {t('rules.lang.h')}</h3>
          <p>
            <Trans k="rules.lang.p" />
          </p>
        </section>

        <section>
          <h3>◆ {t('rules.credits.h')}</h3>
          <p className="dim small">{t('rules.credits.p')}</p>
        </section>
      </div>
      <style>{`
        .rules { display: flex; flex-direction: column; gap: 18px; font-size: 14px; }
        .rules h3 { margin: 0 0 6px; font-size: 15px; color: #7cc4ff; }
        .rules p { margin: 0 0 6px; }
        .rules ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
        .rules .small { font-size: 12px; }
        .formula { margin: 8px 0; padding: 10px 12px; border-radius: 8px; background: #07090c; border: 1px solid var(--line); font-size: 12px; color: var(--hazard); }
        .rules-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
        .rules-table th { text-align: left; font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: .08em; color: var(--text-faint); padding: 6px 8px; border-bottom: 1px solid var(--line); }
        .rules-table td { padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
        .class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
        .class-item { display: flex; flex-direction: column; padding: 8px 10px; border-left: 3px solid; border-radius: 0 8px 8px 0; background: var(--bg-3); font-size: 13px; }
        .class-item span { color: var(--text-dim); font-size: 12px; }
        @media (max-width: 600px) { .rules-table th:nth-child(2), .rules-table td:nth-child(2) { display: none; } }
      `}</style>
    </Modal>
  );
}
