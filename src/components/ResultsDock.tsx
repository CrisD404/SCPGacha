import type { PackType } from '../data/types';
import { useT } from '../i18n';
import { packShort } from '../i18n/labels';
import { Icon } from './Icon';
import { Pack } from './Pack';
import './dock.css';

export interface NextPack {
  type: PackType;
  /** paquetes de ese tipo disponibles */
  count: number;
}

/** Dock ilustrado de la pantalla de resultados: Volver · Compartir · Abrir otro. */
export function ResultsDock({ onBack, onShare, onAgain, next }: { onBack: () => void; onShare: () => void; onAgain: () => void; next: NextPack | null }) {
  const { t } = useT();
  return (
    <nav className="dock results-dock" aria-label={t('scene.results')}>
      <button className="dock-btn" onClick={onBack}>
        <span className="dock-art" aria-hidden>
          <Icon name="chevron" size={22} style={{ transform: 'scaleX(-1)' }} />
        </span>
        <b>{t('dock.back')}</b>
        <small>{t('dock.backSub')}</small>
      </button>
      <button className="dock-btn dock-main" onClick={onShare}>
        <span className="dock-art dock-broadcast" aria-hidden>
          <i />
          <i />
          <Icon name="antenna" size={28} />
        </span>
        <b>{t('share.action.share')}</b>
        <small>{t('dock.shareSub')}</small>
      </button>
      <button className="dock-btn dock-next" onClick={onAgain} disabled={!next}>
        <span className="dock-pack" aria-hidden>{next ? <Pack type={next.type} width="34px" /> : <Icon name="hourglass" size={24} />}</span>
        <b>{t('scene.openAnother')}</b>
        <small>{next ? t('dock.nextSub', { name: packShort(next.type), n: next.count }) : t('gacha.noPacksShort')}</small>
      </button>
    </nav>
  );
}
