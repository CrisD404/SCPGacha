import { useEffect, useState, type AnimationEvent, type CSSProperties } from 'react';
import { useUi, type NoticeKind } from '../store/ui';
import { sfx } from '../fx/sfx';
import { useT } from '../i18n';
import { Insignia, TIER_STYLES } from './Insignia';
import './notifier.css';


const BASE_MS: Record<NoticeKind, number> = { trophy: 3600, reward: 3400, mission: 2800, info: 2400 };

/**
 * Notificaciones de a una: entran deslizándose desde la derecha, muestran
 * una barra de tiempo (se pausa al pasar el puntero) y dan paso a la siguiente.
 */
export function Notifier() {
  const notice = useUi((s) => s.notice);
  const queued = useUi((s) => s.queue.length);
  const next = useUi((s) => s.nextNotice);
  const [leaving, setLeaving] = useState(false);
  const { tk, t } = useT();

  useEffect(() => {
    if (!notice) return;
    setLeaving(false);
    sfx.play(notice.kind === 'trophy' ? 'trophy' : notice.kind === 'info' ? 'tap' : 'chime');
  }, [notice]);

  if (!notice) return null;

  // Con mucha cola, cada aviso dura menos para no hacer esperar.
  const factor = queued >= 8 ? 0.45 : queued >= 3 ? 0.65 : 1;
  const duration = Math.max(1200, BASE_MS[notice.kind] * factor);
  const accent = TIER_STYLES[notice.tier].glow;

  const onAnimationEnd = (e: AnimationEvent) => {
    if (e.animationName === 'notice-timer') setLeaving(true);
    else if (e.animationName === 'notice-out') next();
  };

  return (
    <div className="notifier" role="status" aria-live="polite">
      <div
        key={notice.id}
        className={`notice n-${notice.kind} t-${notice.tier} ${leaving ? 'leaving' : ''}`}
        style={{ ['--accent' as string]: accent, ['--dur' as string]: `${duration}ms` } as CSSProperties}
        onClick={() => setLeaving(true)}
        onAnimationEnd={onAnimationEnd}
        title={t('notice.dismiss')}
      >
        <div className="notice-sweep" />
        <div className="notice-badge">
          <Insignia icon={notice.icon} tier={notice.tier} label={notice.label} size={54} />
        </div>
        <div className="notice-body">
          <div className="notice-kicker">
            {tk(`notice.kicker.${notice.kind}`)}
            {notice.meta && <span className="notice-count">{notice.meta}</span>}
          </div>
          <div className="notice-title">{notice.title}</div>
          {notice.text && <div className="notice-text">{notice.text}</div>}
        </div>
        {queued > 0 && <div className="notice-queue">+{queued}</div>}
        <div className="notice-timer">
          <i />
        </div>
      </div>
    </div>
  );
}
