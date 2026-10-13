import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGame } from '../store/game';
import { useUi } from '../store/ui';
import { sfx } from '../fx/sfx';
import { Emblem } from './Emblem';
import { Icon, type IconName } from './Icon';
import { MISSIONS } from '../game/missions';
import { TROPHIES } from '../game/trophies';
import { LANGS, useLang, useT, type Lang } from '../i18n';
import { loadCardTranslations } from '../data/cards';

export function Header({ section }: { section: string }) {
  const { t } = useT();
  const missionsLeft = useGame((s) => MISSIONS.length - s.save.daily.done.length);
  const tabs = [
    { id: 'gacha', label: t('nav.gacha'), dot: missionsLeft > 0 && section !== 'gacha' },
    { id: 'coleccion', label: t('nav.collection'), dot: false },
    { id: 'combate', label: t('nav.battle'), dot: false },
  ];

  return (
    <header className="header">
      <a className="brand" href="#/gacha" aria-label={t('nav.home')}>
        <Emblem />
        <span>SCP//GACHA</span>
      </a>
      <nav className="nav" aria-label={t('nav.sections')}>
        {tabs.map((tab) => (
          <a key={tab.id} href={`#/${tab.id}`} className={section === tab.id ? 'active' : ''} aria-current={section === tab.id ? 'page' : undefined} onClick={() => sfx.play('tap')}>
            {tab.label}
            {tab.dot && <i className="nav-dot" />}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <ControlMenu />
      </div>
    </header>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`ctl-switch ${on ? 'on' : ''}`} aria-hidden="true">
      <span className="ctl-switch-knob" />
      <span className="ctl-switch-label">{on ? 'ON' : 'OFF'}</span>
    </span>
  );
}

function Row({ icon, title, sub, onClick, right, role = 'menuitem', checked }: { icon: IconName; title: string; sub?: string; onClick: () => void; right: ReactNode; role?: string; checked?: boolean }) {
  return (
    <button className="ctl-row" role={role} aria-checked={checked} onClick={onClick}>
      <span className="ctl-icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="ctl-text">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {right}
    </button>
  );
}

/** Selector ES / EN: carga las traducciones de cartas antes de cambiar para no mostrar un texto a medias. */
function LangPicker() {
  const { t, lang } = useT();
  const setLang = useLang((s) => s.setLang);
  const [loading, setLoading] = useState<Lang | null>(null);

  const choose = async (next: Lang) => {
    if (next === lang || loading) return;
    setLoading(next);
    await loadCardTranslations(next);
    setLoading(null);
    setLang(next);
    sfx.play('toggle');
  };

  return (
    <div className="ctl-lang" role="group" aria-label={t('menu.language')}>
      <span className="ctl-icon">
        <Icon name="globe" size={18} />
      </span>
      <span className="ctl-text">
        <b>{t('menu.language')}</b>
        <small>{loading ? t('menu.languageLoading') : LANGS.find((l) => l.id === lang)!.label}</small>
      </span>
      <span className="ctl-seg">
        {LANGS.map((l) => (
          <button key={l.id} className={l.id === lang ? 'on' : ''} aria-pressed={l.id === lang} onClick={() => void choose(l.id)} title={l.label}>
            {l.short}
          </button>
        ))}
      </span>
    </div>
  );
}

/** Menú colapsable con los ajustes y accesos secundarios ("Consola del agente"). */
function ControlMenu() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const settings = useGame((s) => s.save.settings);
  const unlocked = useGame((s) => Object.keys(s.save.trophies).length);
  const setSettings = useGame((s) => s.setSettings);
  const setModal = useUi((s) => s.setModal);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (patch: Parameters<typeof setSettings>[0]) => {
    setSettings(patch);
    // el sonido se oye recién activado, no al apagarlo
    if (patch.sound !== false) requestAnimationFrame(() => sfx.play('toggle'));
  };

  return (
    <div className="ctl" ref={ref}>
      <button
        className={`ctl-btn ${open ? 'open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu.aria')}
        title={t('menu.title')}
        onClick={() => {
          setOpen(!open);
          sfx.play('tap');
        }}
      >
        <Icon name="sliders" size={19} />
        <span className={`ctl-led ${settings.sound ? 'on' : ''}`} />
      </button>
      {open && (
        <div className="ctl-panel" role="menu" aria-label={t('menu.title')}>
          <div className="ctl-head">
            <span className="ctl-head-title">{t('menu.title')}</span>
            <span className="ctl-head-id">TERM-19</span>
          </div>
          <div className="ctl-group">
            <Row
              icon="bolt"
              title={t('menu.intense')}
              sub={settings.intense ? t('menu.intenseOn') : t('menu.intenseOff')}
              role="menuitemcheckbox"
              checked={settings.intense}
              onClick={() => toggle({ intense: !settings.intense })}
              right={<Switch on={settings.intense} />}
            />
            <Row
              icon={settings.sound ? 'sound' : 'mute'}
              title={t('menu.sound')}
              sub={settings.sound ? t('menu.soundOn') : t('menu.soundOff')}
              role="menuitemcheckbox"
              checked={settings.sound}
              onClick={() => toggle({ sound: !settings.sound })}
              right={<Switch on={settings.sound} />}
            />
            {settings.sound && (
              <label className="ctl-volume">
                <span className="mono">VOL</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={settings.volume}
                  onChange={(e) => setSettings({ volume: Number(e.target.value) })}
                  onPointerUp={() => sfx.play('chime')}
                  aria-label={t('menu.volume')}
                />
                <span className="mono ctl-vol-val">{Math.round(settings.volume * 100)}</span>
              </label>
            )}
            <LangPicker />
          </div>
          <div className="ctl-group">
            <Row
              icon="trophy"
              title={t('menu.trophies')}
              sub={t('menu.trophiesSub', { n: unlocked, total: TROPHIES.length })}
              onClick={() => {
                setModal('trophies');
                setOpen(false);
              }}
              right={<Icon name="chevron" size={16} className="ctl-chev" />}
            />
            <Row
              icon="book"
              title={t('menu.manual')}
              sub={t('menu.manualSub')}
              onClick={() => {
                setModal('rules');
                setOpen(false);
              }}
              right={<Icon name="chevron" size={16} className="ctl-chev" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}
