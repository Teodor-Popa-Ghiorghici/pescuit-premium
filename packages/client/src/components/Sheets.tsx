import { LOCALES } from '@pescuit/shared';
import { useSyncExternalStore } from 'react';
import { audioStatus, onAudioStatus } from '../audio/context.js';
import { getEngine } from '../audio/engine.js';
import { softPress } from '../audio/ui.js';
import type { AudioSettings } from '../audio/mixer.js';
import { getTableSpeed, setTableSpeed, subscribeTableSpeed } from '../game/presentationSettings.js';
import { useDialog } from '../hooks/useDialog.js';
import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

function useAudioSettings(): AudioSettings {
  const engine = getEngine();
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.settings,
  );
}

/** §3.5 - "tap for sound": a tab hangs from the top bar while the audio context is suspended or locked. The
 *  first tap anywhere unlocks it as well; this is for the player who has not tapped yet. */
export function SoundTab() {
  const { t } = useT();
  const status = useSyncExternalStore(onAudioStatus, audioStatus);
  const s = useAudioSettings();
  if (status === 'running' || status === 'unavailable' || s.muted) return null;
  return (
    <button type="button" className="sound-tab" data-sound-tab onClick={() => getEngine().unlock()}>
      {t('settings.tapForSound')}
    </button>
  );
}

function useTableSpeed() {
  return useSyncExternalStore(subscribeTableSpeed, getTableSpeed);
}

function Slider({ label, value, onChange, id }: { label: string; value: number; onChange: (v: number) => void; id: string }) {
  return (
    <label className="sheetrow" htmlFor={id}>
      <span className="sheetrow__label">{label}</span>
      <input id={id} type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
    </label>
  );
}

function Toggle({ label, on, onChange, id }: { label: string; on: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label className="sheetrow" htmlFor={id}>
      <span className="sheetrow__label">{label}</span>
      <input id={id} type="checkbox" className="sheetrow__check" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/**
 * §3.5/§5.8 - the mixer, opened by a long press on the mute tab (or from the menu): master and bus
 * volumes, the output profile (speakers or headphones - headphones unlock the private tier), mono,
 * softer sounds, the A/V offset for Bluetooth, the ambience toggle. Every setting is per device.
 */
export function SoundSettings({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const engine = getEngine();
  const s = useAudioSettings();
  const speed = useTableSpeed();
  const dialog = useDialog<HTMLDivElement>(onClose);
  const set = (patch: Partial<AudioSettings>) => engine.update(patch);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialog} className="modal sheet-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('settings.title')} data-settings>
        <div className="modal__header">
          <h2>{t('settings.title')}</h2>
          <button
            className="btn modal__close"
            onClick={() => {
              softPress();
              onClose();
            }}
            aria-label={t('nav.close')}
          >
            ×
          </button>
        </div>
        <Toggle id="s-muted" label={t('settings.muted')} on={s.muted} onChange={(v) => set({ muted: v })} />
        <Slider id="s-master" label={t('settings.master')} value={s.master} onChange={(v) => set({ master: v })} />
        <Slider id="s-effects" label={t('settings.effects')} value={s.effects} onChange={(v) => set({ effects: v })} />
        <Slider id="s-interface" label={t('settings.interface')} value={s.interface} onChange={(v) => set({ interface: v })} />
        <Slider id="s-music" label={t('settings.music')} value={s.music} onChange={(v) => set({ music: v })} />
        <Toggle id="s-amb" label={t('settings.ambienceOn')} on={s.ambience > 0} onChange={(v) => set({ ambience: v ? 1 : 0 })} />
        <div className="sheetrow" role="radiogroup" aria-label={t('settings.profile')}>
          <span className="sheetrow__label">{t('settings.profile')}</span>
          <span className="seg">
            {(['speaker', 'headphones'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={s.profile === p}
                className={`seg__btn ${s.profile === p ? 'is-on' : ''}`}
                onClick={() => set({ profile: p })}
              >
                {p === 'speaker' ? t('settings.speakers') : t('settings.headphones')}
              </button>
            ))}
          </span>
        </div>
        <div className="sheetrow" role="radiogroup" aria-label={t('settings.tableSpeed')}>
          <span className="sheetrow__label">{t('settings.tableSpeed')}</span>
          <span className="seg">
            {([1, 1.5] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={speed === v} className={`seg__btn ${speed === v ? 'is-on' : ''}`} onClick={() => setTableSpeed(v)}>
                {v}×
              </button>
            ))}
          </span>
        </div>
        <Toggle id="s-mono" label={t('settings.mono')} on={s.mono} onChange={(v) => set({ mono: v })} />
        <Toggle id="s-soft" label={t('settings.softer')} on={s.softer} onChange={(v) => set({ softer: v })} />
        <label className="sheetrow" htmlFor="s-av">
          <span className="sheetrow__label">
            {t('settings.avOffset')} <span className="num">{s.avOffsetMs} ms</span>
          </span>
          <input id="s-av" type="range" min={-100} max={400} step={10} value={s.avOffsetMs} onChange={(e) => set({ avOffsetMs: Number(e.target.value) })} />
        </label>
        <p className="muted sheet-modal__hint">{t('settings.silentHint')}</p>
      </div>
    </div>
  );
}

/** §5.8 - the menu: language (moved out of the top bar), the mixer, and leaving the table. */
export function MenuSheet({ onClose, onSound }: { onClose: () => void; onSound: () => void }) {
  const { t, locale } = useT();
  const { setLocale, leaveRoom, local } = useGame();
  const dialog = useDialog<HTMLDivElement>(onClose);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialog} className="modal sheet-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('menu.title')} data-menu>
        <div className="modal__header">
          <h2>{t('menu.title')}</h2>
          <button
            className="btn modal__close"
            onClick={() => {
              softPress();
              onClose();
            }}
            aria-label={t('nav.close')}
          >
            ×
          </button>
        </div>
        <div className="sheetrow">
          <span className="sheetrow__label">{t('menu.language')}</span>
          <span className="seg" role="radiogroup" aria-label={t('menu.language')}>
            {LOCALES.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={l === locale} className={`seg__btn ${l === locale ? 'is-on' : ''}`} onClick={() => setLocale(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </span>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            softPress();
            onSound();
          }}
        >
          {t('menu.soundSettings')}
        </button>
        {!local && (
          <button
            type="button"
            className="btn btn--ghost sheet-modal__leave"
            onClick={() => {
              onClose();
              leaveRoom();
            }}
          >
            {t('menu.leave')}
          </button>
        )}
      </div>
    </div>
  );
}

/** §3.2 - in headphones mode, once per game: the private tier voices only your own secrets, so leaving
 *  it on over speakers would tell the call about a forgetful player's hand. */
export function HeadphonesPrompt({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  return (
    <div className="hp-prompt" role="alertdialog" aria-label={t('settings.headphonesAsk')} data-headphones-prompt>
      <span className="hp-prompt__text">{t('settings.headphonesAsk')}</span>
      <button
        type="button"
        className="hp-prompt__btn"
        onClick={() => {
          softPress();
          onDone();
        }}
      >
        {t('settings.headphonesYes')}
      </button>
      <button
        type="button"
        className="hp-prompt__btn"
        onClick={() => {
          softPress();
          getEngine().update({ profile: 'speaker' });
          onDone();
        }}
      >
        {t('settings.headphonesNo')}
      </button>
    </div>
  );
}
