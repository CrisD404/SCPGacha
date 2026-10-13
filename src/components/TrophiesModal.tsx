import { TROPHIES, type TrophyTier } from '../game/trophies';
import { useSave } from '../store/game';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Insignia, TIER_STYLES } from './Insignia';
import { useT } from '../i18n';
import { trophyDesc, trophyName } from '../i18n/labels';
import './trophies.css';

const TIER_ORDER: TrophyTier[] = ['bronze', 'silver', 'gold', 'o5'];

export function TrophiesModal({ onClose }: { onClose: () => void }) {
  const unlocked = useSave((s) => s.trophies);
  const count = TROPHIES.filter((tr) => unlocked[tr.id]).length;
  const { t, tk, fmtDate } = useT();

  return (
    <Modal
      title={
        <>
          {t('trophies.title')} <span className="mono dim trophy-count">{count} / {TROPHIES.length}</span>
        </>
      }
      icon={<Icon name="trophy" size={24} />}
      onClose={onClose}
      wide
    >
      <div className="trophy-tiers">
        <div className="trophy-progress">
          <i style={{ width: `${(count / TROPHIES.length) * 100}%` }} />
        </div>
        {TIER_ORDER.map((tier) => {
          const all = TROPHIES.filter((tr) => tr.tier === tier);
          const got = all.filter((tr) => unlocked[tr.id]).length;
          return (
            <span key={tier} className="tier-chip mono" style={{ ['--tc' as string]: TIER_STYLES[tier].glow }}>
              <i />
              {tk(`trophies.tier.${tier}`)} {got}/{all.length}
            </span>
          );
        })}
      </div>
      <div className="trophy-grid">
        {TROPHIES.map((tr) => {
          const at = unlocked[tr.id];
          const hidden = tr.secret && !at;
          return (
            <div key={tr.id} className={`trophy ${at ? 'on' : ''}`} style={{ ['--tc' as string]: TIER_STYLES[tr.tier].glow }}>
              <Insignia icon={tr.icon} tier={tr.tier} label={tr.label} size={52} locked={!at} secret={hidden} />
              <div className="trophy-text">
                <b>{hidden ? t('trophies.sealed') : trophyName(tr)}</b>
                <span>{hidden ? t('trophies.sealedDesc') : trophyDesc(tr)}</span>
                {at ? <small className="mono">{t('trophies.unlockedOn', { date: fmtDate(at, { dateStyle: 'short' }) })}</small> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
