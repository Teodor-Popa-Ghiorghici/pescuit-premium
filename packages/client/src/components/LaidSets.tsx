import { useT } from '../i18n/useT.js';
import { useGame } from '../state/store.js';

export function LaidSets({ ownerId }: { ownerId: string }) {
  const { rank } = useT();
  const { view } = useGame();
  const sets = (view?.laidSets ?? []).filter((s) => s.ownerId === ownerId);
  if (sets.length === 0) return null;
  return (
    <div className="laid-sets">
      {sets.map((s) => (
        <span
          key={s.id}
          className={`laid-set ${s.isPowerSet ? 'laid-set--power' : ''} ${s.destroyedByMantis ? 'laid-set--destroyed' : ''}`}
          title={s.rank ? rank(s.rank) : undefined}
        >
          {s.rank ? rank(s.rank) : '?'}
          {s.isPowerSet && !s.spent && !s.destroyedByMantis && s.rank && <span className="laid-set__dot" />}
        </span>
      ))}
    </div>
  );
}
