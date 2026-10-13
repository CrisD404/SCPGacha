import { useEffect, useState } from 'react';
import { loadCards, loadCardTranslations } from './data/cards';
import { getLang, LANGS, useT } from './i18n';
import { useGame } from './store/game';
import { useUi } from './store/ui';
import { useRoute } from './hooks';
import { sfx } from './fx/sfx';
import { fx } from './fx/particles';
import { Header } from './components/Header';
import { Notifier } from './components/Notifier';
import { ShareHost } from './components/ShareHost';
import { FxLayer } from './components/FxLayer';
import { Emblem } from './components/Emblem';
import { CardDetail } from './components/CardDetail';
import { TrophiesModal } from './components/TrophiesModal';
import { RulesModal } from './components/RulesModal';
import { GachaPage } from './pages/GachaPage';
import { CollectionPage } from './pages/CollectionPage';
import { BattlePage } from './pages/BattlePage';
import './app.css';

function Boot({ error }: { error?: string }) {
  const { t } = useT();
  return (
    <div className="boot">
      <Emblem className="boot-emblem" />
      <div className="boot-title display">SCP // GACHA</div>
      {error ? (
        <p className="boot-error">{error}</p>
      ) : (
        <p className="boot-text mono">
          {t('boot.connecting')}
          <span className="boot-dots" />
        </p>
      )}
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const hydrated = useGame((s) => s.hydrated);
  const settings = useGame((s) => s.save.settings);
  const tick = useGame((s) => s.tick);
  const route = useRoute();
  const modal = useUi((s) => s.modal);
  const setModal = useUi((s) => s.setModal);
  const { lang } = useT();

  useEffect(() => {
    Promise.all([loadCards(), loadCardTranslations(getLang())])
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    sfx.enabled = settings.sound;
    sfx.volume = settings.volume;
  }, [settings.sound, settings.volume]);

  useEffect(() => {
    fx.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const live = ready && hydrated;

  // idioma del documento (lectores de pantalla, traducción del navegador)
  useEffect(() => {
    document.documentElement.lang = LANGS.find((l) => l.id === lang)!.locale;
    document.title = lang === 'es' ? 'SCP Gacha — Archivo Anómalo' : 'SCP Gacha — Anomalous Archive';
  }, [lang]);

  useEffect(() => {
    if (!live) return;
    tick();
    const id = setInterval(tick, 15_000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    if (!useGame.getState().save.settings.hideRules) setModal('rules');
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [live, tick, setModal]);

  if (!live) return <Boot error={error} />;

  const section = route.path[0] ?? 'gacha';

  return (
    <>
      <Header section={section} />
      <main className="main">
        {section === 'coleccion' ? <CollectionPage /> : section === 'combate' ? <BattlePage sub={route.path.slice(1)} /> : <GachaPage />}
      </main>
      <CardDetail />
      {modal === 'trophies' && <TrophiesModal onClose={() => setModal(null)} />}
      {modal === 'rules' && <RulesModal onClose={() => setModal(null)} />}
      <ShareHost />
      <Notifier />
      <FxLayer />
    </>
  );
}
