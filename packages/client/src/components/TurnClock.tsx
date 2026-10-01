import type { RedactedView } from '@pescuit/engine';
import { useEffect, useMemo, useState } from 'react';
import { getEngine } from '../audio/engine.js';
import { useT } from '../i18n/useT.js';

type Clock = NonNullable<RedactedView['turnClock']>;
type Phase = 'run' | 'rope' | 'out';

/** what is left of the ask, ms, on the server's clock */
function leftOf(clock: Clock): number {
  return clock.deadlineAt - getEngine().server.serverNow(Date.now());
}
function phaseOf(clock: Clock, left = leftOf(clock)): Phase {
  return left <= 0 ? 'out' : left <= clock.ropeMs ? 'rope' : 'run';
}

/** the clock's phase, switched by two timers (no per-frame renders: the drain and the burn are CSS animations) */
export function useTurnPhase(clock: Clock | null): Phase | null {
  const [phase, setPhase] = useState<Phase | null>(() => (clock ? phaseOf(clock) : null));
  useEffect(() => {
    if (!clock) return setPhase(null);
    const left = leftOf(clock);
    setPhase(phaseOf(clock, left));
    const ids: ReturnType<typeof setTimeout>[] = [];
    if (left > clock.ropeMs) ids.push(setTimeout(() => setPhase('rope'), left - clock.ropeMs));
    if (left > 0) ids.push(setTimeout(() => setPhase('out'), left));
    return () => ids.forEach(clearTimeout);
  }, [clock?.deadlineAt, clock?.ropeMs, clock?.totalMs]);
  return phase;
}

/** whole seconds left, re-read four times a second (only the dock's numeral uses it) */
function useSecondsLeft(clock: Clock): number {
  const [s, setS] = useState(() => Math.max(0, Math.ceil(leftOf(clock) / 1000)));
  useEffect(() => {
    const read = () => setS(Math.max(0, Math.ceil(leftOf(clock) / 1000)));
    read();
    const id = setInterval(read, 250);
    return () => clearInterval(id);
  }, [clock.deadlineAt]);
  return s;
}

/** The rope itself: a twisted band that burns from its right end, an ember at the burn and the char left behind.
 *  Mounted when the rope is lit; its animation starts where the clock is, so a late mount is still in step. */
function Rope({ clock }: { clock: Clock }) {
  const style = useMemo(() => {
    const left = Math.max(0, Math.min(clock.ropeMs, leftOf(clock)));
    return { ['--rope-ms' as string]: `${clock.ropeMs}ms`, ['--rope-delay' as string]: `${-(clock.ropeMs - left)}ms` } as React.CSSProperties;
  }, [clock.deadlineAt, clock.ropeMs]);
  return (
    <span className="trope" style={style} aria-hidden="true">
      <span className="trope__char" />
      <span className="trope__band">
        <span className="trope__ember">
          <span className="trope__spark" />
          <span className="trope__spark" />
          <span className="trope__spark" />
        </span>
      </span>
    </span>
  );
}

/**
 * HAND_AND_TURN_PLAN #4-#5: the turn clock over the seat whose ask it is. A drain bar while time is plentiful; the last
 * `ropeMs` it is the rope - lit, burning, gone. `dock` is your own (with the seconds); `seat` an opponent's post or chip.
 * The rope's sounds are the audio engine's (`setTurnRope`, fed by the presenter), not this component's.
 */
export function TurnClock({ clock, variant }: { clock: Clock; variant: 'dock' | 'seat' }) {
  const phase = useTurnPhase(clock);
  const drain = useMemo(() => {
    const left = Math.max(0, Math.min(clock.totalMs, leftOf(clock)));
    return { ['--turn-ms' as string]: `${clock.totalMs}ms`, ['--turn-delay' as string]: `${-(clock.totalMs - left)}ms`, ['--rope-share' as string]: String(clock.ropeMs / clock.totalMs) } as React.CSSProperties;
  }, [clock.deadlineAt, clock.totalMs, clock.ropeMs]);
  if (!phase) return null;
  return (
    <div className={`tclock tclock--${variant} is-${phase}`} style={drain} data-turn-clock={phase}>
      {phase === 'run' && (
        <span className="tclock__track" aria-hidden="true">
          <span className="tclock__fill" />
        </span>
      )}
      {phase === 'rope' && <Rope clock={clock} />}
      {variant === 'dock' && <Seconds clock={clock} phase={phase} />}
    </div>
  );
}

function Seconds({ clock, phase }: { clock: Clock; phase: Phase }) {
  const { t } = useT();
  const s = useSecondsLeft(clock);
  return (
    <span className={`tclock__secs num ${phase === 'rope' ? 'is-rope' : ''}`} role="timer" aria-live="off" aria-label={t('turn.timeLeft', { s })}>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}
