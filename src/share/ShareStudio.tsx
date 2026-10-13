import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Card } from '../data/types';
import { RARITIES, rarityRank } from '../data/rarity';
import { useGame } from '../store/game';
import { notify } from '../store/ui';
import { useT, type Key } from '../i18n';
import { CardMini } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { sfx } from '../fx/sfx';
import { loadArt, loadFonts } from './art';
import { defaultTitle, drawScene, hasSummary, type Env } from './render';
import { LOOP_MS, canShareFiles, copyImage, download, extensionFor, renderGif, renderPng, renderVideo, shareFile, videoMime } from './export';
import { FORMATS, type ShareFormat, type ShareOptions, type ShareOutput, type ShareRequest, type ShareStamp, type ShareTheme } from './types';
import '../components/dock.css';
import './share.css';

const PREFS_KEY = 'scp-gacha-share';
type Prefs = Omit<ShareOptions, 'title'>;
const DEFAULT_PREFS: Prefs = { format: 'story', theme: 'archive', output: 'png', stamp: 'auto', summary: true, handle: '' };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

const FORMAT_TILES: { id: ShareFormat; name: Key; sub: Key }[] = [
  { id: 'square', name: 'share.format.square', sub: 'share.format.squareSub' },
  { id: 'portrait', name: 'share.format.portrait', sub: 'share.format.portraitSub' },
  { id: 'story', name: 'share.format.story', sub: 'share.format.storySub' },
];
const THEME_TILES: { id: ShareTheme; name: Key }[] = [
  { id: 'archive', name: 'share.theme.archive' },
  { id: 'alert', name: 'share.theme.alert' },
  { id: 'thaumiel', name: 'share.theme.thaumiel' },
  { id: 'dossier', name: 'share.theme.dossier' },
];
const STAMPS: { id: ShareStamp; name: Key }[] = [
  { id: 'auto', name: 'share.stamp.auto' },
  { id: 'none', name: 'share.stamp.none' },
  { id: 'classified', name: 'card.classified' },
  { id: 'topsecret', name: 'scene.topSecret' },
  { id: 'breach', name: 'scene.breach' },
];

