import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../audio/engine.js';
import { MOTIFS } from '../audio/motifs.js';
import { RANK_TO_MOTIF } from '../audio/cuesheet.js';
import { Seal } from '../art/seals.js';
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

const STAVE_W = 168;
const STAVE_H = 44;
const LINES = [8, 16, 24, 32, 40];

/** The motif as a stave: a contour of its notes (their pitch up the lines, their time along it). Squid's is
 *  empty but for a rest: it is the one motif the game never plays (§3.8). */
function Stave({ power }: { power: Power }) {
  const motif = power === 'squid' || power === 'clownfish' ? null : MOTIFS[RANK_TO_MOTIF[power] as keyof typeof MOTIFS];
  const notes = motif?.full ?? (power === 'clownfish' ? [{ note: 81, start: 0.01, dur: 0.2 }, { note: 83, start: 0.22, dur: 0.3 }] : []);
  const secs = motif?.seconds.full ?? 0.6;
  const all = notes.map((n) => n.note);
  const lo = Math.min(...all, 100);
  const hi = Math.max(...all, 0);
  const span = Math.max(1, hi - lo);
  return (
    <svg className="codex__stave" width={STAVE_W} height={STAVE_H} viewBox={`0 0 ${STAVE_W} ${STAVE_H}`} aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.4" opacity="0.55">
        {LINES.map((y) => (
          <line key={y} x1="2" x2={STAVE_W - 2} y1={y} y2={y} />
        ))}
      </g>
      {notes.length === 0 ? (
        // a whole rest hangs from the fourth line: nothing to hear
        <rect x={STAVE_W / 2 - 9} y={LINES[1]} width="18" height="5" fill="currentColor" />
      ) : (
        notes.map((n, i) => {
          const x = 14 + (n.start / secs) * (STAVE_W - 36);
          const y = 38 - ((n.note - lo) / span) * 28;
          const w = Math.max(5, (n.dur / secs) * (STAVE_W - 36) * 0.7);
          return <rect key={i} x={x} y={y - 3} width={w} height="6" fill="currentColor" />;
        })
      )}
    </svg>
  );
}

function PowerRow({ power }: { power: Power }) {
  const { t, rank } = useT();
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const motif = RANK_TO_MOTIF[power];
  const rest = power === 'squid';
  const play = () => {
    const engine = getEngine();
    engine.unlock();
    // Squid shows the rest: an empty stave, no sound - the button still answers, with a flash
    if (!rest && motif) engine.play(`power.used.${motif}`, undefined, { full: true });
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
          <Stave power={power} />
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

/** §5.8 - the Codex: the nine powers, each with its carving, seal, one-line rule and its motif (a button to hear it;
 *  Squid shows the rest). Loaded with the Rules panel, so it costs the table nothing until it is opened. */
export default function Codex() {
  const { t } = useT();
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
