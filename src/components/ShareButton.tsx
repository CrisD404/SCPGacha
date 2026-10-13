import type { ShareRequest } from '../share/types';
import { useUi } from '../store/ui';
import { useT } from '../i18n';
import { sfx } from '../fx/sfx';
import { Icon } from './Icon';

/** Botón de compartir con arte de transmisión; abre el estudio con la solicitud dada. */
export function ShareButton({ request, compact = false, className = '' }: { request: () => ShareRequest; compact?: boolean; className?: string }) {
  const openShare = useUi((s) => s.openShare);
  const { t } = useT();
  return (
    <button
      className={`share-btn ${compact ? 'compact' : ''} ${className}`}
      onClick={() => {
        sfx.play('tap');
        openShare(request());
      }}
    >
      <span className="share-btn-art">
        <i />
        <Icon name="antenna" size={compact ? 15 : 18} />
      </span>
      <span className="share-btn-text">
        <b>{t('share.action.share')}</b>
        {!compact && <small>{t('share.button.sub')}</small>}
      </span>
    </button>
  );
}