function Panel({ icon, title, children, aside }: { icon: IconName; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="st-panel">
      <header className="st-panel-head">
        <Icon name={icon} size={15} />
        <span>{title}</span>
        {aside && <span className="st-panel-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export default function ShareStudio({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  const { t, lang } = useT();
  const markShared = useGame((s) => s.markShared);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>(() => request.selected ?? request.cards.map((c) => c.id));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<{ label: string; p: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const env = useRef<Env>({ arts: new Map() });
  const canvas = useRef<HTMLCanvasElement>(null);
  const cache = useRef<{ key: string; blob: Blob } | null>(null);
  const video = useMemo(videoMime, []);
  const nativeShare = useMemo(canShareFiles, []);

  const cards = useMemo<Card[]>(() => request.cards.filter((c) => selected.includes(c.id)), [request.cards, selected]);
  const options: ShareOptions = { ...prefs, title, output: prefs.output === 'video' && !video ? 'png' : prefs.output };
  const scene = { request, cards, options };
  const sceneKey = JSON.stringify([selected, options, lang]);
  const autoTitle = defaultTitle({ request, cards });

  const patch = (p: Partial<Prefs>) => {
    sfx.play('tap');
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      savePrefs(next);
      return next;
    });
  };

  // arte rasterizado + fuentes
  useEffect(() => {
    let alive = true;
    Promise.all([loadFonts(), ...request.cards.map((c) => loadArt(c).then((img) => env.current.arts.set(c.id, img)))])
      .catch(() => undefined)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [request.cards]);

  // vista previa (animada si la salida es GIF o video)
  useEffect(() => {
    const c = canvas.current;
    if (!ready || !c || !cards.length) return;
    const { w, h } = FORMATS[options.format];
    c.width = Math.round(w / 2);
    c.height = Math.round(h / 2);
    const ctx = c.getContext('2d')!;
    if (options.output === 'png') {
      drawScene(ctx, c.width, c.height, scene, 0.18, env.current);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      drawScene(ctx, c.width, c.height, scene, ((now - t0) % LOOP_MS) / LOOP_MS, env.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // sceneKey resume todas las dependencias del dibujo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sceneKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  const fileName = () => {
    const base = (cards.length === 1 ? cards[0].code : `scp-gacha-${request.context}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    return `${base}-${new Date().toISOString().slice(0, 10)}`;
  };

  /** Genera (o reutiliza) el archivo en el formato de salida elegido. */
  const generate = async (): Promise<Blob> => {
    if (cache.current?.key === sceneKey) return cache.current.blob;
    let blob: Blob;
    if (options.output === 'gif') {
      setBusy({ label: t('share.busy.gif'), p: 0 });
      blob = await renderGif(scene, env.current, (p) => setBusy({ label: t('share.busy.gif'), p }));
    } else if (options.output === 'video') {
      setBusy({ label: t('share.busy.video'), p: 0 });
      blob = await renderVideo(scene, env.current, (p) => setBusy({ label: t('share.busy.video'), p }));
    } else {
      setBusy({ label: t('share.busy.png'), p: 0.5 });
      blob = await renderPng(scene, env.current);
    }
    cache.current = { key: sceneKey, blob };
    return blob;
  };

  const done = (msg: string) => {
    markShared();
    setFlash(msg);
    sfx.play('chime');
    setTimeout(() => setFlash(null), 2200);
  };

  const fail = (e: unknown) => {
    setBusy(null);
    sfx.play('error');
    notify({ kind: 'info', icon: 'warning', title: t('share.err.title'), text: e instanceof Error && e.message === 'clipboard' ? t('share.err.clipboard') : t('share.err.generic') });
  };

  const onShare = async () => {
    if (busy || !cards.length) return;
    try {
      const blob = await generate();
      setBusy(null);
      const name = `${fileName()}.${extensionFor(blob.type)}`;
      if (nativeShare) {
        if (await shareFile(blob, name, `${options.title || autoTitle} #SCPGacha`)) done(t('share.done.shared'));
      } else {
        download(blob, name);
        done(t('share.done.downloadedShare'));
      }
    } catch (e) {
      fail(e);
    }
  };

  const onCopy = async () => {
    if (busy || !cards.length) return;
    try {
      // siempre PNG: los portapapeles no aceptan GIF ni video
      await copyImage(renderPng(scene, env.current));
      done(options.output === 'png' ? t('share.done.copied') : t('share.done.copiedStill'));
    } catch (e) {
      fail(e);
    }
  };

  const onDownload = async () => {
    if (busy || !cards.length) return;
    try {
      const blob = await generate();
      setBusy(null);
      download(blob, `${fileName()}.${extensionFor(blob.type)}`);
      done(t('share.done.downloaded'));
    } catch (e) {
      fail(e);
    }
  };

  const toggleCard = (id: string) => {
    sfx.play('tap');
    setSelected((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : request.cards.filter((c) => cur.includes(c.id) || c.id === id).map((c) => c.id)));
  };

  const bestOnly = () => {
    const best = [...request.cards].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.q - a.q)[0];
    setSelected([best.id]);
    sfx.play('tap');
  };

  const { w, h } = FORMATS[options.format];
  const suggestions: string[] = [autoTitle, t('share.suggest.1'), t('share.suggest.2'), t('share.suggest.3')];
  const outputs: { id: ShareOutput; name: string; sub: string; icon: IconName }[] = [
    { id: 'png', name: t('share.output.png'), sub: t('share.output.pngSub'), icon: 'archive' },
    { id: 'gif', name: t('share.output.gif'), sub: t('share.output.gifSub'), icon: 'spark' },
    ...(video ? [{ id: 'video' as ShareOutput, name: video.includes('mp4') ? t('share.output.mp4') : t('share.output.webm'), sub: video.includes('mp4') ? t('share.output.mp4Sub') : t('share.output.webmSub'), icon: 'bolt' as IconName }] : []),
  ];

  return createPortal(
    <div className="studio" role="dialog" aria-modal="true" aria-label={t('share.title')}>
      <header className="studio-head">
        <span className="studio-mark">
          <Icon name="antenna" size={20} />
        </span>
        <div className="studio-titles">
          <span className="studio-kicker">{t('share.kicker')}</span>
          <h2>{t('share.title')}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={t('common.close')} disabled={!!busy}>
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="studio-body">
        <div className="studio-stage">
          <div className={`device device-${options.format}`}>
            <div className="device-screen" style={{ aspectRatio: `${w} / ${h}`, ['--ar' as string]: w / h }}>
              <canvas ref={canvas} className="studio-canvas" />
              {!ready && <div className="device-loading mono">{t('share.loading')}</div>}
              {busy && (
                <div className="device-busy">
                  <div className="busy-ring" style={{ ['--p' as string]: busy.p }}>
                    <span className="display">{Math.round(busy.p * 100)}%</span>
                  </div>
                  <span className="mono">{busy.label}</span>
                </div>
              )}
              {flash && (
                <div className="device-flash">
                  <Icon name="check" size={28} strokeWidth={2.6} />
                  <span>{flash}</span>
                </div>
              )}
            </div>
          </div>
          <div className="stage-meta mono">
            {t('share.preview')} · {w}×{h} · {options.output === 'png' ? 'PNG' : options.output === 'gif' ? 'GIF' : video?.includes('mp4') ? 'MP4' : 'WEBM'}
          </div>
        </div>

        <div className="studio-controls">
          {request.cards.length > 1 && (
            <Panel
              icon="cards"
              title={t('share.panel.cards')}
              aside={
                <span className="st-mini-actions">
                  <button onClick={() => (setSelected(request.cards.map((c) => c.id)), sfx.play('tap'))}>{t('share.cards.all')}</button>
                  <button onClick={bestOnly}>{t('share.cards.best')}</button>
                </span>
              }
            >
              <div className="st-cards">
                {request.cards.map((c) => (
                  <div key={c.id} className={`st-card ${selected.includes(c.id) ? 'on' : ''}`}>
                    <CardMini card={c} selected={selected.includes(c.id)} onClick={() => toggleCard(c.id)} />
                    <span className="st-check" style={{ ['--rc' as string]: RARITIES[c.rarity].color }}>
                      {selected.includes(c.id) && <Icon name="check" size={12} strokeWidth={3} />}
                    </span>
                  </div>
                ))}
              </div>
              <p className="st-hint">{t('share.cards.hint', { n: selected.length, total: request.cards.length })}</p>
            </Panel>
          )}

          <Panel icon="sliders" title={t('share.panel.format')}>
            <div className="st-tiles st-tiles-3">
              {FORMAT_TILES.map((f) => (
                <button key={f.id} className={`st-tile ${prefs.format === f.id ? 'on' : ''}`} onClick={() => patch({ format: f.id })} aria-pressed={prefs.format === f.id}>
                  <span className={`ratio ratio-${f.id}`} />
                  <b>{t(f.name)}</b>
                  <small>{t(f.sub)}</small>
                </button>
              ))}
            </div>
          </Panel>

          <Panel icon="prism" title={t('share.panel.theme')}>
            <div className="st-tiles st-tiles-4">
              {THEME_TILES.map((th) => (
                <button key={th.id} className={`st-tile st-theme ${prefs.theme === th.id ? 'on' : ''}`} onClick={() => patch({ theme: th.id })} aria-pressed={prefs.theme === th.id}>
                  <span className={`swatch swatch-${th.id}`} />
                  <b>{t(th.name)}</b>
                </button>
              ))}
            </div>
          </Panel>

          <Panel icon="spark" title={t('share.panel.output')}>
            <div className={`st-tiles st-tiles-${outputs.length}`}>
              {outputs.map((o) => (
                <button key={o.id} className={`st-tile st-out ${options.output === o.id ? 'on' : ''}`} onClick={() => patch({ output: o.id })} aria-pressed={options.output === o.id}>
                  <span className={`out-icon out-${o.id}`}>
                    <Icon name={o.icon} size={20} />
                  </span>
                  <b>{o.name}</b>
                  <small>{o.sub}</small>
                </button>
              ))}
            </div>
          </Panel>

          <Panel icon="book" title={t('share.panel.texts')}>
            <label className="st-field">
              <span>{t('share.field.title')}</span>
              <input className="field" value={title} maxLength={48} placeholder={autoTitle} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="st-suggest">
              {suggestions.map((s) => (
                <button key={s} className={`chip ${(title || autoTitle) === s ? 'on' : ''}`} onClick={() => setTitle(s === autoTitle ? '' : s)}>
                  {s}
                </button>
              ))}
            </div>
            <label className="st-field">
              <span>{t('share.field.handle')}</span>
              <input className="field" value={prefs.handle} maxLength={28} placeholder="@agente_19" onChange={(e) => setPrefs((p) => (savePrefs({ ...p, handle: e.target.value }), { ...p, handle: e.target.value }))} />
            </label>
          </Panel>

          <Panel icon="stamp" title={t('share.panel.stamp')}>
            <div className="st-stamps">
              {STAMPS.map((st) => (
                <button key={st.id} className={`st-stamp ${prefs.stamp === st.id ? 'on' : ''} stamp-${st.id}`} onClick={() => patch({ stamp: st.id })} aria-pressed={prefs.stamp === st.id}>
                  {t(st.name)}
                </button>
              ))}
            </div>
            {hasSummary(request, cards.length) && (
              <button className={`st-switch ${prefs.summary ? 'on' : ''}`} onClick={() => patch({ summary: !prefs.summary })} aria-pressed={prefs.summary}>
                <span className="ctl-switch-like">
                  <i />
                </span>
                {t('share.summary')}
              </button>
            )}
          </Panel>
        </div>
      </div>

      <footer className="dock studio-dock">
        <button className="dock-btn dock-side" onClick={onCopy} disabled={!!busy || !ready}>
          <span className="dock-art" aria-hidden>
            <Icon name="copies" size={24} />
          </span>
          <b>{t('share.action.copy')}</b>
          <small>{t('share.action.copySub')}</small>
        </button>
        <button className="dock-btn dock-main" onClick={onShare} disabled={!!busy || !ready}>
          <span className="dock-art dock-broadcast" aria-hidden>
            <i />
            <i />
            <Icon name="antenna" size={30} />
          </span>
          <b>{t('share.action.share')}</b>
          <small>{nativeShare ? t('share.action.shareSub') : t('share.action.shareFallback')}</small>
        </button>
        <button className="dock-btn dock-side" onClick={onDownload} disabled={!!busy || !ready}>
          <span className="dock-art" aria-hidden>
            <Icon name="archive" size={24} />
          </span>
          <b>{t('share.action.download')}</b>
          <small>{t('share.action.downloadSub')}</small>
        </button>
      </footer>
    </div>,
    document.body,
  );
}
