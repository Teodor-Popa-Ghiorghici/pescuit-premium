import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../audio/engine.js';
import { POWER_CUE } from '../audio/cuesheet.js';
import { Seal } from '../art/seals.js';
import { useCodexT } from '../i18n/codexStrings.js';
import { useT } from '../i18n/useT.js';
import { Card } from './Card.js';
import './codex.css';

/** the nine powers, in the order of RULES §6 */
const POWERS = ['squid', 'shark', 'tortoise', 'jellyfish', 'lanternfish', 'stickleback', 'mantisShrimp', 'whale', 'clownfish'] as const;
type Power = (typeof POWERS)[number];

const KIND: Record<Power, 'reactive' | 'active' | 'special'> = {
  squid: 'reactive',
  shark: 'reactive',
  tortoise: 'reactive',
  lanternfish: 'reactive',
  mantisShrimp: 'reactive',
  jellyfish: 'active',
  stickleback: 'active',
  whale: 'active',
  clownfish: 'special',
};

function PowerRow({ power }: { power: Power }) {
  const { rank } = useT();
  const t = useCodexT();
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const cue = POWER_CUE[power];
  const rest = power === 'squid';
  const play = () => {
    const engine = getEngine();
    engine.unlock();
    // Squid shows the rest: no sound - the button still answers, with a flash. The others play the power's own cue.
    if (!rest && cue) engine.play(cue, undefined, { full: true });
    setPlaying(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(false), rest ? 700 : 1300);
  };
  return (
    <li className="codex__row" data-codex={power}>
      <div className="codex__card">
        <Card rank={power} size="md" />
      </div>
      <div className="codex__body">
        <h3 className="codex__name">
          <Seal rank={power} size={22} color="var(--ink)" inline /> {rank(power)}
          <span className="codex__kind">{t(`codex.kind.${KIND[power]}`)}</span>
        </h3>
        <p className="codex__rule">{t(`codex.${power}`)}</p>
        <div className={`codex__motif ${playing ? 'is-playing' : ''}`}>
          <button type="button" className="btn codex__play" onClick={play} aria-label={`${rank(power)}: ${rest ? t('codex.rest') : t('codex.play')}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              {rest ? <rect x="2" y="5" width="10" height="4" fill="currentColor" /> : <polygon points="2,1 13,7 2,13" fill="currentColor" />}
            </svg>
            <span>{rest ? t('codex.rest') : playing ? t('codex.playing') : t('codex.play')}</span>
          </button>
        </div>
        {rest && <p className="codex__note">{t('codex.restNote')}</p>}
      </div>
    </li>
  );
}

/** §5.8 - the Codex: the nine powers, each with its carving, seal, one-line rule and its sound (a button to hear it;
 *  Squid shows the rest). Loaded with the Rules panel, so it costs the table nothing until it is opened. */
export default function Codex() {
  const t = useCodexT();
  return (
    <div className="codex">
      <p className="codex__intro">{t('codex.intro')}</p>
      <ul className="codex__list">
        {POWERS.map((p) => (
          <PowerRow key={p} power={p} />
        ))}
      </ul>
      <p className="codex__intro">{t('codex.tallyNote')}</p>
    </div>
  );
}
