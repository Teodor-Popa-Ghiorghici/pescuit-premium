import { useEffect, useRef } from 'react';
import { useT } from '../i18n/useT.js';
import { stamp } from '../motion.js';
import { useGame } from '../state/store.js';
import { Card } from './Card.js';

/** §6.3 SET_LAID — the plate is pressed into the table the moment it appears,
 *  and never again on a re-render. */
function LaidSetPlate({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    stamp(ref.current);
  }, []);
  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}

/**
 * Sets that have been scored sit under their owner's post, pressed flat at the angle
 * the set id seeds (§4.5). A concealed power set is the wooden back and nothing more
 * — that is the whole point of Mode Ascuns.
 */
export function LaidSets({ ownerId }: { ownerId: string }) {
  const { rank } = useT();
  const { view } = useGame();
  const sets = (view?.laidSets ?? []).filter((s) => s.ownerId === ownerId);
  if (sets.length === 0) return null;

  return (
    <div className="laid-sets">
      {sets.map((s) => (
        <LaidSetPlate key={s.id} className="laid-set">
          <Card
            rank={s.rank}
            size="sm"
            laid
            seed={s.id}
            spent={s.spent && !s.destroyedByMantis}
            destroyed={s.destroyedByMantis}
            faceDown={s.rank === null}
            title={s.rank ? rank(s.rank) : undefined}
          />
        </LaidSetPlate>
      ))}
    </div>
  );
}
