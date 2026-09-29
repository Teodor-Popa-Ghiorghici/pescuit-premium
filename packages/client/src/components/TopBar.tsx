import { useRef } from 'react';
import { HeadphonesIcon } from '../art/marks.js';
import { useT } from '../i18n/useT.js';

/* §5.8 - the icons are cut, not drawn: angular, mitred, square-ended, in the same hand as the seals (a 24 grid,
 * a 2.6 stroke, no curves). */
const CARVED = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinejoin: 'miter', strokeLinecap: 'square', 'aria-hidden': true } as const;

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...CARVED}>
    <path d="M3,9 H7 L12,4 V20 L7,15 H3 Z" fill="currentColor" />
    {muted ? <path d="M16,9 L22,15 M22,9 L16,15" /> : <path d="M16,9 L18,12 L16,15 M19,6 L22,12 L19,18" />}
  </svg>
);
const LogIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...CARVED}>
    <path d="M5,3 H15 L19,7 V21 H5 Z M9,10 H15 M9,14 H15 M9,18 H13" />
  </svg>
);
const RulesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...CARVED}>
    <path d="M3,5 L12,7 L21,5 V19 L12,21 L3,19 Z M12,7 V21" />
  </svg>
);
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...CARVED} strokeWidth="3">
    <path d="M3,6 H21 M3,12 H17 M3,18 H21" />
  </svg>
);

/**
 * §5.2/§5.8 - the top bar: 40 px, the turn line at the left, icon tabs with labels at the right.
 * Mute is one tap; a long press opens the mixer. Language lives in the menu.
 */
export function TopBar({
  text,
  mine,
  muted,
  headphones,
  logOpen,
  showLog,
  onMute,
  onMixer,
  onLog,
  onRules,
  onMenu,
  className = '',
}: {
  text: string;
  mine: boolean;
  muted: boolean;
  headphones: boolean;
  logOpen: boolean;
  /** the log tab: on the phone always; on a wide desktop the board is already there */
  showLog: boolean;
  onMute: () => void;
  onMixer: () => void;
  onLog: () => void;
  onRules: () => void;
  onMenu: () => void;
  className?: string;
}) {
  const { t } = useT();
  const timer = useRef<number | undefined>(undefined);
  const long = useRef(false);

  const down = () => {
    long.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      long.current = true;
      onMixer();
    }, 520);
  };
  const cancel = () => window.clearTimeout(timer.current);

  return (
    <header className={`ph-top ${className}`} data-topbar>
      <span className={`ph-top__turn ${mine ? 'is-mine' : ''}`} aria-live="polite">
        {text}
      </span>
      <nav className="ph-top__icons" aria-label={t('menu.title')}>
        {headphones && (
          <span className="ph-tab ph-tab--static" title={t('nav.headphones')}>
            <HeadphonesIcon size={18} />
            <span className="ph-tab__label">{t('nav.headphones')}</span>
          </span>
        )}
        <button
          type="button"
          className="ph-tab"
          aria-pressed={muted}
          onPointerDown={down}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (long.current) {
              long.current = false;
              return;
            }
            onMute();
          }}
        >
          <SpeakerIcon muted={muted} />
          <span className="ph-tab__label">{muted ? t('nav.muted') : t('nav.sound')}</span>
        </button>
        {showLog && (
          <button type="button" className={`ph-tab ${logOpen ? 'is-on' : ''}`} aria-pressed={logOpen} onClick={onLog}>
            <LogIcon />
            <span className="ph-tab__label">{t('nav.log')}</span>
          </button>
        )}
        <button type="button" className="ph-tab" onClick={onRules}>
          <RulesIcon />
          <span className="ph-tab__label">{t('nav.rules')}</span>
        </button>
        <button type="button" className="ph-tab" onClick={onMenu}>
          <MenuIcon />
          <span className="ph-tab__label">{t('nav.menu')}</span>
        </button>
      </nav>
    </header>
  );
}
