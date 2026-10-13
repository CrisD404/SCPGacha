import { lazy, Suspense } from 'react';
import { useUi } from '../store/ui';

// El estudio (render en canvas, codificador GIF) se descarga sólo al compartir.
const ShareStudio = lazy(() => import('../share/ShareStudio'));

export function ShareHost() {
  const share = useUi((s) => s.share);
  const close = useUi((s) => s.closeShare);
  if (!share) return null;
  return (
    <Suspense fallback={<div className="studio-loading" aria-busy="true" />}>
      <ShareStudio request={share} onClose={close} />
    </Suspense>
  );
}
